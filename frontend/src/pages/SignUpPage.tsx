import { SignUp } from '@clerk/clerk-react'

export function SignUpPage() {
  return (
    <div className="auth-screen">
      <div className="auth-panel">
        <div className="auth-hero">
          <img
            src="https://skandanhomecarre.com/wp-content/uploads/2025/05/Skanda-Horizontal-LOGO2.png"
            alt="Skandan Home Carre Clinic Logo"
            className="auth-illustration"
            style={{ maxWidth: '360px', marginBottom: '1rem' }}
          />
          <span className="eyebrow">Skandan Home Carre Clinic LLP</span>
          <h1>Create Your Account</h1>
          <p>Sign up with your Google account to get started. Only registered employees and admins can access the dashboard.</p>
          <div className="hero-badges">
            <span>Clean healthcare UI</span>
            <span>Live attendance</span>
            <span>GPS tracking</span>
          </div>
        </div>
        <div className="auth-card">
          <SignUp
            path="/sign-up"
            routing="path"
            signInUrl="/sign-in"
            fallbackRedirectUrl="/"
          />
        </div>
      </div>
    </div>
  )
}
