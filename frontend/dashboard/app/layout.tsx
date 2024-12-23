import { HighlightInit } from '@highlight-run/next/client'
import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Josefin_Sans, Space_Mono } from 'next/font/google'
import Script from 'next/script'

const display = Josefin_Sans({
  subsets: ['latin'], display: 'swap', weight: ['100', '200', '300', '400', '500', '600', '700'],
  variable: '--font-display'
})

const body = Space_Mono({
  subsets: ['latin'], display: 'swap', weight: ['400', '700'],
  variable: '--font-body'
})

export const metadata: Metadata = {
  title: 'Measure',
  description: 'Open source mobile app monitoring | Alternative to Firebase Crashlytics, Instabug, Sentry, Embrace'
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <HighlightInit
        projectId={process.env.NEXT_PUBLIC_HIGHLIGHT_PROJECT_ID}
        serviceName={process.env.NEXT_PUBLIC_FRONTEND_SERVICE_NAME}
        disableSessionRecording
        excludedHostnames={['localhost']}
        tracingOrigins
        networkRecording={{
          enabled: true,
          recordHeadersAndBody: true,
          urlBlocklist: [],
        }}
      />
      <html lang="en">
        <body className={`${display.variable} ${body.variable}`}>{children}</body>
      </html>
    </>
  )
}
