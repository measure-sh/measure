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
    <html lang="en">
      <body className={`${display.variable} ${body.variable}`}>{children}</body>
      <Script strategy="afterInteractive">
        {`(function(c,l,a,r,i,t,y){
            c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments) };
            t=l.createElement(r);t.async=1;t.src="/api/clarity/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "${process.env.NEXT_PUBLIC_CLARITY_KEY}");
          `}
      </Script>
    </html>
  )
}
