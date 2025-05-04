"use client"

import React, { useEffect, useRef, useState } from 'react'
import { measureAuth, MeasureAuthSession } from '../auth/measure_auth'
import Image from 'next/image'

interface UserAvatarProps {
  onLogoutClick?: () => void
}

const UserAvatar: React.FC<UserAvatarProps> = ({ onLogoutClick }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [session, setSession] = useState<MeasureAuthSession | null>(null)
  const [sessionError, setSessionError] = useState<Error | null>(null)
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false)
  const teamSwitcherRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        teamSwitcherRef.current &&
        !teamSwitcherRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    const handleFocusIn = (event: FocusEvent) => {
      if (
        teamSwitcherRef.current &&
        !teamSwitcherRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('focusin', handleFocusIn)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('focusin', handleFocusIn)
    }
  }, [])

  useEffect(() => {
    const fetchSession = async () => {
      const { session, error } = await measureAuth.getSession()
      setSession(session)
      setSessionError(error)
    }

    fetchSession()
  }, [])

  const toggleUserAvatar = () => {
    setIsOpen(!isOpen)
  }

  const handleLogoutClick = () => {
    setIsOpen(false)
    if (onLogoutClick) {
      onLogoutClick()
    }
  }

  return (
    <div className="relative w-24 self-center inline-block text-left" ref={teamSwitcherRef} >
      <button
        type="button"
        onClick={toggleUserAvatar}
        disabled={session === null || sessionError !== null}
        className="aspect-square w-full font-display border border-black rounded-full outline-hidden hover:enabled:bg-yellow-200 focus:enabled:bg-yellow-200 active:enabled:bg-yellow-300">
        {session === null && sessionError === null && <p className="w-full truncate text-xs">Updating...</p>}
        {session === null && sessionError !== null && <p className="w-full truncate text-xs">Error</p>}
        {session !== null && sessionError === null && !avatarLoadFailed && (
          <div className="relative w-full h-full">
            <Image
              src={session!.user.avatar_url}
              fill
              loading='lazy'
              sizes="96px"
              alt={session!.user.name}
              className="object-fit rounded-full"
              onError={(_) => {
                setAvatarLoadFailed(true)
              }}
            />
          </div>
        )}
        {session !== null && sessionError === null && avatarLoadFailed && (
          <p className="w-full truncate text-xs">{session!.user.name}</p>
        )}
      </button>

      {isOpen && (
        <div className="z-50 origin-top-left absolute -left-12 mt-2 w-48 shadow-lg border border-black">
          <div
            role="menu"
            aria-orientation="vertical"
            aria-labelledby="options-menu"
          >
            <button
              onClick={handleLogoutClick}
              className="w-full px-2 py-2 text-white bg-neutral-950 font-display text-left hover:text-black hover:bg-yellow-200 active:bg-yellow-300 outline-hidden focus:bg-yellow-200"
              role="menuitem"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserAvatar