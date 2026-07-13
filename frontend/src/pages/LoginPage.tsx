import { SignIn } from '@clerk/clerk-react'

export function LoginPage() {
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
          <h1>Employee Management System</h1>

        </div>
        <div className="auth-card">
          <SignIn
            path="/sign-in"
            routing="path"
            signUpUrl="/sign-up"
            forceRedirectUrl="/"
          />
        </div>
      </div>
    </div>
  )
}
