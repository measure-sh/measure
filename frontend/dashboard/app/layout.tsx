import type { Metadata, Viewport } from "next";
import AttributionCapture from "./components/analytics/attribution_capture";
import { ClientProviders } from "./components/client_providers";
import { ConsentManager } from "./components/consent_manager";
import { ThemeProvider } from "./components/theme_provider";
import { Toaster } from "./components/toaster";
import UTMCapture from "./components/analytics/utm_capture";
import "./globals.css";
import { fira_code, josefin_sans, work_sans } from "./utils/fonts";
import { previewImage, sharedOpenGraph } from "./utils/metadata";

const title = "Measure";
const description =
  "Measure helps mobile teams monitor and fix crashes, ANRs, bugs, and performance issues. The open source alternative to Firebase Crashlytics.";

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
        <AttributionCapture />
        <UTMCapture />
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
