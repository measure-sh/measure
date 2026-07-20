import { Fira_Code, Josefin_Sans, Work_Sans } from "next/font/google";

// Used by both the root layout and global-error. global-error replaces the
// root layout when it renders, so it has to apply these variables itself.
export const josefin_sans = Josefin_Sans({
  subsets: ["latin"],
  display: "swap",
  weight: ["100", "200", "300", "400", "500", "600", "700"],
  variable: "--font-josefin-sans",
});

export const work_sans = Work_Sans({
  subsets: ["latin"],
  display: "swap",
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-work-sans",
});

export const fira_code = Fira_Code({
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-fira-code",
});
