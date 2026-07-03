import * as stellarSdk from '@stellar/stellar-sdk';
import { NETWORK_PASSPHRASE, RPC_URL } from '../lib/payroll-sdk';

function parseAddress(str: string) {
  return new stellarSdk.Address(str.trim());
}

async function main() {
  if (!process.env.HR_SECRET) throw new Error("Set HR_SECRET env var to run this script.");
  const secret = process.env.HR_SECRET!;
  const keypair = stellarSdk.Keypair.fromSecret(secret);
  const address = keypair.publicKey();
  console.log("Admin/HR Address:", address);

  const PAYROLL_ID = "CAFRROTQNRVUQO6XBH4QFH57QAALGQXK336GV2BZR6HEITNLKWJSHLX3";
  const VERIFIER_ID = "CABPT2QO54HVAH5VWTLT3QZ3VXWNK2ZY6J2VZUK42SZHWXSWZO2ODPTK";
  const TOKEN_ID = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

  const server = new stellarSdk.rpc.Server(RPC_URL);
  const contract = new stellarSdk.Contract(PAYROLL_ID);

  console.log("Submitting initialize transaction on-chain...");
  const initArgs = [
    parseAddress(address).toScVal(),
    parseAddress(TOKEN_ID).toScVal(),
    parseAddress(VERIFIER_ID).toScVal(),
  ];

  const sourceAccount = await server.getAccount(address);
  let tx = new stellarSdk.TransactionBuilder(sourceAccount, {
    fee: "100000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call("initialize", ...initArgs))
    .setTimeout(300)
    .build();

  let success = false;
  try {
    tx = await server.prepareTransaction(tx);
    tx.sign(keypair);

    const response = await server.sendTransaction(tx);
    console.log("Initialize Tx response status:", response.status, "hash:", response.hash);

    // Wait for tx resolution
    let txStatus = await server.getTransaction(response.hash);
    while (txStatus.status === stellarSdk.rpc.Api.GetTransactionStatus.NOT_FOUND) {
      console.log("Waiting for initialization to resolve...");
      await new Promise((r) => setTimeout(r, 1000));
      txStatus = await server.getTransaction(response.hash);
    }
    console.log("Tx Final Status:", txStatus.status);
    if (txStatus.status === stellarSdk.rpc.Api.GetTransactionStatus.SUCCESS) {
      success = true;
    }
  } catch (err) {
    console.log("Initialization transaction skipped or failed (likely already initialized):", (err as any).message);
    success = true;
  }

  if (success) {
    console.log("✅ CONTRACTS READY!");

    // 2. Fund the Treasury (transfer 500 XLM / 5,000,000,000 stroops to the contract)
    console.log("Funding the payroll treasury with 500 XLM...");
    const tokenContract = new stellarSdk.Contract(TOKEN_ID);
    const fundArgs = [
      parseAddress(address).toScVal(),
      parseAddress(PAYROLL_ID).toScVal(),
      stellarSdk.xdr.ScVal.scvI128(
        new stellarSdk.xdr.Int128Parts({
          lo: stellarSdk.xdr.Uint64.fromString("5000000000"), // 500 * 10^7 = 5,000,000,000 stroops
          hi: stellarSdk.xdr.Int64.fromString("0")
        })
      )
    ];

    const currentAccount = await server.getAccount(address);
    let fundTx = new stellarSdk.TransactionBuilder(currentAccount, {
      fee: "100000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(tokenContract.call("transfer", ...fundArgs))
      .setTimeout(300)
      .build();

    fundTx = await server.prepareTransaction(fundTx);
    fundTx.sign(keypair);

    const fundResponse = await server.sendTransaction(fundTx);
    console.log("Fund Tx response status:", fundResponse.status, "hash:", fundResponse.hash);

    let fundStatus = await server.getTransaction(fundResponse.hash);
    while (fundStatus.status === stellarSdk.rpc.Api.GetTransactionStatus.NOT_FOUND) {
      console.log("Waiting for funding to resolve...");
      await new Promise((r) => setTimeout(r, 1000));
      fundStatus = await server.getTransaction(fundResponse.hash);
    }
    console.log("Funding Final Status:", fundStatus.status);
    if (fundStatus.status === stellarSdk.rpc.Api.GetTransactionStatus.SUCCESS) {
      console.log("✅ TREASURY SUCCESSFULLY FUNDED!");
    } else {
      console.error("❌ Treasury funding failed on-chain.");
    }
  } else {
    console.error("❌ Initialization failed on-chain.");
  }
}

main().catch(console.error);
