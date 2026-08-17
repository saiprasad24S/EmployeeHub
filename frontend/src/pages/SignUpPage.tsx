import { useState } from 'react'
import { useSignUp } from '@clerk/clerk-react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, UserPlus, AlertCircle, CheckCircle2 } from 'lucide-react'

export function SignUpPage() {
  const { isLoaded, signUp, setActive } = useSignUp()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isLoaded || !signUp) return

    if (!email.trim()) {
      setError('Please enter your email address.')
      return
    }

    if (!password) {
      setError('Please enter a password.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Direct Email + Password registration through Clerk
      const result = await signUp.create({
        emailAddress: email.trim(),
        password: password,
      })

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId })
        setIsSuccess(true)
        setTimeout(() => {
          navigate('/', { replace: true })
        }, 1200)
      } else if (result.createdSessionId) {
        await setActive({ session: result.createdSessionId })
        setIsSuccess(true)
        setTimeout(() => {
          navigate('/', { replace: true })
        }, 1200)
      } else {
        // In case the instance still requires email verification code:
        setIsSuccess(true)
        setTimeout(() => {
          navigate('/sign-in', { replace: true })
        }, 1500)
      }
    } catch (err: any) {
      console.error('Sign up error:', err)
      const clerkMsg =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        err?.message ||
        'Could not create account. Please try again.'
      setError(clerkMsg)
    } finally {
      setLoading(false)
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
            Create Your Account
          </h1>
        </div>

        <div className="auth-card" style={{ padding: '2rem 1.75rem', background: 'var(--panel)', borderRadius: '16px', border: '1px solid var(--panel-border)', boxShadow: '0 10px 30px rgba(0,0,0,0.06)' }}>
          {isSuccess ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <CheckCircle2 size={48} style={{ color: '#10B981', margin: '0 auto 0.75rem auto' }} />
              <h3 style={{ margin: 0, color: 'var(--text)' }}>Account Created Successfully!</h3>
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '0.4rem' }}>
                Redirecting to dashboard...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSignUpSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div style={{ textAlign: 'center', marginBottom: '0.25rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                  Sign Up
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                  Register with your email and choose a secure password
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
                    }}
                  />
                </div>
              </div>

              {/* Password Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>
                  Password
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Lock
                    size={18}
                    style={{ position: 'absolute', left: '12px', color: 'var(--muted)', pointerEvents: 'none' }}
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Minimum 8 characters"
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

              {/* Confirm Password Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>
                  Confirm Password
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Lock
                    size={18}
                    style={{ position: 'absolute', left: '12px', color: 'var(--muted)', pointerEvents: 'none' }}
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value)
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
                    Creating Account...
                  </>
                ) : (
                  <>
                    <UserPlus size={18} />
                    Create Account
                  </>
                )}
              </button>

              <div style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--muted)' }}>
                Already have an account?{' '}
                <Link to="/sign-in" style={{ color: '#0B2C8C', fontWeight: 700, textDecoration: 'none' }}>
                  Sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
