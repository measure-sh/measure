"use client"

import { Plus } from 'lucide-react'
import React, { FormEventHandler, useState } from 'react'
import { CreateMcpKeyApiStatus, createMcpKeyFromServer, McpKey } from '../api/api_calls'
import { toastNegative, toastPositive } from '../utils/use_toast'
import { Button } from './button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog"

interface CreateMcpKeyProps {
  teamId: string
  onSuccess?: (mcpKey: McpKey) => void
}
const CreateMcpKey: React.FC<CreateMcpKeyProps> = ({ teamId, onSuccess }) => {

  const [createMcpKeyApiStatus, setCreateMcpKeyApiStatus] = useState(CreateMcpKeyApiStatus.Init)
  const [keyName, setKeyName] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)

  const createMcpKey: FormEventHandler = async (event) => {
    event.preventDefault()

    if (keyName === "") {
      return
    }

    setCreateMcpKeyApiStatus(CreateMcpKeyApiStatus.Loading)

    const result = await createMcpKeyFromServer(teamId, keyName)

    switch (result.status) {
      case CreateMcpKeyApiStatus.Error:
        setCreateMcpKeyApiStatus(CreateMcpKeyApiStatus.Error)
        toastNegative(`Error creating MCP key: ${result.error}`)
        break
      case CreateMcpKeyApiStatus.Success:
        setCreateMcpKeyApiStatus(CreateMcpKeyApiStatus.Success)
        setDialogOpen(false)
        toastPositive(`MCP key ${result.data.name} has been created`)
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
        <Plus /> Create MCP Key
      </Button>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Add new MCP key</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col w-5/6">
            <form onSubmit={createMcpKey} className="flex flex-col">
              <input id="app-name" type="string" placeholder="Enter key name" className="w-96 border border-black rounded-md outline-hidden focus-visible:outline-yellow-300 py-2 px-4 font-body placeholder:text-neutral-400" onChange={(event) => setKeyName(event.target.value)} />
              <div className="py-2" />
              <div className='flex flex-row gap-2'>
                <Button
                  variant="outline"
                  type="submit"
                  className="w-fit font-display border border-black select-none"
                  loading={createMcpKeyApiStatus === CreateMcpKeyApiStatus.Loading}
                  disabled={createMcpKeyApiStatus === CreateMcpKeyApiStatus.Loading || keyName.length === 0}
                >Create MCP Key
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

export default CreateMcpKey
