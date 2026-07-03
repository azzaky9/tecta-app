"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  SparklesIcon,
  WandSparklesIcon,
  WalletIcon,
  CopyIcon,
  CheckIcon,
  LogOutIcon,
} from "lucide-react";
import { FlickeringGrid } from "@/components/ui/flickering-grid";
import { Card } from "@/components/ui/card";
import { ClaimStepperModal, type ClaimStepKey } from "@/components/claim-stepper-modal";
import { WalletProvider, useWallet } from "@/components/wallet-provider";
import { TokenXLM, TokenUSDC } from "@web3icons/react";
import {
  FIELD_MODULUS,
  generateNullifier,
  generateClaimProofLocal,
  claimSalarySponsored,
  getRecipientFieldElement,
  getTokenDecimals,
  getPayrollTokenSymbol,
  toRawAmount,
} from "@/lib/payroll-sdk";

type ClaimLink = {
  root: string;
  amount: string; // human-readable
  privateKey: string;
  salt: string;
  treeIndex: number;
  siblingPath: string[];
  name?: string;
};

function parseClaimLink(params: URLSearchParams): ClaimLink | null {
  const root = params.get("root");
  const amount = params.get("amount");
  const privateKey = params.get("pk");
  const salt = params.get("salt");
  const idx = params.get("idx");
  const path = params.get("path");
  const name = params.get("name") ?? undefined;

  if (!root || !amount || !privateKey || !salt || idx === null || !path) return null;

  const siblingPath = path.split(",").map((h) => (h.startsWith("0x") ? h : `0x${h}`));
  if (siblingPath.length !== 8) return null;

  return {
    root: root.startsWith("0x") ? root : `0x${root}`,
    amount,
    privateKey,
    salt,
    treeIndex: Number(idx),
    siblingPath,
    name,
  };
}

/** Client-side search for a Stellar keypair whose raw pubkey fits the BN254 field the circuit uses. */
async function generateCompatibleWallet(): Promise<{ publicKey: string; secret: string }> {
  const { Keypair } = await import("@stellar/stellar-sdk");
  for (let i = 0; i < 5000; i++) {
    const kp = Keypair.random();
    const raw = kp.rawPublicKey();
    const hex = "0x" + Array.from(raw).map((b) => b.toString(16).padStart(2, "0")).join("");
    if (BigInt(hex) < FIELD_MODULUS) {
      return { publicKey: kp.publicKey(), secret: kp.secret() };
    }
  }
  throw new Error("Could not find a compatible wallet, try again.");
}

/** Only shows the icon for whatever token the contract's symbol() actually resolves to. */
function TokenIcon({ symbol, size }: { symbol: string | null; size: number }) {
  const Icon = symbol?.toUpperCase().includes("USDC") ? TokenUSDC : TokenXLM;
  return <Icon variant="branded" size={size} />;
}

export default function PublicClaimPage() {
  return (
    <WalletProvider>
      <Suspense fallback={<ClaimBackground><div /></ClaimBackground>}>
        <PublicClaimPageInner />
      </Suspense>
    </WalletProvider>
  );
}

function ClaimBackground({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen w-full bg-background overflow-hidden flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 z-0 opacity-60">
        <FlickeringGrid
          className="w-full h-full"
          squareSize={4}
          gridGap={6}
          flickerChance={0.1}
          color="#505f76"
          maxOpacity={0.4}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
      </div>
      <div className="relative z-10 w-full flex justify-center">{children}</div>
    </div>
  );
}

