import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = "force-dynamic"

const SALT = process.env.SLACK_OAUTH_STATE_SALT

function createTimeBasedState(userData: any): string {
  const now = Math.floor(Date.now() / (5 * 60 * 1000))
  const encodedData = btoa(JSON.stringify(userData))

  const hash = crypto.pbkdf2Sync(
    `${now}-${encodedData}`, // password
    SALT || '',              // salt
    100000,                  // iterations
    32,                      // key length
    'sha256'
  ).toString('hex')

  return `${now}.${encodedData}.${hash}`
}

export async function POST(req: NextRequest) {
  try {
    const { userId, teamId, redirectUrl } = await req.json()

    if (!userId || !teamId || !redirectUrl) {
      return NextResponse.json(
        { error: 'userId, teamId, and redirectUrl are required' },
        { status: 400 }
      )
    }

    const state = createTimeBasedState({ userId: userId, teamId: teamId, redirectUrl: redirectUrl })


    const slackUrl = new URL('https://slack.com/oauth/v2/authorize')
    slackUrl.searchParams.set('client_id', process.env.SLACK_CLIENT_ID!)
    slackUrl.searchParams.set('scope', 'chat:write,channels:read,groups:read,commands')
    slackUrl.searchParams.set('redirect_uri', redirectUrl)
    slackUrl.searchParams.set('state', state)

    return NextResponse.json({ url: slackUrl.toString() })
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  }
}