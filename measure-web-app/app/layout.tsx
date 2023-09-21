import './globals.css'
import type { Metadata } from 'next'
import { Abril_Fatface, Arvo, Averia_Sans_Libre, Comfortaa, Courier_Prime, Fira_Code, Fira_Mono, Fira_Sans, Fira_Sans_Condensed, Fragment_Mono, Gudea, Halant, Hanken_Grotesk, Hind, IBM_Plex_Mono, Inconsolata, Inter, Josefin_Sans, Josefin_Slab, Kanit, Karla, Khula, Lato, Lekton, Lora, Maitree, Mandali, Montserrat, Noto_Sans_Mono, Nunito_Sans, Open_Sans, Oswald, Palanquin, Poppins, Quattrocento, Quattrocento_Sans, Raleway, Red_Hat_Mono, Roboto_Condensed, Roboto_Mono, Sono, Source_Code_Pro, Source_Sans_3, Space_Grotesk, Space_Mono, Work_Sans } from 'next/font/google'
import localFont from 'next/font/local'

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
