"use client"

import React, { useState, FormEventHandler } from 'react'
import { CreateAppApiStatus, createAppFromServer, App } from '../api/api_calls'
import { Button } from './button'
import { toast, toastNegative, toastPositive } from '../utils/use_toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog"
import { Plus } from 'lucide-react'

interface CreateAppProps {
  teamId: string,
  onSuccess?: (app: App) => void
}
const CreateApp: React.FC<CreateAppProps> = ({ teamId, onSuccess }) => {

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
        setCreateAppApiStatus(CreateAppApiStatus.Error)
        toastNegative(`Error creating app: ${result.error}`)
        break
      case CreateAppApiStatus.Success:
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
        className="font-display border border-black select-none"
        onClick={() => setDialogOpen(true)}
      >
        <Plus /> Create App
      </Button>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Add new app</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col w-5/6">
            <form onSubmit={createApp} className="flex flex-col">
              <input id="app-name" type="string" placeholder="Enter app name" className="w-96 border border-black rounded-md outline-hidden focus-visible:outline-yellow-300 py-2 px-4 font-body placeholder:text-neutral-400" onChange={(event) => setAppName(event.target.value)} />
              <div className="py-2" />
              <div className='flex flex-row gap-2'>
                <Button
                  variant="outline"
                  type="submit"
                  className="w-fit font-display border border-black select-none"
                  loading={createAppApiStatus === CreateAppApiStatus.Loading}
                  disabled={createAppApiStatus === CreateAppApiStatus.Loading || appName.length === 0}
                >Create App
                </Button>
                <Button
                  variant="outline"
                  type="submit"
                  className="w-fit font-display border border-black select-none"
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
