import { HeroSection } from "./components/hero-section";
import { FeaturesSection } from "./components/features-section";
import { RoadmapSection } from "./components/roadmap-section";
import { OpenSourceSection } from "./components/opensource-section";
import { DeveloperSection } from "./components/developer-section";
import { MarketingFooter } from "./components/marketing-footer";

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <FeaturesSection />
      <RoadmapSection />
      <OpenSourceSection />
      <DeveloperSection />
      <MarketingFooter />
    </>
  );
}
