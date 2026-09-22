import Link from "next/link";

export default function SandboxBanner() {
  return (
    <div className="w-full px-4 py-2 font-body text-sm flex items-center justify-between mb-8 bg-primary text-primary-foreground">
      <span>
        You are viewing sample data in the interactive demo. Ready to set up
        your app?
      </span>
      <Link
        href="/auth/login"
        className="font-semibold underline ml-4 whitespace-nowrap"
      >
        Get Started →
      </Link>
    </div>
  );
}
