import type { Metadata, Viewport } from "next";
import { Fira_Code, Josefin_Sans, Work_Sans } from "next/font/google";
import { ClientProviders } from "./components/client_providers";
import { ConsentManager } from "./components/consent_manager";
import { ThemeProvider } from "./components/theme_provider";
import { Toaster } from "./components/toaster";
import "./globals.css";
import { previewImage, sharedOpenGraph } from "./utils/metadata";

const josefin_sans = Josefin_Sans({
  subsets: ["latin"],
  display: "swap",
  weight: ["100", "200", "300", "400", "500", "600", "700"],
  variable: "--font-josefin-sans",
});

const work_sans = Work_Sans({
  subsets: ["latin"],
  display: "swap",
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-work-sans",
});

const fira_code = Fira_Code({
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-fira-code",
});

const title = "Measure";
const description =
  "Open source mobile app monitoring for crashes, ANRs, performance, bug reports, user journeys and more.";

export const metadata: Metadata = {
  metadataBase: new URL("https://measure.sh"),

  title: {
    default: title,
    template: `%s | ${title}`,
  },

  description: description,

  openGraph: {
    ...sharedOpenGraph,
    title: title,
    description: description,
    url: "/",
  },

  twitter: {
    card: "summary_large_image",
    title: title,
    description: description,
    images: [previewImage],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${josefin_sans.variable} ${work_sans.variable} ${fira_code.variable}`}
      >
        <ClientProviders>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <ConsentManager>
              <div className="bg-background text-foreground">{children}</div>
            </ConsentManager>
            <Toaster />
          </ThemeProvider>
        </ClientProviders>
      </body>
    </html>
  );
}
