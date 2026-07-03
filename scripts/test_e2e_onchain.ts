import { Noir } from '@noir-lang/noir_js';
import { UltraHonkBackend } from '@aztec/bb.js';
import circuitJson from '../circuits/target/circuits.json';
import {
  generateCommitment,
  generateCommitments,
  computeMerkleRoot,
  getSiblingPath,
  generateNullifier,
  getRecipientFieldElement,
  PAYROLL_CONTRACT_ID,
  RPC_URL,
  NETWORK_PASSPHRASE
} from '../lib/payroll-sdk';
import * as stellarSdk from '@stellar/stellar-sdk';
import { Buffer } from 'buffer';

async function main() {
  const hrSecret = "***REMOVED-LEAKED-SECRET***";
  const hrKeypair = stellarSdk.Keypair.fromSecret(hrSecret);
  const hrAddress = hrKeypair.publicKey();
  console.log("HR Address:", hrAddress);

  // 1. Define payroll batch entries
  const employees = [
    { name: "Alice", amount: 50, publicKey: "111222", salt: "333444" },
    { name: "Bob", amount: 75, publicKey: "555666", salt: "777888" },
  ];

  const commitments = generateCommitments(employees);
  const totalAmount = employees.reduce((sum, e) => sum + e.amount, 0);
  const newRoot = computeMerkleRoot(commitments);
  const cleanRoot = newRoot.startsWith("0x") ? newRoot.slice(2) : newRoot;

  console.log("Computed Merkle Root for disbursement:", newRoot);

  const server = new stellarSdk.rpc.Server(RPC_URL);
  const contract = new stellarSdk.Contract("CAFRROTQNRVUQO6XBH4QFH57QAALGQXK336GV2BZR6HEITNLKWJSHLX3");

  // 2. Submit disburse_batch on-chain
  console.log("Submitting disburse_batch transaction on-chain...");
  const disburseArgs = [
    new stellarSdk.Address(hrAddress).toScVal(),
    stellarSdk.xdr.ScVal.scvI128(
      new stellarSdk.xdr.Int128Parts({
        lo: stellarSdk.xdr.Uint64.fromString(String(BigInt(totalAmount) & 0xFFFFFFFFFFFFFFFFn)),
        hi: stellarSdk.xdr.Int64.fromString(String(BigInt(totalAmount) >> 64n)),
      })
    ),
    stellarSdk.xdr.ScVal.scvBytes(Buffer.from(cleanRoot, "hex")),
  ];

  const hrAccount = await server.getAccount(hrAddress);
  let disburseTx = new stellarSdk.TransactionBuilder(hrAccount, {
    fee: "100000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call("disburse_batch", ...disburseArgs))
    .setTimeout(300)
    .build();

  disburseTx = await server.prepareTransaction(disburseTx);
  disburseTx.sign(hrKeypair);

  const disburseResult = await server.sendTransaction(disburseTx);
  if (disburseResult.status === "ERROR") {
    throw new Error(`Disbursement transaction failed: ${disburseResult.errorResult?.toXDR().toString("hex")}`);
  }
  console.log("Disbursement Tx submitted! Hash:", disburseResult.hash);

  // Wait for disbursement tx to resolve
  let disburseTxStatus = await server.getTransaction(disburseResult.hash);
  while (disburseTxStatus.status === stellarSdk.rpc.Api.GetTransactionStatus.NOT_FOUND) {
    console.log("Waiting for disbursement transaction to resolve...");
    await new Promise((r) => setTimeout(r, 1000));
    disburseTxStatus = await server.getTransaction(disburseResult.hash);
  }
  console.log("Disbursement Transaction Final Status:", disburseTxStatus.status);
  if (disburseTxStatus.status !== stellarSdk.rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error("Disbursement transaction failed on-chain.");
  }

  // 3. Generate a recipient keypair that satisfies the BN254 modulus
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

  // Fund recipient via Friendbot
  console.log("Funding recipient account via Friendbot...");
  const friendbotUrl = `https://friendbot.stellar.org/?addr=${recipientAddress}`;
  const fundRes = await fetch(friendbotUrl);
  if (!fundRes.ok) {
    throw new Error(`Failed to fund recipient: ${await fundRes.text()}`);
  }
  console.log("Recipient funded successfully!");

  // 4. Generate ZK Proof for Alice (index 0)
  const alice = employees[0];
  const siblingPath = getSiblingPath(commitments, 0);
  const nullifier = generateNullifier(alice.publicKey, alice.salt);

  const inputs = {
    root: newRoot,
    nullifier,
    recipient: recipientHex,
    amount: `0x${BigInt(alice.amount).toString(16)}`,
    secret_key: `0x${BigInt(alice.publicKey).toString(16)}`,
    salt: `0x${BigInt(alice.salt).toString(16)}`,
    index: `0x0`,
    hash_path: siblingPath,
  };

  console.log("Generating witness for Alice...");
  const noir = new Noir(circuitJson as any);
  const { witness } = await noir.execute(inputs);

  console.log("Generating ZK Honk proof for Alice...");
  const { Barretenberg } = await import("@aztec/bb.js");
  const barretenbergAPI = await Barretenberg.new({ threads: 1 });
  await barretenbergAPI.initSRSChonk();
  const backend = new UltraHonkBackend(circuitJson.bytecode, barretenbergAPI);
  const proofs = await backend.generateProof(witness);
  console.log("ZK Proof generated successfully! Length:", proofs.proof.length);

  // 5. Submit claim transaction on-chain
  console.log("Submitting claim transaction on-chain for Alice...");
  const cleanNullifier = nullifier.startsWith("0x") ? nullifier.slice(2) : nullifier;

  const claimArgs = [
    stellarSdk.xdr.ScVal.scvBytes(Buffer.from(cleanRoot, "hex")),
    stellarSdk.xdr.ScVal.scvBytes(Buffer.from(cleanNullifier, "hex")),
    new stellarSdk.Address(recipientAddress).toScVal(),
    stellarSdk.xdr.ScVal.scvI128(
      new stellarSdk.xdr.Int128Parts({
        lo: stellarSdk.xdr.Uint64.fromString(String(BigInt(alice.amount) & 0xFFFFFFFFFFFFFFFFn)),
        hi: stellarSdk.xdr.Int64.fromString(String(BigInt(alice.amount) >> 64n)),
      })
    ),
    stellarSdk.xdr.ScVal.scvBytes(Buffer.from(proofs.proof)),
  ];

  const recipientAccount = await server.getAccount(recipientAddress);
  let claimTx = new stellarSdk.TransactionBuilder(recipientAccount, {
    fee: "100000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call("claim", ...claimArgs))
    .setTimeout(300)
    .build();

  console.log("Preparing claim transaction...");
  claimTx = await server.prepareTransaction(claimTx);
  claimTx.sign(recipientKeypair);

  console.log("Submitting claim transaction to Stellar Testnet...");
  const claimResult = await server.sendTransaction(claimTx);
  if (claimResult.status === "ERROR") {
    throw new Error(`Claim transaction failed: ${claimResult.errorResult?.toXDR().toString("hex")}`);
  }
  console.log("Claim Tx submitted! Hash:", claimResult.hash);

  // Wait for claim tx to resolve
  let claimTxStatus = await server.getTransaction(claimResult.hash);
  while (claimTxStatus.status === stellarSdk.rpc.Api.GetTransactionStatus.NOT_FOUND) {
    console.log("Waiting for claim transaction to resolve...");
    await new Promise((r) => setTimeout(r, 1000));
    claimTxStatus = await server.getTransaction(claimResult.hash);
  }
  console.log("Claim Transaction Final Status:", claimTxStatus.status);
  if (claimTxStatus.status === stellarSdk.rpc.Api.GetTransactionStatus.SUCCESS) {
    console.log("🎉 ON-CHAIN END-TO-END VERIFICATION SUCCESSFUL!");
    console.log(`Successfully claimed ${alice.amount} tokens for ${alice.name} privately on-chain!`);
  } else {
    console.error("❌ Claim transaction execution failed on-chain.");
  }
}

main().catch(console.error);
