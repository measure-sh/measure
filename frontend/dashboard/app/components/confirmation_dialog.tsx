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

interface ConfirmationDialogProps {
  body: ReactNode;
  open: boolean;
  affirmativeText: string;
  cancelText: string;
  onAffirmativeAction: () => void;
  onCancelAction: () => void;
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  body,
  open,
  affirmativeText,
  cancelText,
  onAffirmativeAction,
  onCancelAction,
}) => {
  return (
    <Dialog
      open={open}
      modal={true}
      onOpenChange={(open) => {
        if (!open) onCancelAction();
      }}
    >
      <DialogContent className="bg-background text-foreground">
        <DialogHeader>
          <DialogTitle className="font-display">Are you sure?</DialogTitle>
        </DialogHeader>
        {/* Adopt the body's own element so block content (div/ul/p)
                    isn't illegally nested inside the <p> Radix renders. */}
        <DialogDescription asChild={isValidElement(body)}>
          {body}
        </DialogDescription>
        <DialogFooter>
          <Button variant="default" onClick={onAffirmativeAction}>
            {affirmativeText}
          </Button>
          <Button variant="outline" onClick={onCancelAction}>
            {cancelText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmationDialog;
