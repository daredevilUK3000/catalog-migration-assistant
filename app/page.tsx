import Hero from "@/components/Hero";
import HowItWorksSection from "@/components/HowItWorksSection";
import FeatureSection from "@/components/FeatureSection";
import TrustSection from "@/components/TrustSection";
import Footer from "@/components/Footer";
import ImportVisual from "@/components/visuals/ImportVisual";
import HealthVisual from "@/components/visuals/HealthVisual";
import ExportVisual from "@/components/visuals/ExportVisual";
import TrackerVisual from "@/components/visuals/TrackerVisual";
import { VinylRings, WaveformLine } from "@/components/BackgroundShapes";

export default function Home() {
  return (
    <main>
      <Hero />
      <HowItWorksSection />

      <div className="relative">
        <VinylRings className="pointer-events-none absolute -top-20 -right-32 w-[500px] h-[500px] text-[var(--ink)]" />
        <FeatureSection
          eyebrow="Step 1 — Universal Import"
          title="Upload a screenshot. Get a structured catalog."
          description="Screenshots, CSVs, PDFs, folders, pasted text — whatever you already have. AI extracts it once; you confirm it once. After that, it's just data."
          visual={<ImportVisual />}
          tint="paper"
        />
      </div>

      <div className="relative">
        <WaveformLine className="pointer-events-none absolute inset-x-0 top-0 w-full h-24 text-[var(--paper)]" />
        <FeatureSection
          eyebrow="Step 2 — Catalog Health"
          title="Know what's wrong before a distributor tells you."
          description="Duplicate ISRCs, missing lyrics, undersized artwork — flagged automatically, with no AI involved. Deterministic rules you can trust with royalty data."
          visual={<HealthVisual />}
          tint="ink"
          reverse
        />
      </div>

      <FeatureSection
        eyebrow="Step 3 — Distributor Export Packs"
        title="One master catalog. Any distributor's format."
        description="Bulk CSV where it's supported, a copy-paste-ready reference sheet where it isn't — mapped exactly to how each distributor expects it."
        visual={<ExportVisual />}
        tint="paper"
      />

      <FeatureSection
        eyebrow="Step 4 — Migration Tracker"
        title="Always know where every album stands."
        description="Imported, health-checked, packed, uploaded, verified — track every release through the migration, including takedown status where stream history matters."
        visual={<TrackerVisual />}
        tint="forest"
        reverse
      />

      <TrustSection />
      <Footer />
    </main>
  );
}
