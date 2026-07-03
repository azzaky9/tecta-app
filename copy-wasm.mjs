// scripts/copy-wasm.mjs
import { copyFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const dest = 'public/wasm';
mkdirSync(dest, { recursive: true });

copyFileSync(
  resolve('node_modules/@noir-lang/acvm_js/web/acvm_js_bg.wasm'),
  `${dest}/acvm_js_bg.wasm`
);
copyFileSync(
  resolve('node_modules/@noir-lang/noirc_abi/web/noirc_abi_wasm_bg.wasm'),
  `${dest}/noirc_abi_wasm_bg.wasm`
);

console.log('WASM files copied to /public/wasm');
