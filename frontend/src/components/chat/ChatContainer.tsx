import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth, useUser } from '@clerk/clerk-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ConversationList } from './ConversationList'
import { ChatWindow } from './ChatWindow'
import { TeamsBottomNav, type TeamsTab } from './TeamsBottomNav'
import { TeamsCalendarView } from './TeamsCalendarView'
import { getConversations, sendPresencePing, resolveToken, getGroups, createGroup, searchEmployees } from './chatApi'
import { API_BASE_URL } from '../../lib/api'
import { Home, Users, Calendar, Plus, X, Check, Loader2 } from 'lucide-react'
import type { ConversationItem, EmployeeSearchResult } from './chatTypes'

interface ChatContainerProps {
  isEmployeePortal?: boolean
  isAdmin?: boolean
  employeeProfile?: {
    name?: string
    profile_photo?: string
    employee_id?: string
  } | null
  onHomeClick?: () => void
}

export const ChatContainer: React.FC<ChatContainerProps> = ({
  isEmployeePortal = false,
  isAdmin = false,
  employeeProfile,
  onHomeClick,
}) => {
  const { getToken } = useAuth()
  const { user } = useUser()
  const queryClient = useQueryClient()
  const [token, setToken] = useState<string>('')
  const [activeConversation, setActiveConversation] = useState<ConversationItem | null>(null)
  const [currentTeamsTab, setCurrentTeamsTab] = useState<TeamsTab>('chat')

  // 1. Fetch & refresh Auth Token in state
  useEffect(() => {
    let active = true
    const fetchToken = async () => {
      try {
        const t = await getToken()
        if (active && t) setToken(t)
      } catch (err) {
        console.error('Failed to get clerk token for chat:', err)
      }
    }
    void fetchToken()
    const interval = setInterval(fetchToken, 45000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [getToken])

  // 2. Presence Heartbeat Ping using dynamic getToken
  useEffect(() => {
    const ping = async () => {
      try {
        await sendPresencePing(getToken)
      } catch (err) {
        console.warn('Presence ping error:', err)
      }
    }
    void ping()
    const interval = setInterval(ping, 45000)
    return () => clearInterval(interval)
  }, [getToken])

  // 3. Load Conversations query using dynamic getToken
  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['communication-conversations'],
    queryFn: async () => {
      return getConversations(getToken)
    },
    refetchInterval: 3500,
  })

  const totalUnreadCount = conversations.reduce(
    (acc, c) => acc + (c.unread_count || 0),
    0
  )

  // Keep active conversation reference updated with latest data
  useEffect(() => {
    if (activeConversation) {
      const updated = conversations.find((c) => c.id === activeConversation.id)
      if (updated) {
        setActiveConversation(updated)
      }
    }
  }, [conversations])

  // Mobile history navigation support:
  // When entering a conversation, push state with { portalTab: 'chat', inChatConversation: true }
  // When mobile back button is pressed, popstate closes the active conversation to return to the chat list.
  const handleSelectConversation = useCallback((conv: ConversationItem) => {
    const currentState = window.history.state || {}
    const chatState = {
      ...currentState,
      portalTab: 'chat',
      inChatConversation: true,
      conversationId: conv.id,
    }
    if (activeConversation) {
      window.history.replaceState(chatState, '')
    } else {
      window.history.pushState(chatState, '')
    }
    setActiveConversation(conv)
  }, [activeConversation])

  const handleBackToConversations = useCallback(() => {
    setActiveConversation(null)
    if (window.history.state?.inChatConversation) {
      window.history.back()
    }
  }, [])

  // Listen for mobile back button (popstate)
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const state = e.state as { inChatConversation?: boolean; portalTab?: string } | null
      // If we are currently in an active conversation and the popped state is not inside a conversation
      if (!state?.inChatConversation) {
        setActiveConversation(null)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const handleMessageSent = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['communication-conversations'] })
    void queryClient.invalidateQueries({ queryKey: ['communication-unread-count'] })
    void queryClient.invalidateQueries({ queryKey: ['communication-groups'] })
  }, [queryClient])

  // 4. Employee profile data: prioritize employeeProfile from portal, fallback to API
  const profileQuery = useQuery({
    queryKey: ['chat-employee-profile'],
    queryFn: async () => {
      const t = await resolveToken(getToken)
      if (!t) return null
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}` },
      })
      if (!res.ok) return null
      return res.json()
    },
    enabled: !employeeProfile,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  })

  const currentUserName = employeeProfile?.name || profileQuery.data?.employee?.name || user?.fullName || 'You'
  // NEVER use user?.imageUrl (mail DP) — only show employee photo or empty string
  const currentUserPhoto = employeeProfile?.profile_photo || profileQuery.data?.employee?.profile_photo || ''
  const isUserAdmin = isAdmin || employeeProfile?.employee_id?.toUpperCase() === 'ADMIN' || profileQuery.data?.role === 'ADMIN'

  return (
    <div className={`teams-app-wrapper ${isEmployeePortal ? 'portal-mode' : ''}`}>
      {/* Main Screen Frame — Clean edge-to-edge native appearance */}
      <div
        className={`teams-mobile-frame fluid-frame ${activeConversation ? 'in-chat' : 'in-list'}`}
      >
        {/* Dynamic Teams Tab Content */}
        <div className="teams-frame-body">
          {currentTeamsTab === 'chat' ? (
            <div className={`teams-chat-split-engine ${activeConversation ? 'show-chat' : 'show-list'}`}>
              <div className="teams-sidebar-pane">
                <ConversationList
                  conversations={conversations}
                  activeConversationId={activeConversation?.id || null}
                  onSelectConversation={handleSelectConversation}
                  token={token}
                  getToken={getToken}
                  isLoading={isLoading && !conversations.length}
                  currentUserName={currentUserName}
                  currentUserPhoto={currentUserPhoto}
                />
              </div>

              <div className="teams-chat-pane">
                <ChatWindow
                  conversation={activeConversation}
                  token={token}
                  getToken={getToken}
                  onBack={handleBackToConversations}
                  onMessageSent={handleMessageSent}
                />
              </div>
            </div>
          ) : currentTeamsTab === 'home' ? (
            <div className="teams-tab-placeholder-screen">
              <div className="teams-tab-placeholder-inner">
                <Home size={42} color="#5B5FC7" />
                <h3>Home</h3>
                <p>Return to the main employee workspace to view attendance and quick actions.</p>
                <button
                  type="button"
                  className="teams-back-to-chat-btn"
                  onClick={() => {
                    if (onHomeClick) {
                      onHomeClick()
                    } else {
                      setCurrentTeamsTab('chat')
                    }
                  }}
                >
                  {onHomeClick ? 'Open Home Screen' : 'Back to Chat'}
                </button>
              </div>
            </div>
          ) : currentTeamsTab === 'groups' ? (
            <div className="teams-tab-placeholder-screen" style={{ padding: '1rem', overflow: 'auto', display: 'block' }}>
              <GroupListPanel
                getToken={getToken}
                isAdmin={isUserAdmin}
                onSelectConversation={(conv) => {
                  handleSelectConversation(conv)
                  setCurrentTeamsTab('chat')
                }}
              />
            </div>
          ) : (
            <TeamsCalendarView />
          )}
        </div>

        {/* Teams Bottom Navigation Bar (Hidden when inside active conversation on mobile) */}
        {!activeConversation && (
          <TeamsBottomNav
            activeTab={currentTeamsTab}
            onTabChange={(tab) => {
              if (tab === 'home' && onHomeClick) {
                onHomeClick()
                return
              }
              setCurrentTeamsTab(tab)
              setActiveConversation(null)
            }}
            onHomeClick={onHomeClick}
            unreadChatCount={totalUnreadCount}
          />
        )}
      </div>
    </div>
  )
}

// ── Group List Panel (rendered inside Groups tab) ──
const GroupListPanel: React.FC<{
  getToken: () => Promise<string | null>
  isAdmin: boolean
  onSelectConversation: (conv: ConversationItem) => void
}> = ({ getToken, isAdmin, onSelectConversation }) => {
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchEmployeeQuery, setSearchEmployeeQuery] = useState('')

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['communication-groups'],
    queryFn: () => getGroups(getToken),
    refetchInterval: 5000,
  })

  // Directory for group creation — fetched once and filtered instantly in-memory
  const { data: allEmployees = [], isLoading: isLoadingDirectory } = useQuery({
    queryKey: ['group-all-employees'],
    queryFn: () => searchEmployees('', getToken),
    enabled: showCreateModal,
    staleTime: 60000,
  })

  const directoryEmployees = useMemo(() => {
    const q = searchEmployeeQuery.trim().toLowerCase()
    if (!q) return allEmployees
    return allEmployees.filter(
      (e) =>
        e.name?.toLowerCase().includes(q) ||
        e.employee_id?.toLowerCase().includes(q) ||
        e.department?.toLowerCase().includes(q)
    )
  }, [allEmployees, searchEmployeeQuery])

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!groupName.trim()) return
    if (selectedMemberIds.length === 0) {
      alert('Please select at least one member to add to the group.')
      return
    }

    try {
      setIsSubmitting(true)
      const newGroup = await createGroup(groupName.trim(), selectedMemberIds, getToken)
      setShowCreateModal(false)
      setGroupName('')
      setSelectedMemberIds([])
      void queryClient.invalidateQueries({ queryKey: ['communication-groups'] })
      void queryClient.invalidateQueries({ queryKey: ['communication-conversations'] })
      onSelectConversation(newGroup as ConversationItem)
    } catch (err: any) {
      alert(err.message || 'Failed to create group')
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleMember = (id: number) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    )
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem' }}>
        <div>
          <h2 style={{ margin: 0, color: '#242424', fontSize: '1.25rem', fontWeight: 700 }}>Groups</h2>
          <p style={{ margin: '0.2rem 0 0', color: '#616161', fontSize: '0.8rem' }}>
            Collaborate with your project team and clinical branch
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              background: '#5B5FC7',
              color: '#FFFFFF',
              border: 'none',
              padding: '0.5rem 0.9rem',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(91,95,199,0.25)',
            }}
          >
            <Plus size={16} />
            <span>Create Group</span>
          </button>
        )}
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#616161' }}>
          <Loader2 size={24} className="spin-animation" style={{ margin: '0 auto 0.5rem' }} />
          <p>Loading groups...</p>
        </div>
      ) : groups.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem 1.5rem',
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E1DFDD',
        }}>
          <Users size={44} color="#5B5FC7" style={{ marginBottom: '0.75rem' }} />
          <h4 style={{ margin: '0 0 0.4rem', color: '#242424', fontSize: '1.05rem' }}>No groups yet</h4>
          <p style={{ margin: 0, color: '#616161', fontSize: '0.82rem', maxWidth: '300px', marginLeft: 'auto', marginRight: 'auto' }}>
            {isAdmin
              ? 'Click "+ Create Group" above to create team channels and assign employees.'
              : 'Your administrator will add you to department or project groups.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {groups.map((group: any) => (
            <div
              key={group.id}
              onClick={() => onSelectConversation(group as ConversationItem)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                padding: '0.85rem 1rem',
                background: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E1DFDD',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#F9F9FB'
                e.currentTarget.style.borderColor = '#5B5FC7'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#FFFFFF'
                e.currentTarget.style.borderColor = '#E1DFDD'
              }}
            >
              <div style={{
                width: 44,
                height: 44,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #5B5FC7 0%, #444791 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFF',
                fontWeight: 700,
                fontSize: '1rem',
                flexShrink: 0,
                boxShadow: '0 2px 6px rgba(91,95,199,0.3)',
              }}>
                {(group.group_name || 'G').charAt(0).toUpperCase()}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#242424', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {group.group_name || 'Unnamed Group'}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#8A8886', flexShrink: 0 }}>
                    {group.members?.length || 0} members
                  </span>
                </div>

                <div style={{ fontSize: '0.78rem', color: '#616161', marginTop: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {group.last_message ? (
                    <span>
                      <strong>{group.last_message.sender_name}:</strong> {group.last_message.content}
                    </span>
                  ) : (
                    <span style={{ fontStyle: 'italic', color: '#8A8886' }}>No messages yet. Tap to start chatting.</span>
                  )}
                </div>
              </div>

              {(group.unread_count || 0) > 0 && (
                <span style={{
                  background: '#EF4444',
                  color: '#FFF',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  borderRadius: '9999px',
                  padding: '0.15rem 0.5rem',
                  minWidth: '20px',
                  textAlign: 'center',
                }}>
                  {group.unread_count > 99 ? '99+' : group.unread_count}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Admin Create Group Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem',
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '480px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          }}>
            <div style={{
              padding: '1.1rem 1.25rem',
              borderBottom: '1px solid #E1DFDD',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#242424', fontWeight: 700 }}>Create New Group</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#616161' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'hidden' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#424242', marginBottom: '0.35rem' }}>
                  Group Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Clinical Team Madhapur"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    border: '1px solid #C8C6C4',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#424242' }}>
                    Select Members ({selectedMemberIds.length} selected) *
                  </label>
                </div>

                <input
                  type="text"
                  placeholder="Search employees..."
                  value={searchEmployeeQuery}
                  onChange={(e) => setSearchEmployeeQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    border: '1px solid #E1DFDD',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    marginBottom: '0.5rem',
                    boxSizing: 'border-box',
                  }}
                />

                <div style={{
                  maxHeight: '220px',
                  overflowY: 'auto',
                  border: '1px solid #E1DFDD',
                  borderRadius: '8px',
                  padding: '0.25rem',
                }}>
                  {directoryEmployees.filter((e: EmployeeSearchResult) => e.employee_id !== 'ADMIN').map((emp: EmployeeSearchResult) => {
                    const isSelected = selectedMemberIds.includes(emp.id)
                    return (
                      <div
                        key={emp.id}
                        onClick={() => toggleMember(emp.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.65rem',
                          padding: '0.5rem 0.65rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(91, 95, 199, 0.08)' : 'transparent',
                          transition: 'background 0.12s',
                        }}
                      >
                        <div style={{
                          width: 20,
                          height: 20,
                          borderRadius: '4px',
                          border: isSelected ? '2px solid #5B5FC7' : '2px solid #A19F9D',
                          background: isSelected ? '#5B5FC7' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#FFF',
                          flexShrink: 0,
                        }}>
                          {isSelected && <Check size={14} strokeWidth={3} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#242424' }}>{emp.name}</div>
                          <div style={{ fontSize: '0.72rem', color: '#8A8886' }}>{emp.employee_id} • {emp.department || 'General'}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: '0.55rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid #C8C6C4',
                    background: '#FFF',
                    color: '#424242',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !groupName.trim() || selectedMemberIds.length === 0}
                  style={{
                    padding: '0.55rem 1.25rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#5B5FC7',
                    color: '#FFF',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    opacity: isSubmitting || !groupName.trim() || selectedMemberIds.length === 0 ? 0.6 : 1,
                  }}
                >
                  {isSubmitting ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
