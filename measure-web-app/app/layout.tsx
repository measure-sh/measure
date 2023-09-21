import './globals.css'
import type { Metadata } from 'next'
import {Josefin_Sans, Space_Mono } from 'next/font/google'

const display = Josefin_Sans({ subsets: ['latin'], display: 'swap', weight:['100','200', '300', '400', '500', '600', '700'],
variable: '--font-display'})

const body = Space_Mono({ subsets: ['latin'], display: 'swap', weight: ['400', '700'],
variable: '--font-body'})
export const metadata: Metadata = {
  title: 'Measure',
  description: 'Open source mobile app monitoring | Alternative to Firebase Crashlytics, Instabug, Sentry, Embrace',
  viewport: { width: "device-width", initialScale: 1, minimumScale:1 }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable}`}>{children}</body>
    </html>
  )
}
