/** Disburses one real batch entry and prints an unclaimed /claim link for it. */
import * as sdk from '@stellar/stellar-sdk';
import {
  generateCommitments, computeMerkleRoot, getSiblingPath,
  getTokenDecimals, toRawAmount,
  PAYROLL_CONTRACT_ID, RPC_URL, NETWORK_PASSPHRASE,
} from '../lib/payroll-sdk';

const HR_SECRET = process.env.HR_SECRET;
if (!HR_SECRET) throw new Error('Set HR_SECRET env var to run this script.');

const runSalt = String(500000 + Math.floor(Math.random() * 400000));
const EMPLOYEES = [
  { name: 'Example', amount: 2, publicKey: '90210', salt: runSalt },
];

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

  const emp = EMPLOYEES[0];
  const hashPath = getSiblingPath(commitments, 0);
  const params = new URLSearchParams({
    root, amount: String(emp.amount), pk: emp.publicKey, salt: emp.salt,
    idx: '0', path: hashPath.join(','), name: emp.name,
  });
  console.log(`http://localhost:3000/claim?${params.toString()}`);
}

main().catch(e => { console.error('FAILED:', e.message || e); process.exit(1); });
