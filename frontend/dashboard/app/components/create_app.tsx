"use client"

import React, { useState, FormEventHandler } from 'react'
import { CreateAppApiStatus, createAppFromServer, App } from '../api/api_calls'
import Link from 'next/link'
import { Button } from './button'
import { toastPositive } from '../utils/use_toast'

interface CreateAppProps {
  teamId: string,
  existingAppName?: string,
  existingApiKey?: string
}

export enum CreateAppStatus {
  PreCreation,
  PostCreation
}

// This component acts in two modes.
//
// If only teamId is passed in, it will show
// the UI for new app creation first and show following app setup steps after
// successfull app creation.
//
// If existingAppName and existingApiKey are passed in, it will skip the new app
// creation UI and only show the following app setup steps with the api key and
// app name passed in.
const CreateApp: React.FC<CreateAppProps> = ({ teamId, existingAppName = null, existingApiKey = null }) => {

  const [data, setData] = useState<App>()
  const [createAppStatus, setCreateAppStatus] = useState(existingAppName === null && existingApiKey === null ? CreateAppStatus.PreCreation : CreateAppStatus.PostCreation)
  const [createAppApiStatus, setCreateAppApiStatus] = useState(CreateAppApiStatus.Init)
  const [appName, setAppName] = useState("")

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
        break
      case CreateAppApiStatus.Success:
        setCreateAppApiStatus(CreateAppApiStatus.Success)
        setCreateAppStatus(CreateAppStatus.PostCreation)
        setData(result.data)
        break
    }
  }

  return (
    <div>
      {/* UI before app creation */}
      {createAppStatus === CreateAppStatus.PreCreation &&
        <div className="flex flex-col w-5/6">
          <form onSubmit={createApp} className="flex flex-col">
            <p className="font-display font-regular text-2xl">Add new app</p>
            <div className="py-2" />
            <input id="app-name" type="string" placeholder="Enter app name" className="w-96 border border-black rounded-md outline-hidden focus-visible:outline-yellow-300 py-2 px-4 font-body placeholder:text-neutral-400" onChange={(event) => setAppName(event.target.value)} />
            <div className="py-2" />
            <Button
              variant="outline"
              type="submit"
              className="w-fit font-display border border-black select-none"
              disabled={createAppApiStatus === CreateAppApiStatus.Loading || appName.length === 0}
            >Create App
            </Button>
            <div className="py-2" />
          </form>
          {createAppApiStatus === CreateAppApiStatus.Loading && <p className="font-display">Creating app...</p>}
          {createAppApiStatus === CreateAppApiStatus.Error && <p className="font-display">Error creating app. Please try again.</p>}
        </div>
      }

      {/* UI after app creation */}
      {createAppStatus === CreateAppStatus.PostCreation &&
        <div className="flex flex-col">
          <p className="font-body text-sm">Follow our <Link target='_blank' className="underline decoration-2 underline-offset-2 decoration-yellow-200 hover:decoration-yellow-500" href='https://github.com/measure-sh/measure?tab=readme-ov-file#docs'>docs</Link> to finish setting up your app.</p>
          <div className="py-4" />
          <p className="font-display text-xl max-w-6xl">API key</p>
          <div className="flex flex-row items-center">
            <input id="api-key-input" readOnly={true} type="text" value={existingApiKey !== null ? existingApiKey : data!.api_key.key} className="w-96 border border-black rounded-md outline-hidden text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] py-2 px-4 font-body placeholder:text-neutral-400" />
            <Button
              variant="outline"
              type="submit"
              className="m-4 w-fit font-display border border-black select-none"
              onClick={() => {
                navigator.clipboard.writeText(existingApiKey !== null ? existingApiKey : data!.api_key.key)
                toastPositive("API key copied to clipboard")
              }}
            >Copy
            </Button>
          </div>
        </div>
      }
    </div>
  )
}

export default CreateApp
