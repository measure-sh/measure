"use client"

import React from 'react';
import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter()

  const goBack = async () => {
    router.back()
  }

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-center justify-center p-24 w-screen h-screen">
      <p className="font-display font-regular text-4xl text-center">404</p>
      <div className="py-2" />
      <p className="font-body text-center">Sorry, we couldn&apos;t find the page you were looking for...</p>
      <div className="py-4" />
      <button className="block text-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black rounded-md font-display text-black transition-colors duration-100 py-2 px-4" onClick={() => goBack()}>Go Back</button>
    </div>
  )
}
