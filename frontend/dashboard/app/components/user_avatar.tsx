"use client"

import React, { useEffect, useRef, useState } from 'react'
import { measureAuth, MeasureAuthSession } from '../auth/measure_auth'
import Image from 'next/image'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './dropdown_menu'
import { Button } from './button'

interface UserAvatarProps {
  onLogoutClick?: () => void
}

const UserAvatar: React.FC<UserAvatarProps> = ({ onLogoutClick }) => {
  const [session, setSession] = useState<MeasureAuthSession | null>(null)
  const [sessionError, setSessionError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchSession = async () => {
      const { session, error } = await measureAuth.getSession()
      setSession(session)
      setSessionError(error)
    }

    fetchSession()
  }, [])

  const handleLogoutClick = () => {
    if (onLogoutClick) {
      onLogoutClick()
    }
  }

  return (
    <DropdownMenu >
      <DropdownMenuTrigger asChild className='w-full' tabIndex={-1}>
        <Button
          variant="outline"
          size={"lg"}
          className="flex flex-row items-center w-full p-1 font-display border border-black"
          disabled={session === null && sessionError === null}
        >
          <div
            className="aspect-square w-12 rounded-full">
            {session !== null && sessionError === null && (
              <div className="relative w-full h-full">
                <Image
                  src={session!.user.avatar_url}
                  fill
                  loading='lazy'
                  sizes="48px"
                  alt="User Avatar"
                  className="object-fit rounded-full"
                />
              </div>
            )}
          </div>
          <div className='px-2' />
          {session === null && sessionError === null && <p className="w-full truncate text-xs">Updating...</p>}
          {session === null && sessionError !== null && <p className="w-full truncate text-xs">Error</p>}
          {session !== null && sessionError === null &&
            <div className='flex flex-col items-start truncate text-xs w-full'>
              <p className='text-sm'>{session?.user.name}</p>
              <p className='text-[10px]'>{session?.user.email}</p>
            </div>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className='select-none'
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DropdownMenuLabel className='font-display'>Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogoutClick} className='font-body'>
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default UserAvatar