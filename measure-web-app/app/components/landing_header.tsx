'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation'
import { useScrollDirection } from '../utils/scroll_utils';

export default function LandingHeader() {
  const scrollDir = useScrollDirection();
  const [isFocused, setIsFocused] = useState(false);
  const router = useRouter();

  return (
    <header onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)} className={`w-full flex flex-col z-50 bg-white fixed top-0 transition-transform duration-100 ease-in-out ${scrollDir === 'scrolling down' && isFocused === false ? '-translate-y-full' : 'translate-y-0'}`}>
      <div className="w-full flex flex-col md:flex-row space-between items-center py-4 px-4">
        <button className="outline-none border border-black rounded-full hover:bg-yellow-200 focus-visible:bg-yellow-200 active:bg-yellow-300 font-display font-display transition-colors duration-100 py-1 px-2.5" onClick={() => router.push('/')}>m</button>
        <div className="py-2 md:py-0 md:flex md:grow" />
        <button className="outline-none hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black rounded-md font-display transition-colors duration-100 py-2 px-4" onClick={() => router.push('/#email-waitlist')}>Get early access!</button>
      </div>
      <div className="w-full border-[0.1px] border-stone-900" />
    </header>
  )
}
