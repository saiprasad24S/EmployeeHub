import React from 'react'
import { Home, MessageSquare, Users, Calendar } from 'lucide-react'

export type TeamsTab = 'home' | 'chat' | 'groups' | 'calendar'

interface TeamsBottomNavProps {
  activeTab: TeamsTab
  onTabChange: (tab: TeamsTab) => void
  unreadChatCount?: number
  onHomeClick?: () => void
}

export const TeamsBottomNav: React.FC<TeamsBottomNavProps> = ({
  activeTab,
  onTabChange,
  unreadChatCount = 0,
  onHomeClick,
}) => {
  return (
    <nav className="teams-bottom-nav" aria-label="Teams Navigation">
      <button
        type="button"
        className={`teams-nav-item ${activeTab === 'home' ? 'active' : ''}`}
        onClick={() => {
          if (onHomeClick) {
            onHomeClick()
          } else {
            onTabChange('home')
          }
        }}
      >
        <div className="teams-nav-icon-wrap">
          <Home size={20} strokeWidth={activeTab === 'home' ? 2.4 : 1.8} />
        </div>
        <span className="teams-nav-label">Home</span>
      </button>

      <button
        type="button"
        className={`teams-nav-item ${activeTab === 'chat' ? 'active' : ''}`}
        onClick={() => onTabChange('chat')}
      >
        <div className="teams-nav-icon-wrap">
          <MessageSquare size={20} strokeWidth={activeTab === 'chat' ? 2.4 : 1.8} />
          {unreadChatCount > 0 && (
            <span className="teams-nav-badge">
              {unreadChatCount > 99 ? '99+' : unreadChatCount}
            </span>
          )}
        </div>
        <span className="teams-nav-label">Chat</span>
      </button>

      <button
        type="button"
        className={`teams-nav-item ${activeTab === 'groups' ? 'active' : ''}`}
        onClick={() => onTabChange('groups')}
      >
        <div className="teams-nav-icon-wrap">
          <Users size={20} strokeWidth={activeTab === 'groups' ? 2.4 : 1.8} />
        </div>
        <span className="teams-nav-label">Groups</span>
      </button>

      <button
        type="button"
        className={`teams-nav-item ${activeTab === 'calendar' ? 'active' : ''}`}
        onClick={() => onTabChange('calendar')}
      >
        <div className="teams-nav-icon-wrap">
          <Calendar size={20} strokeWidth={activeTab === 'calendar' ? 2.4 : 1.8} />
        </div>
        <span className="teams-nav-label">Calendar</span>
      </button>
    </nav>
  )
}
