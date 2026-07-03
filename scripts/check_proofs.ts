import * as fs from 'fs';

function main() {
  const proofPath = '/home/azxky9/hackathon/tecta-wasm/proofs/proof.bin/proof';
  const pubPath = '/home/azxky9/hackathon/tecta-wasm/proofs/proof.bin/public_inputs';

  if (fs.existsSync(proofPath)) {
    const proof = fs.readFileSync(proofPath);
    console.log("Test proof file length:", proof.length);
    console.log("Test proof first 64 bytes (hex):", proof.slice(0, 64).toString('hex'));
  } else {
    console.log("Test proof file not found!");
  }

  if (fs.existsSync(pubPath)) {
    const pub = fs.readFileSync(pubPath);
    console.log("Test public inputs file length:", pub.length);
    console.log("Test public inputs first 64 bytes (hex):", pub.slice(0, 64).toString('hex'));
  } else {
    console.log("Test public inputs file not found!");
  }
}

main();
