import * as fs from 'fs';
import * as zlib from 'zlib';

function main() {
  const jsonPath = '/home/azxky9/hackathon/tecta-wasm/circuits/target/circuits.json';
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const base64Bytecode = data.bytecode;
  const compressed = Buffer.from(base64Bytecode, 'base64');
  fs.writeFileSync('/tmp/bytecode.gz', compressed);
  console.log("Successfully extracted GZIP ACIR bytecode to /tmp/bytecode.gz");
}

main();
