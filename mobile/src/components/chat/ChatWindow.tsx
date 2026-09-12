import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
  Clipboard,
  ToastAndroid,
} from 'react-native';
import {
  Text,
  TextInput,
  IconButton,
  Avatar,
  ActivityIndicator,
  Menu,
} from 'react-native-paper';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import { useAuthStore } from '../../store/authStore';
import {
  getConversationMessages,
  sendChatMessage,
  markConversationAsRead,
  deleteChatMessage,
  toggleReaction,
} from '../../api/chatApi';
import { useWebSocket } from '../../hooks/useWebSocket';
import { ConversationItem, ChatMessage } from '../../types/chat';
import ColleagueProfileSheet from './ColleagueProfileSheet';

interface ChatWindowProps {
  conversation: ConversationItem;
  onBack: () => void;
}

const REACTION_EMOJIS = ['👍', '❤️', '😆', '😮', '😢', '😠'];

export default function ChatWindow({ conversation, onBack }: ChatWindowProps) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const currentProfileId = useAuthStore((state) => state.profile?.id);

  const [inputContent, setInputContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [profileVisible, setProfileVisible] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const typingTimerRef = useRef<any>(null);

  // Reaction & message context menu
  const [selectedMsg, setSelectedMsg] = useState<ChatMessage | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);

  // Fetch initial message history with 2s polling fallback when offline/no-ws
  const { data: initialMessages = [], isLoading } = useQuery({
    queryKey: ['chat-messages', conversation.id],
    queryFn: async () => {
      const token = await getToken();
      if (!token) return [];
      return getConversationMessages(conversation.id, token);
    },
    refetchInterval: 2000,
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (initialMessages.length > 0) {
      setMessages((prev) => {
        if (prev.length === 0) return initialMessages;
        if (initialMessages.length !== prev.length) return initialMessages;
        const lastInit = initialMessages[initialMessages.length - 1];
        const lastPrev = prev[prev.length - 1];
        if (lastInit?.id !== lastPrev?.id || lastInit?.status !== lastPrev?.status) {
          return initialMessages;
        }
        return prev;
      });
    }
  }, [initialMessages]);

  // Mark conversation read on mount
  useEffect(() => {
    const markRead = async () => {
      try {
        const token = await getToken();
        if (token) await markConversationAsRead(conversation.id, token);
      } catch {}
    };
    markRead();
  }, [conversation.id, getToken]);

  // WebSocket callbacks
  const handleNewMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
    // If incoming message, mark as read
    if (!msg.is_self) {
      getToken().then((token) => {
        if (token) markConversationAsRead(conversation.id, token);
      });
    }
  }, [conversation.id, getToken]);

  const handleTypingEvent = useCallback((data: { name: string; is_typing: boolean }) => {
    if (data.is_typing) {
      setTypingUser(data.name);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => setTypingUser(null), 3000);
    } else {
      setTypingUser(null);
    }
  }, []);

  const handleReadReceipt = useCallback(() => {
    setMessages((prev) =>
      prev.map((m) => (m.is_self ? { ...m, status: 'READ' } : m))
    );
  }, []);

  // Hook WebSocket connection
  const { isConnected, sendMessage: wsSend, sendTyping } = useWebSocket({
    conversationId: conversation.id,
    onNewMessage: handleNewMessage,
    onTyping: handleTypingEvent,
    onReadReceipt: handleReadReceipt,
  });

  // Handle typing debounce
  const handleInputChange = (text: string) => {
    setInputContent(text);
    sendTyping(text.length > 0);
  };

  const handleSend = async () => {
    const content = inputContent.trim();
    if (!content || isSending) return;

    setInputContent('');
    sendTyping(false);

    // Try WebSocket first
    const sentViaWs = wsSend(content);
    if (!sentViaWs) {
      // Fallback to REST API
      setIsSending(true);
      try {
        const token = await getToken();
        if (token) {
          const newMsg = await sendChatMessage(conversation.id, content, token);
          setMessages((prev) => [...prev, newMsg]);
        }
      } catch (err: any) {
        Alert.alert('Message Failed', 'Could not send message. Please check your connection.');
      } finally {
        setIsSending(false);
      }
    }
  };

  const handlePickAttachment = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      setIsSending(true);
      try {
        const token = await getToken();
        if (token) {
          const newMsg = await sendChatMessage(
            conversation.id,
            '',
            token,
            result.assets[0].uri
          );
          setMessages((prev) => [...prev, newMsg]);
        }
      } catch (err: any) {
        Alert.alert('Upload Failed', 'Could not send image attachment.');
      } finally {
        setIsSending(false);
      }
    }
  };

  const handleToggleReaction = async (emoji: string) => {
    if (!selectedMsg) return;
    setMenuVisible(false);
    try {
      const token = await getToken();
      if (token) {
        await toggleReaction(selectedMsg.id, emoji, token);
        queryClient.invalidateQueries({ queryKey: ['chat-messages', conversation.id] });
      }
    } catch {}
  };

  const handleDeleteMessage = async () => {
    if (!selectedMsg) return;
    setMenuVisible(false);
    try {
      const token = await getToken();
      if (token) {
        await deleteChatMessage(selectedMsg.id, token);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === selectedMsg.id
              ? { ...m, is_deleted: true, content: 'This message was deleted.' }
              : m
          )
        );
      }
    } catch {
      Alert.alert('Error', 'Could not delete message.');
    }
  };

  const handleCopyMessage = () => {
    if (selectedMsg?.content) {
      Clipboard.setString(selectedMsg.content);
      ToastAndroid.show('Message copied', ToastAndroid.SHORT);
    }
    setMenuVisible(false);
  };

  const title =
    conversation.type === 'GROUP'
      ? conversation.group_name || 'Group Chat'
      : conversation.other_member?.name || 'Colleague';
  const isOnline = conversation.other_member?.is_online;

  // Inverted FlatList requires array in reverse order (newest first)
  const invertedMessages = [...messages].reverse();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Top Chat Header */}
      <View style={styles.header}>
        <IconButton icon="arrow-left" iconColor="#FFFFFF" size={24} onPress={onBack} />

        <TouchableOpacity
          style={styles.headerInfo}
          onPress={() => setProfileVisible(true)}
        >
          <View style={styles.avatarBox}>
            <Avatar.Text
              size={38}
              label={title.substring(0, 2).toUpperCase()}
              style={styles.headerAvatar}
            />
            {isOnline && <View style={styles.onlineDot} />}
          </View>
          <View style={styles.headerTextCol}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.headerStatus}>
              {isOnline ? 'Online' : 'Offline'}
              {isConnected && ' • Realtime'}
            </Text>
          </View>
        </TouchableOpacity>

        <IconButton
          icon="information-outline"
          iconColor="#FFFFFF"
          size={24}
          onPress={() => setProfileVisible(true)}
        />
      </View>

      {/* Typing Indicator Bar */}
      {typingUser && (
        <View style={styles.typingBanner}>
          <ActivityIndicator size={12} color="#6B2FA0" />
          <Text style={styles.typingText}>{typingUser} is typing...</Text>
        </View>
      )}

      {/* Messages Viewport */}
      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#6B2FA0" />
        </View>
      ) : (
        <FlatList
          data={invertedMessages}
          keyExtractor={(item) => String(item.id)}
          inverted
          contentContainerStyle={styles.messagesList}
          renderItem={({ item }) => {
            const isSelf = item.is_self || item.sender_id === currentProfileId;

            return (
              <TouchableOpacity
                activeOpacity={0.8}
                onLongPress={() => {
                  setSelectedMsg(item);
                  setMenuVisible(true);
                }}
                style={[
                  styles.messageRow,
                  isSelf ? styles.selfRow : styles.otherRow,
                ]}
              >
                <View
                  style={[
                    styles.bubble,
                    isSelf ? styles.selfBubble : styles.otherBubble,
                    item.is_deleted && styles.deletedBubble,
                  ]}
                >
                  {/* Attachment image if present */}
                  {item.attachments && item.attachments.length > 0 && !item.is_deleted && (
                    <Image
                      source={{ uri: item.attachments[0].file_url }}
                      style={styles.attachmentImage}
                      contentFit="cover"
                    />
                  )}

                  {/* Message text */}
                  {item.content ? (
                    <Text
                      style={[
                        styles.messageText,
                        isSelf ? styles.selfText : styles.otherText,
                        item.is_deleted && styles.deletedText,
                      ]}
                    >
                      {item.content}
                    </Text>
                  ) : null}

                  {/* Timestamp & Delivery status */}
                  <View style={styles.metaRow}>
                    <Text
                      style={[
                        styles.timeText,
                        isSelf ? styles.selfTimeText : styles.otherTimeText,
                      ]}
                    >
                      {new Date(item.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                    {isSelf && (
                      <Text
                        style={[
                          styles.statusTick,
                          item.status === 'READ' && styles.readTick,
                        ]}
                      >
                        {item.status === 'READ' ? '✓✓' : item.status === 'DELIVERED' ? '✓✓' : '✓'}
                      </Text>
                    )}
                  </View>

                  {/* Reactions Display */}
                  {item.reactions && item.reactions.length > 0 && (
                    <View style={styles.reactionsRow}>
                      {item.reactions.map((r, i) => (
                        <View
                          key={i}
                          style={[
                            styles.reactionBadge,
                            r.reacted_by_self && styles.reactedSelfBadge,
                          ]}
                        >
                          <Text style={styles.reactionEmoji}>
                            {r.emoji} {r.count > 1 ? r.count : ''}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Message Options / Reaction Menu Modal */}
      {selectedMsg && (
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={{ x: 100, y: 300 }}
        >
          <View style={styles.emojiPickerRow}>
            {REACTION_EMOJIS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={styles.emojiBtn}
                onPress={() => handleToggleReaction(emoji)}
              >
                <Text style={styles.emojiPickText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Menu.Item onPress={handleCopyMessage} title="Copy" leadingIcon="content-copy" />
          {(selectedMsg.is_self || selectedMsg.sender_id === currentProfileId) && (
            <Menu.Item
              onPress={handleDeleteMessage}
              title="Delete Message"
              leadingIcon="delete"
              titleStyle={{ color: '#DC2626' }}
            />
          )}
        </Menu>
      )}

      {/* Bottom Composer Bar */}
      <View style={styles.composerBar}>
        <IconButton
          icon="paperclip"
          iconColor="#6B2FA0"
          size={24}
          onPress={handlePickAttachment}
          disabled={isSending}
        />

        <TextInput
          placeholder="Type a message..."
          value={inputContent}
          onChangeText={handleInputChange}
          multiline
          style={styles.textInput}
          mode="outlined"
          outlineColor="#E5E7EB"
          activeOutlineColor="#6B2FA0"
          dense
        />

        <IconButton
          icon="send"
          iconColor="#FFFFFF"
          size={22}
          containerColor="#6B2FA0"
          onPress={handleSend}
          disabled={!inputContent.trim() || isSending}
        />
      </View>

      {/* Colleague Information Sheet */}
      <ColleagueProfileSheet
        visible={profileVisible}
        onClose={() => setProfileVisible(false)}
        employee={conversation.other_member || null}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: '#6B2FA0',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 36,
    paddingBottom: 8,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  avatarBox: {
    position: 'relative',
    marginRight: 10,
  },
  headerAvatar: {
    backgroundColor: '#8B5CF6',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  headerTextCol: {
    flex: 1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerStatus: {
    color: '#E9D5FF',
    fontSize: 11,
    marginTop: 1,
  },
  typingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#FAF5FF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9D5FF',
  },
  typingText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#6B2FA0',
    fontStyle: 'italic',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  messageRow: {
    marginVertical: 4,
    flexDirection: 'row',
  },
  selfRow: {
    justifyContent: 'flex-end',
  },
  otherRow: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  selfBubble: {
    backgroundColor: '#6B2FA0',
    borderBottomRightRadius: 2,
  },
  otherBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  deletedBubble: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  attachmentImage: {
    width: 220,
    height: 160,
    borderRadius: 8,
    marginBottom: 6,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  selfText: {
    color: '#FFFFFF',
  },
  otherText: {
    color: '#1F2937',
  },
  deletedText: {
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  timeText: {
    fontSize: 10,
  },
  selfTimeText: {
    color: '#E9D5FF',
  },
  otherTimeText: {
    color: '#9CA3AF',
  },
  statusTick: {
    fontSize: 10,
    marginLeft: 4,
    color: '#E9D5FF',
  },
  readTick: {
    color: '#38BDF8',
    fontWeight: 'bold',
  },
  reactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 4,
  },
  reactionBadge: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  reactedSelfBadge: {
    backgroundColor: 'rgba(107, 47, 160, 0.2)',
  },
  reactionEmoji: {
    fontSize: 12,
  },
  emojiPickerRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  emojiBtn: {
    padding: 6,
  },
  emojiPickText: {
    fontSize: 22,
  },
  composerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  textInput: {
    flex: 1,
    maxHeight: 100,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 4,
    fontSize: 14,
  },
});
