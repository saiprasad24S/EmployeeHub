import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { WS_BASE_URL } from '../lib/api';
import { useChatStore } from '../store/chatStore';
import { ChatMessage } from '../types/chat';

interface UseWebSocketOptions {
  conversationId: number | null;
  onNewMessage?: (msg: ChatMessage) => void;
  onTyping?: (data: { employee_id: number; name: string; is_typing: boolean }) => void;
  onReadReceipt?: (data: { employee_id: number; conversation_id: number }) => void;
}

export function useWebSocket({
  conversationId,
  onNewMessage,
  onTyping,
  onReadReceipt,
}: UseWebSocketOptions) {
  const { getToken } = useAuth();
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const setWebSocketConnected = useChatStore((state) => state.setWebSocketConnected);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(async () => {
    if (!conversationId) return;

    try {
      const token = await getToken();
      if (!token) return;

      // Close existing
      if (socketRef.current) {
        socketRef.current.close();
      }

      const wsUrl = `${WS_BASE_URL}/ws/chat/${conversationId}/?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        setWebSocketConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'new_message' && data.message) {
            onNewMessage?.(data.message);
          } else if (data.type === 'typing') {
            onTyping?.(data);
          } else if (data.type === 'read_receipt') {
            onReadReceipt?.(data);
          }
        } catch (err) {
          // ignore parsing error
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        setWebSocketConnected(false);
        // Attempt reconnect after 3 seconds if still mounted and same conversation
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };

      socketRef.current = ws;
    } catch (err) {
      setIsConnected(false);
      setWebSocketConnected(false);
    }
  }, [conversationId, getToken, setWebSocketConnected, onNewMessage, onTyping, onReadReceipt]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      setIsConnected(false);
      setWebSocketConnected(false);
    };
  }, [connect]);

  const sendMessage = useCallback((content: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          action: 'send_message',
          content,
        })
      );
      return true;
    }
    return false;
  }, []);

  const sendTyping = useCallback((isTyping: boolean) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          action: 'typing',
          is_typing: isTyping,
        })
      );
    }
  }, []);

  const markRead = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          action: 'mark_read',
        })
      );
    }
  }, []);

  return {
    isConnected,
    sendMessage,
    sendTyping,
    markRead,
  };
}
