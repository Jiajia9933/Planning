import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { createUser, findUserByEmail, findUserById, updateUserPassword } from '../repositories/userRepository'
import { createResetToken, findValidResetToken, markResetTokenUsed } from '../repositories/passwordResetRepository'
import { sendPasswordResetEmail } from '../services/email'
import { signToken } from '../middleware/auth'
import { env } from '../config/env'

export const authRouter = Router()

function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

authRouter.post('/register', async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {}
    if (!isValidEmail(email) || typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ error: 'Valid email and a password of at least 8 characters are required' })
      return
    }
    if (await findUserByEmail(email)) {
      res.status(409).json({ error: 'An account with this email already exists' })
      return
    }
    const passwordHash = await bcrypt.hash(password, 12)
    const user = await createUser(email, passwordHash)
    // No project is created here — the user creates one explicitly via
    // POST /api/projects/me after choosing a name (see routes/projects.ts).
    res.status(201).json({ token: signToken(user.id) })
  } catch (err) {
    next(err)
  }
})

authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {}
    if (!isValidEmail(email) || typeof password !== 'string') {
      res.status(400).json({ error: 'Email and password are required' })
      return
    }
    const user = await findUserByEmail(email)
    const valid = user ? await bcrypt.compare(password, user.passwordHash) : false
    if (!user || !valid) {
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }
    res.json({ token: signToken(user.id) })
  } catch (err) {
    next(err)
  }
})

// Always responds the same way whether or not the email is registered — an
// attacker probing this endpoint can't tell which emails have accounts.
authRouter.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body ?? {}
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'A valid email is required' })
      return
    }
    const user = await findUserByEmail(email)
    if (user) {
      const token = await createResetToken(user.id)
      const resetLink = `${env.appBaseUrl}/?resetToken=${token}`
      sendPasswordResetEmail(user.email, resetLink).catch((err) => {
        console.error('Failed to send password reset email:', err)
      })
    }
    res.json({ message: 'If an account with this email exists, a reset link has been sent.' })
  } catch (err) {
    next(err)
  }
})

authRouter.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body ?? {}
    if (typeof token !== 'string' || typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ error: 'A token and a password of at least 8 characters are required' })
      return
    }
    const valid = await findValidResetToken(token)
    if (!valid) {
      res.status(400).json({ error: 'This reset link is invalid or has expired' })
      return
    }
    const passwordHash = await bcrypt.hash(password, 12)
    await updateUserPassword(valid.userId, passwordHash)
    await markResetTokenUsed(token)
    const user = await findUserById(valid.userId)
    // Log the user straight in — they just proved ownership of the account.
    res.json({ token: signToken(valid.userId), email: user?.email ?? null })
  } catch (err) {
    next(err)
  }
})
