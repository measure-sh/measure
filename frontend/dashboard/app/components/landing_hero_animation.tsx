"use client";

import dynamic from "next/dynamic";
import landingHeroAnim from "../animations/landing_hero.json";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

export default function LandingHeroAnimation() {
  return (
    <div className="w-80 h-80 md:w-[28rem] md:h-[20rem]">
      <Lottie
        animationData={landingHeroAnim}
        className="dark:sepia dark:invert"
      />
    </div>
  );
}
