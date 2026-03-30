import { HeroSection } from "./components/hero-section";
import { ProblemSection } from "./components/problem-section";
import { SolutionSection } from "./components/solution-section";
import { HowItWorksSection } from "./components/how-it-works-section";
import { FeaturesSection } from "./components/features-section";
import { DifferentiatorsSection } from "./components/differentiators-section";
import { PricingSection } from "./components/pricing-section";
import { UpcomingFeaturesSection } from "./components/upcoming-features-section";
import { DeveloperSection } from "./components/developer-section";
import { RoadmapSection } from "./components/roadmap-section";
import { CtaSection } from "./components/cta-section";
import { MarketingFooter } from "./components/marketing-footer";

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <ProblemSection />
      <SolutionSection />
      <HowItWorksSection />
      <FeaturesSection />
      <DifferentiatorsSection />
      <PricingSection />
      <UpcomingFeaturesSection />
      <DeveloperSection />
      <RoadmapSection />
      <CtaSection />
      <MarketingFooter />
    </>
  );
}
