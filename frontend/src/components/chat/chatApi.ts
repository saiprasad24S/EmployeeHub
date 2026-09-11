import { authedFetch } from '../../lib/api'
import type {
  ChatMessage,
  CommunicationOverviewData,
  ConversationItem,
  EmployeeSearchResult,
  TypingStatusResponse,
} from './chatTypes'


export type TokenProvider = string | (() => Promise<string | null>)

export async function resolveToken(tokenOrProvider?: TokenProvider): Promise<string> {
  if (!tokenOrProvider) return ''
  if (typeof tokenOrProvider === 'function') {
    try {
      const resolved = await tokenOrProvider()
      return resolved || ''
    } catch {
      return ''
    }
  }
  return tokenOrProvider
}

export async function searchEmployees(
  query: string,
  tokenOrProvider: TokenProvider
): Promise<EmployeeSearchResult[]> {
  const token = await resolveToken(tokenOrProvider)
  const params = query ? `?q=${encodeURIComponent(query)}` : ''
  const res = await authedFetch(`/api/communication/employees/search/${params}`, token)
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    throw new Error(errData.detail || 'Failed to search employees')
  }
  return res.json()
}

export async function getConversations(tokenOrProvider: TokenProvider): Promise<ConversationItem[]> {
  const token = await resolveToken(tokenOrProvider)
  const res = await authedFetch('/api/communication/conversations/', token)
  if (!res.ok) throw new Error('Failed to load conversations')
  return res.json()
}

export async function startConversation(
  targetEmployeeId: string | number,
  tokenOrProvider: TokenProvider
): Promise<ConversationItem> {
  const token = await resolveToken(tokenOrProvider)
  const res = await authedFetch('/api/communication/conversations/', token, {
    method: 'POST',
    body: JSON.stringify({ target_employee_id: targetEmployeeId }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to start conversation')
  }
  return res.json()
}

export async function getConversationMessages(
  conversationId: number,
  tokenOrProvider: TokenProvider
): Promise<ChatMessage[]> {
  const token = await resolveToken(tokenOrProvider)
  const res = await authedFetch(`/api/communication/conversations/${conversationId}/messages/`, token)
  if (!res.ok) throw new Error('Failed to load messages')
  return res.json()
}

export async function sendChatMessage(
  conversationId: number,
  content: string,
  tokenOrProvider: TokenProvider,
  file?: File
): Promise<ChatMessage> {
  const token = await resolveToken(tokenOrProvider)
  if (file) {
    // Use FormData for file uploads
    const formData = new FormData()
    formData.append('content', content || '')
    formData.append('file', file)
    const res = await fetch(`${(await import('../../lib/api')).API_BASE_URL}/api/communication/conversations/${conversationId}/messages/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.detail || 'Failed to send message')
    }
    return res.json()
  }
  const res = await authedFetch(`/api/communication/conversations/${conversationId}/messages/`, token, {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to send message')
  }
  return res.json()
}

export async function markConversationAsRead(
  conversationId: number,
  tokenOrProvider: TokenProvider
): Promise<void> {
  const token = await resolveToken(tokenOrProvider)
  await authedFetch(`/api/communication/conversations/${conversationId}/read/`, token, {
    method: 'POST',
  })
}

export async function deleteChatMessage(
  messageId: number,
  tokenOrProvider: TokenProvider
): Promise<void> {
  const token = await resolveToken(tokenOrProvider)
  const res = await authedFetch(`/api/communication/messages/${messageId}/`, token, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to delete message')
  }
}

export async function getConversationTyping(
  conversationId: number,
  tokenOrProvider: TokenProvider
): Promise<TypingStatusResponse> {
  const token = await resolveToken(tokenOrProvider)
  const res = await authedFetch(`/api/communication/conversations/${conversationId}/typing/`, token)
  if (!res.ok) return { is_typing: false }
  return res.json()
}

export async function setConversationTyping(
  conversationId: number,
  isTyping: boolean,
  tokenOrProvider: TokenProvider
): Promise<void> {
  const token = await resolveToken(tokenOrProvider)
  await authedFetch(`/api/communication/conversations/${conversationId}/typing/`, token, {
    method: 'POST',
    body: JSON.stringify({ is_typing: isTyping }),
  })
}

export async function sendPresencePing(tokenOrProvider: TokenProvider): Promise<void> {
  const token = await resolveToken(tokenOrProvider)
  if (!token) return
  await authedFetch('/api/communication/presence/ping/', token, {
    method: 'POST',
  })
}

export async function getUnreadCount(tokenOrProvider: TokenProvider): Promise<number> {
  const token = await resolveToken(tokenOrProvider)
  if (!token) return 0
  const res = await authedFetch('/api/communication/unread-count/', token)
  if (!res.ok) return 0
  const data = await res.json()
  return data.unread_count || 0
}

export async function getCommunicationOverview(
  tokenOrProvider: TokenProvider
): Promise<CommunicationOverviewData> {
  const token = await resolveToken(tokenOrProvider)
  const res = await authedFetch('/api/communication/overview/', token)
  if (!res.ok) throw new Error('Failed to load overview')
  return res.json()
}

// ── Reactions ──
export async function toggleReaction(
  messageId: number,
  emoji: string,
  tokenOrProvider: TokenProvider
): Promise<{ status: string; emoji: string }> {
  const token = await resolveToken(tokenOrProvider)
  const res = await authedFetch(`/api/communication/messages/${messageId}/reactions/`, token, {
    method: 'POST',
    body: JSON.stringify({ emoji }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to toggle reaction')
  }
  return res.json()
}

// ── Groups ──
export async function getGroups(tokenOrProvider: TokenProvider): Promise<any[]> {
  const token = await resolveToken(tokenOrProvider)
  if (!token) return []
  const res = await authedFetch('/api/communication/groups/', token)
  if (!res.ok) return []
  return res.json()
}

export async function createGroup(
  groupName: string,
  memberIds: number[],
  tokenOrProvider: TokenProvider
): Promise<any> {
  const token = await resolveToken(tokenOrProvider)
  const res = await authedFetch('/api/communication/groups/', token, {
    method: 'POST',
    body: JSON.stringify({ group_name: groupName, member_ids: memberIds }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to create group')
  }
  return res.json()
}
