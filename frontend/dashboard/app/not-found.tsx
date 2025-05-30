"use client"

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './components/button';

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
      <Button
        variant="outline"
        className="font-display border border-black select-none"
        onClick={() => goBack()}>
        Go Back
      </Button>
    </div >
  )
}
