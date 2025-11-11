"use client"

import Image from 'next/image'
import Link from 'next/link'
import LandingHeader from '../components/landing_header'


import { buttonVariants } from '../components/button'
import LandingFooter from '../components/landing_footer'
import { cn } from '../utils/shadcn_utils'

export default function About() {
  const team = [
    {
      name: "Gandharva Kumar",
      profile_pic_url: "/images/profile_pics/profile_gandharva.jpeg",
      title: "CEO",
      url: 'https://www.linkedin.com/in/gandharvakr/',
    },
    {
      name: "Anup Cowkur",
      profile_pic_url: "/images/profile_pics/profile_anup.jpeg",
      title: "CTO",
      url: 'https://www.linkedin.com/in/anupcowkur/',
    },
    {
      name: "Abhay Sood",
      profile_pic_url: "/images/profile_pics/profile_abhay.jpeg",
      title: "Head of Mobile",
      url: 'https://www.linkedin.com/in/abhaysood/',
    },
    {
      name: "Debjeet Biswas",
      profile_pic_url: "/images/profile_pics/profile_debjeet.jpg",
      title: "Head of Infra",
      url: 'https://www.linkedin.com/in/debjeet-biswas-9b4337281/',
    },
    {
      name: "Adwin Ross",
      profile_pic_url: "/images/profile_pics/profile_adwin.jpeg",
      title: "Mobile Engineer",
      url: 'https://www.linkedin.com/in/adwin-ronald-ross/',
    }
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
  ]

  return (
    <main className="flex flex-col items-center justify-between">
      <LandingHeader />
      <div className="flex flex-col items-center w-full">

        {/* Main description */}
        <div className="py-16" />
        <h1 className="text-5xl font-display leading-relaxed md:w-6xl px-4">For mobile engineers, by mobile engineers</h1>
        <div className="py-4" />
        <p className="text-lg leading-relaxed font-body md:w-6xl text-justify px-4">
          We built Measure to solve the unique challenges mobile developers face in monitoring production apps.<br /><br /> After spending years in the trenches building mobile apps at scale, we understood that existing tools that are often web and backend centric don&apos;t address mobile-specific needs.
          <br /><br />For us, mobile is not an add-on to an observability product. Mobile <b>is</b> the product.
          <br /><br />We strongly believe that tools for mobile developers can and should be better and that&apos;s what drives us everyday.
        </p>

        {/* Team */}
        <div className="py-8 md:py-16" />
        <div className='w-full flex items-center flex-col py-16 md:py-24'>
          <p className="font-display font-regular text-4xl max-w-4xl text-center px-4">Team</p>
          <div className="py-4" />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4 md:gap-6 lg:gap-8 p-4 md:p-6 lg:p-8 w-full max-w-6xl">
            {team.map((team, index) => (
              <Link href={team.url} key={index} target="_blank" rel="noopener noreferrer" className="h-full">
                <div className="flex flex-col items-center h-full border border-border p-8 rounded-md bg-card text-card-foreground shadow-sm">
                  <Image
                    src={team.profile_pic_url}
                    alt={`${team.name} Profile Picture`}
                    width={200}
                    height={200}
                    className="rounded-full border border-border"
                  />
                  <div className='py-4' />
                  <p className='font-display text-xl'>{team.name}</p>
                  <p className='font-body'>{team.title}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Investors */}
        <div className='w-full flex items-center flex-col py-16 md:py-24'>
          <p className="font-display font-regular text-4xl max-w-4xl text-center px-4">Investors</p>
          <div className="py-8" />
          <div className="flex flex-col md:flex-row gap-8 p-2 items-center max-w-6xl">
            <Image
              src="/images/investor_logos/picus_black.png"
              alt={`Picus Capital Logo`}
              width={200}
              height={100}
              className='w-56 h-8 dark:hidden'
            />
            <Image
              src="/images/investor_logos/picus_white.png"
              alt={`Picus Capital Logo`}
              width={200}
              height={100}
              className='w-56 h-8 hidden dark:block'
            />
            <Image
              src="/images/investor_logos/devc_black.svg"
              alt={`DeVC Logo`}
              width={200}
              height={100}
              className='w-56 h-8 dark:hidden'
            />
            <Image
              src="/images/investor_logos/devc_white.svg"
              alt={`DeVC Logo`}
              width={200}
              height={100}
              className='w-56 h-8 hidden dark:block'
            />
            <div className='w-56 flex items-center justify-center'>
              <Image
                src="/images/investor_logos/astir.svg"
                alt={`Astir Ventures Logo`}
                width={200}
                height={100}
                className='w-32 h-12 bg-black rounded-sm p-2'
              />
            </div>
          </div>
        </div>

        {/* Angel Investors */}
        <div className='w-full flex items-center flex-col py-16 md:py-24'>
          <p className="font-display font-regular text-4xl max-w-4xl text-center px-4">Angels</p>
          <div className="py-8" />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 md:gap-16 items-center p-8">
            {angels.map((angel) => (

              <div key={angel.name} className="flex flex-col items-center text-center justify-center h-full w-full border border-border p-8 rounded-md bg-card text-card-foreground shadow-sm">
                <p className='font-display text-xl'>{angel.name}</p>
                <p className='font-body'>{angel.title}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="py-8" />
        <Link
          href="/auth/login"
          className={cn(
            buttonVariants({ variant: "default" }),
            "text-2xl px-8 py-8",
          )}
        >
          Get To The Root Cause
        </Link>
        <div className="py-16" />
      </div>
      <LandingFooter />
    </main >
  )
}
