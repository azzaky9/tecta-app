import { Architecture } from "@/components/architecture";
import { CTA } from "@/components/cta";
import { Features } from "@/components/features";
import { Footer } from "@/components/footer";
import { Hero } from "@/components/hero";
import { Navbar } from "@/components/navbar";
import { BlurFade } from "@/components/ui/blur-fade";
import { FlickeringGrid } from "@/components/ui/flickering-grid";

export default function Home() {
  return (
    <div className="relative bg-background text-on-surface font-body-md antialiased min-h-screen flex flex-col pt-16 selection:bg-primary selection:text-on-primary overflow-x-hidden">
      {/* Full-bleed top page background animation */}
      <div className="absolute top-0 left-0 w-full h-[100vh] z-0 pointer-events-none opacity-60 overflow-hidden">
        <FlickeringGrid
          className="w-full h-full"
          squareSize={4}
          gridGap={6}
          flickerChance={0.1}
          color="#505f76"
          maxOpacity={0.4}
        />
        {/* Subtle fade out gradient blending into the bottom page sections */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
      </div>

      <Navbar />

      {/* Hero Section (Odd: Base Background / Transparent) */}
      <div className="w-full bg-transparent relative z-10">
        <div className="max-w-7xl mx-auto px-container-margin py-10 md:py-16">
          <BlurFade delay={0.1}>
            <Hero />
          </BlurFade>
        </div>
      </div>

      {/* Architecture Section (Even: White Background Band) */}
      <div id="architecture-section" className="w-full bg-white border-y border-slate-200/40 relative z-10">
        <div className="max-w-7xl mx-auto px-container-margin py-12 md:py-16">
          <BlurFade delay={0.2}>
            <Architecture />
          </BlurFade>
        </div>
      </div>

      {/* Features Section (Odd: Base Background / Transparent) */}
      <div className="w-full bg-transparent relative z-10">
        <div className="max-w-7xl mx-auto px-container-margin py-12 md:py-16">
          <BlurFade delay={0.25}>
            <Features />
          </BlurFade>
        </div>
      </div>

      {/* CTA Section (Even: White Background Band) */}
      <div className="w-full bg-white border-y border-slate-200/40 relative z-10">
        <div className="max-w-7xl mx-auto px-container-margin py-12 md:py-20">
          <BlurFade delay={0.3}>
            <CTA />
          </BlurFade>
        </div>
      </div>

      <Footer />
    </div>
  );
}
