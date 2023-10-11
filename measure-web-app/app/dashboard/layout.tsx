"use client"

import Link from "next/link";
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';

const menuItems = [
    {
      href: '/dashboard/overview',
      title: 'Overview',
    },
    {
      href: '/dashboard/crashes',
      title: 'Crashes',
    },
    {
      href: '/dashboard/anrs',
      title: 'ANRs',
    },
    {
      href: '/dashboard/team',
      title: 'Team',
    },
    {
      href: '/dashboard/apps',
      title: 'Apps',
    },
  ];

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const pathName = usePathname();
    const router = useRouter();

    return (
        <div className="flex flex-col md:flex-row flex-1">
            <aside className="border-black border-r w-full md:w-60">
                <nav className="flex flex-col p-4 md:h-screen">
                    <ul>
                        {menuItems.map(({ href, title }) => (
                            <li key={title}>
                                <Link href={href} className={`m-4 outline-none flex justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200  border border-black rounded-md font-display text-black transition-colors duration-100 py-2 px-4 ${pathName === href && 'bg-yellow-100'}`}>{title}</Link>
                            </li>
                        ))}
                    </ul>
                    <div className="grow"/>
                    <button className="m-4 mt-8 outline-none flex justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200  border border-black rounded-md font-display text-black transition-colors duration-100 py-2 px-4" onClick={() => router.push('/')}>Logout</button>
                </nav>
            </aside>
            <main className="flex-1">{children}</main>
        </div>
    );
}