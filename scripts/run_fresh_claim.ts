import * as fs from 'fs';
import * as path from 'path';
import { RPC_URL, NETWORK_PASSPHRASE } from '../lib/payroll-sdk';
import * as stellarSdk from '@stellar/stellar-sdk';
import { Buffer } from 'buffer';

if (!process.env.HR_SECRET) throw new Error("Set HR_SECRET env var to run this script.");
const HR_SECRET = process.env.HR_SECRET!;
const VERIFIER_ID = 'CABPT2QO54HVAH5VWTLT3QZ3VXWNK2ZY6J2VZUK42SZHWXSWZO2ODPTK';
const TOKEN_ID = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
const WASM_PATH = '/home/azxky9/hackathon/tecta-wasm/target/wasm32v1-none/release/shielded_payroll.wasm';

async function waitForTx(server: stellarSdk.rpc.Server, hash: string): Promise<void> {
  while (true) {
    const status = await server.getTransaction(hash);
    if (status.status !== stellarSdk.rpc.Api.GetTransactionStatus.NOT_FOUND) {
      if (status.status !== stellarSdk.rpc.Api.GetTransactionStatus.SUCCESS) {
        throw new Error(`Transaction ${hash} failed: ${status.status}`);
      }
      return;
    }
    await new Promise(r => setTimeout(r, 1500));
  }
}

