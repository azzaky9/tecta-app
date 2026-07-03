/**
 * E2E with human-readable amounts: verifies the decimals-scaling pipeline
 * (getTokenDecimals + toRawAmount) end-to-end on testnet.
 * Jane gets 2.5 XLM, Gale 1.5 XLM. Claim goes to employee_test.
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

const HR_SECRET = '***REMOVED-LEAKED-SECRET***';
const RECIPIENT = 'GAMIBC4Q6BSBZPQYN74P6UUOK4NCHNDTMWYMAUJIY6QX7W6JNS64WOHT';
const RECIPIENT_SECRET = process.env.RECIPIENT_SECRET;

const runSalt = String(200000 + Math.floor(Math.random() * 700000));
const EMPLOYEES = [
  { name: 'Jane', amount: 2.5, publicKey: '41005548', salt: runSalt },
  { name: 'Gale', amount: 1.5, publicKey: '989957147', salt: String(Number(runSalt) + 1) },
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
  const hr = sdk.Keypair.fromSecret(HR_SECRET);

  const decimals = await getTokenDecimals();
  console.log('[0] token decimals from chain:', decimals);

  // Same scaling path as the UI
  const commitments = generateCommitments(EMPLOYEES, decimals);
  const rawTotal = EMPLOYEES.reduce((s, e) => s + toRawAmount(e.amount, decimals), 0n);
  const root = computeMerkleRoot(commitments);
  console.log('[1] disburse: human total =', EMPLOYEES.reduce((s, e) => s + e.amount, 0),
    '→ raw total =', rawTotal.toString(), 'root =', root.slice(0, 14) + '…');

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

  // Jane claims 2.5 XLM
  const jane = EMPLOYEES[0];
  const rawAmount = toRawAmount(jane.amount, decimals);
  const nullifier = generateNullifier(jane.publicKey, jane.salt);
  const recipientHex = await getRecipientFieldElement(RECIPIENT);
  const hashPath = getSiblingPath(commitments, 0);

  const dir = fs.mkdtempSync('/tmp/e2e_human_');
  fs.writeFileSync(path.join(dir, 'Prover.toml'), `root = "${root}"
nullifier = "${nullifier}"
recipient = "${recipientHex}"
amount = "${rawAmount}"
secret_key = "${jane.publicKey}"
salt = "${jane.salt}"
index = "0"
hash_path = [
${hashPath.map(h => `  "${h}"`).join(',\n')}
]
`);
  console.log('[2] proving claim of', jane.amount, 'XLM (raw', rawAmount.toString() + ')...');
  execSync(`nargo execute --package circuits --prover-name ${path.join(dir, 'Prover')} ${path.join(dir, 'witness')}`,
    { cwd: NARGO_DIR, stdio: 'pipe' });
  execSync(`LD_LIBRARY_PATH="${LIBPATH}" ${BB} prove --scheme ultra_honk --oracle_hash keccak ` +
    `-b ${path.join(NARGO_DIR, 'target/bytecode.gz')} -w ${path.join(dir, 'witness.gz')} -o ${dir}`,
    { stdio: 'pipe' });
  const proof = fs.readFileSync(path.join(dir, 'proof'));

  const sourceKp = RECIPIENT_SECRET ? sdk.Keypair.fromSecret(RECIPIENT_SECRET) : hr;
  const balBefore = (await server.getAccount(RECIPIENT), await fetch(
    `https://horizon-testnet.stellar.org/accounts/${RECIPIENT}`).then(r => r.json()))
    .balances.find((b: any) => b.asset_type === 'native').balance;

  let ctx = new sdk.TransactionBuilder(await server.getAccount(sourceKp.publicKey()), {
    fee: '1000000', networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call('claim',
      sdk.xdr.ScVal.scvBytes(Buffer.from(root.slice(2), 'hex')),
      sdk.xdr.ScVal.scvBytes(Buffer.from(nullifier.slice(2), 'hex')),
      new sdk.Address(RECIPIENT).toScVal(),
      i128(rawAmount),
      sdk.xdr.ScVal.scvBytes(proof),
    ))
    .setTimeout(120).build();
  ctx = await server.prepareTransaction(ctx);
  ctx.sign(sourceKp);
  const cres = await server.sendTransaction(ctx);
  if (cres.status === 'ERROR') throw new Error('claim rejected: ' + cres.errorResult?.toXDR('hex'));
  await waitTx(server, cres.hash);
  fs.rmSync(dir, { recursive: true, force: true });

  const balAfter = (await fetch(`https://horizon-testnet.stellar.org/accounts/${RECIPIENT}`)
    .then(r => r.json())).balances.find((b: any) => b.asset_type === 'native').balance;
  console.log('    claim SUCCESS:', cres.hash);
  console.log('[3] recipient XLM balance:', balBefore, '→', balAfter,
    '(+' + fromRawAmount(rawAmount, decimals), 'XLM expected)');
}

main().catch(e => { console.error('E2E FAILED:', e.message || e); process.exit(1); });
