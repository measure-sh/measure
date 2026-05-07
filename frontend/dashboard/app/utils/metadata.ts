const siteName = "measure.sh";

export const previewImage = "/images/social_preview.png";

export const sharedOpenGraph = {
  siteName,
  images: [
    {
      url: previewImage,
      width: 1200,
      height: 630,
      alt: "Measure preview image",
    },
  ],
  locale: "en_US",
  type: "website" as const,
};