async function getXlmBalance(server: stellarSdk.rpc.Server, address: string): Promise<string> {
  try {
    const account = await server.getAccount(address);
    const balances = (account as any).balances ?? [];
    const nativeBalance = balances.find((b: any) => b.asset_type === 'native');
    return nativeBalance?.balance ?? '0';
  } catch (e) {
    return '0';
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   TECTA ZK Payroll — Deploy Fresh Contract & Claim 1K XLM ');
  console.log('═══════════════════════════════════════════════════════════\n');

  const server = new stellarSdk.rpc.Server(RPC_URL);
  const hrKeypair = stellarSdk.Keypair.fromSecret(HR_SECRET);
  const hrAddress = hrKeypair.publicKey();
  console.log('HR Admin Address:', hrAddress);

  // 1. Install & Deploy a Fresh Shielded Payroll Contract
  console.log('\n[Step 1] Deploying fresh ShieldedPayroll contract...');
  const wasmBuffer = fs.readFileSync(WASM_PATH);
  
  let hrAccount = await server.getAccount(hrAddress);
  let installTx = new stellarSdk.TransactionBuilder(hrAccount, {
    fee: '500000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(stellarSdk.Operation.uploadContractWasm({ wasm: wasmBuffer }))
    .setTimeout(300)
    .build();

  installTx = await server.prepareTransaction(installTx);
  installTx.sign(hrKeypair);
  const installRes = await server.sendTransaction(installTx);
  console.log('  WASM Upload Tx Hash:', installRes.hash);
  await waitForTx(server, installRes.hash);

  const crypto = await import('crypto');
  const wasmHash = crypto.createHash('sha256').update(wasmBuffer).digest('hex');
  console.log('  WASM Hash:', wasmHash);

  // Create contract instance using random salt
  const salt = stellarSdk.Keypair.random().rawPublicKey();
  hrAccount = await server.getAccount(hrAddress);
  let createTx = new stellarSdk.TransactionBuilder(hrAccount, {
    fee: '500000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(stellarSdk.Operation.createCustomContract({
      address: new stellarSdk.Address(hrAddress),
      wasmHash: Buffer.from(wasmHash, 'hex'),
      salt: salt,
    }))
    .setTimeout(300)
    .build();

  const simCreate = await server.simulateTransaction(createTx);
  const freshContractId = stellarSdk.Address.fromScVal(simCreate.result!.retval).toString();
  console.log('  ✅ Fresh Contract Deployed! ID:', freshContractId);

  createTx = await server.prepareTransaction(createTx);
  createTx.sign(hrKeypair);
  const createRes = await server.sendTransaction(createTx);
  await waitForTx(server, createRes.hash);

  // 2. Initialize the fresh contract
  console.log('\n[Step 2] Initializing fresh contract...');
  const freshContract = new stellarSdk.Contract(freshContractId);
  const initArgs = [
    new stellarSdk.Address(hrAddress).toScVal(),
    new stellarSdk.Address(TOKEN_ID).toScVal(),
    new stellarSdk.Address(VERIFIER_ID).toScVal(),
  ];

  hrAccount = await server.getAccount(hrAddress);
  let initTx = new stellarSdk.TransactionBuilder(hrAccount, {
    fee: '100000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(freshContract.call('initialize', ...initArgs))
    .setTimeout(300)
    .build();

  initTx = await server.prepareTransaction(initTx);
  initTx.sign(hrKeypair);
  const initRes = await server.sendTransaction(initTx);
  await waitForTx(server, initRes.hash);
  console.log('  ✅ Fresh Contract Initialized!');

  // Load Reference Proof Data
  const proof = fs.readFileSync('/home/azxky9/hackathon/tecta-wasm/proofs/proof.bin/proof');
  const pub = fs.readFileSync('/home/azxky9/hackathon/tecta-wasm/proofs/proof.bin/public_inputs');

  const root = pub.slice(0, 32);
  const nullifier = pub.slice(32, 64);
  const recipientBytes = pub.slice(64, 96);
  const amount = 2000; // 2000 units / stroops

  const recipientAddress = stellarSdk.StrKey.encodeEd25519PublicKey(recipientBytes);
  console.log('\n[Step 3] Target Recipient Address:', recipientAddress);

  // Fund recipient
  await fetch(`https://friendbot.stellar.org/?addr=${recipientAddress}`);

  const balanceBefore = await getXlmBalance(server, recipientAddress);
  console.log('  Recipient Balance Before Claim:', balanceBefore, 'XLM');

  // 3. Fund Treasury & Disburse Batch
  console.log('\n[Step 4] Transferring funds to new contract treasury & Disbursing...');
  const tokenContract = new stellarSdk.Contract(TOKEN_ID);
  const fundArgs = [
    new stellarSdk.Address(hrAddress).toScVal(),
    new stellarSdk.Address(freshContractId).toScVal(),
    stellarSdk.xdr.ScVal.scvI128(
      new stellarSdk.xdr.Int128Parts({
        lo: stellarSdk.xdr.Uint64.fromString(String(BigInt(amount) & 0xFFFFFFFFFFFFFFFFn)),
        hi: stellarSdk.xdr.Int64.fromString(String(BigInt(amount) >> 64n)),
      })
    )
  ];

  hrAccount = await server.getAccount(hrAddress);
  let fundTx = new stellarSdk.TransactionBuilder(hrAccount, {
    fee: '100000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(tokenContract.call('transfer', ...fundArgs))
    .setTimeout(300)
    .build();

  fundTx = await server.prepareTransaction(fundTx);
  fundTx.sign(hrKeypair);
  const fundRes = await server.sendTransaction(fundTx);
  await waitForTx(server, fundRes.hash);

  // Disburse batch
  const disburseArgs = [
    new stellarSdk.Address(hrAddress).toScVal(),
    stellarSdk.xdr.ScVal.scvI128(
      new stellarSdk.xdr.Int128Parts({
        lo: stellarSdk.xdr.Uint64.fromString(String(BigInt(amount) & 0xFFFFFFFFFFFFFFFFn)),
        hi: stellarSdk.xdr.Int64.fromString(String(BigInt(amount) >> 64n)),
      })
    ),
    stellarSdk.xdr.ScVal.scvBytes(root),
  ];

  hrAccount = await server.getAccount(hrAddress);
  let disburseTx = new stellarSdk.TransactionBuilder(hrAccount, {
    fee: '100000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(freshContract.call('disburse_batch', ...disburseArgs))
    .setTimeout(300)
    .build();

  disburseTx = await server.prepareTransaction(disburseTx);
  disburseTx.sign(hrKeypair);
  const disburseRes = await server.sendTransaction(disburseTx);
  console.log('  Disbursement Tx Hash:', disburseRes.hash);
  await waitForTx(server, disburseRes.hash);
  console.log('  ✅ Disbursement Confirmed!');

  // 4. Execute Claim
  console.log('\n[Step 5] Executing fresh Claim transaction on-chain...');
  const claimArgs = [
    stellarSdk.xdr.ScVal.scvBytes(root),
    stellarSdk.xdr.ScVal.scvBytes(nullifier),
    new stellarSdk.Address(recipientAddress).toScVal(),
    stellarSdk.xdr.ScVal.scvI128(
      new stellarSdk.xdr.Int128Parts({
        lo: stellarSdk.xdr.Uint64.fromString(String(BigInt(amount) & 0xFFFFFFFFFFFFFFFFn)),
        hi: stellarSdk.xdr.Int64.fromString(String(BigInt(amount) >> 64n)),
      })
    ),
    stellarSdk.xdr.ScVal.scvBytes(proof),
  ];

  hrAccount = await server.getAccount(hrAddress);
  let claimTx = new stellarSdk.TransactionBuilder(hrAccount, {
    fee: '100000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(freshContract.call('claim', ...claimArgs))
    .setTimeout(300)
    .build();

  claimTx = await server.prepareTransaction(claimTx);
  claimTx.sign(hrKeypair);

  const claimRes = await server.sendTransaction(claimTx);
  console.log('  Claim Tx Submitted! Hash:', claimRes.hash);
  await waitForTx(server, claimRes.hash);

  await new Promise(r => setTimeout(r, 2000));
  const balanceAfter = await getXlmBalance(server, recipientAddress);

  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║        🎉 ON-CHAIN ZK CLAIM TEST EXECUTED SUCCESSFULLY!   ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log(`\n  Fresh Contract Address   : ${freshContractId}`);
  console.log(`  Recipient                : ${recipientAddress}`);
  console.log(`  Recipient Balance Before : ${balanceBefore} XLM`);
  console.log(`  Recipient Balance After  : ${balanceAfter} XLM`);
  console.log(`\n  Disburse Tx Hash         : ${disburseRes.hash}`);
  console.log(`  Claim Tx Hash            : ${claimRes.hash}`);
  console.log(`  Stellar Expert Explorer  : https://stellar.expert/explorer/testnet/tx/${claimRes.hash}`);
}

main().catch(err => console.error('Error:', err.message || err));
