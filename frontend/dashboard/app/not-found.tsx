import Link from "next/link";
import { Button } from "./components/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center p-24 w-screen h-screen">
      <p className="font-display font-regular text-4xl text-center">404</p>
      <div className="py-2" />
      <p className="font-body text-center">
        Sorry, we couldn&apos;t find the page you were looking for...
      </p>
      <div className="py-4" />
      <Button asChild>
        <Link href="/auth/login">Go to Dashboard</Link>
      </Button>
    </div>
  );
}
