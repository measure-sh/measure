import type { Metadata, Viewport } from "next";
import { ClientProviders } from "./components/client_providers";
import { ConsentManager } from "./components/consent_manager";
import { ThemeProvider } from "./components/theme_provider";
import { Toaster } from "./components/toaster";
import "./globals.css";
import { fira_code, josefin_sans, work_sans } from "./utils/fonts";
import { siteMetadata } from "./utils/metadata";

export const metadata: Metadata = siteMetadata;

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
