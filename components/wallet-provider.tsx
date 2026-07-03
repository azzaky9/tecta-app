"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

type WalletContextType = {
  walletAddress: string | null;
  isConnecting: boolean;
  connectWallet: () => Promise<string | null>;
  disconnectWallet: () => Promise<void>;
};

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const initAndCheck = async () => {
      try {
        const { StellarWalletsKit } = await import("@creit.tech/stellar-wallets-kit/sdk");
        const { defaultModules } = await import("@creit.tech/stellar-wallets-kit/modules/utils");
        const { SwkAppDarkTheme } = await import("@creit.tech/stellar-wallets-kit/types");
        const { Networks } = await import("@creit.tech/stellar-wallets-kit");

        StellarWalletsKit.init({
          modules: defaultModules(),
          network: Networks.TESTNET,
          theme: SwkAppDarkTheme,
        });

        // Check if there is an active session address
        const res = await StellarWalletsKit.getAddress().catch(() => null);
        if (res && res.address) {
          setWalletAddress(res.address);
        }

        // Listen for events
        const { KitEventType } = await import("@creit.tech/stellar-wallets-kit");
        StellarWalletsKit.on(KitEventType.STATE_UPDATED, (event) => {
          if (event.payload?.address) {
            setWalletAddress(event.payload.address);
          } else {
            setWalletAddress(null);
          }
        });
      } catch (err) {
        console.warn("Wallet listener initialization failed:", err);
      }
    };

    initAndCheck();
  }, []);

  const connectWallet = async () => {
    setIsConnecting(true);
    try {
      const { StellarWalletsKit } = await import("@creit.tech/stellar-wallets-kit/sdk");
      const res = await StellarWalletsKit.authModal();
      setWalletAddress(res.address);
      return res.address;
    } catch (e) {
      console.warn("Wallet connection failed:", e);
      return null;
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = async () => {
    try {
      const { StellarWalletsKit } = await import("@creit.tech/stellar-wallets-kit/sdk");
      await StellarWalletsKit.disconnect();
      setWalletAddress(null);
    } catch (e) {
      console.warn("Disconnect failed:", e);
    }
  };

  return (
    <WalletContext.Provider
      value={{
        walletAddress,
        isConnecting,
        connectWallet,
        disconnectWallet,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
