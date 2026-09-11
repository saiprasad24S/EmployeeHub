import React, { useState, useEffect } from 'react';
import { StyleSheet, View, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/authStore';
import { useChatStore } from '../../src/store/chatStore';
import ConversationList from '../../src/components/chat/ConversationList';
import ChatWindow from '../../src/components/chat/ChatWindow';
import { ConversationItem } from '../../src/types/chat';

export default function ChatScreen() {
  const [activeConversation, setActiveConversation] = useState<ConversationItem | null>(null);
  const setActiveConversationId = useChatStore((state) => state.setActiveConversation);

  useEffect(() => {
    setActiveConversationId(activeConversation ? activeConversation.id : null);
  }, [activeConversation, setActiveConversationId]);

  // Handle Android back button inside conversation
  useEffect(() => {
    const onBackPress = () => {
      if (activeConversation) {
        setActiveConversation(null);
        return true; // handled
      }
      return false; // let employee tab layout handle it (return to Home)
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [activeConversation]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {activeConversation ? (
        <ChatWindow
          conversation={activeConversation}
          onBack={() => setActiveConversation(null)}
        />
      ) : (
        <ConversationList
          onSelectConversation={(convo) => setActiveConversation(convo)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});
