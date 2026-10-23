"use client";

import { Button } from "./button";

interface PaginatorProps {
  displayText: string;
  prevEnabled: boolean;
  nextEnabled: boolean;
  onNext: () => void;
  onPrev: () => void;
  size?: "default" | "sm";
}

export enum PaginationDirection {
  Forward,
  Backward,
  None,
}

const Paginator: React.FC<PaginatorProps> = ({
  displayText,
  prevEnabled,
  nextEnabled,
  onNext,
  onPrev,
  size = "default",
}) => {
  const small = size === "sm";
  return (
    <div className="flex flex-row items-center">
      <Button
        variant="outline"
        size={size}
        className={small ? "text-xs" : undefined}
        disabled={!prevEnabled}
        onClick={onPrev}
      >
        Previous
      </Button>
      <p className="font-display mx-1">{displayText}</p>
      <Button
        variant="outline"
        size={size}
        className={small ? "text-xs" : undefined}
        disabled={!nextEnabled}
        onClick={onNext}
      >
        Next
      </Button>
    </div>
  );
};

export default Paginator;
