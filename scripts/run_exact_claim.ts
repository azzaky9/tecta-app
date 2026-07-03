import * as fs from 'fs';
import {
  RPC_URL,
  NETWORK_PASSPHRASE
} from '../lib/payroll-sdk';
import * as stellarSdk from '@stellar/stellar-sdk';
import { Buffer } from 'buffer';

const PAYROLL_ID = 'CAFRROTQNRVUQO6XBH4QFH57QAALGQXK336GV2BZR6HEITNLKWJSHLX3';
if (!process.env.HR_SECRET) throw new Error("Set HR_SECRET env var to run this script.");
const HR_SECRET = process.env.HR_SECRET!;

async function main() {
  const server = new stellarSdk.rpc.Server(RPC_URL);
  const hrKeypair = stellarSdk.Keypair.fromSecret(HR_SECRET);
  const hrAddress = hrKeypair.publicKey();

  const proof = fs.readFileSync('/home/azxky9/hackathon/tecta-wasm/proofs/proof.bin/proof');
  const pub = fs.readFileSync('/home/azxky9/hackathon/tecta-wasm/proofs/proof.bin/public_inputs');

  const root = pub.slice(0, 32);
  const nullifier = pub.slice(32, 64);
  const recipientBytes = pub.slice(64, 96);
  const amountBytes = pub.slice(96, 128);

  const recipientAddress = stellarSdk.StrKey.encodeEd25519PublicKey(recipientBytes);
  const amount = Number(BigInt('0x' + amountBytes.toString('hex')));

  console.log('Testing Exact Reference Claim Call...');
  console.log('Root:', root.toString('hex'));
  console.log('Nullifier:', nullifier.toString('hex'));
  console.log('Recipient Address:', recipientAddress);
  console.log('Amount:', amount);

  // 1. Ensure root is added via disburse_batch
  const payrollContract = new stellarSdk.Contract(PAYROLL_ID);
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

  const hrAccount = await server.getAccount(hrAddress);
  let disburseTx = new stellarSdk.TransactionBuilder(hrAccount, {
    fee: '100000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(payrollContract.call('disburse_batch', ...disburseArgs))
    .setTimeout(300)
    .build();

  disburseTx = await server.prepareTransaction(disburseTx);
  disburseTx.sign(hrKeypair);

  const disburseResult = await server.sendTransaction(disburseTx);
  console.log('Disburse Tx Hash:', disburseResult.hash);
  
  while (true) {
    const st = await server.getTransaction(disburseResult.hash);
    if (st.status !== stellarSdk.rpc.Api.GetTransactionStatus.NOT_FOUND) break;
    await new Promise(r => setTimeout(r, 1500));
  }

  // 2. Submit exact claim
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

  const claimAccount = await server.getAccount(hrAddress);
  let claimTx = new stellarSdk.TransactionBuilder(claimAccount, {
    fee: '100000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(payrollContract.call('claim', ...claimArgs))
    .setTimeout(300)
    .build();

  claimTx = await server.prepareTransaction(claimTx);
  claimTx.sign(hrKeypair);

  const claimResult = await server.sendTransaction(claimTx);
  console.log('Claim Tx Hash:', claimResult.hash);

  while (true) {
    const st = await server.getTransaction(claimResult.hash);
    if (st.status !== stellarSdk.rpc.Api.GetTransactionStatus.NOT_FOUND) {
      console.log('FINAL CLAIM STATUS:', st.status);
      if (st.status === stellarSdk.rpc.Api.GetTransactionStatus.SUCCESS) {
        console.log('SUCCESS_TX_HASH:' + claimResult.hash);
      }
      break;
    }
    await new Promise(r => setTimeout(r, 1500));
  }
}

main().catch(err => {
  console.error('ERROR:', err);
});
