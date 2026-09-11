import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  ChevronLeft,
  Send,
  Check,
  CheckCheck,
  Trash2,
  Copy,
  Info,
  Search,
  X,
  MessageSquare,
  AlertCircle,
  Loader2,
  Camera,
  Image as ImageIcon,
  Plus,
  Smile,
  FileText,
  Download,
  Users,
} from 'lucide-react'
import {
  getConversationMessages,
  sendChatMessage,
  markConversationAsRead,
  deleteChatMessage,
  getConversationTyping,
  setConversationTyping,
  toggleReaction,
} from './chatApi'
import { TeamsReactionPicker } from './TeamsReactionPicker'
import { ColleagueProfileDrawer } from './ColleagueProfileDrawer'
import { TeamsAvatar } from './TeamsPresence'

import type { ChatMessage, ConversationItem } from './chatTypes'

interface ChatWindowProps {
  conversation: ConversationItem | null
  token?: string
  getToken?: () => Promise<string | null>
  onBack: () => void
  onMessageSent?: () => void
}

function normalizeMediaUrl(url?: string): string {
  if (!url) return ''
  const mediaIdx = url.indexOf('/media/')
  if (mediaIdx !== -1) {
    return url.substring(mediaIdx)
  }
  return url
}

function formatTeamsTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return ''
  }
}

function formatTeamsDateSeparator(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    if (isToday) return 'Today'

    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear()
    if (isYesterday) return 'Yesterday'

    return d.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return ''
  }
}

function formatTeamsLastSeen(isOnline: boolean, lastSeenStr?: string | null): string {
  if (isOnline) return 'Available'
  if (!lastSeenStr) return 'Offline'
  try {
    const d = new Date(lastSeenStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Active just now'
    if (diffMins < 60) return `Last seen ${diffMins}m ago`

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

    return `Last seen ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`
  } catch {
    return 'Offline'
  }
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  conversation,
  token = '',
  getToken,
  onBack,
  onMessageSent,
}) => {
  const tokenProvider = getToken || token
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [partnerTyping, setPartnerTyping] = useState<string | null>(null)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isSearchingInChat, setIsSearchingInChat] = useState(false)
  const [chatSearchQuery, setChatSearchQuery] = useState('')

  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [activeReactionMessageId, setActiveReactionMessageId] = useState<number | null>(null)

  // Attachments
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const photoInputRef = useRef<HTMLInputElement | null>(null)

