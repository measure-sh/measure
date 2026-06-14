"use client";

import { isValidElement, ReactNode } from "react";
import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";

interface AlertDialogProps {
  title: string;
  body: ReactNode;
  open: boolean;
  affirmativeText: string;
  onAffirmativeAction: () => void;
}

const AlertDialog: React.FC<AlertDialogProps> = ({
  title,
  body,
  open,
  affirmativeText,
  onAffirmativeAction,
}) => {
  return (
    <Dialog open={open} modal={true} onOpenChange={onAffirmativeAction}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">{title}</DialogTitle>
        </DialogHeader>
        {/* Adopt the body's own element so block content (div/ul/p)
                    isn't illegally nested inside the <p> Radix renders. */}
        <DialogDescription asChild={isValidElement(body)}>
          {body}
        </DialogDescription>
        <DialogFooter>
          <Button
            variant="outline"
            className="font-display border border-black select-none"
            onClick={onAffirmativeAction}
          >
            {affirmativeText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AlertDialog;
