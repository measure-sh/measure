import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getPosthogServer } from "../../../posthog-server";

export const dynamic = "force-dynamic"

const SALT = process.env.SLACK_OAUTH_STATE_SALT

const posthog = getPosthogServer()

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
  let err = ""
  try {
    const { userId, teamId, redirectUrl } = await req.json()

    if (!userId || !teamId || !redirectUrl) {
      err = `Slack OAuth URL generation failure: userId, teamId, and redirectUrl are required`
      posthog.captureException(err, {
        source: 'slack_oauth_url_generation',
        user_id: userId,
        team_id: teamId
      })
      console.log(err)
      return NextResponse.json(
        { error: err },
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
    posthog.captureException(error, {
      source: 'slack_oauth_url_generation',
    })
    console.error("Error generating Slack OAuth URL:", error)
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  }
}
