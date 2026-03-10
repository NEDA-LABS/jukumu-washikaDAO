import Header from '@/components/Header';
import HeroSection from '@/components/HeroSection';
import AboutSection from '@/components/AboutSection';
import InvestorSection from '@/components/InvestorSection';
import JoinCtaSection from '@/components/JoinCtaSection';
import Footer from '@/components/Footer';
import ScrollExpandSection from '@/components/ScrollExpandSection';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <HeroSection />
        <ScrollExpandSection>
          <AboutSection />
        </ScrollExpandSection>
        <ScrollExpandSection>
          <InvestorSection />
        </ScrollExpandSection>
        <ScrollExpandSection>
          <JoinCtaSection />
        </ScrollExpandSection>
      </main>
      <Footer />
    </div>
  );
}
