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

interface DangerConfirmationDialogProps {
  body: ReactNode;
  open: boolean;
  affirmativeText: string;
  cancelText: string;
  onAffirmativeAction: () => void;
  onCancelAction: () => void;
}

const DangerConfirmationDialog: React.FC<DangerConfirmationDialogProps> = ({
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
          <DialogTitle className="font-display text-red-600 dark:text-red-400">
            Are you sure?
          </DialogTitle>
        </DialogHeader>
        {/* Body may be a string or the caller's own block element (a div/ul or
            <p>). Radix renders DialogDescription as a <p>, which can't legally
            contain block elements, so when given an element adopt it as the
            description (asChild) rather than nesting it inside the <p>. */}
        <DialogDescription asChild={isValidElement(body)}>
          {body}
        </DialogDescription>
        <DialogFooter>
          <Button variant="destructive" onClick={onAffirmativeAction}>
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

export default DangerConfirmationDialog;
