/**
 * E2E for the sponsored claim path: disburses, proves, then claims to a
 * brand-new, never-funded keypair via /api/claim-sponsored (no XLM, no
 * wallet signature from the recipient at all).
 */
import * as sdk from '@stellar/stellar-sdk';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  generateCommitments, computeMerkleRoot, getSiblingPath, generateNullifier,
  getRecipientFieldElement, getTokenDecimals, toRawAmount, fromRawAmount,
  PAYROLL_CONTRACT_ID, RPC_URL, NETWORK_PASSPHRASE,
} from '../lib/payroll-sdk';

const HR_SECRET = process.env.HR_SECRET;
if (!HR_SECRET) throw new Error('Set HR_SECRET env var to run this script.');
const FRESH_RECIPIENT = sdk.Keypair.random(); // never funded, never touches chain until claim

const runSalt = String(300000 + Math.floor(Math.random() * 700000));
const EMPLOYEES = [
  { name: 'Fresh', amount: 1.25, publicKey: '778812345', salt: runSalt },
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

  console.log('[0] fresh recipient (never funded):', FRESH_RECIPIENT.publicKey());
  const preCheck = await fetch(`https://horizon-testnet.stellar.org/accounts/${FRESH_RECIPIENT.publicKey()}`);
  console.log('    account exists on ledger before claim?', preCheck.status === 200);

  const decimals = await getTokenDecimals();
  const commitments = generateCommitments(EMPLOYEES, decimals);
  const rawTotal = EMPLOYEES.reduce((s, e) => s + toRawAmount(e.amount, decimals), 0n);
  const root = computeMerkleRoot(commitments);
  console.log('[1] disburse: raw total =', rawTotal.toString(), 'root =', root.slice(0, 14) + '…');

  let tx = new sdk.TransactionBuilder(await server.getAccount(hr.publicKey()), {
    fee: '1000000', networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call('disburse_batch',
      new sdk.Address(hr.publicKey()).toScVal(),
      i128(rawTotal),
      sdk.xdr.ScVal.scvBytes(Buffer.from(root.slice(2), 'hex')),
    ))
    .setTimeout(120).build();
  tx = await server.prepareTransaction(tx);
  tx.sign(hr);
  const dres = await server.sendTransaction(tx);
  if (dres.status === 'ERROR') throw new Error('disburse rejected: ' + dres.errorResult?.toXDR('hex'));
  await waitTx(server, dres.hash);
  console.log('    disburse SUCCESS:', dres.hash);

  const emp = EMPLOYEES[0];
  const rawAmount = toRawAmount(emp.amount, decimals);
  const nullifier = generateNullifier(emp.publicKey, emp.salt);
  const recipientHex = await getRecipientFieldElement(FRESH_RECIPIENT.publicKey());
  const hashPath = getSiblingPath(commitments, 0);

  const dir = fs.mkdtempSync('/tmp/e2e_sponsored_');
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
  console.log('[2] proving claim of', emp.amount, 'XLM (raw', rawAmount.toString() + ')...');
  execSync(`nargo execute --package circuits --prover-name ${path.join(dir, 'Prover')} ${path.join(dir, 'witness')}`,
    { cwd: NARGO_DIR, stdio: 'pipe' });
  execSync(`LD_LIBRARY_PATH="${LIBPATH}" ${BB} prove --scheme ultra_honk --oracle_hash keccak ` +
    `-b ${path.join(NARGO_DIR, 'target/bytecode.gz')} -w ${path.join(dir, 'witness.gz')} -o ${dir}`,
    { stdio: 'pipe' });
  const proofHex = '0x' + fs.readFileSync(path.join(dir, 'proof')).toString('hex');
  fs.rmSync(dir, { recursive: true, force: true });

  console.log('[3] submitting sponsored claim via /api/claim-sponsored...');
  const res = await fetch('http://localhost:3000/api/claim-sponsored', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      root, nullifier, recipientAddress: FRESH_RECIPIENT.publicKey(),
      amount: rawAmount.toString(), proofHex,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error('sponsored claim failed: ' + JSON.stringify(data));
  console.log('    sponsored claim SUCCESS:', data.txHash);

  await new Promise(r => setTimeout(r, 3000));
  const post = await fetch(`https://horizon-testnet.stellar.org/accounts/${FRESH_RECIPIENT.publicKey()}`);
  const postJson = await post.json();
  console.log('[4] fresh recipient account now exists on ledger?', post.status === 200);
  console.log('    balance:', postJson.balances?.find((b: any) => b.asset_type === 'native')?.balance,
    '(expected', fromRawAmount(rawAmount, decimals), 'XLM)');
}

main().catch(e => { console.error('E2E FAILED:', e.message || e); process.exit(1); });
