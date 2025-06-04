"use client"

import React, { useState, FormEventHandler } from 'react'
import { CreateTeamApiStatus, createTeamFromServer } from '../api/api_calls'
import { Button } from './button'
import { toastNegative, toastPositive } from '../utils/use_toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog"
import { Plus } from 'lucide-react'

interface CreateTeamProps {
    onSuccess?: (teamId: string) => void
}

const CreateTeam: React.FC<CreateTeamProps> = ({ onSuccess }) => {
    const [createTeamApiStatus, setCreateTeamApiStatus] = useState(CreateTeamApiStatus.Init)
    const [teamName, setTeamName] = useState("")
    const [dialogOpen, setDialogOpen] = useState(false)

    const createTeam: FormEventHandler = async (event) => {
        event.preventDefault()
        if (teamName === "") {
            return
        }
        setCreateTeamApiStatus(CreateTeamApiStatus.Loading)
        const result = await createTeamFromServer(teamName)
        switch (result.status) {
            case CreateTeamApiStatus.Error:
                setCreateTeamApiStatus(CreateTeamApiStatus.Error)
                toastNegative(`Error creating team: ${result.error}`)
                break
            case CreateTeamApiStatus.Success:
                setCreateTeamApiStatus(CreateTeamApiStatus.Success)
                setDialogOpen(false)
                toastPositive(`Team ${teamName} created successfully!`)
                setTeamName("")
                if (onSuccess) {
                    onSuccess(result.data.id)
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
                <Plus /> Create Team
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="font-display">Add new team</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col w-5/6">
                        <form onSubmit={createTeam} className="flex flex-col">
                            <input id="team-name" type="string" placeholder="Enter team name" className="w-96 border border-black rounded-md outline-hidden focus-visible:outline-yellow-300 py-2 px-4 font-body placeholder:text-neutral-400" onChange={(event) => setTeamName(event.target.value)} value={teamName} />
                            <div className="py-2" />
                            <div className='flex flex-row gap-2'>
                                <Button
                                    variant="outline"
                                    type="submit"
                                    className="w-fit font-display border border-black select-none"
                                    loading={createTeamApiStatus === CreateTeamApiStatus.Loading}
                                    disabled={createTeamApiStatus === CreateTeamApiStatus.Loading || teamName.length === 0}
                                >Create Team
                                </Button>
                                <Button
                                    variant="outline"
                                    type="button"
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

export default CreateTeam
