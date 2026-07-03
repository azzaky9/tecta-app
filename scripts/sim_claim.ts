import * as fs from 'fs';
import * as stellarSdk from '@stellar/stellar-sdk';
import { RPC_URL } from '../lib/payroll-sdk';

async function main() {
  const server = new stellarSdk.rpc.Server(RPC_URL);
  const PAYROLL_ID = 'CAFRROTQNRVUQO6XBH4QFH57QAALGQXK336GV2BZR6HEITNLKWJSHLX3';
  const HR_SECRET = '***REMOVED-LEAKED-SECRET***';
  const hrKeypair = stellarSdk.Keypair.fromSecret(HR_SECRET);

  const proof = fs.readFileSync('/home/azxky9/hackathon/tecta-wasm/proofs/proof.bin/proof');
  const pub = fs.readFileSync('/home/azxky9/hackathon/tecta-wasm/proofs/proof.bin/public_inputs');

  const root = pub.slice(0, 32);
  const nullifier = pub.slice(32, 64);
  const recipientBytes = pub.slice(64, 96);
  const amountBytes = pub.slice(96, 128);

  const recipientAddress = stellarSdk.StrKey.encodeEd25519PublicKey(recipientBytes);
  const amount = Number(BigInt('0x' + amountBytes.toString('hex')));

  const payrollContract = new stellarSdk.Contract(PAYROLL_ID);
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

  const hrAccount = await server.getAccount(hrKeypair.publicKey());
  const claimTx = new stellarSdk.TransactionBuilder(hrAccount, {
    fee: '100000',
    networkPassphrase: 'Test SDF Network ; September 2015',
  })
    .addOperation(payrollContract.call('claim', ...claimArgs))
    .setTimeout(300)
    .build();

  const res = await server.simulateTransaction(claimTx);
  console.log('Simulation Error/Result:', JSON.stringify(res, null, 2));
}

main().catch(console.error);
