import { NextRequest, NextResponse } from "next/server";
import * as stellarSdk from "@stellar/stellar-sdk";

/**
 * Sponsored claim: submits claim() using a dedicated sponsor wallet as the
 * transaction source/fee-payer, so employees with a fresh (0 XLM, never
 * funded) wallet can still receive their salary. Safe because the contract's
 * claim() never calls recipient.require_auth() — only the ZK proof and
 * nullifier gate the transfer, so who signs/pays the tx is irrelevant to
 * privacy or authorization. A true CAP-15 fee-bump can't help here anyway:
 * it still requires the inner tx's source account to already exist on-ledger
 * for a sequence number, which a never-funded account doesn't have.
 */
export async function POST(req: NextRequest) {
  try {
    const sponsorSecret = process.env.PAYROLL_SPONSOR_SECRET;
    if (!sponsorSecret) {
      return NextResponse.json(
        { error: "Sponsored claims are not configured (PAYROLL_SPONSOR_SECRET missing)." },
        { status: 500 }
      );
    }

    const { root, nullifier, recipientAddress, amount, proofHex } = await req.json();
    if (!root || !nullifier || !recipientAddress || amount === undefined || !proofHex) {
      return NextResponse.json({ error: "Missing required parameters." }, { status: 400 });
    }

    const { Contract, Address, xdr, TransactionBuilder, rpc, Keypair, BASE_FEE } = stellarSdk;
    const RPC_URL = "https://soroban-testnet.stellar.org:443";
    const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
    const PAYROLL_CONTRACT_ID =
      process.env.STELLAR_PAYROLL_ID ?? "CAFRROTQNRVUQO6XBH4QFH57QAALGQXK336GV2BZR6HEITNLKWJSHLX3";

    const sponsor = Keypair.fromSecret(sponsorSecret);
    const server = new rpc.Server(RPC_URL);
    const contract = new Contract(PAYROLL_CONTRACT_ID);

    const cleanRoot = root.startsWith("0x") ? root.slice(2) : root;
    const cleanNullifier = nullifier.startsWith("0x") ? nullifier.slice(2) : nullifier;
    const rawAmount = BigInt(amount);
    const proofBytes = Buffer.from(proofHex.startsWith("0x") ? proofHex.slice(2) : proofHex, "hex");

    const claimArgs = [
      xdr.ScVal.scvBytes(Buffer.from(cleanRoot, "hex")),
      xdr.ScVal.scvBytes(Buffer.from(cleanNullifier, "hex")),
      new Address(recipientAddress).toScVal(),
      xdr.ScVal.scvI128(
        new xdr.Int128Parts({
          lo: xdr.Uint64.fromString(String(rawAmount & 0xFFFFFFFFFFFFFFFFn)),
          hi: xdr.Int64.fromString(String(rawAmount >> 64n)),
        })
      ),
      xdr.ScVal.scvBytes(proofBytes),
    ];

    const sponsorAccount = await server.getAccount(sponsor.publicKey());
    let tx = new TransactionBuilder(sponsorAccount, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call("claim", ...claimArgs))
      .setTimeout(30)
      .build();

    tx = await server.prepareTransaction(tx);
    tx.sign(sponsor);

    const submitResult = await server.sendTransaction(tx);
    if (submitResult.status === "ERROR") {
      throw new Error(
        submitResult.errorResult?.toXDR().toString("hex") || "Transaction was rejected by the network."
      );
    }

    return NextResponse.json({ success: true, txHash: submitResult.hash });
  } catch (error: any) {
    console.error("Sponsored claim failed:", error);
    return NextResponse.json(
      { error: error.message || "Sponsored claim failed." },
      { status: 500 }
    );
  }
}
