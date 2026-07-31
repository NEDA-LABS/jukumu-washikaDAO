import type { Metadata, Viewport } from 'next'
import { Archivo, Playfair_Display, DM_Mono } from 'next/font/google'
import './globals.css'
import { LanguageProvider } from '@/contexts/LanguageContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import ToastProvider from '@/components/ToastProvider'
import { appConfig } from '@/app.config'

// Body / UI typeface — a grotesque with enough weight range to carry both
// 8px uppercase nav labels and 600-weight buttons.
const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-archivo',
  display: 'swap',
})

// Display typeface — high-contrast didone serif. Carries the balance figures
// and section titles; the editorial counterweight to Archivo's neutrality.
const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-playfair',
  display: 'swap',
})

// Mono — kickers, letter-spaced micro-labels, and every numeral that reads as
// a code or a measurement rather than a quantity.
const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-mono',
  display: 'swap',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f1ea' },
    { media: '(prefers-color-scheme: dark)', color: '#141210' },
  ],
}

export const metadata: Metadata = {
  metadataBase: new URL(appConfig.site.url),
  applicationName: 'Washika DAU',
  title: {
    default: `${appConfig.site.name} — Empowering Communities Through Collective Investment`,
    template: '%s · Washika DAU',
  },
  description: appConfig.site.description,
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Washika DAU',
    statusBarStyle: 'black-translucent',
  },
  // Favicon / app icons come from App Router file conventions:
  // src/app/icon.svg, src/app/icon.png, src/app/apple-icon.png
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="sw" suppressHydrationWarning>
      <body className={`${archivo.variable} ${playfair.variable} ${dmMono.variable}`}>
        <ThemeProvider>
          <LanguageProvider>
            <ToastProvider>{children}</ToastProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
