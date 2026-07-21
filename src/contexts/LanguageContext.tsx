'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'sw' | 'en';

interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
  t: (key: string) => string;
}

const translations = {
  sw: {
    // Header
    'nav.home': 'Nyumbani',
    'nav.about': 'Kuhusu',
    'nav.how_it_works': 'Jinsi Inavyofanya Kazi',
    'nav.impact': 'Athari',
    'nav.join': 'Jiunge',
    'nav.investor': 'Wekeza',
    'nav.login': 'Ingia',
    
    // Hero Section
    'hero.title': 'Washika DAU – Kuunganisha Wajasiriamali na Ustawi wa Jamii',
    'hero.subtitle': 'Akiba. Mafunzo. Uwekezaji. Kila kitu unachohitaji kukua kiuchumi — katika jamii moja iliyounganishwa.',
    'hero.cta.entrepreneur': 'Jisajili Sasa',
    'hero.cta.investor': 'Shirikiana Nasi',
    'hero.learn_more': 'Jifunze',
    
    // About Section
    'about.title': 'Kuhusu Washika DAU',
    'about.vision.title': 'Maono',
    'about.vision.text': 'Kuwa kitovu cha maendeleo ya kijamii na kiuchumi kinacholenga kujenga uchumi wa mzunguko endelevu.',
    'about.mission.title': 'Dhamira',
    'about.mission.text': 'Kuwawezesha wajasiriamali wadogo kupitia mafunzo, mtandao, na uongozi wa kiuchumi.',
    'about.values.title': 'Maadili',
    'about.values.text': 'Uwazi, Ushirikiano, Uongozi, na Maendeleo Endelevu.',
    
    // How It Works
    'how_it_works.title': 'Jinsi Washika DAU Inavyofanya Kazi',
    'how_it_works.step1.title': 'Uanachama na Mafunzo',
    'how_it_works.step1.text': 'Wajasiriamali wanajiunga kupitia vikundi, kulipa ada ndogo ya kila mwezi, na kupata mafunzo.',
    'how_it_works.step2.title': 'Uwekezaji wa Mtaji',
    'how_it_works.step2.text': 'Washika DAU inawekeza katika vikundi, hisa ya 30% ya uongozi.',
    'how_it_works.step3.title': 'Uchumi wa Mzunguko',
    'how_it_works.step3.text': 'Rasilimali zinazunguka ndani ya mtandao.',
    'how_it_works.step4.title': 'Ustawi wa Pamoja',
    'how_it_works.step4.text': 'Faida na mgao wa faida vinashirikiwa.',
    
    // Impact
    'impact.title': 'Athari Yetu',
    'impact.groups': 'Vikundi',
    'impact.cbts': 'CBTs',
    'impact.businesses': 'Biashara',
    'impact.growing': 'Mtandao Unaokua',
    
    // Registration
    'registration.title': 'Jisajili kwa Washika DAU',
    'registration.name': 'Jina Kamili',
    'registration.contact': 'Mawasiliano (Simu/Barua pepe)',
    'registration.location': 'Mahali',
    'registration.business_type': 'Aina ya Biashara',
    'registration.group_name': 'Jina la Kundi (ikiwa tayari uko katika kimoja)',
    'registration.gender': 'Jinsia',
    'registration.age': 'Umri',
    'registration.submit': 'Wasilisha',
    
    // Investor Section
    'investor.title': 'Kwa Nini Uwekeze na Washika DAU?',
    'investor.subtitle': 'Mfumo wa hisa ya 30%, uongozi wa kijamii, athari endelevu.',
    'investor.cta': 'Pakua Hati za Mwekezaji',
    'investor.eyebrow': 'Wekeza',
    'investor.intro': 'Tunashirikiana na wawekezaji ambao wanaelewa kwamba ukuaji wa kweli unaanzia katika jamii.',
    'investor.card1.title': 'Mfumo wa Hisa',
    'investor.card1.text': 'Unapowekeza katika kundi la Washika DAU, unapata hisa ya moja kwa moja ndani ya biashara zao. Mapato yanashirikiwa kwa uwazi kulingana na mikataba iliyowekwa wazi.',
    'investor.card2.title': 'Ufuatiliaji wa Wakati Halisi',
    'investor.card2.text': 'Kila muamala, malipo, na mkutano wa kundi unaweza kuonekana kupitia dashibodi yetu. Uwazi kamili — hakuna siri.',
    'investor.card3.title': 'Athari ya Kijamii',
    'investor.card3.text': 'Uwekezaji wako unasaidia wajasiriamali wadogo kupata mtaji, mafunzo, na mtandao wa kuwaendeleza biashara zao.',
    'investor.contact': 'Wasiliana nasi',

    // Hero extras
    'hero.motto': 'Pamoja Tunajengana',
    'hero.cta.join': 'Jiunge Sasa',
    'hero.stat.groups': 'Vikundi',
    'hero.stat.businesses': 'Biashara',
    'hero.stat.trainers': 'Wakufunzi',

    // About / process rail
    'about.eyebrow': 'Mchakato Wetu',
    'about.heading': 'Washika DAU mfumo wa vikundi kidijitali',
    'about.subheading': 'Fuata hatua hizi nne za kimsingi kujiunge na jamii yetu ya wajasiriamali',

    // Join CTA
    'join.eyebrow': 'Jiunge',
    'join.title': 'Jiunge na sisi Leo',

    // Login page
    'login.welcome.l1': 'Karibu tena',
    'login.welcome.l2': 'kwenye jamii yako',
    'login.welcome.sub': 'Ingia kuendelea na safari yako ya biashara, mafunzo, na uwekezaji pamoja na wenzako.',
    'login.feature1': 'Fuatilia uwekezaji wako',
    'login.feature2': 'Endelea na masomo na vyeti',
    'login.feature3': 'Shirikiana na kundi lako',
    'login.heading': 'Ingia',
    'login.no_account': 'Bado huna akaunti?',
    'login.register_here': 'Jisajili hapa',
    'login.field.identifier': 'Barua pepe au nambari ya simu',
    'login.ph.identifier': '07xx xxx xxx au email@example.com',
    'login.field.password': 'Nywila',
    'login.ph.password': 'Weka nywila yako',
    'login.forgot': 'Umesahau?',
    'login.remember': 'Nikumbuke kwenye kifaa hiki',
    'login.submit': 'Ingia',
    'login.submitting': 'Inaingia...',

    // Register page
    'register.welcome.l1': 'Jiunge na jamii',
    'register.welcome.l2': 'ya wajasiriamali',
    'register.welcome.sub': 'Sajili leo na uanze safari yako ya biashara, mafunzo, na uwekezaji pamoja na wenzako.',
    'register.feature1': 'Mafunzo ya biashara na vyeti',
    'register.feature2': 'Vikundi vya akiba na uwekezaji',
    'register.feature3': 'Malipo ya M-Pesa yaliyosalimishwa',
    'register.feature4': 'Fuatilia ukuaji wa biashara yako',
    'register.heading': 'Unda Akaunti',
    'register.have_account': 'Una akaunti tayari?',
    'register.login_here': 'Ingia hapa',
    'register.section.personal': 'Taarifa za Kibinafsi',
    'register.section.business': 'Biashara na Kitambulisho',
    'register.section.password': 'Unda Nywila',
    'register.f.fullname': 'Jina Kamili',
    'register.ph.fullname': 'Jina lako kamili',
    'register.f.phone': 'Nambari ya Simu',
    'register.f.email': 'Barua Pepe',
    'register.optional': '(si lazima)',
    'register.f.location': 'Mji / Mkoa',
    'register.f.gender': 'Jinsia',
    'register.opt.select_gender': 'Chagua jinsia',
    'register.gender.female': 'Mwanamke',
    'register.gender.male': 'Mwanamume',
    'register.f.age': 'Umri',
    'register.ph.age': 'Umri wako',
    'register.f.business': 'Aina ya Biashara',
    'register.opt.select_type': 'Chagua aina',
    'register.biz.agriculture': 'Kilimo',
    'register.biz.livestock': 'Ufugaji',
    'register.biz.small': 'Biashara Ndogo',
    'register.biz.arts': 'Sanaa na Ubunifu',
    'register.biz.services': 'Huduma',
    'register.biz.tech': 'Teknolojia',
    'register.biz.other': 'Nyingine',
    'register.f.idtype': 'Aina ya Kitambulisho',
    'register.id.national': 'Kitambulisho cha Taifa',
    'register.id.voter': 'Kitambulisho cha Mpiga Kura',
    'register.id.passport': 'Paspoti',
    'register.f.idnumber': 'Nambari ya Kitambulisho',
    'register.ph.idnumber': 'Ingiza nambari ya kitambulisho',
    'register.f.password': 'Nywila',
    'register.ph.password': 'Nywila yenye nguvu',
    'register.f.confirm': 'Thibitisha Nywila',
    'register.ph.confirm': 'Rudia nywila',
    'register.submit': 'Unda Akaunti',
    'register.submitting': 'Inasajili...',
    'register.terms': 'Kwa kusajili, unakubali masharti na sera ya faragha ya Washika DAU.',
    'register.err.mismatch': 'Nywila hazifanani',
    'register.success.title': 'Umefanikiwa!',
    'register.success.text': 'Akaunti yako imeundwa. Unaweza sasa kuingia kwenye jukwaa.',
    'register.success.cta': 'Ingia Sasa',
    'register.register_another': 'Sajili mtu mwingine',

    // Common
    'common.platform': 'Jukumu Platform',
    'tagline': 'Jukwaa la Wajasiriamali Tanzania',

    // Member dashboard — navigation
    'dash.nav.overview': 'Muhtasari',
    'dash.nav.wallet': 'Pochi',
    'dash.nav.group': 'Kundi',
    'dash.nav.investments': 'Uwekezaji',
    'dash.nav.training': 'Mafunzo',
    'dash.nav.settings': 'Mipangilio',
    'dash.nav.more': 'Zaidi',
    'dash.logout': 'Toka',
    // Member dashboard — overview
    'dash.greeting': 'Habari',
    'dash.overview.subtitle': 'Hapa kuna muhtasari wa akaunti yako',
    'dash.balance.label': 'Salio Lako',
    'dash.action.deposit': 'Weka Pesa',
    'dash.action.withdraw': 'Toa Pesa',
    'dash.action.transfer': 'Hamisha',
    'dash.stat.membership': 'Hali ya Uanachama',
    'dash.stat.active': 'Hai',
    'dash.stat.pending': 'Inasubiri',
    'dash.stat.mygroup': 'Kundi Langu',
    'dash.stat.nogroup': 'Hujajiunga',
    'dash.stat.investment': 'Uwekezaji Wangu',
    'dash.stat.returns': 'Faida Inayotarajiwa',
    'dash.governance.title': 'Maamuzi ya Kikundi',
    'dash.governance.sub': 'Shiriki katika kupiga kura na maazimio ya kundi lako',
    'dash.activity.title': 'Shughuli za Hivi Karibuni',
    'dash.joined': 'Umejiunga na Washika DAU',
    'dash.quicknav.title': 'Nenda Haraka',
    'dash.quicknav.wallet': 'Wallet Yangu',
    'dash.quicknav.wallet.sub': 'Historia na mabadiliko ya salio',
    'dash.quicknav.group': 'Kundi Langu',
    'dash.quicknav.group.sub': 'Angalia wanachama na shughuli',
    'dash.quicknav.training': 'Mafunzo',
    'dash.quicknav.training.sub': 'Endelea na masomo',
    'dash.quicknav.investment': 'Uwekezaji',
    'dash.quicknav.investment.sub': 'Fuatilia mapato yako',
    'dash.member': 'Mwanachama',
  },
  en: {
    // Header
    'nav.home': 'Home',
    'nav.about': 'About',
    'nav.how_it_works': 'How It Works',
    'nav.impact': 'Impact',
    'nav.investor': 'Invest',
    'nav.join': 'Join',
    'nav.login': 'Login',
    
    // Hero Section
    'hero.title': 'Washika DAU – Connecting Entrepreneurs with Community Prosperity',
    'hero.subtitle': 'We empower small entrepreneurs through training, networks, and economic leadership for a sustainable circular economy.',
    'hero.cta.entrepreneur': 'Register Now',
    'hero.cta.investor': 'Partner With Us',
    'hero.learn_more': 'Learn More',
    
    // About Section
    'about.title': 'About Washika DAU',
    'about.vision.title': 'Vision',
    'about.vision.text': 'To be a center for social and economic development that aims to build a sustainable circular economy.',
    'about.mission.title': 'Mission',
    'about.mission.text': 'To empower small entrepreneurs through training, networks, and economic leadership.',
    'about.values.title': 'Values',
    'about.values.text': 'Transparency, Collaboration, Leadership, and Sustainable Development.',
    
    // How It Works
    'how_it_works.title': 'How Washika DAU Works',
    'how_it_works.step1.title': 'Membership & Training',
    'how_it_works.step1.text': 'Entrepreneurs join via groups, pay small monthly fees, and receive training.',
    'how_it_works.step2.title': 'Capital Investment',
    'how_it_works.step2.text': 'Washika DAU invests in groups with a 30% equity stake.',
    'how_it_works.step3.title': 'Circular Economy',
    'how_it_works.step3.text': 'Resources circulate within the network.',
    'how_it_works.step4.title': 'Shared Prosperity',
    'how_it_works.step4.text': 'Profits and dividends are shared back.',
    
    // Impact
    'impact.title': 'Our Impact',
    'impact.groups': 'Groups',
    'impact.cbts': 'CBTs',
    'impact.businesses': 'Businesses',
    'impact.growing': 'Growing Network',
    
    // Registration
    'registration.title': 'Register with Washika DAU',
    'registration.name': 'Full Name',
    'registration.contact': 'Contact (Phone/Email)',
    'registration.location': 'Location',
    'registration.business_type': 'Business Type',
    'registration.group_name': 'Group Name (if already in one)',
    'registration.gender': 'Gender',
    'registration.age': 'Age',
    'registration.submit': 'Submit',
    
    // Investor Section
    'investor.title': 'Why Invest with Washika DAU?',
    'investor.subtitle': '30% equity model, community-driven, sustainable impact.',
    'investor.cta': 'Download Investor Deck',
    'investor.eyebrow': 'Invest',
    'investor.intro': 'We partner with investors who understand that true growth starts within the community.',
    'investor.card1.title': 'Equity Model',
    'investor.card1.text': 'When you invest in a Washika DAU group, you receive direct equity in their businesses. Returns are shared transparently based on clearly defined agreements.',
    'investor.card2.title': 'Real-time Tracking',
    'investor.card2.text': 'Every transaction, payment, and group meeting is visible through our dashboard. Full transparency — no secrets.',
    'investor.card3.title': 'Social Impact',
    'investor.card3.text': 'Your investment helps small entrepreneurs access capital, training, and a network to grow their businesses.',
    'investor.contact': 'Contact us',

    // Hero extras
    'hero.motto': 'Together We Build',
    'hero.cta.join': 'Join Now',
    'hero.stat.groups': 'Groups',
    'hero.stat.businesses': 'Businesses',
    'hero.stat.trainers': 'Trainers',

    // About / process rail
    'about.eyebrow': 'Our Process',
    'about.heading': 'Washika DAU — a digital groups platform',
    'about.subheading': 'Follow these four essential steps to join our community of entrepreneurs',

    // Join CTA
    'join.eyebrow': 'Join',
    'join.title': 'Join Us Today',

    // Login page
    'login.welcome.l1': 'Welcome back',
    'login.welcome.l2': 'to your community',
    'login.welcome.sub': 'Sign in to continue your journey of business, training, and investment with your peers.',
    'login.feature1': 'Track your investments',
    'login.feature2': 'Continue your courses and certificates',
    'login.feature3': 'Collaborate with your group',
    'login.heading': 'Sign In',
    'login.no_account': "Don't have an account yet?",
    'login.register_here': 'Register here',
    'login.field.identifier': 'Email or phone number',
    'login.ph.identifier': '07xx xxx xxx or email@example.com',
    'login.field.password': 'Password',
    'login.ph.password': 'Enter your password',
    'login.forgot': 'Forgot?',
    'login.remember': 'Remember me on this device',
    'login.submit': 'Sign In',
    'login.submitting': 'Signing in...',

    // Register page
    'register.welcome.l1': 'Join the community',
    'register.welcome.l2': 'of entrepreneurs',
    'register.welcome.sub': 'Register today and start your journey of business, training, and investment with your peers.',
    'register.feature1': 'Business training and certificates',
    'register.feature2': 'Savings and investment groups',
    'register.feature3': 'Secure M-Pesa payments',
    'register.feature4': 'Track your business growth',
    'register.heading': 'Create Account',
    'register.have_account': 'Already have an account?',
    'register.login_here': 'Sign in here',
    'register.section.personal': 'Personal Information',
    'register.section.business': 'Business & ID',
    'register.section.password': 'Create Password',
    'register.f.fullname': 'Full Name',
    'register.ph.fullname': 'Your full name',
    'register.f.phone': 'Phone Number',
    'register.f.email': 'Email',
    'register.optional': '(optional)',
    'register.f.location': 'City / Region',
    'register.f.gender': 'Gender',
    'register.opt.select_gender': 'Select gender',
    'register.gender.female': 'Female',
    'register.gender.male': 'Male',
    'register.f.age': 'Age',
    'register.ph.age': 'Your age',
    'register.f.business': 'Business Type',
    'register.opt.select_type': 'Select type',
    'register.biz.agriculture': 'Agriculture',
    'register.biz.livestock': 'Livestock',
    'register.biz.small': 'Small Business',
    'register.biz.arts': 'Arts & Crafts',
    'register.biz.services': 'Services',
    'register.biz.tech': 'Technology',
    'register.biz.other': 'Other',
    'register.f.idtype': 'ID Type',
    'register.id.national': 'National ID',
    'register.id.voter': 'Voter ID',
    'register.id.passport': 'Passport',
    'register.f.idnumber': 'ID Number',
    'register.ph.idnumber': 'Enter ID number',
    'register.f.password': 'Password',
    'register.ph.password': 'Strong password',
    'register.f.confirm': 'Confirm Password',
    'register.ph.confirm': 'Repeat password',
    'register.submit': 'Create Account',
    'register.submitting': 'Registering...',
    'register.terms': "By registering, you agree to Washika DAU's terms and privacy policy.",
    'register.err.mismatch': 'Passwords do not match',
    'register.success.title': 'Success!',
    'register.success.text': 'Your account has been created. You can now sign in to the platform.',
    'register.success.cta': 'Sign In Now',
    'register.register_another': 'Register another person',

    // Common
    'common.platform': 'Jukumu Platform',
    'tagline': 'Empowering Entrepreneurs, Building a Circular Economy.',

    // Member dashboard — navigation
    'dash.nav.overview': 'Overview',
    'dash.nav.wallet': 'Wallet',
    'dash.nav.group': 'My Group',
    'dash.nav.investments': 'Investments',
    'dash.nav.training': 'Training',
    'dash.nav.settings': 'Settings',
    'dash.nav.more': 'More',
    'dash.logout': 'Logout',
    // Member dashboard — overview
    'dash.greeting': 'Hello',
    'dash.overview.subtitle': "Here's a summary of your account",
    'dash.balance.label': 'Your Balance',
    'dash.action.deposit': 'Deposit',
    'dash.action.withdraw': 'Withdraw',
    'dash.action.transfer': 'Transfer',
    'dash.stat.membership': 'Membership Status',
    'dash.stat.active': 'Active',
    'dash.stat.pending': 'Pending',
    'dash.stat.mygroup': 'My Group',
    'dash.stat.nogroup': 'Not joined',
    'dash.stat.investment': 'My Investment',
    'dash.stat.returns': 'Expected Returns',
    'dash.governance.title': 'Group Decisions',
    'dash.governance.sub': "Take part in your group's votes and resolutions",
    'dash.activity.title': 'Recent Activity',
    'dash.joined': 'Joined Washika DAU',
    'dash.quicknav.title': 'Quick Links',
    'dash.quicknav.wallet': 'My Wallet',
    'dash.quicknav.wallet.sub': 'History and balance changes',
    'dash.quicknav.group': 'My Group',
    'dash.quicknav.group.sub': 'View members and activity',
    'dash.quicknav.training': 'Training',
    'dash.quicknav.training.sub': 'Continue your courses',
    'dash.quicknav.investment': 'Investment',
    'dash.quicknav.investment.sub': 'Track your returns',
    'dash.member': 'Member',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('sw');

  // Restore the saved language on mount
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('wd-lang') : null;
    if (saved === 'en' || saved === 'sw') setLanguage(saved);
  }, []);

  const toggleLanguage = () => {
    setLanguage(prev => {
      const next = prev === 'sw' ? 'en' : 'sw';
      if (typeof window !== 'undefined') window.localStorage.setItem('wd-lang', next);
      return next;
    });
  };

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations['sw']] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
