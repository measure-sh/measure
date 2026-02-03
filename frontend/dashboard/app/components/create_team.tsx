"use client"

import { Plus } from 'lucide-react'
import React, { FormEventHandler, useState } from 'react'
import { CreateTeamApiStatus, createTeamFromServer } from '../api/api_calls'
import { toastNegative, toastPositive } from '../utils/use_toast'
import { Button } from './button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog"
import { Input } from './input'

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
                toastPositive(`Team ${teamName} has been created`)
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
                onClick={() => setDialogOpen(true)}
            >
                <Plus /> Create Team
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className='bg-background text-foreground'>
                    <DialogHeader>
                        <DialogTitle className="font-display">Add new team</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col w-5/6">
                        <form onSubmit={createTeam} className="flex flex-col">
                            <Input id="team-name" type="string" placeholder="Enter team name" className="w-96 font-body" onChange={(event) => setTeamName(event.target.value)} value={teamName} />
                            <div className="py-2" />
                            <div className='flex flex-row gap-2'>
                                <Button
                                    variant="outline"
                                    type="submit"
                                    className="w-fit"
                                    loading={createTeamApiStatus === CreateTeamApiStatus.Loading}
                                    disabled={createTeamApiStatus === CreateTeamApiStatus.Loading || teamName.length === 0}
                                >Create Team
                                </Button>
                                <Button
                                    variant="outline"
                                    type="button"
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

export default CreateTeam
