"use client"

import { Plus } from 'lucide-react'
import React, { FormEventHandler, useState } from 'react'
import { useCreateTeamMutation } from '../query/hooks'
import { toastNegative, toastPositive } from '../utils/use_toast'
import { Button } from './button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./dialog"
import { Input } from './input'

interface CreateTeamProps {
    disabled?: boolean
    onSuccess?: (teamId: string) => void
}

const CreateTeam: React.FC<CreateTeamProps> = ({ disabled, onSuccess }) => {
    const createTeam = useCreateTeamMutation()

    const [teamName, setTeamName] = useState("")
    const [dialogOpen, setDialogOpen] = useState(false)

    const handleCreateTeam: FormEventHandler = async (event) => {
        event.preventDefault()
        if (teamName === "") {
            return
        }
        try {
            const result = await createTeam.mutateAsync({ teamName })
            setDialogOpen(false)
            toastPositive(`Team ${teamName} has been created`)
            setTeamName("")
            if (onSuccess && result?.id) {
                onSuccess(result.id)
            }
        } catch (error) {
            toastNegative(`Error creating team: ${error instanceof Error ? error.message : "Unknown error"}`)
        }
    }

    return (
        <>
            <Button
                variant="outline"
                disabled={disabled}
                onClick={() => setDialogOpen(true)}
            >
                <Plus /> Create Team
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className='bg-background text-foreground'>
                    <DialogHeader>
                        <DialogTitle className="font-display">Add new team</DialogTitle>
                        <DialogDescription>Create a new team.</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col w-5/6">
                        <form onSubmit={handleCreateTeam} className="flex flex-col">
                            <Input id="team-name" type="string" placeholder="Enter team name" className="w-96 font-body" onChange={(event) => setTeamName(event.target.value)} value={teamName} />
                            <div className="py-2" />
                            <div className='flex flex-row gap-2'>
                                <Button
                                    variant="outline"
                                    type="submit"
                                    className="w-fit"
                                    loading={createTeam.isPending}
                                    disabled={createTeam.isPending || teamName.length === 0}
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
