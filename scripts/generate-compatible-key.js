const { Keypair } = require("@stellar/stellar-sdk");

const FIELD_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

function generateCompatibleKey() {
  console.log("Searching for a BN254-compatible Stellar keypair...");
  let attempts = 0;
  
  while (true) {
    attempts++;
    const kp = Keypair.random();
    const pubKey = kp.publicKey();
    const rawBytes = kp.rawPublicKey();
    const hex = "0x" + Array.from(rawBytes).map(b => b.toString(16).padStart(2, "0")).join("");
    const val = BigInt(hex);

    if (val < FIELD_MODULUS && pubKey.startsWith("GA")) {
      console.log(`\nSuccess! Found compatible keypair in ${attempts} attempts:`);
      console.log(`Public Key (Address):  ${pubKey}`);
      console.log(`Secret Key (S-Seed):   ${kp.secret()}`);
      console.log(`\nImport the Secret Key (S-Seed) into your Freighter or xBull wallet to use it!`);
      break;
    }
  }
}

generateCompatibleKey();
