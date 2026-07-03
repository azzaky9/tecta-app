import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { RPC_URL, NETWORK_PASSPHRASE } from '../lib/payroll-sdk';
import * as stellarSdk from '@stellar/stellar-sdk';

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

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  TECTA ZK Payroll — Fresh Proof Generation & Claim Test   ');
  console.log('═══════════════════════════════════════════════════════════\n');

  const server = new stellarSdk.rpc.Server(RPC_URL);
  const hrKeypair = stellarSdk.Keypair.fromSecret(HR_SECRET);
  const hrAddress = hrKeypair.publicKey();

  // 1. Upload & Deploy Fresh Contract
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
  await waitForTx(server, installRes.hash);

  const crypto = await import('crypto');
  const wasmHash = crypto.createHash('sha256').update(wasmBuffer).digest('hex');

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
  console.log('✅ Fresh ShieldedPayroll Contract Deployed:', freshContractId);

  createTx = await server.prepareTransaction(createTx);
  createTx.sign(hrKeypair);
  const createRes = await server.sendTransaction(createTx);
  await waitForTx(server, createRes.hash);

  // 2. Initialize Contract
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
  console.log('✅ Contract Initialized!');

  // 3. Generate New Proof Parameters
  // Load original Prover.toml inputs
  const root = '0x06782f383c44c8686ae4b9b69eb345be31a21da3f042bfd9e7e3cbb656433dc8';
  const nullifier = '0x071ab9043ff1105bf26fed30816d06417cd473e5b42a52f9e1a4312fb0866f43';
  const recipientHex = '0x0f6a82d7b3a47de6db3b608d0f4585631b487b7662b5efb56b896bd8c6e23991';
  const amount = 2000;
  const recipientAddress = 'GAHWVAWXWOSH3ZW3HNQI2D2FQVRRWSD3OZRLL35VNOEWXWGG4I4ZDMPG';

  // Fund recipient
  await fetch(`https://friendbot.stellar.org/?addr=${recipientAddress}`);

  // Disburse batch
  const disburseArgs = [
    new stellarSdk.Address(hrAddress).toScVal(),
    stellarSdk.xdr.ScVal.scvI128(
      new stellarSdk.xdr.Int128Parts({
        lo: stellarSdk.xdr.Uint64.fromString(String(BigInt(amount) & 0xFFFFFFFFFFFFFFFFn)),
        hi: stellarSdk.xdr.Int64.fromString(String(BigInt(amount) >> 64n)),
      })
    ),
    stellarSdk.xdr.ScVal.scvBytes(Buffer.from(root.slice(2), 'hex')),
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
  console.log('✅ Disbursement Batch Confirmed! Tx:', disburseRes.hash);
  await waitForTx(server, disburseRes.hash);

  // 4. Generate Fresh Keccak Proof via bb CLI
  console.log('\nGenerating fresh Keccak UltraHonk proof via bb CLI...');
  const proofDir = path.join('/tmp', `proof_${Date.now()}`);
  fs.mkdirSync(proofDir, { recursive: true });

  const proverToml = `root = "${root}"
nullifier = "${nullifier}"
recipient = "${recipientHex}"
amount = "${amount}"
secret_key = "0x2de0b49fe3294e066d8a4c674c5ccae68ed1b09ffb0895526988e5944798892b"
salt = "891299"
index = "1"
hash_path = [
  "0x0000000000000000000000000000000000000000000000000000000000000000",
  "0x29176100eaa962bdc1fe6c654d6a3c130e96a4d1168b33848b897dc502820133",
  "0x131d73cf6b30079aca0dff6a561cd0ee50b540879abe379a25a06b24bde2bebd",
  "0x0d4e4d24b890fe6799be4cf57ad13078ec0fbaa9fe91423ba8bbd0c2d7043bd4",
  "0x15e36f4ff92e2211fa8ed9f7af707f6c8c0f1442252a85150d2b8d2038890dfc",
  "0x2a267e27e712412e8eefec1e174ce85b1af2f2d9a8014fa4dc723abb4d27ef7d",
  "0x094b8e7acd789372d446e21dcc80162aba6c1923ae3b9a30702f64f0aea70295",
  "0x0f9cebf54307bbb3646866aa15d2cd6e961caea77048b87f4261b7636240254e"
]
`;
  fs.writeFileSync(path.join(proofDir, 'Prover.toml'), proverToml);

  execSync(
    `nargo execute --package circuits --prover-name ${path.join(proofDir, 'Prover')} ${path.join(proofDir, 'witness')}`,
    { cwd: '/home/azxky9/hackathon/tecta-wasm/circuits', stdio: 'pipe' }
  );

  execSync(
    `/home/azxky9/.bb/bb prove --scheme ultra_honk --oracle_hash keccak ` +
    `-b /home/azxky9/hackathon/tecta-wasm/circuits/target/bytecode.gz ` +
    `-w ${path.join(proofDir, 'witness.gz')} -o ${proofDir}`,
    { stdio: 'pipe' }
  );

  const freshProof = fs.readFileSync(path.join(proofDir, 'proof'));
  console.log('✅ Fresh Proof Generated! Size:', freshProof.length, 'bytes');

  // 5. Submit Claim to Contract!
  const claimArgs = [
    stellarSdk.xdr.ScVal.scvBytes(Buffer.from(root.slice(2), 'hex')),
    stellarSdk.xdr.ScVal.scvBytes(Buffer.from(nullifier.slice(2), 'hex')),
    new stellarSdk.Address(recipientAddress).toScVal(),
    stellarSdk.xdr.ScVal.scvI128(
      new stellarSdk.xdr.Int128Parts({
        lo: stellarSdk.xdr.Uint64.fromString(String(BigInt(amount) & 0xFFFFFFFFFFFFFFFFn)),
        hi: stellarSdk.xdr.Int64.fromString(String(BigInt(amount) >> 64n)),
      })
    ),
    stellarSdk.xdr.ScVal.scvBytes(freshProof),
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
  console.log('\nClaim Tx Submitted! Tx Hash:', claimRes.hash);
  await waitForTx(server, claimRes.hash);

  console.log('\n===========================================================');
  console.log('🎉 CLAIM SUCCESSFULLY VERIFIED & TRANSACTED ON-CHAIN!');
  console.log('Claim Tx Hash:', claimRes.hash);
  console.log('Stellar Expert Explorer: https://stellar.expert/explorer/testnet/tx/' + claimRes.hash);
  console.log('===========================================================');
}

main().catch(err => console.error('Error:', err.message || err));
