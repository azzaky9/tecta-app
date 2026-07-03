"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Wallet } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export function Navbar() {
  const [isVisible, setIsVisible] = useState(true);
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const initKit = async () => {
        try {
          const { StellarWalletsKit } = await import("@creit.tech/stellar-wallets-kit/sdk");
          const { defaultModules } = await import("@creit.tech/stellar-wallets-kit/modules/utils");
          const { SwkAppDarkTheme, KitEventType } = await import("@creit.tech/stellar-wallets-kit/types");

          StellarWalletsKit.init({
            modules: defaultModules(),
            theme: SwkAppDarkTheme,
          });

          try {
            const { address: currentAddress } = await StellarWalletsKit.getAddress();
            setAddress(currentAddress);
          } catch (e) {
            // Not connected
          }

          StellarWalletsKit.on(KitEventType.STATE_UPDATED, (event: any) => {
            setAddress(event.payload.address || null);
          });

          StellarWalletsKit.on(KitEventType.DISCONNECT, () => {
            setAddress(null);
          });
        } catch (e) {
          console.error("Failed to initialize StellarWalletsKit", e);
        }
      };
      initKit();
    }
  }, []);

  const handleConnectOrProfile = async () => {
    try {
      const { StellarWalletsKit } = await import("@creit.tech/stellar-wallets-kit/sdk");
      if (address) {
        document.body.style.overflow = "hidden";
        const { closeEvent } = await import("@creit.tech/stellar-wallets-kit/state");
        const sub = closeEvent.subscribe(() => {
          document.body.style.overflow = "";
          sub();
        });
        try {
          await StellarWalletsKit.profileModal();
        } catch (err) {
          document.body.style.overflow = "";
          sub();
          throw err;
        }
      } else {
        document.body.style.overflow = "hidden";
        try {
          const res = await StellarWalletsKit.authModal();
          setAddress(res.address);
        } finally {
          document.body.style.overflow = "";
        }
      }
    } catch (e) {
      console.warn("Authentication dismissed or failed", e);
    }
  };

  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout | null = null;
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const section2 = document.getElementById("architecture-section");
      let reachedSectionTwo = false;

      if (section2) {
        const rect = section2.getBoundingClientRect();
        reachedSectionTwo = rect.top <= 80;
      } else {
        reachedSectionTwo = currentScrollY > 200;
      }

      if (reachedSectionTwo) {
        if (Math.abs(currentScrollY - lastScrollY) > 2) {
          setIsVisible(false);
        }

        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          setIsVisible(true);
        }, 150);
      } else {
        setIsVisible(true);
        if (scrollTimeout) clearTimeout(scrollTimeout);
      }

      lastScrollY = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  }, []);

  return (
    <div
      className={cn(
        "fixed top-4 left-0 w-full z-50 px-container-margin transition-all duration-300 ease-in-out",
        isVisible ? "translate-y-0 opacity-100" : "-translate-y-20 opacity-0 pointer-events-none"
      )}
    >
      <nav className="flex justify-between items-center pl-4 pr-1.5 h-11 max-w-4xl mx-auto bg-white rounded-full shadow-[0_2px_8px_rgba(18,18,18,0.06),0_1px_2px_rgba(18,18,18,0.04),inset_0_1px_0_rgba(255,255,255,0.8)] transition-transform duration-200" id="top-nav">
        <div className="flex items-center">
          <div className="h-6 w-auto flex items-center gap-2">
            <Image src="/tecta.svg" alt="Tecta Protocol" width={22} height={22} />
            <span className="font-headline-sm text-sm font-bold text-primary">Tecta</span>
          </div>
        </div>

        <div className="hidden md:flex gap-1.5 font-body-md text-xs">
          <a className="text-primary font-semibold px-2.5 py-1 rounded-full bg-surface-container-low" href="#">Protocol</a>
          <a className="text-on-surface-variant hover:text-primary hover:bg-surface-container-low transition-colors px-2.5 py-1 rounded-full" href="#">Architecture</a>
          <a className="text-on-surface-variant hover:text-primary hover:bg-surface-container-low transition-colors px-2.5 py-1 rounded-full" href="#">Compliance</a>
          <a className="text-on-surface-variant hover:text-primary hover:bg-surface-container-low transition-colors px-2.5 py-1 rounded-full" href="#">Docs</a>
        </div>

        <div className="flex items-center gap-2">
          {address && (
            <Button asChild variant="outline" className="h-8 px-3 text-xs">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          )}
          <Button className="h-8 px-3 text-xs" onClick={handleConnectOrProfile}>
            <Wallet className="text-white text-sm mr-1" />
            {address ? `${address.slice(0, 4)}...${address.slice(-4)}` : "Connect"}
          </Button>
        </div>
      </nav>
    </div>
  );
}
