import { Noir } from '@noir-lang/noir_js';
import { UltraHonkBackend } from '@aztec/bb.js';
import circuitJson from '../circuits/target/circuits.json';
import { generateCommitments, getSiblingPath, generateNullifier, getRecipientFieldElement } from '../lib/payroll-sdk';
import { Buffer } from 'buffer';

async function main() {
  const employees = [
    { name: "Alice", amount: 50, publicKey: "111222", salt: "333444" },
    { name: "Bob", amount: 75, publicKey: "555666", salt: "777888" },
  ];

  const commitments = generateCommitments(employees);
  const recipientAddress = "GABBRMQNWDYLAM275BKHVGBNGO7CYIXS75AVD4TEZWJCD5EXS4DJAMJT";
  const recipientHex = await getRecipientFieldElement(recipientAddress);

  const alice = employees[0];
  const siblingPath = getSiblingPath(commitments, 0);
  const nullifier = generateNullifier(alice.publicKey, alice.salt);
  const root = "0x2537c7f5ff988a2304d105180be21fb1fba0e160e63d88af930d565511ab4058";

  const inputs = {
    root,
    nullifier,
    recipient: recipientHex,
    amount: `0x${BigInt(alice.amount).toString(16)}`,
    secret_key: `0x${BigInt(alice.publicKey).toString(16)}`,
    salt: `0x${BigInt(alice.salt).toString(16)}`,
    index: `0x0`,
    hash_path: siblingPath,
  };

  const noir = new Noir(circuitJson as any);
  const { witness } = await noir.execute(inputs);

  const { Barretenberg } = await import("@aztec/bb.js");
  const barretenbergAPI = await Barretenberg.new({ threads: 1 });
  await barretenbergAPI.initSRSChonk();
  const backend = new UltraHonkBackend(circuitJson.bytecode, barretenbergAPI);
  const proofs = await backend.generateProof(witness);

  console.log("My generated proof length:", proofs.proof.length);
  console.log("My generated proof first 64 bytes (hex):", Buffer.from(proofs.proof.slice(0, 64)).toString('hex'));

  // Let's print the public inputs as well
  const expectedPub = [
    root,
    nullifier,
    recipientHex,
    `0x${BigInt(alice.amount).toString(16).padStart(64, '0')}`
  ];
  console.log("Expected Public Inputs:");
  expectedPub.forEach((p, i) => {
    const cleaned = p.startsWith('0x') ? p.slice(2) : p;
    console.log(`Input ${i}:`, cleaned.padStart(64, '0'));
  });
}

main().catch(console.error);
