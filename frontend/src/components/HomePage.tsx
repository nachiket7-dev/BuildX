import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AmbientBackground } from './AmbientBackground';
import { MarketingHeader } from './MarketingHeader';
import { PageHead } from './PageHead';
import { BentoGrid } from './BentoGrid';
import { GridBeams } from './GridBeams';
import { Hero } from './Hero';
import { FAQSection } from './FAQSection';
import { Footer } from './Footer';
import { LandingPreloader } from './LandingPreloader';

export function HomePage() {
  const navigate = useNavigate();
  const [preloaderDone, setPreloaderDone] = useState(false);

  return (
    <>
      {/* Sylven-style editorial preloader — slides away on completion */}
      <AnimatePresence>
        {!preloaderDone && (
          <LandingPreloader onComplete={() => setPreloaderDone(true)} />
        )}
      </AnimatePresence>

      <div className="min-h-screen flex flex-col relative bg-obsidian-bg text-white overflow-x-hidden">
        <PageHead
          title="BuildX — AI Full-Stack App Architect"
          description="Turn plain-English app ideas into production-ready monorepos with multi-model AI orchestration."
        />
        <GridBeams />
        <AmbientBackground />

        <div className="relative z-10 flex flex-col min-h-screen">
          {/* 1. Low-profile glass header with status pill, Launch Studio CTA, & 2-line animated hamburger */}
          <MarketingHeader />

          {/* 2. Hero with simulated multi-model pipeline widget */}
          <main className="flex-1 flex flex-col">
            <Hero
              onGenerate={(idea) => navigate('/create', { state: { idea } })}
              isLoading={false}
            />

            {/* 3. Interactive Bento Grid Showcase */}
            <section id="features" className="w-full">
              <BentoGrid />
            </section>

            {/* 4. Interactive 2-column FAQ Section with accordion reveals */}
            <FAQSection />
          </main>

          {/* 5. Monolithic dark studio footer */}
          <Footer />
        </div>
      </div>
    </>
  );
}
