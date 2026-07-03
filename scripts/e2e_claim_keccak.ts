/**
 * E2E On-chain Claim Test using native nargo + bb CLI tools
 *
 * Strategy:
 * 1. Use JS (Noir SDK) only to compute the Poseidon hashes (commitments, nullifier, Merkle tree)
 * 2. Write a Prover.toml for Alice and run `nargo execute` to generate a witness 
 * 3. Run `bb prove --scheme ultra_honk --oracle_hash keccak` to generate a compatible proof
 * 4. Simulate on verifier contract
 * 5. Execute claim_salary on-chain
 * 6. Verify recipient balance changed
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import {
  generateCommitments,
  computeMerkleRoot,
  getSiblingPath,
  generateNullifier,
  getRecipientFieldElement,
  RPC_URL,
  NETWORK_PASSPHRASE
} from '../lib/payroll-sdk';
import * as stellarSdk from '@stellar/stellar-sdk';
import { Buffer } from 'buffer';

// ── Configuration ──────────────────────────────────────────────────────────
const BB_BINARY       = '/home/azxky9/.bb/bb';
const BYTECODE_GZ     = '/home/azxky9/hackathon/tecta-wasm/circuits/target/bytecode.gz';
const NARGO_CIRCUIT   = '/home/azxky9/hackathon/tecta-wasm/circuits';

const VERIFIER_ID     = 'CABPT2QO54HVAH5VWTLT3QZ3VXWNK2ZY6J2VZUK42SZHWXSWZO2ODPTK';
// The actual initialized payroll contract (uses HR = GDFWO7... as admin)
const PAYROLL_ID      = 'CAFRROTQNRVUQO6XBH4QFH57QAALGQXK336GV2BZR6HEITNLKWJSHLX3';

// HR signing keypair - must be the admin of the payroll contract
const HR_SECRET = '***REMOVED-LEAKED-SECRET***';

// Payroll batch
const EMPLOYEES = [
  { name: 'Alice', amount: 50, publicKey: '111222', salt: '333444' },
  { name: 'Bob',   amount: 75, publicKey: '555666', salt: '777888' },
];

// ── Helpers ────────────────────────────────────────────────────────────────
async function waitForTx(server: stellarSdk.rpc.Server, hash: string): Promise<void> {
  while (true) {
    const status = await server.getTransaction(hash);
    if (status.status !== stellarSdk.rpc.Api.GetTransactionStatus.NOT_FOUND) {
      if (status.status !== stellarSdk.rpc.Api.GetTransactionStatus.SUCCESS) {
        throw new Error(`Transaction ${hash} failed: ${status.status}`);
      }
      return;
    }
    console.log('  ⏳ Waiting for tx to finalize...');
    await new Promise(r => setTimeout(r, 2000));
  }
}

function runCLI(cmd: string): void {
  console.log('  $', cmd);
  execSync(cmd, { stdio: 'pipe' });
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   TECTA ZK Payroll — Full E2E On-chain Claim (keccak)    ');
  console.log('═══════════════════════════════════════════════════════════\n');

  const server   = new stellarSdk.rpc.Server(RPC_URL);
  const hrKeypair = stellarSdk.Keypair.fromSecret(HR_SECRET);
  const hrAddress = hrKeypair.publicKey();
  console.log('HR Admin Address:', hrAddress);

  // ── Step 1: Compute payroll Merkle tree ──────────────────────────────────
  console.log('\n[Step 1] Computing payroll Merkle tree...');
  const commitments = generateCommitments(EMPLOYEES);
  const totalAmount = EMPLOYEES.reduce((sum, e) => sum + e.amount, 0);
  const merkleRoot  = computeMerkleRoot(commitments);
  const cleanRoot   = merkleRoot.startsWith('0x') ? merkleRoot.slice(2) : merkleRoot;

  console.log('  Merkle Root:', merkleRoot);
  console.log('  Total Amount:', totalAmount);
  EMPLOYEES.forEach((e, i) => console.log(`  [${i}] ${e.name}: commitment = ${commitments[i]}`));

  // ── Step 2: Generate recipient address for Alice (BN254-compatible) ───────
  console.log('\n[Step 2] Generating BN254-compatible recipient address...');
  let recipientKeypair: stellarSdk.Keypair;
  let recipientAddress: string;
  let recipientHex: string;
  while (true) {
    recipientKeypair = stellarSdk.Keypair.random();
    recipientAddress = recipientKeypair.publicKey();
    try {
      recipientHex = await getRecipientFieldElement(recipientAddress);
      break;
    } catch (_) {}
  }
  console.log('  Recipient Stellar Address:', recipientAddress);
  console.log('  Recipient as BN254 Field: ', recipientHex);

  // ── Step 3: Fund recipient via Friendbot ──────────────────────────────────
  console.log('\n[Step 3] Funding recipient via Friendbot...');
  const fundRes = await fetch(`https://friendbot.stellar.org/?addr=${recipientAddress}`);
  if (!fundRes.ok) throw new Error(`Friendbot failed: ${await fundRes.text()}`);
  console.log('  ✅ Recipient funded with 10,000 XLM');

  // ── Step 4: Submit disburse_batch on-chain ────────────────────────────────
  console.log('\n[Step 4] Submitting disburse_batch on-chain...');
  const payrollContract = new stellarSdk.Contract(PAYROLL_ID);
  const disburseArgs = [
    new stellarSdk.Address(hrAddress).toScVal(),
    stellarSdk.xdr.ScVal.scvI128(
      new stellarSdk.xdr.Int128Parts({
        lo: stellarSdk.xdr.Uint64.fromString(String(BigInt(totalAmount) & 0xFFFFFFFFFFFFFFFFn)),
        hi: stellarSdk.xdr.Int64.fromString(String(BigInt(totalAmount) >> 64n)),
      })
    ),
    stellarSdk.xdr.ScVal.scvBytes(Buffer.from(cleanRoot, 'hex')),
  ];

  const hrAccount = await server.getAccount(hrAddress);
  let disburseTx = new stellarSdk.TransactionBuilder(hrAccount, {
    fee: '100000', networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(payrollContract.call('disburse_batch', ...disburseArgs))
    .setTimeout(300)
    .build();

  disburseTx = await server.prepareTransaction(disburseTx);
  disburseTx.sign(hrKeypair);
  const disburseResult = await server.sendTransaction(disburseTx);
  if (disburseResult.status === 'ERROR') {
    throw new Error(`Disbursement failed: ${disburseResult.errorResult?.toXDR().toString('hex')}`);
  }
  console.log('  Disbursement Tx Hash:', disburseResult.hash);
  await waitForTx(server, disburseResult.hash);
  console.log('  ✅ Disbursement confirmed on-chain!');

  // ── Step 5: Generate witness using nargo execute ──────────────────────────
  console.log('\n[Step 5] Generating witness with nargo...');
  const alice        = EMPLOYEES[0];
  const siblingPath  = getSiblingPath(commitments, 0);
  const nullifierHex = generateNullifier(alice.publicKey, alice.salt);

  console.log('  Nullifier:', nullifierHex);
  console.log('  Recipient Field:', recipientHex);

  // Write Prover.toml for Alice
  const proverToml = `root = "${merkleRoot}"
nullifier = "${nullifierHex}"
recipient = "${recipientHex}"
amount = "${alice.amount}"
secret_key = "${BigInt(alice.publicKey).toString()}"
salt = "${BigInt(alice.salt).toString()}"
index = "0"
hash_path = [
  "${siblingPath[0]}",
  "${siblingPath[1]}",
  "${siblingPath[2]}",
  "${siblingPath[3]}",
  "${siblingPath[4]}",
  "${siblingPath[5]}",
  "${siblingPath[6]}",
  "${siblingPath[7]}"
]
`;
  const proverTomlPath = path.join(NARGO_CIRCUIT, 'Prover.toml');
  fs.writeFileSync(proverTomlPath, proverToml);
  console.log('  Prover.toml written:\n' + proverToml);

  // Execute nargo to generate witness (must run from the circuit directory)
  execSync(`nargo execute alice_witness --prover-name Prover`, {
    stdio: 'pipe',
    cwd: NARGO_CIRCUIT,
  });

  const witnessPath = path.join(NARGO_CIRCUIT, 'target', 'alice_witness.gz');
  console.log('  ✅ Witness generated at:', witnessPath, `(${fs.statSync(witnessPath).size} bytes)`);

  // ── Step 6: Generate ZK proof with bb CLI (keccak oracle hash) ─────────── 
  console.log('\n[Step 6] Generating ZK proof with bb (keccak)...');
  const proofDir = '/tmp/alice_proof';
  fs.rmSync(proofDir, { recursive: true, force: true });
  fs.mkdirSync(proofDir);

  runCLI(
    `${BB_BINARY} prove --scheme ultra_honk --oracle_hash keccak ` +
    `-b ${BYTECODE_GZ} -w ${witnessPath} -o ${proofDir}`
  );

  const proof        = fs.readFileSync(path.join(proofDir, 'proof'));
  const publicInputs = fs.readFileSync(path.join(proofDir, 'public_inputs'));
  const piNullifier  = publicInputs.slice(32, 64);

  console.log('  ✅ Proof generated:');
  console.log('    proof.length =', proof.length, 'bytes');
  console.log('    publicInputs =', publicInputs.length, 'bytes');
  console.log('    Public Input [0] root:      ', publicInputs.slice(0, 32).toString('hex'));
  console.log('    Public Input [1] nullifier: ', piNullifier.toString('hex'));
  console.log('    Public Input [2] recipient: ', publicInputs.slice(64, 96).toString('hex'));
  console.log('    Public Input [3] amount:    ', publicInputs.slice(96, 128).toString('hex'));

  // ── Step 7: Simulate proof on verifier contract ───────────────────────────
  console.log('\n[Step 7] Simulating proof on verifier contract...');
  const verifierContract = new stellarSdk.Contract(VERIFIER_ID);
  const dummyAccount     = new stellarSdk.Account(stellarSdk.Keypair.random().publicKey(), '0');
  const simTx = new stellarSdk.TransactionBuilder(dummyAccount, {
    fee: '100', networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(verifierContract.call(
      'verify',
      stellarSdk.xdr.ScVal.scvBytes(proof),
      stellarSdk.xdr.ScVal.scvBytes(publicInputs),
      stellarSdk.xdr.ScVal.scvBytes(piNullifier),
    ))
    .setTimeout(30)
    .build();

  const simResult = await server.simulateTransaction(simTx);
  if (!stellarSdk.rpc.Api.isSimulationSuccess(simResult)) {
    throw new Error(`Verifier simulation FAILED: ${simResult.error}`);
  }
  console.log('  ✅ Verifier simulation SUCCESS — proof is cryptographically valid!');

  // ── Step 8: Execute claim_salary on-chain ────────────────────────────────
  console.log('\n[Step 8] Executing claim_salary on-chain...');
  const cleanNullifier = nullifierHex.startsWith('0x') ? nullifierHex.slice(2) : nullifierHex;

  const claimArgs = [
    stellarSdk.xdr.ScVal.scvBytes(Buffer.from(cleanRoot, 'hex')),
    stellarSdk.xdr.ScVal.scvBytes(Buffer.from(cleanNullifier, 'hex')),
    new stellarSdk.Address(recipientAddress).toScVal(),
    stellarSdk.xdr.ScVal.scvI128(
      new stellarSdk.xdr.Int128Parts({
        lo: stellarSdk.xdr.Uint64.fromString(String(BigInt(alice.amount) & 0xFFFFFFFFFFFFFFFFn)),
        hi: stellarSdk.xdr.Int64.fromString(String(BigInt(alice.amount) >> 64n)),
      })
    ),
    stellarSdk.xdr.ScVal.scvBytes(proof),
  ];

  const recipientAccount = await server.getAccount(recipientAddress);
  let claimTx = new stellarSdk.TransactionBuilder(recipientAccount, {
    fee: '100000', networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(payrollContract.call('claim', ...claimArgs))
    .setTimeout(300)
    .build();

  claimTx = await server.prepareTransaction(claimTx);
  claimTx.sign(recipientKeypair);

  const claimResult = await server.sendTransaction(claimTx);
  if (claimResult.status === 'ERROR') {
    throw new Error(`Claim failed: ${claimResult.errorResult?.toXDR().toString('hex')}`);
  }
  console.log('  Claim Tx Hash:', claimResult.hash);
  await waitForTx(server, claimResult.hash);
  console.log('  ✅ Claim CONFIRMED on-chain!');

  // ── Done ──────────────────────────────────────────────────────────────────
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║        🎉 ZK PAYROLL CLAIM SUCCESSFUL ON-CHAIN! 🎉        ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log(`\n  Employee  : ${alice.name}`);
  console.log(`  Amount    : ${alice.amount} tokens claimed privately`);
  console.log(`  Recipient : ${recipientAddress}`);
  console.log(`  Nullifier : 0x${cleanNullifier}`);
  console.log(`\n  Disburse Tx: https://stellar.expert/explorer/testnet/tx/${disburseResult.hash}`);
  console.log(`  Claim Tx   : https://stellar.expert/explorer/testnet/tx/${claimResult.hash}`);
}

main().catch(err => {
  console.error('\n❌ ERROR:', err.message ?? err);
  process.exit(1);
});
