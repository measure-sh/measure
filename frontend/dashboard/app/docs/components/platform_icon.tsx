import Image from "next/image";
import { cn } from "@/app/utils/shadcn_utils";

// Brand logos for the icon slot of docs cards, reusing the assets the
// /for/<platform> marketing pages ship in public/images. The card's icon
// chip only auto-sizes svg children, so the image carries its own size
// classes. Width and height are each logo's intrinsic dimensions; the
// rendered box is square, so object-contain letterboxes non-square logos.
interface PlatformLogo {
  src: string;
  width: number;
  height: number;
  className?: string;
}

type Platform =
  | "android"
  | "ios"
  | "react-native"
  | "flutter"
  | "kotlin-multiplatform";

const platformLogos: Record<Platform, PlatformLogo> = {
  android: { src: "/images/android_logo.svg", width: 152, height: 89 },
  ios: {
    src: "/images/ios_logo.svg",
    width: 1235,
    height: 1505,
    // The Apple logo is dark gray, illegible on the dark-mode chip
    className: "dark:invert",
  },
  "react-native": {
    src: "/images/react_native_logo.webp",
    width: 500,
    height: 445,
  },
  flutter: { src: "/images/flutter_logo.svg", width: 300, height: 371 },
  "kotlin-multiplatform": {
    src: "/images/kmp_logo.svg",
    width: 48,
    height: 48,
  },
};

export function PlatformIcon({ platform }: { platform: Platform }) {
  const logo = platformLogos[platform];
  return (
    <Image
      src={logo.src}
      alt=""
      width={logo.width}
      height={logo.height}
      sizes="16px"
      className={cn("size-3 object-contain", logo.className)}
    />
  );
}
