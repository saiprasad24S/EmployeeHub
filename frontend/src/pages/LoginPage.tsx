import { SignIn } from '@clerk/clerk-react'
import heroImage from '../assets/medical-hero.svg'

export function LoginPage() {
  return (
    <div className="auth-screen">
      <div className="auth-panel">
        <div className="auth-hero">
          <span className="eyebrow">Skandan Home Carre Clinic LLP</span>
          <h1>Employee Management System</h1>
          <p>Secure Google sign-in through Clerk. The dashboard opens only for users registered as employees or admins.</p>
          <div className="hero-badges">
            <span>Clean healthcare UI</span>
            <span>Live attendance</span>
            <span>GPS tracking</span>
          </div>
          <img src={heroImage} alt="Healthcare workers assisting a patient" className="auth-illustration" />
        </div>
        <div className="auth-card">
          <SignIn path="/sign-in" routing="path" signUpUrl="/sign-in" />
        </div>
      </div>
    </div>
  )
}
