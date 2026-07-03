const { execSync } = require("child_process");

const FIELD_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

function getRecipientFieldElement(gAddress) {
  const { Keypair } = require("@stellar/stellar-sdk");
  const keypair = Keypair.fromPublicKey(gAddress);
  const rawBytes = keypair.rawPublicKey();
  const hex = "0x" + Array.from(rawBytes).map(b => b.toString(16).padStart(2, "0")).join("");
  return BigInt(hex);
}

function generate() {
  console.log("Searching for a BN254-compatible seed phrase using Stellar CLI...");
  let attempts = 0;
  while (true) {
    attempts++;
    try {
      // Remove previous temp if exists
      try {
        execSync("stellar keys rm temp_comp", { stdio: "ignore" });
      } catch (e) {}

      // Generate a new keypair
      execSync("stellar keys generate temp_comp", { stdio: "ignore" });

      // Get its address
      const addr = execSync("stellar keys address temp_comp").toString().trim();
      const val = getRecipientFieldElement(addr);

      if (val < FIELD_MODULUS && addr.startsWith("GA")) {
        // Get the phrase
        const phrase = execSync("stellar keys secret temp_comp --phrase").toString().trim();
        console.log(`\nSuccess! Found compatible seed phrase in ${attempts} attempts:`);
        console.log(`Address:     ${addr}`);
        console.log(`Seed Phrase: ${phrase}`);
        
        // Save it permanently as employee_seed
        try {
          execSync("stellar keys rm employee_seed", { stdio: "ignore" });
        } catch (e) {}
        execSync(`stellar keys generate employee_seed --seed "${phrase}"`, { stdio: "ignore" });
        console.log(`\nSuccessfully saved to Stellar CLI keys vault as 'employee_seed'!`);
        
        // Cleanup temp
        execSync("stellar keys rm temp_comp", { stdio: "ignore" });
        break;
      }
    } catch (err) {
      console.error("Error during generation attempt:", err.message);
    }
  }
}

generate();
