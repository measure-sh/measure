import type { Metadata, Viewport } from 'next'
import { Fira_Code, Josefin_Sans, Work_Sans } from 'next/font/google'
import { CookieBanner } from './components/cookie_banner'
import { ThemeProvider } from './components/theme_provider'
import { Toaster } from './components/toaster'
import { PostHogProvider } from './context/posthog'
import './globals.css'

const josefin_sans = Josefin_Sans({
  subsets: ['latin'], display: 'swap', weight: ['100', '200', '300', '400', '500', '600', '700'],
  variable: '--font-josefin-sans'
})

const work_sans = Work_Sans({
  subsets: ['latin'], display: 'swap', weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-work-sans'
})

const fira_code = Fira_Code({
  subsets: ['latin'], display: 'swap', weight: ['300', '400', '500', '600', '700'],
  variable: '--font-fira-code'
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
      <html lang="en">
        <body className={`${josefin_sans.variable} ${work_sans.variable} ${fira_code.variable}`}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <PostHogProvider>
              <CookieBanner />
              <div className='bg-background text-foreground'>
                {children}
              </div>
            </PostHogProvider>
            <Toaster />
          </ThemeProvider>
        </body>
      </html>
    </>
  )
}
