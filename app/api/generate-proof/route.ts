import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { root, nullifier, recipient, amount, secret_key, salt, index, hash_path } = body;

    if (!root || !nullifier || !recipient || amount === undefined || !secret_key || !salt) {
      return NextResponse.json({ error: 'Missing required parameters.' }, { status: 400 });
    }

    const nargoDir = '/home/azxky9/hackathon/tecta-wasm/circuits';
    const bbBinary = '/home/azxky9/.bb/bb';

    // Create unique temp directory for this proof session
    const sessionId = `proof_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const sessionDir = path.join('/tmp', sessionId);
    fs.mkdirSync(sessionDir, { recursive: true });

    // Format Prover.toml content
    const proverToml = `root = "${root}"
nullifier = "${nullifier}"
recipient = "${recipient}"
amount = "${amount}"
secret_key = "${secret_key}"
salt = "${salt}"
index = "${index ?? '0'}"
hash_path = [
${hash_path.map((h: string) => `  "${h}"`).join(',\n')}
]
`;

    const proverPath = path.join(sessionDir, 'Prover.toml');
    fs.writeFileSync(proverPath, proverToml);

    // 1. Execute nargo to generate witness.gz
    const witnessPath = path.join(sessionDir, 'witness.gz');
    execSync(
      `nargo execute --package circuits --prover-name ${path.join(sessionDir, 'Prover')} ${path.join(sessionDir, 'witness')}`,
      { cwd: nargoDir, stdio: 'pipe' }
    );

    // 2. Execute bb CLI with --oracle_hash keccak and LD_LIBRARY_PATH
    const libPath = '/home/azxky9/libcpp/usr/lib/llvm-18/lib:/home/azxky9/libcpp/usr/lib/x86_64-linux-gnu';
    execSync(
      `LD_LIBRARY_PATH="${libPath}" ${bbBinary} prove --scheme ultra_honk --oracle_hash keccak ` +
      `-b ${path.join(nargoDir, 'target/bytecode.gz')} -w ${witnessPath} -o ${sessionDir}`,
      { stdio: 'pipe' }
    );

    // 3. Read generated proof
    const proofBuffer = fs.readFileSync(path.join(sessionDir, 'proof'));
    const proofHex = '0x' + proofBuffer.toString('hex');

    // Clean up temp files
    fs.rmSync(sessionDir, { recursive: true, force: true });

    return NextResponse.json({
      success: true,
      proofHex,
      proofBytesLength: proofBuffer.length,
    });
  } catch (error: any) {
    console.error('API Proof Generation Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate ZK proof on server.' },
      { status: 500 }
    );
  }
}
