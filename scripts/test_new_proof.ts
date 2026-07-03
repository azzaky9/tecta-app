import * as fs from 'fs';
import { RPC_URL, NETWORK_PASSPHRASE } from '../lib/payroll-sdk';
import * as stellarSdk from '@stellar/stellar-sdk';

async function main() {
  const proofPath = '/tmp/proof_uhonk/proof';
  const pubPath = '/tmp/proof_uhonk/public_inputs';

  const proof = fs.readFileSync(proofPath);
  const pub = fs.readFileSync(pubPath);

  // Extract nullifier from public inputs (second input, bytes 32..64)
  const nullifier = pub.slice(32, 64);

  console.log("Loaded Proof length:", proof.length);
  console.log("Public Inputs length:", pub.length);
  console.log("Nullifier (hex):", nullifier.toString('hex'));
  console.log("Public Input 0 (root):", pub.slice(0, 32).toString('hex'));
  console.log("Public Input 1 (nullifier):", pub.slice(32, 64).toString('hex'));
  console.log("Public Input 2 (recipient):", pub.slice(64, 96).toString('hex'));
  console.log("Public Input 3 (amount):", pub.slice(96, 128).toString('hex'));

  const verifierId = "CABPT2QO54HVAH5VWTLT3QZ3VXWNK2ZY6J2VZUK42SZHWXSWZO2ODPTK";
  const server = new stellarSdk.rpc.Server(RPC_URL);
  const contract = new stellarSdk.Contract(verifierId);

  const dummyPublicKey = stellarSdk.Keypair.random().publicKey();
  const dummyAccount = new stellarSdk.Account(dummyPublicKey, "0");

  const verifyArgs = [
    stellarSdk.xdr.ScVal.scvBytes(proof),
    stellarSdk.xdr.ScVal.scvBytes(pub),
    stellarSdk.xdr.ScVal.scvBytes(nullifier),
  ];

  const tx = new stellarSdk.TransactionBuilder(dummyAccount, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call("verify", ...verifyArgs))
    .setTimeout(30)
    .build();

  console.log("\nSimulating verification on-chain...");
  const simResult = await server.simulateTransaction(tx);
  if (stellarSdk.rpc.Api.isSimulationSuccess(simResult)) {
    const val = JSON.stringify(simResult.result?.retval);
    console.log(`🎉 SUCCESS! New proof verified on-chain! Return value: ${val}`);
  } else {
    console.log(`❌ FAILED! Simulation error:`, simResult.error);
    if (simResult.events && simResult.events.length > 0) {
      console.log(`Events:`, simResult.events.map(e => e.event().toXDR().toString('hex')));
    }
  }
}

main().catch(console.error);
