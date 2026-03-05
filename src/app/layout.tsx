import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { LanguageProvider } from '@/contexts/LanguageContext'
import ToastProvider from '@/components/ToastProvider'
import { appConfig } from '@/app.config'

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: `${appConfig.site.name} - Empowering Communities Through Collective Investment`,
  description: appConfig.site.description,
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '32x32' }
    ],
    apple: { url: '/favicon.svg', type: 'image/svg+xml' }
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="sw">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <LanguageProvider>
          <ToastProvider>{children}</ToastProvider>
        </LanguageProvider>
      </body>
    </html>
  )
}
