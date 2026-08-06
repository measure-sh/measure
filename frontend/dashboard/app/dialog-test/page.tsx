"use client";

import { useState } from "react";
import AlertDialog from "@/app/components/alert_dialog";
import { Button } from "@/app/components/button";
import ConfirmationDialog from "@/app/components/confirmation_dialog";
import DangerConfirmationDialog from "@/app/components/danger_confirmation_dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/dialog";
import { Input } from "@/app/components/input";

// A name with no spaces in it, which is what a user can actually type into an
// app or team name field, and the case that used to push the dialog wider than
// its own box instead of wrapping.
const LONG_NAME =
  "SuperCalifragilisticExpialidociousApplicationNameThatKeepsGoingAndGoing";
const LONG_EMAIL =
  "a.very.long.person.name.with.many.dots@an-extremely-long-company-domain-name.example.com";

export default function DialogTestPage() {
  const [open, setOpen] = useState<string | null>(null);
  const close = () => setOpen(null);

  const cases: { id: string; label: string }[] = [
    { id: "danger-long-name", label: "Danger: long app name" },
    { id: "danger-long-email", label: "Danger: long email" },
    { id: "danger-long-buttons", label: "Danger: long button labels" },
    { id: "confirm-long", label: "Confirmation: long body" },
    { id: "alert-long-title", label: "Alert: long title" },
    { id: "alert-list", label: "Alert: list body" },
    { id: "form-long-title", label: "Form dialog (create app style)" },
    { id: "wide-tall", label: "Wide dialog with very tall body" },
  ];

  return (
    <main className="p-8 flex flex-col gap-4 items-start">
      <h1 className="font-display text-2xl">Dialog overflow test</h1>
      <div className="flex flex-row flex-wrap gap-2">
        {cases.map((c) => (
          <Button key={c.id} variant="outline" onClick={() => setOpen(c.id)}>
            {c.label}
          </Button>
        ))}
      </div>

      <DangerConfirmationDialog
        open={open === "danger-long-name"}
        body={
          <p className="font-body">
            Are you sure you want to rename app{" "}
            <span className="font-display font-bold">{LONG_NAME}</span> to{" "}
            <span className="font-display font-bold">{LONG_NAME}V2Final</span>?
          </p>
        }
        affirmativeText="Yes, I'm sure"
        cancelText="Cancel"
        onAffirmativeAction={close}
        onCancelAction={close}
      />

      <DangerConfirmationDialog
        open={open === "danger-long-email"}
        body={
          <p className="font-body">
            Are you sure you want to remove pending invite for{" "}
            <span className="font-display font-bold">{LONG_EMAIL}</span>?
          </p>
        }
        affirmativeText="Yes, I'm sure"
        cancelText="Cancel"
        onAffirmativeAction={close}
        onCancelAction={close}
      />

      <DangerConfirmationDialog
        open={open === "danger-long-buttons"}
        body={
          <p className="font-body">
            Are you sure you want to rotate the API key for app{" "}
            <span className="font-display font-bold">{LONG_NAME}</span>?
          </p>
        }
        affirmativeText="Yes, rotate the API key for this app right now"
        cancelText="No, keep the existing API key unchanged"
        onAffirmativeAction={close}
        onCancelAction={close}
      />

      <ConfirmationDialog
        open={open === "confirm-long"}
        body={
          <p className="font-body">
            Are you sure you want to change the role of{" "}
            <span className="font-display font-bold">{LONG_EMAIL}</span> from{" "}
            <span className="font-display font-bold">developer</span> to{" "}
            <span className="font-display font-bold">owner</span>? The URL for
            this change is
            https://app.measure.sh/teams/00000000-0000-0000-0000-000000000000/members/00000000-0000-0000-0000-000000000000/role
          </p>
        }
        affirmativeText="Yes, I'm sure"
        cancelText="Cancel"
        onAffirmativeAction={close}
        onCancelAction={close}
      />

      <AlertDialog
        open={open === "alert-long-title"}
        title={`Could not update ${LONG_NAME}`}
        body={
          <p className="font-body">
            The server rejected the request with
            ERR_VALIDATION_FAILED_ON_FIELD_APP_NAME_BECAUSE_IT_EXCEEDS_THE_MAXIMUM_LENGTH.
            Try a shorter name.
          </p>
        }
        affirmativeText="Ok"
        onAffirmativeAction={close}
      />

      <AlertDialog
        open={open === "alert-list"}
        title="Downgrade to Free"
        body={
          <div className="font-body">
            <p>
              Downgrading affects{" "}
              <span className="font-display font-bold">{LONG_NAME}</span>:
            </p>
            <ul className="list-disc list-inside pt-2 text-sm">
              <li>
                Pro stays active until the end of the current billing cycle
              </li>
              <li>
                App retention resets to 30 days for
                {" " + LONG_NAME}
              </li>
              <li>Alerts configured for {LONG_EMAIL} stop being delivered</li>
            </ul>
          </div>
        }
        affirmativeText="Ok"
        onAffirmativeAction={close}
      />

      <Dialog
        open={open === "form-long-title"}
        onOpenChange={(next) => {
          if (!next) close();
        }}
      >
        <DialogContent className="bg-background text-foreground">
          <DialogHeader>
            <DialogTitle className="font-display">
              Add new app to {LONG_NAME}
            </DialogTitle>
            <DialogDescription>
              Create a new app for team {LONG_NAME}, owned by {LONG_EMAIL}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col w-5/6">
            <Input
              placeholder="Enter app name"
              className="w-96 font-body"
              defaultValue={LONG_NAME}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close}>
              Create App
            </Button>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={open === "wide-tall"}
        onOpenChange={(next) => {
          if (!next) close();
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">More filters</DialogTitle>
            <DialogDescription className="font-body">
              Narrow down results with additional filters for {LONG_NAME}.
            </DialogDescription>
          </DialogHeader>
          <div className="font-body text-sm flex flex-col gap-2">
            {Array.from({ length: 40 }, (_, i) => (
              <p key={i}>
                Row {i + 1}: {LONG_EMAIL}
              </p>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
