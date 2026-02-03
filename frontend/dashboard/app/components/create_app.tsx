"use client"

import { Plus } from 'lucide-react'
import React, { FormEventHandler, useState } from 'react'
import { App, CreateAppApiStatus, createAppFromServer } from '../api/api_calls'
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
  const [createAppApiStatus, setCreateAppApiStatus] = useState(CreateAppApiStatus.Init)
  const [appName, setAppName] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)

  const createApp: FormEventHandler = async (event) => {
    event.preventDefault()

    if (appName === "") {
      return
    }

    setCreateAppApiStatus(CreateAppApiStatus.Loading)

    const result = await createAppFromServer(teamId, appName)

    switch (result.status) {
      case CreateAppApiStatus.Error:
        setAppName("")
        setCreateAppApiStatus(CreateAppApiStatus.Error)
        toastNegative(`Error creating app: ${result.error}`)
        break
      case CreateAppApiStatus.Success:
        setAppName("")
        setCreateAppApiStatus(CreateAppApiStatus.Success)
        setDialogOpen(false)
        toastPositive(`App ${result.data.name} has been created`)
        if (onSuccess) {
          onSuccess(result.data)
        }
        break
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
            <form onSubmit={createApp} className="flex flex-col">
              <Input id="app-name" type="string" placeholder="Enter app name" className="w-96 font-body" onChange={(event) => setAppName(event.target.value)} />
              <div className="py-2" />
              <div className='flex flex-row gap-2'>
                <Button
                  variant="outline"
                  type="submit"
                  className="w-fit"
                  loading={createAppApiStatus === CreateAppApiStatus.Loading}
                  disabled={createAppApiStatus === CreateAppApiStatus.Loading || appName.length === 0}
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
