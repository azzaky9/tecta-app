"use client";

import { useWallet } from "@/components/wallet-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WalletIcon, LogOutIcon, CopyIcon, CheckIcon } from "lucide-react";
import { useState } from "react";

export function NavWallet() {
  const { walletAddress, connectWallet, disconnectWallet, isConnecting } = useWallet();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!walletAddress) {
    return (
      <Button
        onClick={connectWallet}
        disabled={isConnecting}
        className="gap-2 h-9 px-4 text-xs font-semibold"
      >
        <WalletIcon className="h-4 w-4" />
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </Button>
    );
  }

  // Shorten the address for display (e.g. GBRP...ZOUQ)
  const shortAddress = `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 h-9 px-3 text-xs font-mono font-medium">
          <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>{shortAddress}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-1.5 p-3">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
            Connected Wallet
          </span>
          <div className="flex items-center justify-between gap-2 bg-muted/40 rounded-lg p-2 border border-border/40">
            <span className="font-mono text-xs truncate select-all">{walletAddress}</span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={handleCopy}
            >
              {copied ? (
                <CheckIcon className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <CopyIcon className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={disconnectWallet}
            className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
          >
            <LogOutIcon className="h-4 w-4 mr-2" />
            Disconnect Wallet
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
