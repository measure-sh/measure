"use client";

import GitHubStarsPlot from "@/app/components/github_stars_plot";

export default function GitHubStarsPage() {
  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start p-4 gap-8">
      <div className="flex flex-col gap-2">
        <p className="text-2xl font-display">GitHub Stars</p>
        <p className="text-sm font-body text-muted-foreground">
          Daily star count for the{" "}
          <a
            href="https://github.com/measure-sh/measure"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4"
          >
            measure-sh/measure
          </a>{" "}
          repository
        </p>
      </div>
      <div className="w-full">
        <GitHubStarsPlot />
      </div>
    </div>
  );
}
