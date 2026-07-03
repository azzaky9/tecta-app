"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";
import { useWallet } from "@/components/wallet-provider";
import {
  PAYROLL_CONTRACT_ID,
  fetchRootHistory,
  getTokenBalance,
  getTokenDecimals,
  getPayrollTokenSymbol,
  fromRawAmount,
} from "@/lib/payroll-sdk";
import { ShieldCheckIcon, WalletIcon, SendIcon } from "lucide-react";
import { TokenXLM, TokenUSDC, NetworkStellar } from "@web3icons/react";

/** Only icons for the token actually configured on the payroll contract get shown — never a fabricated set. */
function TreasuryTokenIcon({ symbol }: { symbol: string | null }) {
  const TokenIcon = symbol?.toUpperCase().includes("USDC") ? TokenUSDC : TokenXLM;
  return (
    <div className="flex items-center">
      <NetworkStellar variant="branded" size={20} className="rounded-full ring-2 ring-background" />
      <TokenIcon variant="branded" size={20} className="-ml-2 rounded-full ring-2 ring-background" />
    </div>
  );
}

export default function DashboardPage() {
  const { walletAddress, connectWallet } = useWallet();

  const [walletBalance, setWalletBalance] = useState<string | null>(null);
  const [walletBalanceLoading, setWalletBalanceLoading] = useState(false);
  const [treasuryBalance, setTreasuryBalance] = useState<string | null>(null);
  const [tokenSymbol, setTokenSymbol] = useState<string | null>(null);
  const [roots, setRoots] = useState<string[] | null>(null);
  const [chainLoading, setChainLoading] = useState(true);

  // All figures below come straight from the contract/token on-chain state.
  useEffect(() => {
    (async () => {
      try {
        const decimals = await getTokenDecimals();
        const [rootHistory, treasuryRaw, symbol] = await Promise.all([
          fetchRootHistory(),
          getTokenBalance(PAYROLL_CONTRACT_ID),
          getPayrollTokenSymbol(),
        ]);
        setRoots(rootHistory);
        setTreasuryBalance(fromRawAmount(treasuryRaw, decimals));
        setTokenSymbol(symbol);
      } catch {
        setRoots(null);
        setTreasuryBalance(null);
      } finally {
        setChainLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!walletAddress) {
      setWalletBalance(null);
      return;
    }
    setWalletBalanceLoading(true);
    (async () => {
      try {
        const [raw, decimals] = await Promise.all([
          getTokenBalance(walletAddress),
          getTokenDecimals(),
        ]);
        setWalletBalance(fromRawAmount(raw, decimals));
      } catch {
        setWalletBalance(null);
      } finally {
        setWalletBalanceLoading(false);
      }
    })();
  }, [walletAddress]);

  const latestRoot = roots && roots.length > 0 ? roots[roots.length - 1] : null;
  const batchesDisbursed = roots ? Math.max(roots.length - 1, 0) : null;

  const treasuryNum = treasuryBalance ? parseFloat(treasuryBalance) : null;
  const walletNum = walletBalance ? parseFloat(walletBalance) : null;

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Confidential payroll settlement dashboard
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-border shadow-none rounded-lg">
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Treasury Balance
            </CardTitle>
            {chainLoading ? (
              <WalletIcon className="h-4 w-4 text-muted-foreground" />
            ) : (
              <TreasuryTokenIcon symbol={tokenSymbol} />
            )}
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {chainLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{treasuryBalance ?? "—"}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Held by the payroll contract</p>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-none rounded-lg">
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Batches Disbursed
            </CardTitle>
            <SendIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {chainLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{batchesDisbursed ?? "—"}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Total get_roots() entries</p>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-none rounded-lg">
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Latest Merkle Root
            </CardTitle>
            <ShieldCheckIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {chainLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : latestRoot ? (
              <div className="text-lg font-bold font-mono">
                {latestRoot.slice(0, 10)}…{latestRoot.slice(-6)}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Unavailable</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">On-chain get_roots()</p>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-none rounded-lg">
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Wallet Balance
            </CardTitle>
            <WalletIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {!walletAddress ? (
              <button
                onClick={connectWallet}
                className="text-sm text-primary hover:underline"
              >
                Connect wallet to view
              </button>
            ) : walletBalanceLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{walletBalance ?? "—"}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {walletAddress ? "Your connected wallet" : "Used for disburse_batch"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Balances chart — Treasury vs connected wallet, both live on-chain reads */}
      <Card className="border border-border shadow-none rounded-lg">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Treasury vs Wallet Balance
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {!walletAddress ? (
            <button
              onClick={connectWallet}
              className="text-sm text-primary hover:underline"
            >
              Connect wallet to compare balances
            </button>
          ) : chainLoading || walletBalanceLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : treasuryNum === null || walletNum === null ? (
            <div className="text-sm text-muted-foreground">Balance data unavailable</div>
          ) : (
            <BalanceBarChart treasury={treasuryNum} wallet={walletNum} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BalanceBarChart({ treasury, wallet }: { treasury: number; wallet: number }) {
  const max = Math.max(treasury, wallet, 1);
  const bars = [
    { label: "Treasury", value: treasury, color: "#2a78d6" },
    { label: "Wallet", value: wallet, color: "#1baf7a" },
  ];

  return (
    <div className="flex items-end gap-8 h-40 border-b border-border pt-6">
      {bars.map((bar) => (
        <div key={bar.label} className="flex flex-col items-center gap-1.5" title={`${bar.label}: ${bar.value.toLocaleString()}`}>
          <span className="text-xs font-medium text-foreground">
            {bar.value.toLocaleString()}
          </span>
          <div
            className="w-6 rounded-t"
            style={{
              height: `${Math.max((bar.value / max) * 100, 2)}px`,
              backgroundColor: bar.color,
            }}
          />
          <span className="text-xs text-muted-foreground mt-1">{bar.label}</span>
        </div>
      ))}
    </div>
  );
}
