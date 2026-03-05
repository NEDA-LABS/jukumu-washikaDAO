import Header from '@/components/Header';
import RegistrationSection from '@/components/RegistrationSection';
import Footer from '@/components/Footer';

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-card">
      <Header />
      <main>
        <RegistrationSection title="Jisajili kwa washikaDAU" />
      </main>
      <Footer />
    </div>
  );
}
