"use client";

import { EncryptedText } from "@/components/ui/encrypted-text";
import StarBorder from "@/components/ui/star-border";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function Hero() {
  return (
    <section className="relative flex flex-col items-center justify-center text-center gap-stack-lg min-h-[75vh] py-12 md:py-24 max-w-5xl mx-auto w-full">
      {/* Foreground Content */}
      <div className="flex flex-col items-center gap-6 max-w-4xl px-container-margin">
        {/* Phonetic Pronunciation */}
        <span className="font-mono text-xs text-secondary tracking-wider select-none mb-1">
          Tecta · <span className="italic">tek-tah</span>
        </span>

        <h1 className="font-headline-lg text-primary tracking-tight text-4xl md:text-6xl lg:text-7xl leading-tight md:leading-tight lg:leading-tight">
          The Confidential Settlement Layer for Global Payroll
        </h1>
        <p className="font-body-lg text-secondary max-w-2xl text-sm md:text-base leading-relaxed min-h-[60px] select-none">
          <EncryptedText
            text="Execute institutional disbursements on public networks with zero-knowledge cryptography. Absolute transactional privacy, verifiable compliance, and deterministic execution."
            encryptedClassName="text-neutral-400 font-mono"
            revealedClassName="text-secondary"
            revealDelayMs={12}
            flipDelayMs={30}
          />
        </p>
        <div className="flex flex-col sm:flex-row gap-4 mt-6 justify-center items-center w-full sm:w-auto">
          <StarBorder as={Link} href="/dashboard" color="#38bdf8" speed="4s" className="w-full sm:w-auto">
            <span className="flex items-center justify-center gap-2 px-8 py-3.5 text-base font-semibold">
              Launch Dashboard <ArrowRight className="h-4 w-4" />
            </span>
          </StarBorder>
          <Link
            href="#"
            className="w-full sm:w-auto flex items-center justify-center px-8 py-3.5 text-base font-semibold rounded-full border border-border bg-white/80 backdrop-blur-sm hover:bg-white transition-colors"
          >
            Read Whitepaper
          </Link>
        </div>
      </div>
    </section>
  );
}
