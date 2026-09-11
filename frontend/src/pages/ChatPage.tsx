import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { Users, MessageSquare, Calendar, Mail, ShieldCheck, Activity } from 'lucide-react'
import { ChatContainer } from '../components/chat/ChatContainer'
import { getCommunicationOverview } from '../components/chat/chatApi'

export const ChatPage: React.FC = () => {
  const { getToken } = useAuth()
  const navigate = useNavigate()

  const { data: overview } = useQuery({
    queryKey: ['communication-overview'],
    queryFn: () => getCommunicationOverview(getToken),
    refetchInterval: 10000,
  })

  return (
    <div className="stack" style={{ gap: '1.25rem' }}>
      {/* Top Banner */}
      <div className="chat-admin-banner">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span className="chat-admin-live-badge">
              <span className="chat-presence-dot online" />
              <span>LIVE COMMUNICATION HUB</span>
            </span>
            <span className="chat-admin-security-badge">
              <ShieldCheck size={13} />
              <span>End-to-End Encrypted Access</span>
            </span>
          </div>
          <h2 className="chat-admin-header-title">Internal Employee Messaging & Directory</h2>
          <p className="chat-admin-header-desc">
            Connect directly with healthcare professionals across all departments using Employee Name or Employee ID.
          </p>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="chat-overview-grid">
        <div className="chat-stat-card card-hover-lift">
          <div className="chat-stat-icon" style={{ background: 'linear-gradient(135deg, rgba(107, 47, 160, 0.15), rgba(107, 47, 160, 0.05))', color: 'var(--primary, #6b2fa0)' }}>
            <Users size={22} />
          </div>
          <div className="chat-stat-content">
            <span className="chat-stat-val">{overview?.total_employees ?? '—'}</span>
            <span className="chat-stat-label">Total Staff Members</span>
            <span className="chat-stat-trend positive">Active Directory</span>
          </div>
        </div>

        <div className="chat-stat-card card-hover-lift">
          <div className="chat-stat-icon" style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(59, 130, 246, 0.05))', color: '#2563EB' }}>
            <MessageSquare size={22} />
          </div>
          <div className="chat-stat-content">
            <span className="chat-stat-val">{overview?.active_conversations ?? '—'}</span>
            <span className="chat-stat-label">Active Conversations</span>
            <span className="chat-stat-trend blue">1-on-1 Direct</span>
          </div>
        </div>

        <div className="chat-stat-card card-hover-lift">
          <div className="chat-stat-icon" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.05))', color: '#059669' }}>
            <Calendar size={22} />
          </div>
          <div className="chat-stat-content">
            <span className="chat-stat-val">{overview?.messages_today ?? '—'}</span>
            <span className="chat-stat-label">Messages Exchanged Today</span>
            <span className="chat-stat-trend positive">Real-Time Sync</span>
          </div>
        </div>

        <div className="chat-stat-card card-hover-lift">
          <div className="chat-stat-icon" style={{ background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05))', color: '#DC2626' }}>
            <Mail size={22} />
          </div>
          <div className="chat-stat-content">
            <span className="chat-stat-val">{overview?.unread_messages ?? '—'}</span>
            <span className="chat-stat-label">Unread Inboxes</span>
            <span className="chat-stat-trend alert">Pending Receipts</span>
          </div>
        </div>
      </div>

      {/* Main Communication Module */}
      <ChatContainer isAdmin onHomeClick={() => navigate('/dashboard')} />
    </div>
  )
}

export default ChatPage
