/**
 * Builds a real /claim public-page link from a live disburse_batch, then hits
 * the sponsored-claim API the page itself calls, to confirm the query-param
 * contract (root, amount, pk, salt, idx, path) round-trips correctly.
 */
import * as sdk from '@stellar/stellar-sdk';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  generateCommitments, computeMerkleRoot, getSiblingPath, generateNullifier,
  getRecipientFieldElement, getTokenDecimals, toRawAmount,
  PAYROLL_CONTRACT_ID, RPC_URL, NETWORK_PASSPHRASE, FIELD_MODULUS,
} from '../lib/payroll-sdk';

function randomCompatibleKeypair(): sdk.Keypair {
  for (;;) {
    const kp = sdk.Keypair.random();
    const raw = kp.rawPublicKey();
    const hex = '0x' + Array.from(raw).map((b) => b.toString(16).padStart(2, '0')).join('');
    if (BigInt(hex) < FIELD_MODULUS) return kp;
  }
}

const HR_SECRET = process.env.HR_SECRET;
if (!HR_SECRET) throw new Error('Set HR_SECRET env var to run this script.');

const runSalt = String(400000 + Math.floor(Math.random() * 500000));
const EMPLOYEES = [
  { name: 'PublicLinkTest', amount: 1.25, publicKey: '5551234', salt: runSalt },
];

const NARGO_DIR = '/home/azxky9/hackathon/tecta-wasm/circuits';
const BB = '/home/azxky9/.bb/bb';
const LIBPATH = '/home/azxky9/libcpp/usr/lib/llvm-18/lib:/home/azxky9/libcpp/usr/lib/x86_64-linux-gnu';

async function waitTx(server: sdk.rpc.Server, hash: string) {
  for (;;) {
    const s = await server.getTransaction(hash);
    if (s.status !== sdk.rpc.Api.GetTransactionStatus.NOT_FOUND) {
      if (s.status !== sdk.rpc.Api.GetTransactionStatus.SUCCESS)
        throw new Error(`tx ${hash} failed: ${s.status}`);
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
  const hr = sdk.Keypair.fromSecret(HR_SECRET!);

  const decimals = await getTokenDecimals();
  const commitments = generateCommitments(EMPLOYEES, decimals);
  const rawTotal = EMPLOYEES.reduce((s, e) => s + toRawAmount(e.amount, decimals), 0n);
  const root = computeMerkleRoot(commitments);

  let tx = new sdk.TransactionBuilder(await server.getAccount(hr.publicKey()), {
    fee: '1000000', networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call('disburse_batch',
      new sdk.Address(hr.publicKey()).toScVal(), i128(rawTotal),
      sdk.xdr.ScVal.scvBytes(Buffer.from(root.slice(2), 'hex')),
    ))
    .setTimeout(120).build();
  tx = await server.prepareTransaction(tx);
  tx.sign(hr);
  const dres = await server.sendTransaction(tx);
  if (dres.status === 'ERROR') throw new Error('disburse rejected: ' + dres.errorResult?.toXDR('hex'));
  await waitTx(server, dres.hash);
  console.log('disburse SUCCESS:', dres.hash);

  const emp = EMPLOYEES[0];
  const hashPath = getSiblingPath(commitments, 0);

  const params = new URLSearchParams({
    root,
    amount: String(emp.amount),
    pk: emp.publicKey,
    salt: emp.salt,
    idx: '0',
    path: hashPath.join(','),
    name: emp.name,
  });
  const link = `http://localhost:3000/claim?${params.toString()}`;
  console.log('\nPublic claim link:\n' + link + '\n');

  // Exercise the exact same code path the page uses: generate proof server-side, then sponsor-submit.
  const nullifier = generateNullifier(emp.publicKey, emp.salt);
  const fresh = randomCompatibleKeypair();
  const recipientHex = await getRecipientFieldElement(fresh.publicKey());
  const rawAmount = toRawAmount(emp.amount, decimals);

  const dir = fs.mkdtempSync('/tmp/e2e_public_link_');
  fs.writeFileSync(path.join(dir, 'Prover.toml'), `root = "${root}"
nullifier = "${nullifier}"
recipient = "${recipientHex}"
amount = "${rawAmount}"
secret_key = "${emp.publicKey}"
salt = "${emp.salt}"
index = "0"
hash_path = [
${hashPath.map(h => `  "${h}"`).join(',\n')}
]
`);
  execSync(`nargo execute --package circuits --prover-name ${path.join(dir, 'Prover')} ${path.join(dir, 'witness')}`,
    { cwd: NARGO_DIR, stdio: 'pipe' });
  execSync(`LD_LIBRARY_PATH="${LIBPATH}" ${BB} prove --scheme ultra_honk --oracle_hash keccak ` +
    `-b ${path.join(NARGO_DIR, 'target/bytecode.gz')} -w ${path.join(dir, 'witness.gz')} -o ${dir}`,
    { stdio: 'pipe' });
  const proofHex = '0x' + fs.readFileSync(path.join(dir, 'proof')).toString('hex');
  fs.rmSync(dir, { recursive: true, force: true });

  const res = await fetch('http://localhost:3000/api/claim-sponsored', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ root, nullifier, recipientAddress: fresh.publicKey(), amount: rawAmount.toString(), proofHex }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error('sponsored claim failed: ' + JSON.stringify(data));
  console.log('claim via /api/claim-sponsored SUCCESS:', data.txHash);
  console.log('recipient (fresh, never funded):', fresh.publicKey());
}

main().catch(e => { console.error('FAILED:', e.message || e); process.exit(1); });
