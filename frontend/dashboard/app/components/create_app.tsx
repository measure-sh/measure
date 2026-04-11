"use client"

import { Plus } from 'lucide-react'
import React, { FormEventHandler, useState } from 'react'
import { App } from '../api/api_calls'
import { useCreateAppMutation } from '../query/hooks'
import { toastNegative, toastPositive } from '../utils/use_toast'
import { Button } from './button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog"
import { Input } from './input'

interface CreateAppProps {
  disabled: boolean,
  teamId: string,
  onSuccess?: (app: App) => void
}
const CreateApp: React.FC<CreateAppProps> = ({ teamId, onSuccess, disabled = false }) => {
  const createApp = useCreateAppMutation()

  const [appName, setAppName] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)

  const handleCreateApp: FormEventHandler = async (event) => {
    event.preventDefault()

    if (appName === "") {
      return
    }

    try {
      const app = await createApp.mutateAsync({ teamId, appName })
      setAppName("")
      setDialogOpen(false)
      toastPositive(`App ${app?.name} has been created`)
      if (onSuccess && app) {
        onSuccess(app)
      }
    } catch (error) {
      setAppName("")
      toastNegative(`Error creating app: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        disabled={disabled}
        onClick={() => setDialogOpen(true)}
      >
        <Plus /> Create App
      </Button>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='bg-background text-foreground'>
          <DialogHeader>
            <DialogTitle className="font-display">Add new app</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col w-5/6">
            <form onSubmit={handleCreateApp} className="flex flex-col">
              <Input id="app-name" type="string" placeholder="Enter app name" className="w-96 font-body" onChange={(event) => setAppName(event.target.value)} />
              <div className="py-2" />
              <div className='flex flex-row gap-2'>
                <Button
                  variant="outline"
                  type="submit"
                  className="w-fit"
                  loading={createApp.isPending}
                  disabled={createApp.isPending || appName.length === 0}
                >Create App
                </Button>
                <Button
                  variant="outline"
                  type="submit"
                  className="w-fit"
                  onClick={() => setDialogOpen(false)}
                >Cancel
                </Button>
              </div>
              <div className="py-2" />
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default CreateApp
