import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Modal,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  Text,
  Card,
  Button,
  FAB,
  TextInput,
  Chip,
  ActivityIndicator,
  IconButton,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import { getMyLeaves, getLeaveSummary, applyLeave, ApplyLeavePayload } from '../../src/api/leaveApi';
import { LeaveRequest } from '../../src/types/employee';

const LEAVE_TYPES = [
  { label: 'Casual Leave', value: 'CASUAL' },
  { label: 'Sick Leave', value: 'SICK' },
  { label: 'Maternity/Paternity', value: 'MATERNITY_PATERNITY' },
  { label: 'Bereavement', value: 'BEREAVEMENT' },
  { label: 'Unpaid Leave', value: 'UNPAID' },
] as const;

export default function LeavesScreen() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [modalVisible, setModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Apply Leave form state
  const [leaveType, setLeaveType] = useState<ApplyLeavePayload['leave_type']>('CASUAL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  // Leaves query
  const { data: leaves = [], isLoading, refetch } = useQuery({
    queryKey: ['my-leaves'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) return [];
      return getMyLeaves(token);
    },
  });

  // Summary query
  const { data: summary, refetch: refetchSummary } = useQuery({
    queryKey: ['leaves-summary'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) return { pending: 0, approved: 0, rejected: 0, total: 0 };
      return getLeaveSummary(token);
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchSummary()]);
    setRefreshing(false);
  };

  const applyMutation = useMutation({
    mutationFn: async (payload: ApplyLeavePayload) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return applyLeave(payload, token);
    },
    onSuccess: () => {
      Alert.alert('Leave Applied', 'Your leave request has been submitted for approval.');
      setModalVisible(false);
      setStartDate('');
      setEndDate('');
      setReason('');
      queryClient.invalidateQueries({ queryKey: ['my-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['leaves-summary'] });
    },
    onError: (err: any) => {
      Alert.alert('Submission Failed', err.detail || err.message || 'Failed to submit leave.');
    },
  });

  const handleApply = () => {
    if (!startDate || !endDate || !reason.trim()) {
      Alert.alert('Required Fields', 'Please fill in start date, end date, and reason.');
      return;
    }
    applyMutation.mutate({
      leave_type: leaveType,
      start_date: startDate.trim(),
      end_date: endDate.trim(),
      reason: reason.trim(),
    });
  };

  const filteredLeaves = leaves.filter((item) => {
    if (activeTab === 'ALL') return true;
    return item.status === activeTab;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return '#22C55E';
      case 'REJECTED':
        return '#EF4444';
      default:
        return '#F59E0B';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Leave Management</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Summary Metric Cards */}
        <View style={styles.summaryGrid}>
          <Card style={styles.metricCard}>
            <Card.Content style={styles.metricContent}>
              <Text style={styles.metricNum}>{summary?.total ?? leaves.length}</Text>
              <Text style={styles.metricLabel}>Total</Text>
            </Card.Content>
          </Card>
          <Card style={styles.metricCard}>
            <Card.Content style={styles.metricContent}>
              <Text style={[styles.metricNum, { color: '#F59E0B' }]}>
                {summary?.pending ?? leaves.filter((l) => l.status === 'PENDING').length}
              </Text>
              <Text style={styles.metricLabel}>Pending</Text>
            </Card.Content>
          </Card>
          <Card style={styles.metricCard}>
            <Card.Content style={styles.metricContent}>
              <Text style={[styles.metricNum, { color: '#22C55E' }]}>
                {summary?.approved ?? leaves.filter((l) => l.status === 'APPROVED').length}
              </Text>
              <Text style={styles.metricLabel}>Approved</Text>
            </Card.Content>
          </Card>
          <Card style={styles.metricCard}>
            <Card.Content style={styles.metricContent}>
              <Text style={[styles.metricNum, { color: '#EF4444' }]}>
                {summary?.rejected ?? leaves.filter((l) => l.status === 'REJECTED').length}
              </Text>
              <Text style={styles.metricLabel}>Rejected</Text>
            </Card.Content>
          </Card>
        </View>

        {/* Filter Tabs */}
        <View style={styles.tabRow}>
          {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((tab) => (
            <Chip
              key={tab}
              selected={activeTab === tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tabChip, activeTab === tab && styles.activeChip]}
              textStyle={activeTab === tab ? styles.activeChipText : styles.chipText}
            >
              {tab}
            </Chip>
          ))}
        </View>

        {/* Leaves List */}
        {isLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#6B2FA0" />
          </View>
        ) : filteredLeaves.length === 0 ? (
          <View style={styles.centerBox}>
            <Text style={styles.emptyText}>No leave requests found.</Text>
          </View>
        ) : (
          filteredLeaves.map((item) => (
            <Card key={item.id} style={styles.leaveCard}>
              <Card.Content>
                <View style={styles.cardHeader}>
                  <Text style={styles.leaveType}>{item.leave_type.replace('_', ' ')}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: `${getStatusColor(item.status)}20` },
                    ]}
                  >
                    <Text
                      style={[styles.statusText, { color: getStatusColor(item.status) }]}
                    >
                      {item.status}
                    </Text>
                  </View>
                </View>

                <Text style={styles.dateRange}>
                  {item.start_date} to {item.end_date} ({item.total_days} days)
                </Text>

                <Text style={styles.reasonText}>{item.reason}</Text>

                {item.rejection_reason && (
                  <View style={styles.rejectionBox}>
                    <Text style={styles.rejectionLabel}>Rejection Reason:</Text>
                    <Text style={styles.rejectionText}>{item.rejection_reason}</Text>
                  </View>
                )}
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <FAB
        icon="plus"
        label="Apply Leave"
        style={styles.fab}
        color="#FFFFFF"
        onPress={() => setModalVisible(true)}
      />

      {/* Apply Leave Modal */}
      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Apply for Leave</Text>
            <IconButton icon="close" size={24} iconColor="#FFFFFF" onPress={() => setModalVisible(false)} />
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.label}>Leave Type</Text>
            <View style={styles.typeRow}>
              {LEAVE_TYPES.map((t) => (
                <Chip
                  key={t.value}
                  selected={leaveType === t.value}
                  onPress={() => setLeaveType(t.value)}
                  style={[styles.typeChip, leaveType === t.value && styles.activeChip]}
                  textStyle={leaveType === t.value ? styles.activeChipText : styles.chipText}
                >
                  {t.label}
                </Chip>
              ))}
            </View>

            <TextInput
              label="Start Date (YYYY-MM-DD)"
              value={startDate}
              onChangeText={setStartDate}
              placeholder="2026-09-15"
              mode="outlined"
              style={styles.input}
            />

            <TextInput
              label="End Date (YYYY-MM-DD)"
              value={endDate}
              onChangeText={setEndDate}
              placeholder="2026-09-17"
              mode="outlined"
              style={styles.input}
            />

            <TextInput
              label="Reason for Leave"
              value={reason}
              onChangeText={setReason}
              placeholder="Brief explanation of your leave request"
              mode="outlined"
              multiline
              numberOfLines={4}
              style={styles.input}
            />

            <Button
              mode="contained"
              buttonColor="#6B2FA0"
              textColor="#FFFFFF"
              onPress={handleApply}
              loading={applyMutation.isPending}
              disabled={applyMutation.isPending}
              style={styles.submitBtn}
              labelStyle={{ fontSize: 15, fontWeight: '700' }}
            >
              Submit Leave Request
            </Button>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: '#6B2FA0',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 3,
    borderRadius: 10,
    elevation: 2,
  },
  metricContent: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  metricNum: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  metricLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  tabRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  tabChip: {
    backgroundColor: '#FFFFFF',
    elevation: 1,
  },
  activeChip: {
    backgroundColor: '#6B2FA0',
  },
  chipText: {
    fontSize: 11,
    color: '#4B5563',
  },
  activeChipText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  leaveCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leaveType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  dateRange: {
    fontSize: 13,
    color: '#6B2FA0',
    fontWeight: '600',
    marginTop: 4,
  },
  reasonText: {
    fontSize: 13,
    color: '#4B5563',
    marginTop: 6,
  },
  rejectionBox: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
  },
  rejectionLabel: {
    fontSize: 11,
    color: '#991B1B',
    fontWeight: 'bold',
  },
  rejectionText: {
    fontSize: 12,
    color: '#7F1D1D',
    marginTop: 2,
  },
  centerBox: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 15,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 12,
    backgroundColor: '#6B2FA0',
    borderRadius: 16,
    elevation: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  modalHeader: {
    backgroundColor: '#6B2FA0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 10,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalContent: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  typeChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  submitBtn: {
    marginTop: 8,
    paddingVertical: 6,
    borderRadius: 12,
    elevation: 2,
  },
});
