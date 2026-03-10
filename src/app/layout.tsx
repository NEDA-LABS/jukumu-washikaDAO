import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { LanguageProvider } from '@/contexts/LanguageContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import ToastProvider from '@/components/ToastProvider'
import { appConfig } from '@/app.config'

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: `${appConfig.site.name} - Empowering Communities Through Collective Investment`,
  description: appConfig.site.description,
  icons: {
    icon: [
      { url: '/logo.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/logo.svg',
    apple: { url: '/logo.svg', type: 'image/svg+xml' },
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="sw" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <ThemeProvider>
          <LanguageProvider>
            <ToastProvider>{children}</ToastProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
