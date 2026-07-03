import * as fs from 'fs';

function main() {
  const proof = fs.readFileSync('/home/azxky9/hackathon/tecta-wasm/proofs/proof.bin/proof');
  console.log("Proof length (bytes):", proof.length);
  console.log("Proof length (fields):", proof.length / 32);

  // Print first 8 fields (32 bytes each) as hex
  for (let i = 0; i < 8; i++) {
    const chunk = proof.slice(i * 32, (i + 1) * 32);
    console.log(`Field ${i}: ${chunk.toString('hex')}`);
  }
}

main();
