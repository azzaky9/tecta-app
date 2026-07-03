"use client";

import Image from "next/image";

export function Footer() {
  return (
    <footer className="w-full bg-white border-t border-slate-200/60 py-16 px-container-margin mt-16 relative z-10">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10">
        {/* Column 1: Brand & Status */}
        <div className="flex flex-col gap-4 col-span-1 md:col-span-1">
          <div className="flex items-center gap-2">
            <Image src="/tecta.svg" alt="Tecta" width={26} height={26} />
            <span className="font-headline-sm text-base font-bold text-primary">Tecta</span>
          </div>
          <p className="font-body-md text-xs text-secondary leading-relaxed max-w-xs">
            The decentralized settlement layer for institutional-grade operational payments and zero-knowledge payroll.
          </p>
          {/* Status Indicator */}
          <div className="flex items-center gap-2 mt-2 w-fit bg-white border border-slate-200 px-3 py-1 rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
            </span>
            <span className="font-mono text-[9px] font-semibold text-slate-600 tracking-wider">
              SOROBAN MAINNET: OPERATIONAL
            </span>
          </div>
        </div>

        {/* Column 2: Protocol */}
        <div className="flex flex-col gap-3">
          <span className="font-label-caps text-[10px] font-bold text-slate-400 tracking-widest uppercase">
            Protocol
          </span>
          <div className="flex flex-col gap-2.5 text-xs">
            <a className="text-secondary hover:text-primary transition-colors font-medium" href="#">
              Noir Circuits
            </a>
            <a className="text-secondary hover:text-primary transition-colors font-medium" href="#">
              Soroban Contracts
            </a>
            <a className="text-secondary hover:text-primary transition-colors font-medium" href="#">
              Confidential Token Standard
            </a>
            <a className="text-secondary hover:text-primary transition-colors font-medium" href="#">
              Developer Portal
            </a>
          </div>
        </div>

        {/* Column 3: Security & Audits */}
        <div className="flex flex-col gap-3">
          <span className="font-label-caps text-[10px] font-bold text-slate-400 tracking-widest uppercase">
            Security & Audits
          </span>
          <div className="flex flex-col gap-2.5 text-xs">
            <a className="text-secondary hover:text-primary transition-colors font-medium" href="#">
              Halborn Audit Report (Q1 2026)
            </a>
            <a className="text-secondary hover:text-primary transition-colors font-medium" href="#">
              Cryptographic Proof Specs
            </a>
            <a className="text-secondary hover:text-primary transition-colors font-medium" href="#">
              Compliance Frameworks
            </a>
            <a className="text-secondary hover:text-primary transition-colors font-medium" href="#">
              Bug Bounty Program
            </a>
          </div>
        </div>

        {/* Column 4: Links */}
        <div className="flex flex-col gap-3">
          <span className="font-label-caps text-[10px] font-bold text-slate-400 tracking-widest uppercase">
            Corporate
          </span>
          <div className="flex flex-col gap-2.5 text-xs">
            <a className="text-secondary hover:text-primary transition-colors font-medium" href="#">
              Whitepaper
            </a>
            <a className="text-secondary hover:text-primary transition-colors font-medium" href="#">
              Research Notes
            </a>
            <a className="text-secondary hover:text-primary transition-colors font-medium" href="#">
              Terms & Conditions
            </a>
            <a className="text-secondary hover:text-primary transition-colors font-medium" href="#">
              Contact Desk
            </a>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="max-w-7xl mx-auto border-t border-slate-200/50 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] text-slate-400 font-mono">
        <span>© 2026 Tecta Protocol. Zero-Knowledge Cryptography. All rights reserved.</span>
        <div className="flex gap-6">
          <a className="hover:text-primary transition-colors" href="#">GitHub</a>
          <a className="hover:text-primary transition-colors" href="#">Twitter / X</a>
          <a className="hover:text-primary transition-colors" href="#">Discord</a>
        </div>
      </div>
    </footer>
  );
}
