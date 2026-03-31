import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { google } from 'googleapis'

dotenv.config()

const app = express()
const port = Number(process.env.SERVER_PORT || 4000)

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

const clientId = process.env.GOOGLE_CLIENT_ID
const clientSecret = process.env.GOOGLE_CLIENT_SECRET
const redirectUri = process.env.GOOGLE_REDIRECT_URI || `http://localhost:${port}/api/oauth2callback`

if (!clientId || !clientSecret) {
  throw new Error('Missing GOOGLE_CLIENT_ID and/or GOOGLE_CLIENT_SECRET in environment')
}

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

type SimpleToken = { refresh_token?: string | null }
let currentCredential: SimpleToken | null = null

app.get('/api/auth-url', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/userinfo.email'],
    prompt: 'consent'
  })
  res.json({ url })
})

app.get('/api/oauth2callback', async (req, res) => {
  try {
    const code = req.query.code as string
    if (!code) {
      return res.status(400).send('Missing code')
    }
    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)
    currentCredential = tokens
    res.send('<h1>Authentication successful</h1><p>You can close this window and return to the app.</p>')
  } catch (error) {
    console.error(error)
    res.status(500).send('Auth callback failed')
  }
})

app.get('/api/auth-status', (req, res) => {
  res.json({ authenticated: !!currentCredential?.refresh_token })
})

function encodeMessage(to: string, subject: string, body: string) {
  const messageParts = [
    `To: ${to}`,
    'Content-Type: text/plain; charset=UTF-8',
    'MIME-Version: 1.0',
    `Subject: ${subject}`,
    '',
    body
  ]
  const message = messageParts.join('\n')
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return encodedMessage
}

app.post('/api/send-email', async (req, res) => {
  try {
    const { to, subject, body } = req.body
    if (!to || !subject || !body) {
      return res.status(400).json({ error: 'to, subject, body required' })
    }

    if (!currentCredential?.refresh_token) {
      return res.status(401).json({ error: 'Not authenticated with Gmail' })
    }

    oauth2Client.setCredentials({ refresh_token: currentCredential.refresh_token })
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

    const raw = encodeMessage(to, subject, body)

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw }
    })

    res.json({ success: true })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: String(error) })
  }
})

app.listen(port, () => {
  console.log(`Server is listening on http://localhost:${port}`)
})
