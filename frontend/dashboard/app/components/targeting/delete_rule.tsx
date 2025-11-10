"use client"

import React from "react"
import DangerConfirmationDialog from "../danger_confirmation_dialog"

export type DeleteRuleProps = {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  isDeleting: boolean
}

export default function DeleteRule({
  open,
  onConfirm,
  onCancel,
  isDeleting,
}: DeleteRuleProps) {
  return (
    <DangerConfirmationDialog
      body={
        <p className="font-body">
          Do you want to delete this rule? This action cannot be undone.
        </p>
      }
      open={open}
      affirmativeText={isDeleting ? "Deleting…" : "Delete Rule"}
      cancelText="Cancel"
      onAffirmativeAction={onConfirm}
      onCancelAction={onCancel}
    />
  )
}
