import { authedFetch } from '../lib/api';
import {
  EmployeeSearchResult,
  ConversationItem,
  ChatMessage,
  TypingStatusResponse,
  CommunicationOverviewData,
} from '../types/chat';

export async function searchEmployees(
  query: string,
  token: string
): Promise<EmployeeSearchResult[]> {
  const res = await authedFetch(
    `/api/communication/employees/search/?q=${encodeURIComponent(query)}`,
    token
  );
  const data = await res.json();
  return Array.isArray(data) ? data : data.results || [];
}

export async function getConversations(token: string): Promise<ConversationItem[]> {
  const res = await authedFetch('/api/communication/conversations/', token);
  const data = await res.json();
  return Array.isArray(data) ? data : data.results || [];
}

export async function startConversation(
  targetEmployeeId: string | number,
  token: string
): Promise<ConversationItem> {
  const res = await authedFetch('/api/communication/conversations/', token, {
    method: 'POST',
    body: JSON.stringify({ target_employee_id: targetEmployeeId }),
  });
  return res.json();
}

export async function getConversationMessages(
  conversationId: number,
  token: string,
  limit: number = 100
): Promise<ChatMessage[]> {
  const res = await authedFetch(
    `/api/communication/conversations/${conversationId}/messages/?limit=${limit}`,
    token
  );
  const data = await res.json();
  return Array.isArray(data) ? data : data.results || [];
}

export async function sendChatMessage(
  conversationId: number,
  content: string,
  token: string,
  fileUri?: string
): Promise<ChatMessage> {
  if (fileUri) {
    const formData = new FormData();
    formData.append('content', content);
    const filename = fileUri.split('/').pop() || 'attachment';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'application/octet-stream';

    formData.append('file', {
      uri: fileUri,
      name: filename,
      type,
    } as any);

    const res = await authedFetch(
      `/api/communication/conversations/${conversationId}/messages/`,
      token,
      {
        method: 'POST',
        body: formData,
      }
    );
    return res.json();
  }

  const res = await authedFetch(
    `/api/communication/conversations/${conversationId}/messages/`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({ content }),
    }
  );
  return res.json();
}

export async function markConversationAsRead(
  conversationId: number,
  token: string
): Promise<void> {
  await authedFetch(`/api/communication/conversations/${conversationId}/read/`, token, {
    method: 'POST',
  });
}

export async function deleteChatMessage(messageId: number, token: string): Promise<void> {
  await authedFetch(`/api/communication/messages/${messageId}/`, token, {
    method: 'DELETE',
  });
}

export async function getConversationTyping(
  conversationId: number,
  token: string
): Promise<TypingStatusResponse> {
  const res = await authedFetch(
    `/api/communication/conversations/${conversationId}/typing/`,
    token
  );
  return res.json();
}

export async function setConversationTyping(
  conversationId: number,
  isTyping: boolean,
  token: string
): Promise<void> {
  await authedFetch(`/api/communication/conversations/${conversationId}/typing/`, token, {
    method: 'POST',
    body: JSON.stringify({ is_typing: isTyping }),
  });
}

export async function sendPresencePing(token: string): Promise<void> {
  await authedFetch('/api/communication/presence/ping/', token, {
    method: 'POST',
  });
}

export async function getUnreadCount(token: string): Promise<number> {
  try {
    const res = await authedFetch('/api/communication/unread-count/', token);
    const data = await res.json();
    return typeof data.unread_count === 'number' ? data.unread_count : 0;
  } catch {
    return 0;
  }
}

export async function getCommunicationOverview(
  token: string
): Promise<CommunicationOverviewData> {
  const res = await authedFetch('/api/communication/overview/', token);
  return res.json();
}

export async function toggleReaction(
  messageId: number,
  emoji: string,
  token: string
): Promise<{ status: string; emoji: string }> {
  const res = await authedFetch(
    `/api/communication/messages/${messageId}/reactions/`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    }
  );
  return res.json();
}

export async function getGroups(token: string): Promise<ConversationItem[]> {
  const res = await authedFetch('/api/communication/groups/', token);
  const data = await res.json();
  return Array.isArray(data) ? data : data.results || [];
}

export async function createGroup(
  groupName: string,
  memberIds: number[],
  token: string
): Promise<ConversationItem> {
  const res = await authedFetch('/api/communication/groups/', token, {
    method: 'POST',
    body: JSON.stringify({
      group_name: groupName,
      member_ids: memberIds,
    }),
  });
  return res.json();
}