// Global message cache to eliminate loading spinners on conversation reopen
const globalMessageCache = new Map<number, ChatMessage[]>()

  const tokenProviderRef = useRef(tokenProvider)
  useEffect(() => {
    tokenProviderRef.current = tokenProvider
  }, [tokenProvider])

  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTypingRef = useRef<boolean>(false)

  const isGroup = conversation?.type === 'GROUP'
  const groupTitle = conversation?.group_name || 'Group Chat'
  const partner = conversation?.other_member
  const isOnline = partner?.is_online || false
  const presenceStatus = isOnline ? 'available' : 'offline'
  const statusSubtitle = isGroup
    ? 'Group Channel'
    : formatTeamsLastSeen(isOnline, partner?.last_seen_at)

  const scrollToBottom = (smooth = false) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
  }

  // Handle mobile back button for profile drawer
  useEffect(() => {
    if (!isProfileOpen) return
    const currentState = window.history.state || {}
    window.history.pushState({ ...currentState, profileDrawerOpen: true }, '')

    const handlePop = () => {
      setIsProfileOpen(false)
    }
    window.addEventListener('popstate', handlePop)
    return () => {
      window.removeEventListener('popstate', handlePop)
    }
  }, [isProfileOpen])

  const handleCloseProfile = useCallback(() => {
    setIsProfileOpen(false)
    if (window.history.state?.profileDrawerOpen) {
      window.history.back()
    }
  }, [])

  // 1. Load Messages on conversation switch (instant from cache, background fresh fetch)
  useEffect(() => {
    if (!conversation) {
      setMessages([])
      setIsProfileOpen(false)
      setIsSearchingInChat(false)
      setSelectedFile(null)
      setFilePreviewUrl(null)
      return
    }

    let isMounted = true
    setErrorMsg('')
    setSelectedFile(null)
    setFilePreviewUrl(null)

    // Instant optimistic render if cached
    const cached = globalMessageCache.get(conversation.id)
    if (cached && cached.length > 0) {
      setMessages(cached)
      setIsLoading(false)
      setTimeout(() => scrollToBottom(false), 20)
    } else {
      setIsLoading(true)
    }

    const fetchMessages = async () => {
      try {
        const msgs = await getConversationMessages(conversation.id, tokenProviderRef.current)
        if (isMounted) {
          globalMessageCache.set(conversation.id, msgs)
          setMessages(msgs)
          setIsLoading(false)
          setTimeout(() => scrollToBottom(false), 50)
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMsg(err.message || 'Failed to load conversation')
          setIsLoading(false)
        }
      }
    }

    void fetchMessages()
    void markConversationAsRead(conversation.id, tokenProviderRef.current)

    return () => {
      isMounted = false
    }
  }, [conversation?.id])

  // 2. Poll messages periodically (every 1.6s) without re-triggering full page loader
  useEffect(() => {
    if (!conversation) return
    let isMounted = true

    const poll = async () => {
      if (document.hidden) return
      try {
        const fresh = await getConversationMessages(conversation.id, tokenProviderRef.current)
        if (isMounted && fresh) {
          globalMessageCache.set(conversation.id, fresh)
          setMessages((prev) => {
            if (fresh.length !== prev.length) {
              setTimeout(() => scrollToBottom(true), 40)
              return fresh
            }
            if (fresh.length > 0) {
              const lastFresh = fresh[fresh.length - 1]
              const lastPrev = prev[prev.length - 1]
              if (
                lastFresh.id !== lastPrev?.id ||
                lastFresh.status !== lastPrev?.status ||
                (lastFresh.reactions?.length ?? 0) !== (lastPrev?.reactions?.length ?? 0)
              ) {
                return fresh
              }
              const hasStatusChange = fresh.some((fm, idx) => {
                const pm = prev[idx]
                return pm && (fm.status !== pm.status || (fm.reactions?.length ?? 0) !== (pm.reactions?.length ?? 0))
              })
              if (hasStatusChange) return fresh
            }
            return prev
          })
        }
      } catch {
        // silent fail
      }
    }

    const interval = setInterval(poll, 1600)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [conversation?.id])

  // 3. Partner typing status check (for direct chat)
  useEffect(() => {
    if (!conversation || isGroup) return
    let isMounted = true

    const checkTyping = async () => {
      if (document.hidden) return
      try {
        const status = await getConversationTyping(conversation.id, tokenProviderRef.current)
        if (isMounted) {
          if (status.is_typing && status.typing_user_name) {
            setPartnerTyping(status.typing_user_name)
          } else {
            setPartnerTyping(null)
          }
        }
      } catch {
        // silent fail
      }
    }

    const interval = setInterval(checkTyping, 2000)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [conversation?.id, isGroup])

  // Typing event trigger
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value)

    if (!conversation) return

    if (!isTypingRef.current) {
      isTypingRef.current = true
      void setConversationTyping(conversation.id, true, tokenProvider)
    }

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false
      if (conversation) {
        void setConversationTyping(conversation.id, false, tokenProvider)
      }
    }, 2500)
  }

  // File selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      setFilePreviewUrl(url)
    } else {
      setFilePreviewUrl(null)
    }
    e.target.value = ''
  }

  const handleRemoveSelectedFile = () => {
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl)
    }
    setSelectedFile(null)
    setFilePreviewUrl(null)
  }

  // 4. Send Message (with optional attachment)
  const handleSendMessage = async (customText?: string) => {
    if (!conversation) return
    const content = (customText ?? inputText).trim()
    if (!content && !selectedFile) return
    if (isSending) return

    setIsSending(true)
    setErrorMsg('')
    if (!customText) setInputText('')

    const fileToSend = selectedFile
    const previewToSend = filePreviewUrl
    setSelectedFile(null)
    setFilePreviewUrl(null)

    if (isTypingRef.current) {
      isTypingRef.current = false
      void setConversationTyping(conversation.id, false, tokenProvider)
    }

    const tempId = Date.now()
    const optimisticMsg: ChatMessage = {
      id: tempId,
      conversation_id: conversation.id,
      sender_id: 0,
      sender_name: 'You',
      sender_employee_id: '',
      content,
      message_type: fileToSend?.type.startsWith('image/')
        ? 'IMAGE'
        : fileToSend
        ? 'DOCUMENT'
        : 'TEXT',
      created_at: new Date().toISOString(),
      is_deleted: false,
      is_self: true,
      status: 'SENT',
      attachments: fileToSend
        ? [
            {
              id: tempId,
              file_name: fileToSend.name,
              file_url: previewToSend || '',
              file_type: fileToSend.type,
              file_size: fileToSend.size,
            },
          ]
        : undefined,
    }

    setMessages((prev) => [...prev, optimisticMsg])
    setTimeout(() => scrollToBottom(true), 30)

    try {
      const realMsg = await sendChatMessage(
        conversation.id,
        content,
        tokenProvider,
        fileToSend || undefined
      )
      setMessages((prev) => {
        const next = prev.map((m) => (m.id === tempId ? realMsg : m))
        globalMessageCache.set(conversation.id, next)
        return next
      })
      onMessageSent?.()
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send message')
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
    } finally {
      setIsSending(false)
    }
  }

  // 5. Toggle Reaction (Teams style: ONLY ONE reaction per person per message)
  const handleToggleReaction = async (messageId: number, emoji: string) => {
    setActiveReactionMessageId(null)

    // Optimistically enforce single reaction per person
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId) return msg
        const reactions = msg.reactions ? [...msg.reactions] : []
        const existingSelfIdx = reactions.findIndex((r) => r.reacted_by_self)

        if (existingSelfIdx >= 0) {
          const selfReaction = reactions[existingSelfIdx]
          if (selfReaction.emoji === emoji) {
            // Same emoji clicked -> remove it
            if (selfReaction.count <= 1) {
              reactions.splice(existingSelfIdx, 1)
            } else {
              reactions[existingSelfIdx] = {
                ...selfReaction,
                count: selfReaction.count - 1,
                reacted_by_self: false,
              }
            }
          } else {
            // Different emoji clicked -> remove from old emoji, add to new emoji
            if (selfReaction.count <= 1) {
              reactions.splice(existingSelfIdx, 1)
            } else {
              reactions[existingSelfIdx] = {
                ...selfReaction,
                count: selfReaction.count - 1,
                reacted_by_self: false,
              }
            }
            const newEmojiIdx = reactions.findIndex((r) => r.emoji === emoji)
            if (newEmojiIdx >= 0) {
              reactions[newEmojiIdx] = {
                ...reactions[newEmojiIdx],
                count: reactions[newEmojiIdx].count + 1,
                reacted_by_self: true,
              }
            } else {
              reactions.push({ emoji, count: 1, reacted_by_self: true })
            }
          }
        } else {
          // No reaction yet -> add reaction
          const targetIdx = reactions.findIndex((r) => r.emoji === emoji)
          if (targetIdx >= 0) {
            reactions[targetIdx] = {
              ...reactions[targetIdx],
              count: reactions[targetIdx].count + 1,
              reacted_by_self: true,
            }
          } else {
            reactions.push({ emoji, count: 1, reacted_by_self: true })
          }
        }
        return { ...msg, reactions }
      })
    )

    try {
      await toggleReaction(messageId, emoji, tokenProvider)
    } catch (err: any) {
      console.error('Failed to toggle reaction:', err)
      if (conversation) {
        try {
          const fresh = await getConversationMessages(conversation.id, tokenProvider)
          setMessages(fresh)
        } catch {}
      }
    }
  }

  // 6. Delete Message (Soft delete)
  const handleDeleteMessage = async (msgId: number) => {
    if (!confirm('Delete this message?')) return
    try {
      await deleteChatMessage(msgId, tokenProvider)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? { ...m, is_deleted: true, content: 'This message was deleted.' }
            : m
        )
      )
    } catch (err: any) {
      alert(err.message || 'Failed to delete message')
    }
  }

  // 7. Copy Message Text
  const handleCopyMessage = (msgId: number, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(msgId)
    setTimeout(() => setCopiedId(null), 1800)
  }

  // Filter messages if search active
  const displayedMessages = useMemo(() => {
    if (!chatSearchQuery.trim()) return messages
    const q = chatSearchQuery.toLowerCase()
    return messages.filter((m) => m.content.toLowerCase().includes(q))
  }, [messages, chatSearchQuery])

  if (!conversation) {
    return (
      <div className="teams-chat-window-empty">
        <div className="teams-chat-empty-content">
          <div className="teams-empty-icon-circle">
            <MessageSquare size={38} color="#5B5FC7" />
          </div>
          <h3 className="teams-empty-header">EmployeeHub Chat</h3>
          <p className="teams-empty-text">
            Choose a conversation from the chat list or search for any colleague by name or Employee ID above.
          </p>
        </div>
      </div>
    )
  }

  let lastDateStr = ''

  return (
    <div className="teams-chat-window-root" onClick={() => setActiveReactionMessageId(null)}>
      {/* 1. Teams Top Navigation Bar */}
      <div className="teams-chat-top-bar">
        <div className="teams-top-left">
          <button
            type="button"
            className="teams-back-arrow-btn"
            onClick={onBack}
            aria-label="Back to conversations"
          >
            <ChevronLeft size={26} strokeWidth={2.4} color="#242424" />
          </button>

          {isGroup ? (
            <div className="teams-header-contact-wrap">
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #5B5FC7 0%, #444791 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFF',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  flexShrink: 0,
                  boxShadow: '0 2px 4px rgba(91,95,199,0.25)',
                }}
              >
                <Users size={18} color="#FFFFFF" />
              </div>
              <div className="teams-header-meta">
                <span className="teams-header-name">{groupTitle}</span>
                <span className="teams-header-status">
                  <span className="teams-status-indicator-dot available" />
                  Group Channel
                </span>
              </div>
            </div>
          ) : (
            <div
              className="teams-header-contact-wrap"
              onClick={() => setIsProfileOpen(true)}
              role="button"
              tabIndex={0}
            >
              <TeamsAvatar
                name={partner?.name || 'User'}
                photo={partner?.profile_photo}
                presence={presenceStatus}
                size={36}
                showPresence={true}
              />

              <div className="teams-header-meta">
                <span className="teams-header-name">{partner?.name || 'Colleague'}</span>
                <span className="teams-header-status">
                  <span className={`teams-status-indicator-dot ${presenceStatus}`} />
                  {statusSubtitle}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Header Actions */}
        <div className="teams-chat-top-actions">
          <button
            type="button"
            className="teams-header-icon-btn"
            onClick={() => setIsSearchingInChat((prev) => !prev)}
            title="Search in chat"
          >
            <Search size={19} color="#242424" />
          </button>

          {!isGroup && (
            <button
              type="button"
              className="teams-header-icon-btn"
              onClick={() => setIsProfileOpen(true)}
              title="Colleague details"
            >
              <Info size={19} color="#242424" />
            </button>
          )}
        </div>
      </div>

      {/* In-Chat Filter Search Bar */}
      {isSearchingInChat && (
        <div className="teams-inchat-search-bar">
          <Search size={16} color="#8A8886" />
          <input
            type="text"
            className="teams-inchat-search-input"
            placeholder="Search in this conversation..."
            value={chatSearchQuery}
            onChange={(e) => setChatSearchQuery(e.target.value)}
            autoFocus
          />
          {chatSearchQuery && (
            <button
              type="button"
              className="teams-search-clear"
              onClick={() => setChatSearchQuery('')}
            >
              <X size={14} />
            </button>
          )}
          <button
            type="button"
            className="teams-inchat-search-close"
            onClick={() => {
              setIsSearchingInChat(false)
              setChatSearchQuery('')
            }}
          >
            Done
          </button>
        </div>
      )}

      {/* 2. Messages Canvas (Stretches with flex: 1 to position composer cleanly at bottom) */}
      <div className="teams-messages-canvas">
        {isLoading && messages.length === 0 ? (
          <div className="teams-messages-loading">
            <Loader2 size={26} className="spin-animation" color="#5B5FC7" />
            <span>Loading messages...</span>
          </div>
        ) : errorMsg ? (
          <div className="teams-messages-error">
            <AlertCircle size={24} color="#C4314B" />
            <span>{errorMsg}</span>
          </div>
        ) : displayedMessages.length === 0 ? (
          <div className="teams-no-messages-placeholder">
            <div className="teams-first-convo-art">
              <MessageSquare size={36} color="#5B5FC7" />
            </div>
            <p className="teams-first-convo-lead">
              {isGroup
                ? `Welcome to ${groupTitle}`
                : `This is the start of your direct chat with ${partner?.name || 'your colleague'}.`}
            </p>
            <span className="teams-first-convo-sub">
              {chatSearchQuery
                ? 'Try a different search word'
                : 'Send a message or attachment to start collaborating.'}
            </span>
          </div>
        ) : (
          displayedMessages.map((msg) => {
            const dateStr = formatTeamsDateSeparator(msg.created_at)
            const showDateSeparator = dateStr !== lastDateStr
            lastDateStr = dateStr

            const hasAttachments = msg.attachments && msg.attachments.length > 0
            const firstAtt = hasAttachments ? msg.attachments![0] : null
            // Check if content is just a repeated attachment filename or number string
            const isContentJustFilename = firstAtt && (
              msg.content === firstAtt.file_name ||
              /^\d+\.(jpg|jpeg|png|gif|webp)$/i.test(msg.content.trim())
            )

            return (
              <React.Fragment key={msg.id}>
                {showDateSeparator && (
                  <div className="teams-date-divider">
                    <span className="teams-date-pill">{dateStr}</span>
                  </div>
                )}

                <div
                  className={`teams-message-cluster ${
                    msg.is_self ? 'outgoing' : 'incoming'
                  }`}
                >
                  {/* Incoming Avatar */}
                  {!msg.is_self && (
                    <div className="teams-cluster-avatar">
                      <TeamsAvatar
                        name={isGroup ? msg.sender_name : partner?.name || 'User'}
                        photo={isGroup ? msg.sender_avatar : partner?.profile_photo}
                        presence={null}
                        size={28}
                        showPresence={false}
                      />
                    </div>
                  )}

                  <div className="teams-bubble-wrapper" style={{ position: 'relative' }}>
                    {/* Incoming Sender Name */}
                    {!msg.is_self && (
                      <span className="teams-incoming-sender-name">
                        {isGroup ? msg.sender_name : partner?.name || 'Colleague'}
                      </span>
                    )}

                    {/* The Message Card / Bubble */}
                    <div
                      className={`teams-speech-bubble ${
                        msg.is_self ? 'bubble-outgoing' : 'bubble-incoming'
                      } ${msg.is_deleted ? 'bubble-deleted' : ''}`}
                    >
                      {/* Attachments rendering */}
                      {hasAttachments && (
                        <div className="teams-msg-attachments-container">
                          {msg.attachments!.map((att) => {
                            const isImg =
                              att.file_type?.startsWith('image/') ||
                              /\.(jpg|jpeg|png|gif|webp)$/i.test(att.file_name)
                            const cleanUrl = normalizeMediaUrl(att.file_url)

                            if (isImg) {
                              return (
                                <div key={att.id || att.file_name} className="teams-msg-attachment-image-wrap">
                                  <img
                                    src={cleanUrl}
                                    alt=""
                                    className="teams-msg-attachment-img"
                                    onClick={() => window.open(cleanUrl, '_blank')}
                                  />
                                </div>
                              )
                            }
                            return (
                              <a
                                key={att.id || att.file_name}
                                href={cleanUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                download
                                className="teams-msg-attachment-card"
                              >
                                <div className="teams-att-card-icon">
                                  <FileText size={22} color="#5B5FC7" />
                                </div>
                                <div className="teams-att-card-info">
                                  <span className="teams-att-card-name">Document</span>
                                  <span className="teams-att-card-size">
                                    {att.file_size
                                      ? `${(att.file_size / 1024).toFixed(1)} KB`
                                      : 'Attachment'}
                                  </span>
                                </div>
                                <Download size={16} color="#616161" className="teams-att-download-icon" />
                              </a>
                            )
                          })}
                        </div>
                      )}

                      {/* Text content (suppressed if it's just the numeric filename) */}
                      {msg.content && !isContentJustFilename && (
                        <p className="teams-message-text">{msg.content}</p>
                      )}

                      <div className="teams-message-footer">
                        <span className="teams-time-stamp">
                          {formatTeamsTime(msg.created_at)}
                        </span>

                        {msg.is_self && !msg.is_deleted && (
                          <span className={`teams-status-tick ${msg.status.toLowerCase()}`}>
                            {msg.status === 'READ' ? (
                              <CheckCheck size={14} className="tick-read-purple" />
                            ) : msg.status === 'DELIVERED' ? (
                              <CheckCheck size={14} />
                            ) : (
                              <Check size={14} />
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Reaction Pills Dock */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className="teams-reaction-pills-dock">
                        {msg.reactions.map((r) => (
                          <button
                            key={r.emoji}
                            type="button"
                            className={`teams-reaction-pill ${r.reacted_by_self ? 'active' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleToggleReaction(msg.id, r.emoji)
                            }}
                            title={`Reacted ${r.count} time(s)`}
                          >
                            <span className="teams-reaction-pill-emoji">{r.emoji}</span>
                            <span className="teams-reaction-pill-count">{r.count}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Teams Reaction Floating Picker */}
                    {activeReactionMessageId === msg.id && (
                      <TeamsReactionPicker
                        onSelectEmoji={(emoji) => void handleToggleReaction(msg.id, emoji)}
                        onClose={() => setActiveReactionMessageId(null)}
                        isSelf={msg.is_self}
                        position="top"
                      />
                    )}

                    {/* Message Actions on Hover */}
                    <div className="teams-hover-actions">
                      {!msg.is_deleted && (
                        <>
                          <button
                            type="button"
                            className="teams-hover-btn"
                            onClick={(e) => {
                              e.stopPropagation()
                              setActiveReactionMessageId((prev) =>
                                prev === msg.id ? null : msg.id
                              )
                            }}
                            title="React to message"
                          >
                            <Smile size={14} />
                          </button>
                          <button
                            type="button"
                            className="teams-hover-btn"
                            onClick={() => handleCopyMessage(msg.id, msg.content)}
                            title="Copy text"
                          >
                            {copiedId === msg.id ? (
                              <Check size={14} color="#237B4B" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                        </>
                      )}

                      {msg.is_self && !msg.is_deleted && (
                        <button
                          type="button"
                          className="teams-hover-btn danger"
                          onClick={() => handleDeleteMessage(msg.id)}
                          title="Delete message"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            )
          })
        )}

        {/* Partner Typing Indicator */}
        {partnerTyping && (
          <div className="teams-typing-indicator">
            <span className="teams-typing-name">{partnerTyping} is typing</span>
            <div className="teams-typing-dots-wave">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. Teams Mobile Composer Bar */}
      <div className="teams-composer-container">
        {/* Selected Attachment Preview Chip */}
        {selectedFile && (
          <div className="teams-attachment-preview-bar">
            {filePreviewUrl ? (
              <img src={filePreviewUrl} alt="" className="teams-att-preview-thumb" />
            ) : (
              <div className="teams-att-preview-icon">
                <FileText size={20} color="#5B5FC7" />
              </div>
            )}
            <div className="teams-att-preview-text">
              <span className="teams-att-preview-name">Photo selected</span>
              <span className="teams-att-preview-size">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </span>
            </div>
            <button
              type="button"
              className="teams-att-preview-remove"
              onClick={handleRemoveSelectedFile}
              aria-label="Remove attachment"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <form
          className="teams-composer-form"
          onSubmit={(e) => {
            e.preventDefault()
            void handleSendMessage()
          }}
        >
          {/* Main Input Row */}
          <div className="teams-input-capsule">
            <input
              type="text"
              className="teams-text-field"
              placeholder="Type a message"
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void handleSendMessage()
                }
              }}
              disabled={isSending}
            />

            {/* Teams Send Button */}
            <button
              type="submit"
              className={`teams-send-circle-btn ${
                inputText.trim() || selectedFile ? 'ready' : 'empty'
              }`}
              disabled={(!inputText.trim() && !selectedFile) || isSending}
              aria-label="Send"
            >
              {isSending ? (
                <Loader2 size={16} className="spin-animation" color="#FFFFFF" />
              ) : (
                <Send size={16} color="#FFFFFF" />
              )}
            </button>
          </div>

          {/* Action Toolbar with Working File / Camera / Photo Inputs */}
          <div className="teams-composer-toolbar">
            {/* Hidden File Inputs */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={cameraInputRef}
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <input
              type="file"
              accept="image/*"
              ref={photoInputRef}
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />

            <button
              type="button"
              className="teams-tool-icon-btn"
              title="Add attachment"
              onClick={() => fileInputRef.current?.click()}
            >
              <Plus size={20} color="#616161" />
            </button>

            <button
              type="button"
              className="teams-tool-icon-btn"
              title="Camera"
              onClick={() => cameraInputRef.current?.click()}
            >
              <Camera size={19} color="#616161" />
            </button>

            <button
              type="button"
              className="teams-tool-icon-btn"
              title="Photos"
              onClick={() => photoInputRef.current?.click()}
            >
              <ImageIcon size={19} color="#616161" />
            </button>
          </div>
        </form>
      </div>

      {/* Profile Drawer */}
      {!isGroup && (
        <ColleagueProfileDrawer
          isOpen={isProfileOpen}
          onClose={handleCloseProfile}
          employee={partner || null}
        />
      )}
    </div>
  )
}
