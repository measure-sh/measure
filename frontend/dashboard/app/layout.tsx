import { HighlightInit } from '@highlight-run/next/client'
import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Josefin_Sans, Space_Mono } from 'next/font/google'
import { Toaster } from './components/toaster'

const josefin_sans = Josefin_Sans({
  subsets: ['latin'], display: 'swap', weight: ['100', '200', '300', '400', '500', '600', '700'],
  variable: '--font-josefin-sans'
})

const space_mono = Space_Mono({
  subsets: ['latin'], display: 'swap', weight: ['400', '700'],
  variable: '--font-space-mono'
})

const title = 'Measure'
const description = 'Open source tool to monitor mobile apps'
const siteName = 'measure.sh'
const previewImage = 'https://measure.sh/images/social_preview.png'

export const metadata: Metadata = {
  title: {
    default: title,
    template: `%s | ${title}`,
  },

  description: description,

  openGraph: {
    title: title,
    description: description,
    url: '/',
    siteName: siteName,
    images: [
      {
        url: previewImage,
        width: 1200,
        height: 630,
        alt: 'Measure preview image',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },

  twitter: {
    card: 'summary_large_image',
    title: title,
    description: description,
    images: [previewImage],
  },
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
        <body className={`${josefin_sans.variable} ${space_mono.variable}`}>
          {children}
          <Toaster />
        </body>
      </html>
    </>
  )
}
