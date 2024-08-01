'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation'
import { useScrollDirection } from '../utils/scroll_utils'
import Link from 'next/link'
import Image from 'next/image'

export default function LandingHeader() {
  const scrollDir = useScrollDirection();
  const [isFocused, setIsFocused] = useState(false)
  const router = useRouter()
  const [selfHosted, setSelfHosted] = useState(false)

  useEffect(() => {
    if (typeof window !== undefined && (window.location.hostname === 'measure.sh' || window.location.hostname === 'www.measure.sh')) {
      setSelfHosted(false)
    } else {
      setSelfHosted(true)
    }
  }, [])

  return (
    <header onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)} className={`w-full flex flex-col z-50 bg-white fixed top-0 transition-transform duration-100 ease-in-out ${scrollDir === 'scrolling down' && isFocused === false ? '-translate-y-full' : 'translate-y-0'}`}>
      <div className="w-full flex flex-col md:flex-row space-between items-center py-4 pl-4 pr-2">
        <button className="outline-none overflow-hidden p-1 border border-black rounded-full hover:bg-yellow-200 focus-visible:bg-yellow-200 active:bg-yellow-300 bg-black font-display font-display transition-colors duration-100" onClick={() => router.push('/')}>
          <Image
            src='/images/measure_logo.svg'
            width={24}
            height={24}
            alt={'Measure logo'} />
        </button>
        <div className="py-2 md:py-0 md:flex md:grow" />
        {selfHosted && <Link href="/auth/login" className='outline-none flex flex-row place-items-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black rounded-md font-display transition-colors duration-100 py-2 px-4'>Login</Link>}
        {!selfHosted && <Link href="https://github.com/measure-sh/measure" className='outline-none flex flex-row place-items-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black rounded-md font-display transition-colors duration-100 py-2 px-4'>
          <Image
            src='/images/github_logo.svg'
            width={24}
            height={24}
            alt={'Github logo'} />
          <div className='px-1' />
          <p className='mt-1'>Get Started</p>
        </Link>}
      </div>
      <div className="w-full border-[0.1px] border-stone-900" />
    </header>
  )
}
