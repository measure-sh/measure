import type { MetadataRoute } from "next";
import { siteDescription, siteTitle } from "./utils/metadata";

// The manifest needs literal hex colours, so it cannot reference the
// --background token in globals.css.
const backgroundColor = "#ffffff";

/**
 * manifest describes the site to a browser that installs it. Titles and
 * description come from the shared metadata copy, so an install prompt
 * cannot drift from the page and card titles.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteTitle,
    short_name: siteTitle,
    description: siteDescription,
    start_url: "/",
    display: "standalone",
    background_color: backgroundColor,
    theme_color: backgroundColor,
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/images/measure_logo.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
