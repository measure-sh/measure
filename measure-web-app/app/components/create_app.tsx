"use client"

import React, { useState, FormEventHandler } from 'react';
import { getAccessTokenOrRedirectToAuth, logoutIfAuthError } from '@/app/utils/auth_utils';
import { useRouter } from 'next/navigation';
import Accordion from './accordion';

interface CreateAppProps {
  teamId: string,
  existingAppName?: string,
  existingApiKey?: string
}

export enum CreateAppStatus {
  PreCreation,
  PostCreation
}

export enum CreateAppApiStatus {
  Init,
  Loading,
  Success,
  Error
}

// This component acts in two modes.
//
// If only teamId is passed in, it will show
// the UI for new app creation first and show following app setup steps after
// successfull app creation. 
//
// If existingAppName and existingApiKey are passed in, it will skip the new app
// creation UI and only show the following app setup steps with the api key and
//app name passed in.
const CreateApp: React.FC<CreateAppProps> = ({ teamId, existingAppName = null, existingApiKey = null }) => {

  const addAppSteps = [
    {
      title: "Add the Measure SDK to your app",
      text: `//<project>/<app-module>/build.gradle.kts or <project>/<app-module>/build.gradle)
  
      dependencies {
        implementation("sh.measure:measure")
      }`,
      active: true,
    },
    {
      title: "Add the Measure Gradle plugin to your app's root Gradle file",
      text: `//<project>/build.gradle.kts or <project>/build.gradle
        
      plugins {
          id("com.android.application") version "7.3.0" apply false
          // ...
    
          // Add the dependency for the Measure Gradle plugin
          id("sh.measure") version "2.9.9" apply false
        }`,
      active: false,
    },
    {
      title: "Add the Measure Gradle plugin to your app's module level Gradle file",
      text: `//<project>/<app-module>/build.gradle.kts or <project>/<app-module>/build.gradle
        
        plugins {
          id("com.android.application")
          // ...
        
          // Add the Measure Gradle plugin
          id("sh.measure")
        }`,
      active: false,
    },
    {
      title: "Force a test crash to finish setup",
      text: `    val crashButton = Button(this)
      crashButton.text = "Test Crash"
      crashButton.setOnClickListener {
         throw RuntimeException("Test Crash") // Force a crash
      }
      
      addContentView(crashButton, ViewGroup.LayoutParams(
             ViewGroup.LayoutParams.MATCH_PARENT,
             ViewGroup.LayoutParams.WRAP_CONTENT))`,
      active: false,
    }
  ]

  const emptyData = {
    "id": "",
    "team_id": "",
    "name": "",
    "api_key": {
      "created_at": "",
      "key": "",
      "last_seen": null,
      "revoked": false
    },
    "onboarded": false,
    "created_at": "",
    "updated_at": "",
    "platform": null,
    "onboarded_at": null,
    "unique_identifier": null
  }

  const [data, setData] = useState(emptyData);
  const [createAppStatus, setCreateAppStatus] = useState(existingAppName === null && existingApiKey === null ? CreateAppStatus.PreCreation : CreateAppStatus.PostCreation)
  const [createAppApiStatus, setCreateAppApiStatus] = useState(CreateAppApiStatus.Init);
  const [appName, setAppName] = useState("");

  const router = useRouter()

  const createApp: FormEventHandler = async (event) => {
    event.preventDefault();

    if (appName === "") {
      return
    }

    setCreateAppApiStatus(CreateAppApiStatus.Loading)

    const authToken = await getAccessTokenOrRedirectToAuth(router)
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
      method: 'POST',
      headers: {
        "Authorization": `Bearer ${authToken}`
      },
      body: JSON.stringify({ name: appName })
    };

    const res = await fetch(`${origin}/teams/${teamId}/apps`, opts);

    if (!res.ok) {
      setCreateAppApiStatus(CreateAppApiStatus.Error)
      logoutIfAuthError(router, res)
      return
    }

    setCreateAppApiStatus(CreateAppApiStatus.Success)
    setCreateAppStatus(CreateAppStatus.PostCreation)
    setData(await res.json())
  }

  return (
    <div>
      {/* UI before app creation */}
      {createAppStatus === CreateAppStatus.PreCreation &&
        <div className="flex flex-col w-5/6">
          <form onSubmit={createApp} className="flex flex-col">
            <p className="font-display font-regular text-2xl">Add new app</p>
            <div className="py-2" />
            <input id="app-name" type="string" placeholder="Enter app name" className="w-96 border border-black rounded-md outline-none focus-visible:outline-yellow-300 py-2 px-4 font-sans placeholder:text-neutral-400" onChange={(event) => setAppName(event.target.value)} />
            <div className="py-2" />
            <button type="submit" disabled={createAppApiStatus === CreateAppApiStatus.Loading || appName.length === 0} className={`w-fit outline-none hover:bg-yellow-200 focus-visible:bg-yellow-200 active:bg-yellow-300 font-display border border-black rounded-md transition-colors duration-100 py-2 px-4 ${(createAppApiStatus === CreateAppApiStatus.Loading) ? 'pointer-events-none' : 'pointer-events-auto'}`}>Create App</button>
            <div className="py-2" />
          </form>
          {createAppApiStatus === CreateAppApiStatus.Loading && <p className="font-display">Creating app...</p>}
          {createAppApiStatus === CreateAppApiStatus.Error && <p className="font-display">Error creating app. Please try again.</p>}
        </div>
      }

      {/* UI after app creation */}
      {createAppStatus === CreateAppStatus.PostCreation &&
        <div className="flex flex-col w-5/6">
          <p className="font-display font-regular text-2xl">Finish setting up {existingAppName !== null ? existingAppName : data.name}</p>
          <div className="py-4" />
          <p className="font-display font-regular text-xl max-w-6xl">API key</p>
          <div className="flex flex-row items-center">
            <input id="api-key-input" type="text" value={existingApiKey !== null ? existingApiKey : data.api_key.key} className="w-96 border border-black rounded-md outline-none focus-visible:outline-yellow-300 py-2 px-4 font-sans placeholder:text-neutral-400" />
            <button className="m-4 outline-none flex justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black rounded-md font-display transition-colors duration-100 py-2 px-4" onClick={() => navigator.clipboard.writeText(existingApiKey !== null ? existingApiKey : data.api_key.key)}>Copy</button>
          </div>
          <div className="py-4" />
          <p className="font-display font-regular text-2xl max-w-6xl">Steps:</p>
          <div>
            {addAppSteps.map((text, index) => (
              <Accordion key={index} title={text.title} id={`addAppSteps-${index}`} active={text.active}>
                {text.text}
              </Accordion>
            ))}
          </div>
        </div>
      }
    </div>
  );
};

export default CreateApp;