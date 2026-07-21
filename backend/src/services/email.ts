import { Resend } from 'resend'
import { env } from '../config/env'

const resend = env.resendApiKey ? new Resend(env.resendApiKey) : null

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
  if (!resend) {
    console.warn(`RESEND_API_KEY not set — skipping password reset email to ${to}. Link: ${resetLink}`)
    return
  }
  const { error } = await resend.emails.send({
    from: env.emailFrom,
    to,
    subject: 'HDD Planner – Passwort zurücksetzen',
    html: `
      <p>Klicke auf den folgenden Link, um dein Passwort zurückzusetzen (gültig für 1 Stunde):</p>
      <p><a href="${resetLink}">${resetLink}</a></p>
      <p>Falls du das nicht angefordert hast, kannst du diese E-Mail ignorieren.</p>
    `,
  })
  // The SDK resolves (doesn't reject) on API-level failures — it reports
  // them via this `error` field instead, so without this check a rejected
  // send (e.g. unverified domain, restricted recipient) looks identical to
  // a successful one and the caller's .catch() never fires.
  if (error) {
    throw new Error(`Resend API error: ${error.name} - ${error.message}`)
  }
}
