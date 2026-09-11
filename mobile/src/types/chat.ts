export interface EmployeeSearchResult {
  id: number;
  employee_id: string;
  name: string;
  email?: string;
  phone?: string;
  department?: string;
  designation?: string;
  profile_photo?: string;
  is_online?: boolean;
  last_seen_at?: string;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  reacted_by_self: boolean;
}

export interface MessageAttachment {
  id: number;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
}

export interface ChatMessage {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender_name: string;
  sender_employee_id: string;
  sender_avatar?: string;
  content: string;
  message_type: 'TEXT' | 'IMAGE' | 'DOCUMENT';
  created_at: string;
  edited_at?: string;
  is_deleted: boolean;
  is_self: boolean;
  status: 'SENT' | 'DELIVERED' | 'READ';
  reactions?: MessageReaction[];
  attachments?: MessageAttachment[];
}

export interface LastMessagePreview {
  id: number;
  content: string;
  sender_name: string;
  is_self: boolean;
  created_at: string;
  status: 'SENT' | 'DELIVERED' | 'READ';
}

export interface ConversationItem {
  id: number;
  type: 'DIRECT' | 'GROUP';
  group_name?: string;
  members?: number[];
  updated_at: string;
  other_member?: EmployeeSearchResult;
  last_message?: LastMessagePreview;
  unread_count: number;
}

export interface CommunicationOverviewData {
  total_employees: number;
  active_conversations: number;
  messages_today: number;
  unread_messages: number;
}

export interface TypingStatusResponse {
  is_typing: boolean;
  typing_user_name?: string;
}

export interface WebSocketMessage {
  type: 'new_message' | 'typing' | 'presence' | 'read_receipt' | 'reaction';
  payload: any;
}
