import { generateClaimProofLocal, generateNullifier } from '@/lib/payroll-sdk';

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 7) {
    console.error(
      "Usage: bun run scripts/cli-claim-proof.ts <privateKey> <salt> <treeIndex> <siblingPath_csv> <amount> <root> <recipientAddress>"
    );
    process.exit(1);
  }

  const privateKey = args[0];
  const salt = args[1];
  const treeIndex = parseInt(args[2], 10);
  const siblingPath = args[3].split(',');
  const amount = parseInt(args[4], 10);
  const root = args[5];
  const recipientAddress = args[6];

  // The TS version requires the nullifier to be computed and passed in
  const nullifier = generateNullifier(privateKey, salt);

  const secrets = {
    amount,
    privateKey,
    salt,
    treeIndex,
    siblingPath,
  };

  const publicInputs = {
    root,
    nullifier,
    recipientAddress,
  };

  console.log("Starting proof generation with provided arguments using TS SDK...");

  try {
    const proofBytes = await generateClaimProofLocal(secrets, publicInputs);
    const proofHex = Buffer.from(proofBytes.proof).toString('hex');
    console.log("\n✅ Proof generated successfully!");
    console.log("Proof (hex):", proofHex);
    console.log("Nullifier:", nullifier);
    process.exit(0);
  } catch (err) {
    console.error("\n❌ Error generating proof:", err);
    process.exit(1);
  }
}

main();
