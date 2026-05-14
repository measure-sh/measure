"use client";

import Image from "next/image";
import React, { useState } from "react";
import { useSessionQuery } from "../query/hooks";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown_menu";

interface UserAvatarProps {
  onLogoutClick?: () => void;
}

const UserAvatar: React.FC<UserAvatarProps> = ({ onLogoutClick }) => {
  const sessionQuery = useSessionQuery();
  const session = sessionQuery.data ?? null;
  const sessionError = sessionQuery.error;
  const isLoading = sessionQuery.isLoading;
  const [imageError, setImageError] = useState(false);

  const handleLogoutClick = () => {
    if (onLogoutClick) {
      onLogoutClick();
    }
  };

  // Helper function to get initials from name
  const getInitials = (name: string) => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      return "N/A";
    }

    const words = trimmedName.split(/\s+/).filter((word) => word.length > 0);

    if (words.length === 0) {
      return "N/A";
    }

    if (words.length === 1) {
      // Single name: return first two characters
      return trimmedName.slice(0, 2).toUpperCase();
    }

    // Multiple names: return first letter of first and last word
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild className="w-full">
        <Button
          variant="outline"
          size={"lg"}
          className="flex flex-row items-center w-full p-1 font-display"
          disabled={isLoading}
        >
          <div className="aspect-square w-12 rounded-full">
            {session !== null && !sessionError && (
              <div className="relative w-full h-full rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                {!imageError ? (
                  <Image
                    src={session.user.avatar_url}
                    fill
                    loading="lazy"
                    sizes="48px"
                    alt="User Avatar"
                    className="object-cover"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <span className="text-sm text-primary-foreground">
                    {getInitials(session.user.name)}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="px-2" />
          {isLoading && <p className="w-full truncate text-xs">Updating...</p>}
          {!isLoading && sessionError && (
            <p className="w-full truncate text-xs">Error</p>
          )}
          {session !== null && !sessionError && (
            <div className="flex flex-col items-start truncate text-xs w-full">
              <p className="text-sm">{session?.user.name}</p>
              <p className="text-[10px]">{session?.user.email}</p>
            </div>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="select-none"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DropdownMenuItem onClick={handleLogoutClick} className="font-body">
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserAvatar;
