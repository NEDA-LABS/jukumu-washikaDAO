import Header from '@/components/Header';
import LandingPage from '@/components/landing/LandingPage';
import DevelopersSection from '@/components/DevelopersSection';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        {/* One continuous document now. The old ScrollExpandSection wrappers
            are gone: they scaled whole sections on scroll, which fought the
            new per-block reveal and made the hard-offset shadows shear. */}
        <LandingPage />
        <DevelopersSection />
      </main>
      <Footer />
    </div>
  );
}
