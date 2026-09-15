import { ScrollReveal } from "./animations/ScrollReveal";
import { MarketingHeader } from "./MarketingHeader";
import { PageHead } from "./PageHead";
import { LandingHero } from "./landing/LandingHero";
import { MechanismSection } from "./landing/MechanismSection";
import { ProofSection } from "./landing/ProofSection";
import { FAQSection } from "./FAQSection";
import { Footer } from "./Footer";
export function HomePage({ ready = true }: { ready?: boolean }) {
  return (
    <div className="landing-page page-grid">
      <PageHead
        title="From idea to architecture"
        description="Explore BuildX: a connected workspace for app architecture, editable code, and previews. Start your next project in Studio."
      />
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <MarketingHeader />
      <main id="main-content">
        <LandingHero ready={ready} />
        <ScrollReveal distance={14} duration={0.4}>
          <MechanismSection />
        </ScrollReveal>
        <ScrollReveal distance={14} duration={0.4}>
          <ProofSection />
        </ScrollReveal>
        <ScrollReveal distance={14} duration={0.4}>
          <FAQSection />
        </ScrollReveal>
      </main>
      <Footer />
    </div>
  );
}
