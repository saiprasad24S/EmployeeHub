import { useState } from 'react'
import { useSignIn } from '@clerk/clerk-react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, LogIn, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react'

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" style={{ display: 'inline-block' }}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  )
}

export function LoginPage() {
  const { isLoaded, signIn, setActive } = useSignIn()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Forgot password states
  const [showForgot, setShowForgot] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [resetStep, setResetStep] = useState<'REQUEST' | 'VERIFY' | 'SUCCESS'>('REQUEST')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  const handleGoogleSignIn = async () => {
    if (!isLoaded || !signIn) return
    setGoogleLoading(true)
    setError(null)
    try {
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/',
      })
    } catch (err: any) {
      console.error('Google sign in error:', err)
      const msg =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        err?.message ||
        'Google sign-in could not be completed. Please use Email & Password.'
      setError(msg)
      setGoogleLoading(false)
    }
  }

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isLoaded || !signIn) return

    if (!email.trim()) {
      setError('Please enter your email address.')
      return
    }
    if (!password) {
      setError('Please enter your password.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Direct Email + Password authentication (no OTPs)
      const result = await signIn.create({
        identifier: email.trim(),
        password: password,
      })

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId })
        navigate('/', { replace: true })
      } else if (result.status === 'needs_first_factor') {
        const factorRes = await signIn.attemptFirstFactor({
          strategy: 'password',
          password: password,
        })
        if (factorRes.status === 'complete') {
          await setActive({ session: factorRes.createdSessionId })
          navigate('/', { replace: true })
        } else {
          setError('Authentication incomplete. Please check your credentials.')
        }
      } else {
        setError('Authentication incomplete. Please verify your credentials.')
      }
    } catch (err: any) {
      console.error('Sign in error:', err)
      const clerkMsg =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        err?.message ||
        'Incorrect email or password. Please try again.'
      setError(clerkMsg)
    } finally {
      setLoading(false)
    }
  }

  const handleRequestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isLoaded || !signIn || !resetEmail.trim()) return

    setResetLoading(true)
    setResetError(null)

    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: resetEmail.trim(),
      })
      setResetStep('VERIFY')
    } catch (err: any) {
      console.error('Password reset request error:', err)
      const msg =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        err?.message ||
        'Could not initiate password reset. Please contact your administrator.'
      setResetError(msg)
    } finally {
      setResetLoading(false)
    }
  }

  const handleVerifyPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isLoaded || !signIn || !resetCode.trim() || !newPassword) return

    setResetLoading(true)
    setResetError(null)

    try {
      const res = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: resetCode.trim(),
        password: newPassword,
      })

      if (res.status === 'complete') {
        await setActive({ session: res.createdSessionId })
        setResetStep('SUCCESS')
        setTimeout(() => {
          navigate('/', { replace: true })
        }, 1500)
      } else {
        setResetError('Password reset incomplete. Please try again.')
      }
    } catch (err: any) {
      console.error('Password reset verify error:', err)
      const msg =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        err?.message ||
        'Invalid reset code or password. Please try again.'
      setResetError(msg)
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-panel" style={{ maxWidth: '440px', margin: '0 auto' }}>
        <div className="auth-hero" style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <img
            src="https://skandanhomecarre.com/wp-content/uploads/2025/05/Skanda-Horizontal-LOGO2.png"
            alt="Skandan Home Carre Clinic Logo"
            className="auth-illustration"
            style={{ maxWidth: '300px', margin: '0 auto 0.75rem auto', display: 'block' }}
          />
          <span className="eyebrow" style={{ color: '#0B2C8C', fontWeight: 700, letterSpacing: '0.05em' }}>
            Skandan Home Carre Clinic LLP
          </span>
          <h1 style={{ fontSize: '1.4rem', margin: '0.25rem 0 0 0', fontWeight: 800 }}>
            Employee Management System
          </h1>
        </div>

        <div className="auth-card" style={{ padding: '2rem 1.75rem', background: 'var(--panel)', borderRadius: '16px', border: '1px solid var(--panel-border)', boxShadow: '0 10px 30px rgba(0,0,0,0.06)' }}>
          {!showForgot ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div style={{ textAlign: 'center', marginBottom: '0.25rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                  Sign In
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                  Sign in with your Google account or email & password
                </p>
              </div>

              {error && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.6rem',
                    background: 'rgba(239, 68, 68, 0.08)',
                    color: '#DC2626',
                    padding: '0.85rem 1rem',
                    borderRadius: '10px',
                    fontSize: '0.85rem',
                    lineHeight: 1.4,
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                  }}
                >
                  <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>{error}</div>
                </div>
              )}

              {/* 1-Click Continue with Google Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading || loading || !isLoaded}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '12px',
                  background: '#ffffff',
                  color: '#1f2937',
                  border: '1.5px solid #e5e7eb',
                  fontSize: '0.92rem',
                  fontWeight: 600,
                  cursor: googleLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.75rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  transition: 'background 0.2s, border-color 0.2s',
                }}
              >
                {googleLoading ? (
                  <span className="spinner" style={{ width: '16px', height: '16px', border: '2px solid #cbd5e1', borderTopColor: '#0B2C8C', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                ) : (
                  <GoogleIcon />
                )}
                <span>Continue with Google</span>
              </button>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.25rem 0' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  or with email & password
                </span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              </div>

              {/* Direct Email + Password Form */}
              <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>
                    Email Address
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Mail
                      size={18}
                      style={{ position: 'absolute', left: '12px', color: 'var(--muted)', pointerEvents: 'none' }}
                    />
                    <input
                      type="email"
                      placeholder="name@gmail.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        if (error) setError(null)
                      }}
                      required
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem 0.75rem 2.5rem',
                        borderRadius: '10px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                        color: 'var(--text)',
                        fontSize: '0.92rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgot(true)
                        setResetEmail(email)
                        setError(null)
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        fontSize: '0.8rem',
                        color: '#0B2C8C',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Lock
                      size={18}
                      style={{ position: 'absolute', left: '12px', color: 'var(--muted)', pointerEvents: 'none' }}
                    />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        if (error) setError(null)
                      }}
                      required
                      style={{
                        width: '100%',
                        padding: '0.75rem 2.75rem 0.75rem 2.5rem',
                        borderRadius: '10px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                        color: 'var(--text)',
                        fontSize: '0.92rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--muted)',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !isLoaded}
                  style={{
                    width: '100%',
                    padding: '0.85rem',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #0B2C8C 0%, #1A4DD8 100%)',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 4px 14px rgba(11, 44, 140, 0.25)',
                    marginTop: '0.25rem',
                    opacity: loading ? 0.75 : 1,
                  }}
                >
                  {loading ? (
                    <>
                      <span className="spinner" style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                      Signing In...
                    </>
                  ) : (
                    <>
                      <LogIn size={18} />
                      Sign In with Password
                    </>
                  )}
                </button>

                <div style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--muted)' }}>
                  Don't have an account?{' '}
                  <Link to="/sign-up" style={{ color: '#0B2C8C', fontWeight: 700, textDecoration: 'none' }}>
                    Sign up
                  </Link>
                </div>
              </form>
            </div>
          ) : (
            /* Forgot Password Flow */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgot(false)
                    setResetStep('REQUEST')
                    setResetError(null)
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--muted)',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <ArrowLeft size={20} />
                </button>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                  Reset Password
                </h2>
              </div>

              {resetError && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.6rem',
                    background: 'rgba(239, 68, 68, 0.08)',
                    color: '#DC2626',
                    padding: '0.85rem 1rem',
                    borderRadius: '10px',
                    fontSize: '0.85rem',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                  }}
                >
                  <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>{resetError}</div>
                </div>
              )}

              {resetStep === 'REQUEST' && (
                <form onSubmit={handleRequestPasswordReset} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
                    Enter your account email address. A password reset code will be sent.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>
                      Email Address
                    </label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <Mail size={18} style={{ position: 'absolute', left: '12px', color: 'var(--muted)' }} />
                      <input
                        type="email"
                        placeholder="name@gmail.com"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        required
                        style={{
                          width: '100%',
                          padding: '0.75rem 1rem 0.75rem 2.5rem',
                          borderRadius: '10px',
                          border: '1px solid var(--border)',
                          background: 'var(--bg)',
                          color: 'var(--text)',
                          fontSize: '0.92rem',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    style={{
                      width: '100%',
                      padding: '0.8rem',
                      borderRadius: '10px',
                      background: '#0B2C8C',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {resetLoading ? 'Sending Reset Request...' : 'Send Reset Code'}
                  </button>
                </form>
              )}

              {resetStep === 'VERIFY' && (
                <form onSubmit={handleVerifyPasswordReset} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: 0 }}>
                    Enter the reset code sent to <strong>{resetEmail}</strong> and your new password.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>
                      Reset Code
                    </label>
                    <input
                      type="text"
                      placeholder="Enter verification code"
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        borderRadius: '10px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                        color: 'var(--text)',
                        fontSize: '0.92rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>
                      New Password
                    </label>
                    <input
                      type="password"
                      placeholder="Minimum 8 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        borderRadius: '10px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                        color: 'var(--text)',
                        fontSize: '0.92rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    style={{
                      width: '100%',
                      padding: '0.8rem',
                      borderRadius: '10px',
                      background: '#0B2C8C',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {resetLoading ? 'Resetting Password...' : 'Set New Password'}
                  </button>
                </form>
              )}

              {resetStep === 'SUCCESS' && (
                <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                  <CheckCircle2 size={48} style={{ color: '#10B981', margin: '0 auto 0.75rem auto' }} />
                  <h3 style={{ margin: 0, color: 'var(--text)' }}>Password Reset Successful!</h3>
                  <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '0.4rem' }}>
                    Redirecting to your dashboard...
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
