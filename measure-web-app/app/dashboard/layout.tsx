"use client"

import Link from "next/link";
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import TeamSwitcher from "../components/team_switcher";

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
                <nav className="flex flex-col p-2 md:h-screen">
                    <div className="py-4"/>
                    <TeamSwitcher items={['Anup', 'Measure','LeftShift']}/>
                    <div className="py-4"/>
                    <ul>
                        {menuItems.map(({ href, title }) => (
                            <li key={title}>
                                <Link href={href} className={`m-4 outline-none flex justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black rounded-md font-display text-black transition-colors duration-100 py-2 px-4 ${pathName === href && 'bg-neutral-950 text-white focus-visible:text-black hover:text-black'}`}>{title}</Link>
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