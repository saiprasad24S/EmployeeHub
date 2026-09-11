import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import {
  Text,
  Searchbar,
  Avatar,
  Chip,
  Divider,
  ActivityIndicator,
  Button,
} from 'react-native-paper';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import {
  getConversations,
  searchEmployees,
  startConversation,
  sendPresencePing,
} from '../../api/chatApi';
import { ConversationItem, EmployeeSearchResult } from '../../types/chat';

interface ConversationListProps {
  onSelectConversation: (convo: ConversationItem) => void;
}

export default function ConversationList({ onSelectConversation }: ConversationListProps) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'ALL' | 'UNREAD' | 'ONLINE'>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  // Presence heartbeat every 45 seconds
  useEffect(() => {
    let timer: any;
    const ping = async () => {
      try {
        const token = await getToken();
        if (token) await sendPresencePing(token);
      } catch {}
    };
    ping();
    timer = setInterval(ping, 45000);
    return () => clearInterval(timer);
  }, [getToken]);

  // Conversations query
  const { data: conversations = [], isLoading, refetch } = useQuery({
    queryKey: ['chat-conversations'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) return [];
      return getConversations(token);
    },
    refetchInterval: 5000,
  });

  // Employee search query (active when searchQuery has text)
  const { data: searchResults = [], isFetching: isSearching } = useQuery({
    queryKey: ['employee-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const token = await getToken();
      if (!token) return [];
      return searchEmployees(searchQuery.trim(), token);
    },
    enabled: searchQuery.trim().length > 0,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleStartChatWith = async (emp: EmployeeSearchResult) => {
    try {
      const token = await getToken();
      if (!token) return;
      const convo = await startConversation(emp.id, token);
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      onSelectConversation(convo);
      setSearchQuery('');
    } catch (err: any) {
      console.warn('Failed to start conversation', err);
    }
  };

  const filteredConversations = conversations.filter((item) => {
    if (filterTab === 'UNREAD') return item.unread_count > 0;
    if (filterTab === 'ONLINE') return item.other_member?.is_online;
    return true;
  });

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchWrapper}>
        <Searchbar
          placeholder="Search by name or Employee ID..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          inputStyle={styles.searchInput}
          iconColor="#6B2FA0"
        />
      </View>

      {/* Filter Tabs (when not searching) */}
      {!searchQuery.trim() && (
        <View style={styles.filterRow}>
          {(['ALL', 'UNREAD', 'ONLINE'] as const).map((tab) => (
            <Chip
              key={tab}
              selected={filterTab === tab}
              onPress={() => setFilterTab(tab)}
              style={[styles.filterChip, filterTab === tab && styles.activeChip]}
              textStyle={filterTab === tab ? styles.activeChipText : styles.chipText}
            >
              {tab === 'UNREAD'
                ? `Unread (${conversations.filter((c) => c.unread_count > 0).length})`
                : tab}
            </Chip>
          ))}
        </View>
      )}

      {/* If Searching, show directory search results */}
      {searchQuery.trim() ? (
        <View style={styles.listContainer}>
          <Text style={styles.sectionHeader}>Colleague Search Results</Text>
          {isSearching ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="small" color="#6B2FA0" />
            </View>
          ) : searchResults.length === 0 ? (
            <View style={styles.centerBox}>
              <Text style={styles.emptyText}>No employees found matching "{searchQuery}"</Text>
            </View>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => String(item.id)}
              ItemSeparatorComponent={Divider}
              renderItem={({ item }) => (
                <View style={styles.searchItemRow}>
                  <View style={styles.avatarBox}>
                    <Avatar.Text
                      size={46}
                      label={(item.name || 'User').substring(0, 2).toUpperCase()}
                      style={styles.avatar}
                    />
                    {item.is_online && <View style={styles.onlineBadge} />}
                  </View>
                  <View style={styles.searchInfo}>
                    <Text style={styles.searchName}>{item.name}</Text>
                    <Text style={styles.searchSub}>
                      {item.designation || 'Staff'} • {item.department}
                    </Text>
                    <Text style={styles.searchId}>ID: {item.employee_id}</Text>
                  </View>
                  <Button
                    mode="contained"
                    compact
                    buttonColor="#6B2FA0"
                    onPress={() => handleStartChatWith(item)}
                  >
                    Chat
                  </Button>
                </View>
              )}
            />
          )}
        </View>
      ) : (
        /* Conversation Inbox */
        <View style={styles.listContainer}>
          {isLoading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color="#6B2FA0" />
            </View>
          ) : filteredConversations.length === 0 ? (
            <View style={styles.centerBox}>
              <Text style={styles.emptyText}>No conversations yet.</Text>
              <Text style={styles.emptySub}>Search for a colleague above to start messaging.</Text>
            </View>
          ) : (
            <FlatList
              data={filteredConversations}
              keyExtractor={(item) => String(item.id)}
              ItemSeparatorComponent={Divider}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              renderItem={({ item }) => {
                const isGroup = item.type === 'GROUP';
                const title = isGroup ? item.group_name || 'Group Chat' : item.other_member?.name || 'Colleague';
                const isOnline = item.other_member?.is_online;
                const unread = item.unread_count > 0;
                const lastMsg = item.last_message;

                return (
                  <TouchableOpacity
                    style={[styles.convoRow, unread && styles.unreadConvoRow]}
                    onPress={() => onSelectConversation(item)}
                  >
                    <View style={styles.avatarBox}>
                      <Avatar.Text
                        size={50}
                        label={title.substring(0, 2).toUpperCase()}
                        style={styles.avatar}
                      />
                      {!isGroup && isOnline && <View style={styles.onlineBadge} />}
                    </View>

                    <View style={styles.convoCenter}>
                      <View style={styles.convoTop}>
                        <Text style={[styles.convoName, unread && styles.boldText]} numberOfLines={1}>
                          {title}
                        </Text>
                        {lastMsg && (
                          <Text style={styles.convoTime}>
                            {new Date(lastMsg.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Text>
                        )}
                      </View>

                      <View style={styles.convoBottom}>
                        <Text
                          style={[styles.convoSnippet, unread && styles.boldSnippet]}
                          numberOfLines={1}
                        >
                          {lastMsg ? lastMsg.content : 'No messages yet'}
                        </Text>
                        {unread && (
                          <View style={styles.unreadBadge}>
                            <Text style={styles.unreadBadgeText}>{item.unread_count}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  searchWrapper: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchBar: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    elevation: 0,
    height: 46,
  },
  searchInput: {
    fontSize: 14,
    minHeight: 0,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 8,
  },
  filterChip: {
    backgroundColor: '#F3F4F6',
    height: 32,
  },
  activeChip: {
    backgroundColor: '#6B2FA0',
  },
  chipText: {
    fontSize: 12,
    color: '#4B5563',
  },
  activeChipText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  listContainer: {
    flex: 1,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#4B5563',
    fontWeight: '600',
  },
  emptySub: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 6,
    textAlign: 'center',
  },
  avatarBox: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    backgroundColor: '#6B2FA0',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  searchItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  searchInfo: {
    flex: 1,
    marginRight: 8,
  },
  searchName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  searchSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  searchId: {
    fontSize: 11,
    color: '#6B2FA0',
    fontWeight: '600',
    marginTop: 2,
  },
  convoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#FFFFFF',
  },
  unreadConvoRow: {
    backgroundColor: '#FAF5FF',
  },
  convoCenter: {
    flex: 1,
  },
  convoTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  convoName: {
    fontSize: 16,
    color: '#1F2937',
    flex: 1,
    marginRight: 8,
  },
  boldText: {
    fontWeight: 'bold',
    color: '#6B2FA0',
  },
  convoTime: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  convoBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  convoSnippet: {
    fontSize: 13,
    color: '#6B7280',
    flex: 1,
    marginRight: 8,
  },
  boldSnippet: {
    fontWeight: '600',
    color: '#1F2937',
  },
  unreadBadge: {
    backgroundColor: '#6B2FA0',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
