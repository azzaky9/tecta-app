import { Noir } from '@noir-lang/noir_js';
import { UltraHonkBackend } from '@aztec/bb.js';
import circuitJson from '../circuits/target/circuits.json';
import { generateNullifier, getRecipientFieldElement, PAYROLL_CONTRACT_ID, RPC_URL, NETWORK_PASSPHRASE } from '../lib/payroll-sdk';
import * as stellarSdk from '@stellar/stellar-sdk';
import { Buffer } from 'buffer';

async function main() {
  // 1. Generate a new recipient keypair that satisfies the BN254 modulus constraint
  let recipientKeypair;
  let recipientAddress;
  let recipientHex;
  while (true) {
    recipientKeypair = stellarSdk.Keypair.random();
    recipientAddress = recipientKeypair.publicKey();
    try {
      recipientHex = await getRecipientFieldElement(recipientAddress);
      break;
    } catch (e) {}
  }
  console.log("Recipient Address (valid under BN254):", recipientAddress);

  // 2. Fund the recipient account using Friendbot so it exists on-chain
  console.log("Funding recipient account via Friendbot...");
  const friendbotUrl = `https://friendbot.stellar.org/?addr=${recipientAddress}`;
  const fundRes = await fetch(friendbotUrl);
  if (!fundRes.ok) {
    throw new Error(`Failed to fund recipient via Friendbot: ${await fundRes.text()}`);
  }
  console.log("Recipient funded successfully!");
  console.log("Recipient Hex for ZK circuit:", recipientHex);

  // 4. Bob's details from Request 7
  const privateKey = "654720141";
  const salt = "483898";
  const treeIndex = 0;
  const siblingPath = [
    "0x2047357f162ff5cbf24f602a7078bcfdf653bc442832081463f5653d0e8651d3",
    "0x2098f5fb9e239eab3ceac3f27b81e481dc3124d55ffed523a839ee8446b64864",
    "0x1069673dcdb12263df301a6ff584a7ec261a44cb9dc68df067a4774460b1f1e1",
    "0x18f43331537ee2af2e3d758d50f72106467c6eea50371dd528d57eb2b856d238",
    "0x07f9d837cb17b0d36320ffe93ba52345f1b728571a568265caac97559dbc952a",
    "0x2b94cf5e8746b3f5c9631f4c5df32907a699c58c94b2ad4d7b5cec1639183f55",
    "0x2dee93c5a666459646ea7d22cca9e1bcfed71e6951b953611d11dda32ea09d78",
    "0x078295e5a22b84e982cf601eb639597b8b0515a88cb5ac7fa8a4aabe3c87349d"
  ];
  const amount = 1000;
  const root = "0x251a175ba16c870139fb88ba179fda111d3dfbf397d95d6e951ec381294787f0";

  const nullifier = generateNullifier(privateKey, salt);

  const inputs = {
    root,
    nullifier,
    recipient: recipientHex,
    amount: `0x${BigInt(amount).toString(16)}`,
    secret_key: `0x${BigInt(privateKey).toString(16)}`,
    salt: `0x${BigInt(salt).toString(16)}`,
    index: `0x${BigInt(treeIndex).toString(16)}`,
    hash_path: siblingPath,
  };

  console.log("Generating witness...");
  const noir = new Noir(circuitJson as any);
  const { witness } = await noir.execute(inputs);

  console.log("Generating proof...");
  const { Barretenberg } = await import("@aztec/bb.js");
  const barretenbergAPI = await Barretenberg.new({ threads: 1 });
  await barretenbergAPI.initSRSChonk();
  const backend = new UltraHonkBackend(circuitJson.bytecode, barretenbergAPI);
  const proofs = await backend.generateProof(witness);
  console.log("Proof generated successfully! Length:", proofs.proof.length);

  // 5. Submit on-chain claim transaction
  console.log("Connecting to Soroban RPC...");
  const server = new stellarSdk.rpc.Server(RPC_URL);
  const contract = new stellarSdk.Contract(PAYROLL_CONTRACT_ID);

  const cleanRoot = root.startsWith("0x") ? root.slice(2) : root;
  const cleanNullifier = nullifier.startsWith("0x") ? nullifier.slice(2) : nullifier;

  const claimArgs = [
    stellarSdk.xdr.ScVal.scvBytes(Buffer.from(cleanRoot, "hex")),
    stellarSdk.xdr.ScVal.scvBytes(Buffer.from(cleanNullifier, "hex")),
    new stellarSdk.Address(recipientAddress).toScVal(),
    stellarSdk.xdr.ScVal.scvI128(
      new stellarSdk.xdr.Int128Parts({
        lo: stellarSdk.xdr.Uint64.fromString(String(BigInt(amount) & 0xFFFFFFFFFFFFFFFFn)),
        hi: stellarSdk.xdr.Int64.fromString(String(BigInt(amount) >> 64n)),
      })
    ),
    stellarSdk.xdr.ScVal.scvBytes(Buffer.from(proofs.proof)),
  ];

  const sourceAccount = await server.getAccount(recipientAddress);
  let tx = new stellarSdk.TransactionBuilder(sourceAccount, {
    fee: "100000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call("claim", ...claimArgs))
    .setTimeout(300)
    .build();

  console.log("Preparing transaction (simulation & footprints)...");
  tx = await server.prepareTransaction(tx);
  tx.sign(recipientKeypair);

  console.log("Submitting claim transaction to Stellar Testnet...");
  const submitResult = await server.sendTransaction(tx);
  
  if (submitResult.status === "ERROR") {
    throw new Error(
      submitResult.errorResult?.toXDR().toString("hex") || "Transaction was rejected by the network."
    );
  }

  console.log("Claim submitted successfully! Status:", submitResult.status, "TxHash:", submitResult.hash);

  // 6. Check transaction result
  let statusResponse = await server.getTransaction(submitResult.hash);
  while (statusResponse.status === stellarSdk.rpc.Api.GetTransactionStatus.NOT_FOUND) {
    console.log("Waiting for transaction result...");
    await new Promise((r) => setTimeout(r, 1000));
    statusResponse = await server.getTransaction(submitResult.hash);
  }

  console.log("Transaction Final Status:", statusResponse.status);
  if (statusResponse.status === stellarSdk.rpc.Api.GetTransactionStatus.SUCCESS) {
    console.log("✅ ON-CHAIN CLAIM VERIFIED SUCCESSFULLY!");
  } else {
    console.error("❌ On-chain claim execution failed:", statusResponse.resultMetaXdr?.toXDR().toString("hex"));
  }
}

main().catch(console.error);
