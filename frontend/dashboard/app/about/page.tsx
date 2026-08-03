import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import LandingHeader from "../components/landing_header";

import { buttonVariants } from "../components/button_variants";
import LandingFooter from "../components/landing_footer";
import TrackCtaLink from "../components/analytics/track_cta_link";
import JsonLd from "../components/json_ld";
import { webPageJsonLd } from "../utils/json_ld";
import { pageMetadata } from "../utils/metadata";
import { cn } from "../utils/shadcn_utils";

const seo = {
  title: "About Measure — Built by and for Mobile Developers",
  description:
    "Meet the team behind Measure. Open source mobile app monitoring built by mobile developers, for mobile developers.",
  path: "/about",
};

export const metadata: Metadata = pageMetadata(seo);

export default function About() {
  const team = [
    {
      name: "Gandharva Kumar",
      profile_pic_url: "/images/profile_pics/profile_gandharva.webp",
      title: "CEO",
      url: "https://www.linkedin.com/in/gandharvakr/",
    },
    {
      name: "Anup Cowkur",
      profile_pic_url: "/images/profile_pics/profile_anup.webp",
      title: "CTO",
      url: "https://www.linkedin.com/in/anupcowkur/",
    },
    {
      name: "Abhay Sood",
      profile_pic_url: "/images/profile_pics/profile_abhay.webp",
      title: "Head of Mobile",
      url: "https://www.linkedin.com/in/abhaysood/",
    },
    {
      name: "Debjeet Biswas",
      profile_pic_url: "/images/profile_pics/profile_debjeet.webp",
      title: "Head of Infra",
      url: "https://www.linkedin.com/in/debjeet-biswas-9b4337281/",
    },
    {
      name: "Adwin Ross",
      profile_pic_url: "/images/profile_pics/profile_adwin.webp",
      title: "Mobile Engineer",
      url: "https://www.linkedin.com/in/adwin-ronald-ross/",
    },
  ];

  const angels = [
    {
      name: "Mustafa Ali",
      title: "Head of Mobile, Shopify",
    },
    {
      name: "Kunal Shah",
      title: "Founder, CRED",
    },
    {
      name: "Misbah Ashraf",
      title: "Co-Founder, Jar",
    },
    {
      name: "Vatsal Singhal",
      title: "Co-Founder, Ultrahuman",
    },
    {
      name: "Anshuman Bajoria",
      title: "Strategy and Operations, Revolut",
    },
    {
      name: "Anuj Bhagat",
      title: "Product, Google",
    },
    {
      name: "Sudhanshu Raheja",
      title: "President, GoTo Financial",
    },
    {
      name: "Sidu Ponnappa",
      title: "CEO, realfast",
    },
    {
      name: "Abhinit Tiwari",
      title: "Head of Design, Gojek",
    },
    {
      name: "Ranjan Sakalley",
      title: "Co-Founder, base14",
    },
    {
      name: "Gaurav Batra",
      title: "Co-Founder, Semaai",
    },
    {
      name: "Paul Meinshausen",
      title: "CEO, Aampe",
    },
  ];

  return (
    <main className="flex flex-col items-center justify-between">
      <JsonLd data={webPageJsonLd(seo, "AboutPage")} />
      <LandingHeader />
      <div className="flex flex-col items-center w-full">
        <div className="max-w-6xl w-full mx-auto px-4 py-8 font-body">
          {/* Main description */}
          <div className="py-16" />
          <h1 className="text-5xl font-display mb-2">
            For mobile engineers, by mobile engineers
          </h1>
          <div className="py-4" />
          <p className="text-justify text-lg">
            We built Measure to solve the unique challenges mobile developers
            face in monitoring production apps.
            <br />
            <br /> After spending years in the trenches building mobile apps at
            scale, we understood that existing tools that are often web and
            backend centric don&apos;t address mobile-specific needs.
            <br />
            <br />
            For us, mobile is not an add-on to an observability product. Mobile{" "}
            <b>is</b> the product.
            <br />
            <br />
            We strongly believe that tools for mobile developers can and should
            be better and that&apos;s what drives us everyday.
          </p>

          {/* Team */}
          <div className="mt-24">
            <h2 className="text-3xl font-display mb-8">Team</h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4 md:gap-8 w-full">
              {team.map((member) => (
                <Link
                  href={member.url}
                  key={member.name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-full"
                >
                  <div className="flex flex-col items-center h-full border border-border p-8 rounded-md bg-card text-card-foreground shadow-sm">
                    <Image
                      src={member.profile_pic_url}
                      alt={`${member.name} Profile Picture`}
                      width={200}
                      height={200}
                      className="rounded-full border border-border"
                    />
                    <div className="py-4" />
                    <p className="font-display text-xl">{member.name}</p>
                    <p className="font-body">{member.title}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Investors */}
          <div className="mt-24">
            <h2 className="text-3xl font-display mb-8">Investors</h2>
            <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
              <Image
                src="/images/investor_logos/picus_black.webp"
                alt={`Picus Capital Logo`}
                width={788}
                height={112}
                className="h-9 w-auto dark:hidden"
              />
              <Image
                src="/images/investor_logos/picus_white.webp"
                alt={`Picus Capital Logo`}
                width={903}
                height={128}
                className="h-9 w-auto hidden dark:block"
              />
              <Image
                src="/images/investor_logos/devc_black.svg"
                alt={`DeVC Logo`}
                width={210}
                height={93}
                className="h-6 w-auto dark:hidden"
              />
              <Image
                src="/images/investor_logos/devc_white.svg"
                alt={`DeVC Logo`}
                width={210}
                height={93}
                className="h-6 w-auto hidden dark:block"
              />
              <Image
                src="/images/investor_logos/astir.svg"
                alt={`Astir Ventures Logo`}
                width={297}
                height={150}
                className="h-10 w-auto bg-black rounded-sm p-2"
              />
            </div>
          </div>

          {/* Angel Investors */}
          <div className="mt-24">
            <h2 className="text-3xl font-display mb-8">Angels</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-8 items-center w-full">
              {angels.map((angel) => (
                <div
                  key={angel.name}
                  className="flex flex-col items-center text-center justify-center h-full w-full border border-border p-4 md:p-6 rounded-md bg-card text-card-foreground shadow-sm"
                >
                  <p className="font-display text-xl">{angel.name}</p>
                  <p className="font-body">{angel.title}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-24" />
        <TrackCtaLink
          location="about"
          destination="signup"
          href="/auth/login"
          className={cn(
            buttonVariants({ variant: "default" }),
            "text-2xl px-8 py-8",
          )}
        >
          Get Started For Free
        </TrackCtaLink>
        <div className="py-16" />
      </div>
      <LandingFooter />
    </main>
  );
}
