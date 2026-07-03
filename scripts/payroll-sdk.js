import { Keypair, Contract, Address, xdr, TransactionBuilder, Networks } from '@stellar/stellar-sdk';
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
  
  return BigInt(result);
}
import circuitJson from '../circuits/target/circuits.json' assert { type: 'json' };

const FIELD_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

// ==========================================
// 1. COMMITMENT & NULLIFIER GENERATION
// ==========================================

/**
 * Derives the ZK public key from a secret key.
 */
export function deriveZkPublicKey(secretKey) {
  return poseidon([BigInt(secretKey)]);
}

/**
 * Computes a leaf commitment for the Merkle tree.
 * Commitment = Poseidon(amount, Poseidon(secret_key), salt)
 */
export function generateCommitment(amount, secretKey, salt) {
  const zkPublicKey = deriveZkPublicKey(secretKey);
  const commitment = poseidon([BigInt(amount), zkPublicKey, BigInt(salt)]);
  return '0x' + commitment.toString(16).padStart(64, '0');
}

/**
 * Computes the unique nullifier to prevent double-spending.
 * Nullifier = Poseidon(secret_key, salt)
 */
export function generateNullifier(secretKey, salt) {
  const nullifier = poseidon([BigInt(secretKey), BigInt(salt)]);
  return '0x' + nullifier.toString(16).padStart(64, '0');
}

/**
 * Decodes a Stellar G-address to its 32-byte hex public key
 * and checks if it satisfies the BN254 field modulus constraint.
 */
export function getRecipientFieldElement(gAddress) {
  const keypair = Keypair.fromPublicKey(gAddress);
  const rawBytes = keypair.rawPublicKey();
  
  let hex = '0x' + Array.from(rawBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const value = BigInt(hex);
  
  if (value >= FIELD_MODULUS) {
    throw new Error(
      `Recipient address exceeds BN254 modulus. Please use a compatible address (starts with GA).`
    );
  }
  return hex;
}

// ==========================================
// 2. HR DISBURSEMENT (FRONTEND WALLET)
// ==========================================

/**
 * Calls disburse_batch on the smart contract using a connected wallet (e.g. Freighter).
 * 
 * @param {object} walletConnection - The connected wallet instance ( Freighter / Rabe / etc. )
 * @param {string} contractId - The deployed Shielded Payroll contract ID
 * @param {number|string} totalAmount - Total amount to disburse (in stroops)
 * @param {string[]} commitments - Array of commitment hex strings (e.g. ["0x12a...", "0x34b..."])
 * @param {string} hrAddress - HR wallet address
 * @param {string} networkPassphrase - Testnet passphrase
 * @param {string} rpcUrl - Soroban RPC URL
 */
export async function disbursePayrollBatch(
  walletConnection,
  contractId,
  totalAmount,
  commitments,
  hrAddress,
  networkPassphrase = "Test SDF Testnet ; September 2015",
  rpcUrl = "https://soroban-testnet.stellar.org:443"
) {
  // Convert commitments array of hex strings to Soroban ScVal bytes array
  const scCommitments = commitments.map(comm => {
    const cleanHex = comm.startsWith('0x') ? comm.slice(2) : comm;
    return xdr.ScVal.scvBytes(Buffer.from(cleanHex, 'hex'));
  });

  const contract = new Contract(contractId);
  const disburseArgs = [
    new Address(hrAddress).toScVal(),
    xdr.ScVal.scvI128(xdr.Int128Parts.fromBigInt(BigInt(totalAmount))),
    xdr.ScVal.scvVec(scCommitments)
  ];

  // 1. Fetch current account sequence from RPC
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getAccount",
      params: { address: hrAddress }
    })
  });
  const accountData = await response.json();
  const sequence = accountData.result.sequence;

  // 2. Build Transaction
  let tx = new TransactionBuilder(
    new Address(hrAddress), 
    { fee: "100000", networkPassphrase }
  )
    .addOperation(contract.call('disburse_batch', ...disburseArgs))
    .setTimeout(30)
    .build();

  // 3. Request wallet to sign and submit transaction
  console.log("Signing and submitting disburse_batch transaction via wallet...");
  const signedTxXdr = await walletConnection.signTransaction(tx.toXDR(), {
    networkPassphrase
  });

  // 4. Send transaction to the Soroban RPC
  const submitResponse = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "sendTransaction",
      params: { transaction: signedTxXdr }
    })
  });
  
  const submitResult = await submitResponse.json();
  return submitResult.result;
}

// ==========================================
// 3. EMPLOYEE CLAIM (BROWSER PROVING & WALLET)
// ==========================================

/**
 * Generates the ZK Proof locally in the browser.
 * 
 * @param {object} secrets - { privateKey, salt, treeIndex, siblingPath }
 * @param {object} publicInputs - { root, nullifier, recipientAddress, amount }
 */
export async function generateClaimProofLocal(secrets, publicInputs) {
  const backend = new BarretenbergBackend(circuitJson);
  const noir = new Noir(circuitJson);

  const recipientHex = getRecipientFieldElement(publicInputs.recipientAddress);
  const rootHex = publicInputs.root.startsWith('0x') ? publicInputs.root : `0x${publicInputs.root}`;
  const nullifierHex = publicInputs.nullifier.startsWith('0x') ? publicInputs.nullifier : `0x${publicInputs.nullifier}`;

  const inputs = {
    root: rootHex,
    nullifier: nullifierHex,
    recipient: recipientHex,
    amount: secrets.amount,
    secret_key: secrets.privateKey,
    salt: secrets.salt,
    index: secrets.treeIndex,
    hash_path: secrets.siblingPath // [Field; 8] sibling hashes
  };

  console.log("Generating ZK Claim Proof locally in browser...");
  const { proof } = await noir.generateProof(inputs);
  return proof; // Raw proof bytes (Uint8Array)
}

/**
 * Submits the claim to the smart contract using a connected wallet.
 */
export async function claimSalary(
  walletConnection,
  contractId,
  root,
  nullifier,
  recipientAddress,
  amount,
  proofBytes,
  networkPassphrase = "Test SDF Testnet ; September 2015",
  rpcUrl = "https://soroban-testnet.stellar.org:443"
) {
  const contract = new Contract(contractId);

  const cleanRoot = root.startsWith('0x') ? root.slice(2) : root;
  const cleanNullifier = nullifier.startsWith('0x') ? nullifier.slice(2) : nullifier;

  const claimArgs = [
    xdr.ScVal.scvBytes(Buffer.from(cleanRoot, 'hex')),
    xdr.ScVal.scvBytes(Buffer.from(cleanNullifier, 'hex')),
    new Address(recipientAddress).toScVal(),
    xdr.ScVal.scvI128(xdr.Int128Parts.fromBigInt(BigInt(amount))),
    xdr.ScVal.scvBytes(proofBytes)
  ];

  // Build Transaction
  let tx = new TransactionBuilder(
    new Address(recipientAddress), 
    { fee: "100000", networkPassphrase }
  )
    .addOperation(contract.call('claim', ...claimArgs))
    .setTimeout(30)
    .build();

  // Sign with wallet
  console.log("Signing claim transaction via wallet...");
  const signedTxXdr = await walletConnection.signTransaction(tx.toXDR(), {
    networkPassphrase
  });

  // Submit to RPC
  const submitResponse = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 3,
      method: "sendTransaction",
      params: { transaction: signedTxXdr }
    })
  });
  
  const submitResult = await submitResponse.json();
  return submitResult.result;
}
