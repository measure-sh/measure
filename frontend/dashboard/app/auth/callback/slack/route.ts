import crypto from 'crypto';
import { NextResponse } from "next/server";
import { getPosthogServer } from "../../../posthog-server";

export const dynamic = "force-dynamic"

const origin = process?.env?.NEXT_PUBLIC_SITE_URL
const apiOrigin = process?.env?.API_BASE_URL
const SALT = process.env.SLACK_OAUTH_STATE_SALT

const posthog = getPosthogServer()

function verifyTimeBasedState(state: string) {
  try {
    const [timestamp, encodedData, providedHash] = state.split('.')

    if (!timestamp || !encodedData || !providedHash) {
      throw new Error('Invalid state format')
    }

    const timeWindow = parseInt(timestamp)
    const currentWindow = Math.floor(Date.now() / (5 * 60 * 1000))

    // Allow current and previous time window (10 minutes total)
    if (currentWindow - timeWindow > 1) {
      throw new Error('State expired')
    }

    // Recreate expected hash using the same salt as creation
    const derivedKey = crypto.pbkdf2Sync(
      `${timeWindow}-${encodedData}`, // password
      SALT || '',                     // salt
      100000,                         // iterations
      32,                             // key length
      'sha256'
    )
    const expectedHash = derivedKey.toString('hex')

    if (providedHash !== expectedHash) {
      throw new Error('Invalid state hash')
    }

    // Decode and return the user data
    const userData = JSON.parse(atob(encodedData))
    return userData

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`State verification failed: ${errorMessage}`)
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  let returnUrl = `${origin}`
  let userId = null
  let teamId = null

  try {
    if (state) {
      const userData = verifyTimeBasedState(state)
      userId = userData.userId
      teamId = userData.teamId
      returnUrl = `${origin}/${teamId}/team`
    } else {
      throw new Error('No state parameter provided')
    }
  } catch (err) {
    posthog.captureException(err, {
      source: 'slack_oauth_callback',
      user_id: userId,
      team_id: teamId
    })
    console.error('State verification failed:', err)
    return NextResponse.redirect(
      `${returnUrl}?error=${encodeURIComponent('Invalid or expired OAuth state')}`,
      { status: 302 }
    )
  }

  // Handle OAuth errors from Slack
  if (error) {
    console.log(`Slack OAuth failure: ${error}`)
    const errorMessage = error === 'access_denied'
      ? 'Installation cancelled'
      : `Slack OAuth error: ${error}`

    posthog.captureException(errorMessage, {
      source: 'slack_oauth_callback',
      user_id: userId,
      team_id: teamId
    })
    return NextResponse.redirect(
      `${returnUrl}?error=${encodeURIComponent(errorMessage)}`,
      { status: 302 }
    )
  }

  if (!code) {
    console.log("Slack OAuth failure: no authorization code")
    posthog.captureException("Slack OAuth failure: no authorization code", {
      source: 'slack_oauth_callback',
      user_id: userId,
      team_id: teamId
    })
    return NextResponse.redirect(
      `${returnUrl}?error=${encodeURIComponent('Could not connect Slack workspace')}`,
      { status: 302 }
    )
  }

  // Exchange code for Slack installation
  const res = await fetch(`${apiOrigin}/slack/connect`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
      userId,
      teamId
    }),
  })

  if (!res.ok) {
    const errorResponse = await res.json()
    const baseErrorMessage = 'Could not connect to Slack workspace'
    const serverErrorMessage = errorResponse.error
    const errorMessage = serverErrorMessage
      ? `${baseErrorMessage}: ${serverErrorMessage}`
      : baseErrorMessage
    posthog.captureException(errorMessage, {
      source: 'slack_oauth_callback',
      user_id: userId,
      team_id: teamId
    })
    console.error(errorMessage)
    return NextResponse.redirect(
      `${returnUrl}?error=${encodeURIComponent(errorMessage)}`,
      { status: 302 }
    )
  }

  const data = await res.json()

  // Success - redirect back with success message
  const successMessage = `Successfully connected to ${data.slack_team_name} workspace!`
  return NextResponse.redirect(
    new URL(`${returnUrl}?success=${encodeURIComponent(successMessage)}`),
    { status: 303 }
  )
}