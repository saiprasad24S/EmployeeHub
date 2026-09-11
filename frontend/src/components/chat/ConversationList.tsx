import React, { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, X, SlidersHorizontal, Sparkles, Loader2, ShieldCheck, Users } from 'lucide-react'
import { TeamsAvatar } from './TeamsPresence'
import { searchEmployees, startConversation } from './chatApi'
import type { ConversationItem, EmployeeSearchResult } from './chatTypes'

interface ConversationListProps {
  conversations: ConversationItem[]
  activeConversationId: number | null
  onSelectConversation: (conv: ConversationItem) => void
  token?: string
  getToken?: () => Promise<string | null>
  isLoading?: boolean
  currentUserName?: string
  currentUserPhoto?: string
}

function formatTeamsTimestamp(dateStr?: string | null): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()

    if (isToday) {
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
    }

    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear()

    if (isYesterday) return 'Yesterday'

    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays < 7) {
      return d.toLocaleDateString([], { weekday: 'short' })
    }

    return d.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: '2-digit' })
  } catch {
    return ''
  }
}

function formatLastSeen(isOnline: boolean, lastSeenStr?: string | null): string {
  if (isOnline) return 'Available'
  if (!lastSeenStr) return ''
  try {
    const d = new Date(lastSeenStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return 'Active just now'
    if (mins < 60) return `Last seen ${mins}m ago`

    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()

    const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
    if (isToday) return `Last seen today at ${timeStr}`

    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear()
    if (isYesterday) return `Last seen yesterday at ${timeStr}`

    return `Last seen ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}`
  } catch {
    return ''
  }
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  token = '',
  getToken,
  isLoading,
  currentUserName = 'You',
  currentUserPhoto,
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'online'>('all')
  const [isStartingConv, setIsStartingConv] = useState(false)

  const tokenProvider = getToken || token

  // Pre-fetch & cache directory employees with 60s staleTime for instant 0ms search
  const { data: allDirectoryEmployees = [], isLoading: isDirectoryLoading } = useQuery({
    queryKey: ['chat-directory-all-employees'],
    queryFn: () => searchEmployees('', tokenProvider),
    enabled: Boolean(tokenProvider),
    staleTime: 60000,
    refetchInterval: 30000,
  })

  // Instant in-memory search filtering across all employee fields
  const directoryResults = useMemo(() => {
    if (!isSearchFocused && !searchQuery.trim()) return []
    const q = searchQuery.trim().toLowerCase()
    if (!q) return allDirectoryEmployees
    return allDirectoryEmployees.filter(
      (emp) =>
        emp.name?.toLowerCase().includes(q) ||
        emp.employee_id?.toLowerCase().includes(q) ||
        emp.department?.toLowerCase().includes(q) ||
        emp.designation?.toLowerCase().includes(q)
    )
  }, [allDirectoryEmployees, searchQuery, isSearchFocused])

  const isSearchingDirectory = isDirectoryLoading && !allDirectoryEmployees.length

  const totalUnreadCount = useMemo(() => {
    return conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0)
  }, [conversations])

  // Filter existing conversations based on filter tabs and search query
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      // Tab filter
      if (activeFilter === 'unread' && (!c.unread_count || c.unread_count <= 0)) {
        return false
      }
      if (activeFilter === 'online' && !c.other_member?.is_online) {
        return false
      }

      // Query filter
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      const name = c.other_member?.name?.toLowerCase() || ''
      const empId = c.other_member?.employee_id?.toLowerCase() || ''
      const lastMsg = c.last_message?.content?.toLowerCase() || ''
      const dept = c.other_member?.department?.toLowerCase() || ''
      return name.includes(q) || empId.includes(q) || lastMsg.includes(q) || dept.includes(q)
    })
  }, [conversations, activeFilter, searchQuery])

  // Handle clicking on an employee from directory search results
  const handleSelectEmployee = async (emp: EmployeeSearchResult) => {
    // 1. Check if conversation already exists with this employee
    const existing = conversations.find(
      (c) =>
        c.other_member?.id === emp.id ||
        c.other_member?.employee_id?.toUpperCase() === emp.employee_id.toUpperCase()
    )
    if (existing) {
      setSearchQuery('')
      setIsSearchFocused(false)
      onSelectConversation(existing)
      return
    }

    // 2. Start conversation with the target employee
    try {
      setIsStartingConv(true)
      const conv = await startConversation(emp.employee_id, tokenProvider)
      setSearchQuery('')
      setIsSearchFocused(false)
      onSelectConversation(conv)
    } catch (err: any) {
      alert(err.message || 'Failed to start conversation')
    } finally {
      setIsStartingConv(false)
    }
  }

  const isSearchActive = searchQuery.trim().length > 0 || (isSearchFocused && directoryResults.length > 0)

  return (
    <div className="teams-chat-list-container">
      {/* 1. Teams Mobile Top Navigation Bar (No New Chat Button) */}
      <div className="teams-mobile-top-bar">
        <div className="teams-user-presence-slot">
          <TeamsAvatar
            name={currentUserName}
            photo={currentUserPhoto}
            presence="available"
            size={34}
            showPresence={true}
          />
        </div>

        <h1 className="teams-page-title">Chat</h1>

        <div className="teams-top-actions">
          <button
            type="button"
            className="teams-top-icon-btn"
            onClick={() => setActiveFilter((prev) => (prev === 'unread' ? 'all' : 'unread'))}
            title="Filter messages"
          >
            <SlidersHorizontal
              size={19}
              color={activeFilter === 'unread' ? '#5B5FC7' : '#242424'}
            />
          </button>
        </div>
      </div>

      {/* 2. Direct Search Bar (Search for any employee name or Employee ID) */}
      <div className="teams-search-section">
        <div className="teams-search-pill">
          {isSearchingDirectory ? (
            <Loader2 size={16} className="spin-animation" color="#5B5FC7" style={{ marginRight: '0.5rem' }} />
          ) : (
            <Search size={16} className="teams-search-icon" />
          )}
          <input
            type="text"
            className="teams-search-input"
            placeholder=""
            value={searchQuery}
            onFocus={() => setIsSearchFocused(true)}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {(searchQuery || isSearchFocused) && (
            <button
              type="button"
              className="teams-search-clear"
              onClick={() => {
                setSearchQuery('')
                setIsSearchFocused(false)
              }}
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* 3. Filter Chips (Visible when not actively searching) */}
      {!isSearchActive && (
        <div className="teams-filter-chips-bar">
          <button
            type="button"
            className={`teams-filter-chip ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            All
            <span className="teams-chip-count">{conversations.length}</span>
          </button>

          <button
            type="button"
            className={`teams-filter-chip ${activeFilter === 'unread' ? 'active' : ''}`}
            onClick={() => setActiveFilter('unread')}
          >
            Unread
            {totalUnreadCount > 0 && (
              <span className="teams-chip-badge">
                {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
              </span>
            )}
          </button>

          <button
            type="button"
            className={`teams-filter-chip ${activeFilter === 'online' ? 'active' : ''}`}
            onClick={() => setActiveFilter('online')}
          >
            Available
            <span className="teams-chip-online-dot" />
          </button>
        </div>
      )}

      {/* 4. Conversations & Search Results Scroll Area */}
      <div className="teams-conversations-scroll">
        {/* Starting Conversation Banner */}
        {isStartingConv && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', background: 'rgba(91, 95, 199, 0.08)', color: '#5B5FC7', fontSize: '0.82rem', fontWeight: 600 }}>
            <Loader2 size={16} className="spin-animation" />
            <span>Opening conversation...</span>
          </div>
        )}

        {/* === SEARCH RESULTS VIEW === */}
        {isSearchActive ? (
          <div>
            {/* A. Matching Directory People / Employees */}
            <div className="teams-section-header">
              <span>{searchQuery.trim() ? `People (${directoryResults.length})` : `Suggested Contacts (${directoryResults.length})`}</span>
            </div>

            {isSearchingDirectory && directoryResults.length === 0 ? (
              <div className="teams-list-loading">
                <div className="teams-skeleton-row" />
                <div className="teams-skeleton-row" />
              </div>
            ) : directoryResults.length === 0 ? (
              <div style={{ padding: '0.65rem 1rem', fontSize: '0.82rem', color: 'var(--teams-text-secondary)' }}>
                No employees matching &ldquo;{searchQuery}&rdquo;
              </div>
            ) : (
              directoryResults.map((emp) => {
                const isAdmin =
                  emp.employee_id.toUpperCase() === 'ADMIN' ||
                  emp.name.toLowerCase() === 'admin'
                const presenceStatus = emp.is_online ? 'available' : 'offline'

                return (
                  <div
                    key={emp.id}
                    className="teams-conversation-row"
                    onClick={() => handleSelectEmployee(emp)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="teams-row-avatar-cell">
                      <TeamsAvatar
                        name={emp.name}
                        photo={emp.profile_photo}
                        presence={presenceStatus}
                        size={44}
                        showPresence={true}
                      />
                    </div>

                    <div className="teams-row-content">
                      <div className="teams-row-top">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', overflow: 'hidden' }}>
                          <span className="teams-row-name" style={{ fontWeight: 700 }}>
                            {emp.name}
                          </span>
                          {isAdmin && (
                            <span className="teams-row-admin-badge" title="Official Admin">
                              ADMIN
                            </span>
                          )}
                        </div>
                        <span className="teams-meta-id">{emp.employee_id}</span>
                      </div>

                      <div className="teams-row-bottom">
                        <span style={{ fontSize: '0.78rem', color: 'var(--teams-text-secondary)' }}>
                          {emp.designation || 'Staff'} {emp.department ? `• ${emp.department}` : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}

            {/* B. Matching Existing Chats / Messages */}
            {filteredConversations.length > 0 && (
              <>
                <div className="teams-section-header" style={{ marginTop: '0.8rem' }}>
                  <span>Chats ({filteredConversations.length})</span>
                </div>

                {filteredConversations.map((conv) => {
                  const isGroup = conv.type === 'GROUP'
                  const partner = conv.other_member
                  const isSelected = conv.id === activeConversationId
                  const hasUnread = (conv.unread_count || 0) > 0
                  const isOnline = partner?.is_online || false
                  const presenceStatus = isOnline ? 'available' : 'offline'
                  const timestamp = formatTeamsTimestamp(conv.last_message?.created_at || conv.updated_at)
                  const isAdmin =
                    !isGroup && (
                      partner?.employee_id?.toUpperCase() === 'ADMIN' ||
                      partner?.name?.toLowerCase() === 'admin'
                    )
                  const displayName = isGroup
                    ? (conv.group_name || 'Group')
                    : (partner?.name || 'Unknown Colleague')

                  return (
                    <div
                      key={conv.id}
                      className={`teams-conversation-row ${isSelected ? 'active' : ''} ${
                        hasUnread ? 'has-unread' : ''
                      }`}
                      onClick={() => {
                        setSearchQuery('')
                        onSelectConversation(conv)
                      }}
                    >
                      <div className="teams-row-avatar-cell">
                        {isGroup ? (
                          <div style={{
                            width: 46,
                            height: 46,
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, #5B5FC7 0%, #444791 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#FFF',
                            flexShrink: 0,
                            boxShadow: '0 2px 5px rgba(91,95,199,0.25)',
                          }}>
                            <Users size={20} color="#FFFFFF" />
                          </div>
                        ) : (
                          <TeamsAvatar
                            name={partner?.name || 'User'}
                            photo={partner?.profile_photo}
                            presence={presenceStatus}
                            size={46}
                            showPresence={true}
                          />
                        )}
                      </div>

                      <div className="teams-row-content">
                        <div className="teams-row-top">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', overflow: 'hidden' }}>
                            <span className={`teams-row-name ${hasUnread ? 'unread' : ''}`}>
                              {displayName}
                            </span>
                            {isAdmin && (
                              <span className="teams-row-admin-badge" title="Official Admin">
                                ADMIN
                              </span>
                            )}
                          </div>
                          <span className={`teams-row-time ${hasUnread ? 'unread' : ''}`}>
                            {timestamp}
                          </span>
                        </div>

                        <div className="teams-row-bottom">
                          <p className={`teams-row-preview ${hasUnread ? 'unread' : ''}`}>
                            {conv.last_message ? (
                              isGroup && !conv.last_message.is_self ? (
                                <span><strong>{conv.last_message.sender_name}:</strong> {conv.last_message.content}</span>
                              ) : (
                                conv.last_message.content
                              )
                            ) : (
                              'Started a conversation'
                            )}
                          </p>

                          {hasUnread && (
                            <span className="teams-unread-badge">
                              {conv.unread_count! > 99 ? '99+' : conv.unread_count}
                            </span>
                          )}
                        </div>

                        <div className="teams-row-meta">
                          {isGroup ? (
                            <span className="teams-meta-dept" style={{ color: '#5B5FC7', fontWeight: 600 }}>
                              Group Channel
                            </span>
                          ) : (
                            <>
                              <span className="teams-meta-id">{partner?.employee_id}</span>
                              {partner?.department && (
                                <span className="teams-meta-dept">• {partner.department}</span>
                              )}
                              {(() => {
                                const status = formatLastSeen(partner?.is_online || false, partner?.last_seen_at)
                                return status ? (
                                  <span className={`teams-meta-status ${partner?.is_online ? 'online' : ''}`}>
                                    • {status}
                                  </span>
                                ) : null
                              })()}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        ) : (
          /* === RECENT CONVERSATIONS VIEW (Search Bar is Empty) === */
          <>
            <div className="teams-section-header">
              <span>Recent</span>
            </div>

            {isLoading ? (
              <div className="teams-list-loading">
                <div className="teams-skeleton-row" />
                <div className="teams-skeleton-row" />
                <div className="teams-skeleton-row" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="teams-list-empty">
                <Sparkles size={32} className="teams-empty-sparkle" />
                <p className="teams-empty-title">Search to start a conversation</p>
                <p className="teams-empty-sub">
                  Type any colleague&apos;s name, Employee ID, or &ldquo;Admin&rdquo; in the search bar above to begin chatting.
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isGroup = conv.type === 'GROUP'
                const partner = conv.other_member
                const isSelected = conv.id === activeConversationId
                const hasUnread = (conv.unread_count || 0) > 0
                const isOnline = partner?.is_online || false
                const presenceStatus = isOnline ? 'available' : 'offline'
                const timestamp = formatTeamsTimestamp(conv.last_message?.created_at || conv.updated_at)
                const isAdmin =
                  !isGroup && (
                    partner?.employee_id?.toUpperCase() === 'ADMIN' ||
                    partner?.name?.toLowerCase() === 'admin'
                  )
                const displayName = isGroup
                  ? (conv.group_name || 'Group')
                  : (partner?.name || 'Unknown Colleague')

                return (
                  <div
                    key={conv.id}
                    className={`teams-conversation-row ${isSelected ? 'active' : ''} ${
                      hasUnread ? 'has-unread' : ''
                    }`}
                    onClick={() => onSelectConversation(conv)}
                  >
                    {/* Avatar Cell */}
                    <div className="teams-row-avatar-cell">
                      {isGroup ? (
                        <div style={{
                          width: 46,
                          height: 46,
                          borderRadius: '12px',
                          background: 'linear-gradient(135deg, #5B5FC7 0%, #444791 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#FFF',
                          flexShrink: 0,
                          boxShadow: '0 2px 5px rgba(91,95,199,0.25)',
                        }}>
                          <Users size={20} color="#FFFFFF" />
                        </div>
                      ) : (
                        <TeamsAvatar
                          name={partner?.name || 'User'}
                          photo={partner?.profile_photo}
                          presence={presenceStatus}
                          size={46}
                          showPresence={true}
                        />
                      )}
                    </div>

                    {/* Content Cell */}
                    <div className="teams-row-content">
                      <div className="teams-row-top">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', overflow: 'hidden' }}>
                          <span className={`teams-row-name ${hasUnread ? 'unread' : ''}`}>
                            {displayName}
                          </span>
                          {isAdmin && (
                            <span className="teams-row-admin-badge" title="Official Admin">
                              ADMIN
                            </span>
                          )}
                        </div>
                        <span className={`teams-row-time ${hasUnread ? 'unread' : ''}`}>
                          {timestamp}
                        </span>
                      </div>

                      <div className="teams-row-bottom">
                        <p className={`teams-row-preview ${hasUnread ? 'unread' : ''}`}>
                          {conv.last_message ? (
                            isGroup && !conv.last_message.is_self ? (
                              <span><strong>{conv.last_message.sender_name}:</strong> {conv.last_message.content}</span>
                            ) : (
                              conv.last_message.content
                            )
                          ) : (
                            'Started a conversation'
                          )}
                        </p>

                        {hasUnread && (
                          <span className="teams-unread-badge">
                            {conv.unread_count! > 99 ? '99+' : conv.unread_count}
                          </span>
                        )}
                      </div>

                      {/* Micro Department / ID / Last Seen tag */}
                      <div className="teams-row-meta">
                        {isGroup ? (
                          <span className="teams-meta-dept" style={{ color: '#5B5FC7', fontWeight: 600 }}>
                            Group Channel
                          </span>
                        ) : (
                          <>
                            <span className="teams-meta-id">{partner?.employee_id}</span>
                            {partner?.department && (
                              <span className="teams-meta-dept">• {partner.department}</span>
                            )}
                            {(() => {
                              const status = formatLastSeen(partner?.is_online || false, partner?.last_seen_at)
                              return status ? (
                                <span className={`teams-meta-status ${partner?.is_online ? 'online' : ''}`}>
                                  • {status}
                                </span>
                              ) : null
                            })()}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </>
        )}
      </div>
    </div>
  )
}
