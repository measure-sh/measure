"use client"

import { FetchMcpKeysApiStatus, fetchMcpKeysFromServer, McpKey, RevokeMcpKeyApiStatus, revokeMcpKeyFromServer } from "@/app/api/api_calls"
import { Button } from "@/app/components/button"
import CreateMcpKey from "@/app/components/create_mcp_key"
import DangerConfirmationModal from "@/app/components/danger_confirmation_dialog"
import LoadingSpinner from "@/app/components/loading_spinner"
import { formatDateToHumanReadableDateTime } from "@/app/utils/time_utils"
import { toastNegative, toastPositive } from "@/app/utils/use_toast"
import { useEffect, useState } from 'react'

export default function MCP({ params }: { params: { teamId: string } }) {

  const [fetchMcpKeysApiStatus, setFetchMcpKeysApiStatus] = useState<FetchMcpKeysApiStatus>(FetchMcpKeysApiStatus.Loading)
  const [revokeMcpKeyApiStatus, setRevokeMcpKeyApiStatus] = useState<RevokeMcpKeyApiStatus>(RevokeMcpKeyApiStatus.Init)

  const [mcpKeys, setMcpKeys] = useState<McpKey[]>([])
  const [revokeConfirmationModalOpen, setRevokeConfirmationModalOpen] = useState(false)
  const [revokeKeyId, setRevokeKeyId] = useState<string | null>(null)
  const [revokeKeyName, setRevokeKeyName] = useState<string | null>(null)


  const getMcpKeys = async () => {
    setFetchMcpKeysApiStatus(FetchMcpKeysApiStatus.Loading)

    const result = await fetchMcpKeysFromServer(params.teamId)

    switch (result.status) {
      case FetchMcpKeysApiStatus.Error:
        setFetchMcpKeysApiStatus(FetchMcpKeysApiStatus.Error)
        break
      case FetchMcpKeysApiStatus.NoKeys:
        setFetchMcpKeysApiStatus(FetchMcpKeysApiStatus.NoKeys)
        break
      case FetchMcpKeysApiStatus.Success:
        setFetchMcpKeysApiStatus(FetchMcpKeysApiStatus.Success)
        setMcpKeys(result.data)
        break
    }
  }

  useEffect(() => {
    getMcpKeys()
  }, [])

  const revokeMcpKey = async () => {
    setRevokeMcpKeyApiStatus(RevokeMcpKeyApiStatus.Loading)

    const result = await revokeMcpKeyFromServer(params.teamId, revokeKeyId!)

    switch (result.status) {

      case RevokeMcpKeyApiStatus.Error:
        setRevokeMcpKeyApiStatus(RevokeMcpKeyApiStatus.Error)
        toastNegative("Error revoking MCP key")
        break
      case RevokeMcpKeyApiStatus.Success:
        setRevokeMcpKeyApiStatus(RevokeMcpKeyApiStatus.Success)
        setMcpKeys((prevKeys) => prevKeys.map((key) => key.id === revokeKeyId ? { ...key, revoked: true } : key))
        toastPositive("MCP key revoked successfully")
        break
    }
  }

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start">
      <div className="flex flex-row items-center gap-2 justify-between w-full">
        <p className="font-display text-4xl max-w-6xl text-center">MCP Keys</p>
        <CreateMcpKey
          teamId={params.teamId}
          onSuccess={(key) => {
            setFetchMcpKeysApiStatus(FetchMcpKeysApiStatus.Success)
            setMcpKeys((prevKeys) => [...prevKeys, key])
          }} />
      </div>

      {/* Main UI*/}
      <div>
        {/* Modal for confirming Key revoke */}
        <DangerConfirmationModal
          body={
            <p className="font-body">Are you sure you want to revoke MCP key <span className="font-display font-bold">{revokeKeyName}</span>?
              <br /><br />All services using this key will lose access immediately.
            </p>
          }
          open={revokeConfirmationModalOpen}
          affirmativeText="Yes, I'm sure"
          cancelText="Cancel"
          confirmationText={revokeKeyName!}
          onAffirmativeAction={() => {
            setRevokeConfirmationModalOpen(false)
            revokeMcpKey()
          }}
          onCancelAction={() => setRevokeConfirmationModalOpen(false)}
        />

        <div className="py-8" />
        {/* Loading message for fetch mcp keys */}
        {fetchMcpKeysApiStatus === FetchMcpKeysApiStatus.Loading && <LoadingSpinner />}
        {/* Error message for fetch mcp keys */}
        {fetchMcpKeysApiStatus === FetchMcpKeysApiStatus.Error && <p className="font-body text-sm">Error fetching MCP keys, please refresh page to try again</p>}
        {/* No keys message for fetch mcp keys */}
        {fetchMcpKeysApiStatus === FetchMcpKeysApiStatus.NoKeys && <p className="font-body text-sm">Looks like you don&apos;t have any MCP keys yet. Get started by creating one!</p>}

        {fetchMcpKeysApiStatus === FetchMcpKeysApiStatus.Success &&
          <div className="flex flex-col">
            {mcpKeys?.map(({ id, name, key, revoked, created_at, last_seen }, index) => (
              <div key={id} className={`${index == 0 ? 'mt-0' : 'mt-24'}`}>
                <div className="font-display text-2xl">{name}</div>
                <div className="py-2" />
                <p className={`w-fit px-2 py-1 rounded-full border text-sm font-display ${revoked ? 'border-red-600 text-red-600 bg-red-50' : 'border-green-600 text-green-600 bg-green-50'}`}>{revoked ? 'Revoked' : 'Active'}</p>
                <div className="py-2" />
                <div className="font-body">Created At: {created_at ? formatDateToHumanReadableDateTime(created_at) : "N/A"}</div>
                <div className="py-1" />
                <div className="font-body">Last seen: {last_seen ? formatDateToHumanReadableDateTime(last_seen) : "N/A"}</div>
                <div className="py-2" />
                <div className="flex flex-row items-center">
                  <input type="text" readOnly={true} value={key} className="w-96 border border-black rounded-md outline-hidden text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] py-2 px-4 font-body placeholder:text-neutral-400" />
                  <div className="px-2" />
                  <Button
                    variant="outline"
                    className="font-display border border-black select-none"
                    disabled={revoked}
                    onClick={() => {
                      navigator.clipboard.writeText(key)
                      toastPositive("MCP key copied to clipboard")
                    }}>
                    Copy
                  </Button>
                  <div className="px-2" />
                  <Button
                    variant="outline"
                    className="font-display border border-black select-none"
                    disabled={revoked}
                    loading={revokeMcpKeyApiStatus === RevokeMcpKeyApiStatus.Loading && revokeKeyId === id}
                    onClick={() => {
                      console.log("Revoke button clicked for key ID:", id);
                      setRevokeKeyId(id)
                      setRevokeKeyName(name)
                      setRevokeConfirmationModalOpen(true)
                    }}>
                    Revoke
                  </Button>
                </div>
              </div>
            ))}
          </div>
        }

      </div >
      <div className="py-4" />
    </div >
  )
}