function PublicClaimPageInner() {
  const searchParams = useSearchParams();
  const [link] = useState(() => parseClaimLink(searchParams));
  const { walletAddress, connectWallet, disconnectWallet, isConnecting } = useWallet();

  const [recipient, setRecipient] = useState("");
  const [recipientError, setRecipientError] = useState("");
  const [generatingWallet, setGeneratingWallet] = useState(false);
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [decimals, setDecimals] = useState<number | null>(null);
  const [tokenSymbol, setTokenSymbol] = useState<string | null>(null);
  const [nullifier, setNullifier] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [status, setStatus] = useState<ClaimStepKey | "error">("proving");
  const [errorMessage, setErrorMessage] = useState("");
  const [txHash, setTxHash] = useState("");

  useEffect(() => {
    getTokenDecimals().then(setDecimals);
    getPayrollTokenSymbol().then(setTokenSymbol);
    if (link) setNullifier(generateNullifier(link.privateKey, link.salt));
  }, [link]);

  if (!link) {
    return (
      <ClaimBackground>
        <Card className="w-full max-w-md border border-border shadow-none rounded-lg p-8 text-center">
          <h1 className="text-lg font-semibold">Invalid claim link</h1>
          <p className="text-sm text-muted-foreground mt-2">
            This link is missing or malformed. Ask HR to resend your salary claim email.
          </p>
        </Card>
      </ClaimBackground>
    );
  }

  const handleConnectWallet = async () => {
    const addr = await connectWallet();
    if (!addr) return;
    try {
      await getRecipientFieldElement(addr);
      setRecipient(addr);
      setGeneratedSecret(null);
      setRecipientError("");
    } catch (e: any) {
      setRecipientError(
        "Connected wallet isn't compatible with this proof system — generate a compatible wallet instead."
      );
    }
  };

  const handleGenerateWallet = async () => {
    setGeneratingWallet(true);
    try {
      const wallet = await generateCompatibleWallet();
      setRecipient(wallet.publicKey);
      setGeneratedSecret(wallet.secret);
      setRecipientError("");
    } catch (e: any) {
      setRecipientError(e.message || "Failed to generate wallet");
    } finally {
      setGeneratingWallet(false);
    }
  };

  const handleCopySecret = () => {
    if (!generatedSecret) return;
    navigator.clipboard.writeText(generatedSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClaim = async () => {
    if (!recipient) {
      setRecipientError("Enter or generate a Stellar wallet address to receive your salary.");
      return;
    }

    setRecipientError("");
    try {
      await getRecipientFieldElement(recipient);
    } catch (e: any) {
      setRecipientError(e.message || "That wallet address isn't compatible — generate one instead.");
      return;
    }

    setModalOpen(true);
    setStatus("proving");
    setErrorMessage("");

    try {
      const tokenDecimals = decimals ?? (await getTokenDecimals());
      const rawAmount = toRawAmount(link.amount, tokenDecimals);

      const proofBytes = await generateClaimProofLocal(
        {
          amount: rawAmount,
          privateKey: link.privateKey.startsWith("0x") ? link.privateKey : BigInt(link.privateKey),
          salt: link.salt.startsWith("0x") ? link.salt : BigInt(link.salt),
          treeIndex: BigInt(link.treeIndex),
          siblingPath: link.siblingPath,
        },
        { root: link.root, nullifier, recipientAddress: recipient }
      );

      setStatus("submitting");
      const result = await claimSalarySponsored(link.root, nullifier, recipient, rawAmount, proofBytes.proof);

      if (result.success && result.txHash) {
        setTxHash(result.txHash);
        setStatus("success");
      } else {
        setStatus("error");
        setErrorMessage(result.error || "Claim failed. Your link is still valid — try again.");
      }
    } catch (e: any) {
      setStatus("error");
      setErrorMessage(e.message || "Something went wrong generating your proof.");
    }
  };

  const displayAmount = decimals !== null ? link.amount : "…";

  return (
    <ClaimBackground>
      <Card className="w-full max-w-md border border-border shadow-none rounded-lg p-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center text-center gap-2">
            <Image src="/tecta.svg" alt="Tecta" width={32} height={32} />
            <h1 className="text-lg font-semibold">
              {link.name ? `Hi ${link.name}, your salary is ready` : "Your salary is ready to claim"}
            </h1>
            <p className="text-xs text-muted-foreground">
              Privately verified with a zero-knowledge proof — nobody but you can see this claim.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-5 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Amount</p>
            <div className="flex items-center justify-center gap-2 mt-1">
              <TokenIcon symbol={tokenSymbol} size={24} />
              <p className="text-3xl font-bold">{displayAmount}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted-foreground">
              Wallet to receive your salary
            </label>
            <input
              value={recipient}
              onChange={(e) => {
                setRecipient(e.target.value.trim());
                setGeneratedSecret(null);
                setRecipientError("");
              }}
              placeholder="GA..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {recipientError && (
              <p className="text-xs text-red-600">{recipientError}</p>
            )}

            <div className="flex items-center justify-center gap-4 mt-1">
              {walletAddress ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <WalletIcon className="h-3.5 w-3.5" />
                  Connected: {walletAddress.slice(0, 4)}…{walletAddress.slice(-4)}
                  <button
                    onClick={() => {
                      disconnectWallet();
                      if (recipient === walletAddress) setRecipient("");
                    }}
                    className="flex items-center gap-1 text-muted-foreground hover:text-red-600"
                  >
                    <LogOutIcon className="h-3.5 w-3.5" />
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleConnectWallet}
                  disabled={isConnecting}
                  className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <WalletIcon className="h-3.5 w-3.5" />
                  {isConnecting ? "Connecting…" : "Connect Wallet"}
                </button>
              )}
              <span className="text-xs text-muted-foreground">or</span>
              <button
                onClick={handleGenerateWallet}
                disabled={generatingWallet}
                className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <WandSparklesIcon className="h-3.5 w-3.5" />
                {generatingWallet ? "Generating…" : "Generate one"}
              </button>
            </div>

            {generatedSecret && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mt-1">
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Save this secret key now — it's the only way to access these funds later.
                  It's never sent anywhere.
                </p>
                <div className="flex items-center justify-between gap-2 mt-2 bg-white rounded-md px-2 py-1.5 border border-amber-200">
                  <span className="font-mono text-[10px] text-amber-900 truncate select-all">
                    {generatedSecret}
                  </span>
                  <button onClick={handleCopySecret} className="shrink-0 text-amber-700 hover:text-amber-900">
                    {copied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleClaim}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-sm h-11 transition-colors"
          >
            <SparklesIcon className="h-4 w-4" />
            Claim Salary
          </button>

          <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
            No wallet signature required — your proof alone authorizes this claim.
            Fees are covered for you.
          </p>

          <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/70">
            <Image src="/tecta.svg" alt="" width={12} height={12} />
            Powered by Tecta
          </div>
        </div>
      </Card>

      <ClaimStepperModal
        open={modalOpen}
        status={status}
        errorMessage={errorMessage}
        txHash={txHash}
        onClose={() => setModalOpen(false)}
      />
    </ClaimBackground>
  );
}
