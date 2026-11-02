"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const Lottie = dynamic(() => import("lottie-react").then((mod) => mod.Lottie), {
  ssr: false,
});

export default function LandingHeroAnimation() {
  const { resolvedTheme } = useTheme();
  // Each theme loads its own recoloured hero variant; only the active one is
  // fetched. Light keeps the white screen, panel backgrounds, black lines and
  // phone as-is, but snaps the dashboard's chart elements to the Tailwind-400
  // palette so the pastels don't wash out. Dark additionally whitens the line
  // art and makes the screen fills transparent.
  const [animationData, setAnimationData] = useState<object | null>(null);

  useEffect(() => {
    if (!resolvedTheme) {
      return;
    }
    let active = true;
    const load =
      resolvedTheme === "dark"
        ? import("../animations/landing_hero_dark.json")
        : import("../animations/landing_hero_light.json");
    load.then((mod) => {
      if (active) {
        setAnimationData(mod.default);
      }
    });
    return () => {
      active = false;
    };
  }, [resolvedTheme]);

  return (
    <div className="w-80 h-80 md:w-md md:h-80">
      {/* lottie-react's stylesheet sets height: 100% on this element outside
          Tailwind's cascade layers, so h-auto needs the important modifier.
          The height then follows the animations' 6:5 aspect ratio and the
          animation keeps the full width of the box. */}
      {animationData && (
        <Lottie
          src={animationData}
          autoplay
          loop
          className="aspect-6/5 h-auto! w-full"
        />
      )}
    </div>
  );
}
