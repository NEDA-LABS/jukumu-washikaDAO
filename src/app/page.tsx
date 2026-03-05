import Header from '@/components/Header';
import HeroSection from '@/components/HeroSection';
import AboutSection from '@/components/AboutSection';
import JoinCtaSection from '@/components/JoinCtaSection';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <HeroSection />
        <AboutSection />
        <JoinCtaSection />
      </main>
      <Footer />
    </div>
  );
}
