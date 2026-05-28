"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

interface Testimonial {
  name: string;
  handle: string;
  avatar: string;
  text: string;
}

const testimonials: Testimonial[] = [
  {
    name: "Mustafa Ali",
    handle: "Head of Mobile, Shopify",
    avatar: "/images/testimonial_pics/mustafa.jpeg",
    text: "Fixing mobile issues is never the hard part. It's the archaeology. Great to see measure.sh hit GA. A unified session timeline for user actions, network calls, logs, and lifecycle events is the kind of tooling mobile devs have needed for a while.",
  },
  {
    name: "Hussain Mustafa",
    handle: "Developer Support Engineer, RevenueCat",
    avatar: "/images/testimonial_pics/hussain.jpg",
    text: "I've been using measure.sh lately to monitor my mobile apps and host it myself and it has been a delight. Definitely recommend it to anyone looking for an open source mobile app monitoring tool.",
  },
  {
    name: "Landseer Enga",
    handle: "Founder, Revyl.ai",
    avatar: "/images/testimonial_pics/landseer.jpeg",
    text: "This is awesome!",
  },

  {
    name: "Sutirth Chakravarty",
    handle: "Architect, Turtlemint",
    avatar: "/images/testimonial_pics/sutirth.jpeg",
    text: `When I stumbled upon measure.sh, I was blown away!

🚀Crash-free sessions improved dramatically—now hitting a mythical 99.99% consistently.
📊 Logs, metrics, traces—finally stitched together in one view.
⚡️ Our hot & warm app startup times? Looking great!`,
  },
  {
    name: "Raghunath Jawahar",
    handle: "Founder, Legacy Code HQ",
    avatar: "/images/testimonial_pics/raghunath.jpg",
    text: `The good folks at measure.sh have been working on a mobile app monitoring platform for several months now and have open-sourced it. Do check it out and show it some love!

This is quite a strong team that led several mobile platform initiatives at Gojek.`,
  },
  {
    name: "Iniyan Murugavel",
    handle: "Lead Engineer, Circles",
    avatar: "/images/testimonial_pics/iniyan.jpeg",
    text: `I'm personally a fan. Not just of the product, but of the minds behind it.

It's built by some of the sharpest mobile engineers I've admired for years. Folks who live and breathe performance, scaling, and observability.

This isn't just another tool. It's crafted with intent, care, and deep expertise.`,
  },
  {
    name: "Aditya Pahilwani",
    handle: "Senior Software Engineer, Quince",
    avatar: "/images/testimonial_pics/aditya.jpg",
    text: "I'm surprised this hasn't gained more attention yet—it's incredibly exciting for the mobile space, where we definitely lack observability and measure addresses so many of those gaps.",
  },
  {
    name: "Tuist",
    handle: "Open Source App Development Platform",
    avatar: "/images/testimonial_pics/tuist.jpeg",
    text: "Looking for a way to keep tabs on your mobile apps? How about using a free and open-source solution? Consider exploring measure.sh!",
  },
  {
    name: "Gaurav Thakkar",
    handle: "Senior Software Engineer, BookMyShow",
    avatar: "/images/testimonial_pics/gaurav.jpeg",
    text: "Happy to see that a very easy to use and strong competitive tool to Crashlytics is now generally available and out of Beta!",
  },
];

// Lay testimonials out left-to-right across the columns (item 0 → col 0,
// item 1 → col 1, …) so the reading order is horizontal, while each column
// stacks independently to keep the staggered, masonry-style heights.
function useColumnCount() {
  const [count, setCount] = useState(3);
  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      setCount(w >= 1024 ? 3 : w >= 768 ? 2 : 1);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);
  return count;
}

export default function Testimonials() {
  const columnCount = useColumnCount();
  const columns = Array.from({ length: columnCount }, (_, col) =>
    testimonials.filter((_, i) => i % columnCount === col),
  );

  return (
    <div className="flex items-start gap-4 md:gap-6 w-full max-w-6xl px-4 md:px-6">
      {columns.map((column, col) => (
        <div key={col} className="flex flex-1 flex-col gap-4 md:gap-6 min-w-0">
          {column.map((testimonial) => (
            <div
              key={testimonial.name}
              className="flex flex-col border border-border p-6 rounded-md bg-card text-card-foreground shadow-sm"
            >
              <div className="flex flex-row items-center gap-2">
                <Image
                  src={testimonial.avatar}
                  alt={`${testimonial.name} Profile Picture`}
                  width={40}
                  height={40}
                  className="rounded-full border border-border object-cover shrink-0"
                />
                <div className="min-w-0">
                  <p className="font-body text-sm font-medium truncate">
                    {testimonial.name}
                  </p>
                  <p className="font-body text-xs text-muted-foreground truncate">
                    {testimonial.handle}
                  </p>
                </div>
              </div>
              <p className="mt-4 font-body text-sm leading-relaxed whitespace-pre-line text-foreground/90">
                {testimonial.text}
              </p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
