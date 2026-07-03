import * as fs from 'fs';
import { Noir } from '@noir-lang/noir_js';
import { UltraHonkBackend } from '@aztec/bb.js';
import circuitJson from '../circuits/target/circuits.json';
import { generateCommitments, getSiblingPath, generateNullifier, getRecipientFieldElement } from '../lib/payroll-sdk';

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

  const refProofPath = '/home/azxky9/hackathon/tecta-wasm/proofs/proof.bin/proof';
  if (fs.existsSync(refProofPath)) {
    const ref = fs.readFileSync(refProofPath);
    console.log("Ref proof length:", ref.length);

    // Let's find first non-zero byte in both
    let myFirstNonZero = -1;
    for (let i = 0; i < proofs.proof.length; i++) {
      if (proofs.proof[i] !== 0) {
        myFirstNonZero = i;
        break;
      }
    }

    let refFirstNonZero = -1;
    for (let i = 0; i < ref.length; i++) {
      if (ref[i] !== 0) {
        refFirstNonZero = i;
        break;
      }
    }

    console.log("My first non-zero byte at index:", myFirstNonZero);
    console.log("Ref first non-zero byte at index:", refFirstNonZero);

    // Compare suffixes
    // If they differ by 64 bytes, let's see if proofs.proof.slice(64) is similar to ref
    const mySlice = proofs.proof.slice(64);
    let match = true;
    for (let i = 0; i < Math.min(mySlice.length, ref.length); i++) {
      if (mySlice[i] !== ref[i]) {
        match = false;
        console.log(`Mismatch at index ${i}: mySlice=${mySlice[i]}, ref=${ref[i]}`);
        if (i > 10) break;
      }
    }
    console.log("Does mySlice (offset 64) match ref proof?", match);
  }
}

main().catch(console.error);
