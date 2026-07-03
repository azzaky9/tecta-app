import * as fs from 'fs';
import {
  generateCommitments,
  computeMerkleRoot,
  getSiblingPath,
  generateNullifier,
  getRecipientFieldElement,
} from '../lib/payroll-sdk';
import * as stellarSdk from '@stellar/stellar-sdk';

// Same as in the E2E script
const EMPLOYEES = [
  { name: 'Alice', amount: 50, publicKey: '111222', salt: '333444' },
  { name: 'Bob',   amount: 75, publicKey: '555666', salt: '777888' },
];

async function main() {
  const commitments = generateCommitments(EMPLOYEES);
  const merkleRoot  = computeMerkleRoot(commitments);
  const siblingPath = getSiblingPath(commitments, 0);
  const nullifierHex = generateNullifier(EMPLOYEES[0].publicKey, EMPLOYEES[0].salt);
  
  // Pick a stable pre-generated BN254-compatible recipient address for deterministic testing
  // GAVOLWOAUQHQYGNH7G2MR7IDQUNWKTMLXACGF4RWQSMAGCHPDPH57BQE -> 0x2ae5d9... (was in a previous run)
  // For this test let's pick one that's reliable
  let recipientHex: string;
  let recipientAddress: string;
  
  // Try to find a consistent one
  const candidateKeypairs = [
    'SDASWFAS2QE2MBLDAHFHMNUXKJQJSJFQ4DLAQVMKM2VLVSEDMDIMYJT',
    'SDUVGQBLF3SXBFVSCBKPIYKKQ5FGLHQJLF2YBPKZ4RAQPJRYZJYWQM',
  ];
  
  let keypair: stellarSdk.Keypair | null = null;
  for (let i = 0; i < 100; i++) {
    const kp = stellarSdk.Keypair.random();
    const pub = kp.publicKey();
    try {
      recipientHex = await getRecipientFieldElement(pub);
      recipientAddress = pub;
      keypair = kp;
      break;
    } catch (_) {}
  }

  console.log('Merkle Root:', merkleRoot);
  console.log('Nullifier:', nullifierHex);
  console.log('Recipient Stellar Address:', recipientAddress!);
  console.log('Recipient Field:', recipientHex!);
  console.log('Amount:', EMPLOYEES[0].amount);
  console.log('Sibling Path:', siblingPath);

  // Write input.json for stellar-zk prove
  const inputJson = {
    root: merkleRoot,
    nullifier: nullifierHex,
    recipient: recipientHex!,
    amount: String(EMPLOYEES[0].amount),
    secret_key: BigInt(EMPLOYEES[0].publicKey).toString(),
    salt: BigInt(EMPLOYEES[0].salt).toString(),
    index: "0",
    hash_path: siblingPath,
  };
  
  fs.writeFileSync('/home/azxky9/hackathon/tecta-wasm/inputs/alice_input.json', JSON.stringify(inputJson, null, 2));
  console.log('\nWrote alice_input.json');
  console.log('Recipient Secret Key:', keypair!.secret());
}

main().catch(console.error);
