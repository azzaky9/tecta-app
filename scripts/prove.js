import { Noir } from '@noir-lang/noir_js';
import { BarretenbergBackend } from '@noir-lang/backend_barretenberg';
import { poseidon1, poseidon2, poseidon3 } from 'poseidon-lite';

function poseidon(inputs) {
  const cleanInputs = inputs.map(i => typeof i === 'string' && i.startsWith('0x') ? BigInt(i) : BigInt(i));
  const len = cleanInputs.length;
  let result;
  if (len === 1) result = poseidon1(cleanInputs);
  else if (len === 2) result = poseidon2(cleanInputs);
  else if (len === 3) result = poseidon3(cleanInputs);
  else throw new Error(`Unsupported Poseidon length: ${len}`);
  
  return '0x' + result.toString(16).padStart(64, '0');
}
import circuitJson from '../circuits/target/circuits.json' assert { type: 'json' };

/**
 * 1. HR Side: Generates commitments for a list of employees to perform a batch disburse
 */
export function generateCommitments(payrollList) {
  // payrollList structure: [{ amount: 1500, publicKey: "...", salt: "..." }]
  return payrollList.map(item => {
    // commitment = Poseidon(amount, publicKey, salt)
    const commitment = poseidon([item.amount, item.publicKey, item.salt]);
    return commitment;
  });
}

/**
 * 2. Employee Side: Generates a proof to claim payroll privately
 */
export async function generateClaimProof(employeeSecrets, publicInputs) {
  // Initialize Noir and the Barretenberg backend
  const backend = new BarretenbergBackend(circuitJson);
  const noir = new Noir(circuitJson);

  // Compute the nullifier locally to submit alongside the proof
  const nullifier = poseidon([employeeSecrets.privateKey, employeeSecrets.salt]);

  const inputs = {
    root: publicInputs.root,                   // Public Merkle Root
    nullifier: nullifier,                     // Nullifier (Poseidon(secret_key, salt))
    recipient: publicInputs.recipientAddress, // Fresh wallet address (represented as Field)
    amount: employeeSecrets.amount,           // Individual salary amount

    // Hidden private inputs
    secret_key: employeeSecrets.privateKey,
    salt: employeeSecrets.salt,
    index: employeeSecrets.treeIndex,
    hash_path: employeeSecrets.siblingPath    // Sibling hashes path
  };

  console.log("Generating Zero-Knowledge claim proof...");
  const { proof, publicInputs: derivedPublicInputs } = await noir.generateProof(inputs);
  
  return {
    proof: Buffer.from(proof).toString('hex'), // Send as hex string to Soroban
    nullifier: nullifier,
    publicInputs: derivedPublicInputs
  };
}
