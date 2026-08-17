import { useState } from 'react'
import { useSignIn } from '@clerk/clerk-react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, LogIn, AlertCircle, ArrowLeft, KeyRound, CheckCircle2 } from 'lucide-react'

export function LoginPage() {
  const { isLoaded, signIn, setActive } = useSignIn()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Forgot password flow states
  const [showForgot, setShowForgot] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [resetStep, setResetStep] = useState<'REQUEST' | 'VERIFY' | 'SUCCESS'>('REQUEST')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

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
      // Direct Email + Password authentication through Clerk (Bypasses email OTP flow)
      const result = await signIn.create({
        identifier: email.trim(),
        password: password,
      })

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId })
        navigate('/', { replace: true })
      } else if (result.status === 'needs_first_factor') {
        // Attempt first factor with password directly if required
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
        'Could not initiate password reset. Please verify your email or contact your administrator.'
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
            /* Standard Email + Password Sign In Form */
            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div style={{ textAlign: 'center', marginBottom: '0.25rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                  Sign In
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                  Enter your email and password to access your account
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

              {/* Email Input */}
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
                    placeholder="name@skandanhomecarre.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (error) setError(null)
                    }}
                    required
                    autoFocus
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
                      transition: 'border-color 0.2s',
                    }}
                  />
                </div>
              </div>

              {/* Password Input */}
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
                      transition: 'border-color 0.2s',
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

              {/* Submit Button */}
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
                  transition: 'transform 0.15s ease',
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
                    Sign In
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
                    Enter your account email address. If email delivery is active, a password reset code will be sent.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>
                      Email Address
                    </label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <Mail size={18} style={{ position: 'absolute', left: '12px', color: 'var(--muted)' }} />
                      <input
                        type="email"
                        placeholder="name@skandanhomecarre.com"
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
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)', background: 'var(--bg)', padding: '0.75rem', borderRadius: '8px', lineHeight: 1.4 }}>
                    ℹ️ <strong>Note:</strong> If email quota is reached on development Clerk, contact your Administrator to set or update your password directly.
                  </div>
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
