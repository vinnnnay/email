import { useEffect, useState } from 'react'
import axios from 'axios'
import './App.css'

type Tone = 'formal' | 'casual' | 'apology'

const templates: Record<Tone, (context: string) => string> = {
  formal: (context) =>
    `Dear recipient,\n\nI hope this message finds you well. ${context} \n\nBest regards,\n[Your Name]`,
  casual: (context) =>
    `Hey there,\n\n${context} \n\nCheers,\n[Your Name]`,
  apology: (context) =>
    `Hello,\n\nI want to sincerely apologize for the inconvenience. ${context} \n\nSincerely,\n[Your Name]`
}

function App() {
  const [toEmail, setToEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [contextText, setContextText] = useState('')
  const [tone, setTone] = useState<Tone>('formal')
  const [generatedText, setGeneratedText] = useState('')
  const [status, setStatus] = useState('Ready')
  const [isAuth, setIsAuth] = useState(false)

  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      const { data } = await axios.get('/api/auth-status')
      setIsAuth(!!data.authenticated)
    } catch (err) {
      console.error(err)
      setIsAuth(false)
    }
  }

  const generateEmail = () => {
    if (!contextText.trim()) {
      setStatus('Enter context to generate email')
      return
    }

    const template = templates[tone]
    const result = template(contextText.trim())
    setGeneratedText(result)
    setSubject(subject || `Regarding: ${contextText.slice(0, 40)}`)
    setStatus('Email generated')
  }

  const loginWithGoogle = async () => {
    try {
      const { data } = await axios.get('/api/auth-url')
      window.open(data.url, '_blank')
      setStatus('Google login opened. Complete authorization and then click Check auth.')
    } catch (error) {
      console.error(error)
      setStatus('Failed to get Google login URL')
    }
  }

  const sendEmail = async () => {
    if (!generatedText) {
      setStatus('Generate an email before sending')
      return
    }

    try {
      const res = await axios.post('/api/send-email', {
        to: toEmail,
        subject,
        body: generatedText
      })
      if (res.data.success) {
        setStatus('Email sent successfully!')
      } else {
        setStatus('Email request completed with no success flag')
      }
    } catch (error: any) {
      console.error(error)
      setStatus('Failed to send email: ' + (error?.response?.data?.error || error.message))
    }
  }

  return (
    <div className="app-container">
      <h1>AI Email / Message Generator</h1>
      <div className="controls">
        <label>Recipient email</label>
        <input value={toEmail} onChange={(e) => setToEmail(e.target.value)} placeholder="to@example.com" />

        <label>Template</label>
        <select value={tone} onChange={(e) => setTone(e.target.value as Tone)}>
          <option value="formal">Formal</option>
          <option value="casual">Casual</option>
          <option value="apology">Apology / Request</option>
        </select>

        <label>Context (purpose / details)</label>
        <textarea value={contextText} onChange={(e) => setContextText(e.target.value)} rows={5} />

        <button onClick={generateEmail}>Generate Email</button>
      </div>

      <label>Subject</label>
      <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject" />

      <label>Generated Email</label>
      <textarea readOnly value={generatedText} rows={12} />

      <div className="actions">
        <button onClick={loginWithGoogle}>Sign in with Google</button>
        <button onClick={checkAuthStatus}>Check Auth Status</button>
        <button onClick={sendEmail} disabled={!isAuth}>Send via Gmail</button>
      </div>

      <p className="status">Status: {status}</p>
      <p>Gmail auth: {isAuth ? 'connected' : 'not connected'}</p>
    </div>
  )
}

export default App
