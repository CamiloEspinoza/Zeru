import { HeroSection } from "./components/hero-section";
import { ProblemSection } from "./components/problem-section";
import { SolutionSection } from "./components/solution-section";
import { HowItWorksSection } from "./components/how-it-works-section";
import { FeaturesSection } from "./components/features-section";
import { PricingSection } from "./components/pricing-section";
import { UpcomingFeaturesSection } from "./components/upcoming-features-section";
import { CtaSection } from "./components/cta-section";
import { DeveloperSection } from "./components/developer-section";
import { MarketingFooter } from "./components/marketing-footer";

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <ProblemSection />
      <SolutionSection />
      <HowItWorksSection />
      <FeaturesSection />
      <PricingSection />
      <UpcomingFeaturesSection />
      <CtaSection />
      <DeveloperSection />
      <MarketingFooter />
    </>
  );
}
