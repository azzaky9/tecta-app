/**
 * Full end-to-end flow on Stellar Testnet against the DEPLOYED contracts:
 *   1. HR disburses a fresh payroll batch (new salts → new root)
 *   2. Employee (Zac) generates a ZK proof locally (nargo beta.9 + bb 0.87, same as the API route)
 *   3. Employee claims salary to their own wallet
 *
 * Run: npx tsx scripts/e2e_full_flow.mts
 */
import * as sdk from '@stellar/stellar-sdk';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  generateCommitments, computeMerkleRoot, getSiblingPath, generateNullifier,
  getRecipientFieldElement, PAYROLL_CONTRACT_ID, RPC_URL, NETWORK_PASSPHRASE,
} from '../lib/payroll-sdk';

const HR_SECRET = '***REMOVED-LEAKED-SECRET***';
const RECIPIENT = 'GAMIBC4Q6BSBZPQYN74P6UUOK4NCHNDTMWYMAUJIY6QX7W6JNS64WOHT';
const RECIPIENT_SECRET = process.env.RECIPIENT_SECRET; // employee_test key; falls back to HR as tx source

// Fresh salts each run so nullifiers never collide
const runSalt = String(100000 + Math.floor(Math.random() * 900000));
const EMPLOYEES = [
  { name: 'Zac', amount: 1000, publicKey: '172256170', salt: runSalt },
  { name: 'Josh', amount: 450, publicKey: '749373417', salt: String(Number(runSalt) + 1) },
];

const NARGO_DIR = '/home/azxky9/hackathon/tecta-wasm/circuits';
const BB = '/home/azxky9/.bb/bb';
const LIBPATH = '/home/azxky9/libcpp/usr/lib/llvm-18/lib:/home/azxky9/libcpp/usr/lib/x86_64-linux-gnu';

async function waitTx(server: sdk.rpc.Server, hash: string) {
  for (;;) {
    const s = await server.getTransaction(hash);
    if (s.status !== sdk.rpc.Api.GetTransactionStatus.NOT_FOUND) {
      if (s.status !== sdk.rpc.Api.GetTransactionStatus.SUCCESS)
        throw new Error(`tx ${hash} failed: ${s.status} ${JSON.stringify((s as any).resultXdr ?? '')}`);
      return;
    }
    await new Promise(r => setTimeout(r, 1500));
  }
}

function i128(v: bigint) {
  return sdk.xdr.ScVal.scvI128(new sdk.xdr.Int128Parts({
    lo: sdk.xdr.Uint64.fromString(String(v & 0xFFFFFFFFFFFFFFFFn)),
    hi: sdk.xdr.Int64.fromString(String(v >> 64n)),
  }));
}

async function main() {
  const server = new sdk.rpc.Server(RPC_URL);
  const contract = new sdk.Contract(PAYROLL_CONTRACT_ID);
  const hr = sdk.Keypair.fromSecret(HR_SECRET);

  // ── 1. Disburse ──
  const commitments = generateCommitments(EMPLOYEES);
  const total = EMPLOYEES.reduce((s, e) => s + e.amount, 0);
  const root = computeMerkleRoot(commitments);
  console.log('[1] Disbursing batch. root =', root, 'total =', total);

  let tx = new sdk.TransactionBuilder(await server.getAccount(hr.publicKey()), {
    fee: '1000000', networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call('disburse_batch',
      new sdk.Address(hr.publicKey()).toScVal(),
      i128(BigInt(total)),
      sdk.xdr.ScVal.scvBytes(Buffer.from(root.slice(2), 'hex')),
    ))
    .setTimeout(120).build();
  tx = await server.prepareTransaction(tx);
  tx.sign(hr);
  const dres = await server.sendTransaction(tx);
  if (dres.status === 'ERROR') throw new Error('disburse rejected: ' + dres.errorResult?.toXDR('hex'));
  await waitTx(server, dres.hash);
  console.log('    disburse SUCCESS:', dres.hash);

  // ── 2. Prove (identical to /api/generate-proof) ──
  const zac = EMPLOYEES[0];
  const nullifier = generateNullifier(zac.publicKey, zac.salt);
  const recipientHex = await getRecipientFieldElement(RECIPIENT);
  const hashPath = getSiblingPath(commitments, 0);

  const dir = fs.mkdtempSync('/tmp/e2e_proof_');
  fs.writeFileSync(path.join(dir, 'Prover.toml'), `root = "${root}"
nullifier = "${nullifier}"
recipient = "${recipientHex}"
amount = "${zac.amount}"
secret_key = "${zac.publicKey}"
salt = "${zac.salt}"
index = "0"
hash_path = [
${hashPath.map(h => `  "${h}"`).join(',\n')}
]
`);
  console.log('[2] Generating witness + proof...');
  execSync(`nargo execute --package circuits --prover-name ${path.join(dir, 'Prover')} ${path.join(dir, 'witness')}`,
    { cwd: NARGO_DIR, stdio: 'pipe' });
  execSync(`LD_LIBRARY_PATH="${LIBPATH}" ${BB} prove --scheme ultra_honk --oracle_hash keccak ` +
    `-b ${path.join(NARGO_DIR, 'target/bytecode.gz')} -w ${path.join(dir, 'witness.gz')} -o ${dir}`,
    { stdio: 'pipe' });
  const proof = fs.readFileSync(path.join(dir, 'proof'));
  console.log('    proof generated:', proof.length, 'bytes');

  // ── 3. Claim ──
  const sourceKp = RECIPIENT_SECRET ? sdk.Keypair.fromSecret(RECIPIENT_SECRET) : hr;
  console.log('[3] Claiming to', RECIPIENT, '(tx source:', sourceKp.publicKey().slice(0, 8) + '…)');
  let ctx = new sdk.TransactionBuilder(await server.getAccount(sourceKp.publicKey()), {
    fee: '1000000', networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call('claim',
      sdk.xdr.ScVal.scvBytes(Buffer.from(root.slice(2), 'hex')),
      sdk.xdr.ScVal.scvBytes(Buffer.from(nullifier.slice(2), 'hex')),
      new sdk.Address(RECIPIENT).toScVal(),
      i128(BigInt(zac.amount)),
      sdk.xdr.ScVal.scvBytes(proof),
    ))
    .setTimeout(120).build();
  ctx = await server.prepareTransaction(ctx);
  ctx.sign(sourceKp);
  const cres = await server.sendTransaction(ctx);
  if (cres.status === 'ERROR') throw new Error('claim rejected: ' + cres.errorResult?.toXDR('hex'));
  await waitTx(server, cres.hash);
  console.log('    claim SUCCESS:', cres.hash);
  fs.rmSync(dir, { recursive: true, force: true });

  console.log('\n🎉 END-TO-END OK: disburse → prove → claim all succeeded on testnet.');
  console.log('   Explorer: https://stellar.expert/explorer/testnet/tx/' + cres.hash);
}

main().catch(e => { console.error('E2E FAILED:', e.message || e); process.exit(1); });
