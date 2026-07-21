import type { Metadata, Viewport } from 'next'
import { Inter, Fraunces, Geist_Mono } from 'next/font/google'
import './globals.css'
import { LanguageProvider } from '@/contexts/LanguageContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import ToastProvider from '@/components/ToastProvider'
import { appConfig } from '@/app.config'

// Body / UI typeface — clean, warm grotesque (Claude "Styrene"-style)
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

// Display / heading typeface — soft editorial serif (Claude "Copernicus"-style)
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  axes: ['opsz', 'SOFT'],
})

const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' })

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
      <body className={`${inter.variable} ${fraunces.variable} ${geistMono.variable}`}>
        <ThemeProvider>
          <LanguageProvider>
            <ToastProvider>{children}</ToastProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
