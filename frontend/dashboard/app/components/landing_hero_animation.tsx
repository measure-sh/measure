"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

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
    <div className="w-80 h-80 md:w-[28rem] md:h-[20rem]">
      {animationData && <Lottie animationData={animationData} />}
    </div>
  );
}
