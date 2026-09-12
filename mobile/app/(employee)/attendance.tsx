import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Text, Card, IconButton, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import { useAuthStore } from '../../src/store/authStore';
import { getMonthlyAttendance } from '../../src/api/attendanceApi';
import { MonthlyAttendanceDay } from '../../src/types/employee';

const { width } = Dimensions.get('window');
const CELL_SIZE = (width - 48) / 7;

export default function AttendanceScreen() {
  const { getToken } = useAuth();
  const profile = useAuthStore((state) => state.profile);

  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1); // 1-indexed
  const [selectedDay, setSelectedDay] = useState<MonthlyAttendanceDay | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['attendance-month', profile?.id, currentYear, currentMonth],
    queryFn: async () => {
      const token = await getToken();
      if (!token || !profile?.id) return { days: [], present_count: 0, absent_count: 0 };
      return getMonthlyAttendance(profile.id, currentYear, currentMonth, token);
    },
    enabled: !!profile?.id,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
    setSelectedDay(null);
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
    setSelectedDay(null);
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  // Calendar math
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth - 1, 1).getDay(); // 0 is Sunday

  const daysMap = new Map<number, MonthlyAttendanceDay>();
  if (data?.days) {
    data.days.forEach((d) => {
      const dayNum = parseInt(d.date.split('-')[2], 10);
      daysMap.set(dayNum, d);
    });
  }

  const presentCount = data?.present_count ?? 0;
  const totalMarked = daysInMonth;
  const absentCount = Math.max(0, totalMarked - presentCount);
  const presentPct = totalMarked > 0 ? Math.round((presentCount / totalMarked) * 100) : 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Attendance Calendar</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Month Navigation Banner */}
        <View style={styles.monthBanner}>
          <IconButton icon="chevron-left" size={26} iconColor="#6B2FA0" onPress={handlePrevMonth} />
          <Text style={styles.monthText}>
            {monthNames[currentMonth - 1]} {currentYear}
          </Text>
          <IconButton icon="chevron-right" size={26} iconColor="#6B2FA0" onPress={handleNextMonth} />
        </View>

        {/* Ratio & Summary Cards */}
        <View style={styles.summaryRow}>
          <Card style={[styles.summaryCard, styles.presentBorder]}>
            <Card.Content style={styles.summaryContent}>
              <Text style={styles.summaryNum}>{presentCount}</Text>
              <Text style={styles.summaryLabel}>Days Present</Text>
            </Card.Content>
          </Card>

          <Card style={[styles.summaryCard, styles.absentBorder]}>
            <Card.Content style={styles.summaryContent}>
              <Text style={styles.summaryNum}>{absentCount}</Text>
              <Text style={styles.summaryLabel}>Days Absent / Off</Text>
            </Card.Content>
          </Card>
        </View>

        {/* Attendance Ratio Bar */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.ratioHeader}>
              <Text style={styles.ratioLabel}>Monthly Presence Ratio</Text>
              <Text style={styles.ratioValue}>{presentPct}%</Text>
            </View>
            <View style={styles.ratioBarBg}>
              <View style={[styles.ratioBarFill, { width: `${presentPct}%` }]} />
            </View>
          </Card.Content>
        </Card>

        {/* Calendar Grid Card */}
        <Card style={styles.card}>
          <Card.Content>
            {/* Weekday labels */}
            <View style={styles.weekdayRow}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <Text key={d} style={styles.weekdayText}>
                  {d}
                </Text>
              ))}
            </View>

            {isLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color="#6B2FA0" />
              </View>
            ) : (
              <View style={styles.grid}>
                {/* Empty cells before month start */}
                {Array.from({ length: firstDayIndex }).map((_, i) => (
                  <View key={`empty-${i}`} style={styles.cell} />
                ))}

                {/* Days of month */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const dayData = daysMap.get(dayNum);
                  const isPresent = dayData?.status === 'PRESENT';
                  const isSelected =
                    selectedDay && parseInt(selectedDay.date.split('-')[2], 10) === dayNum;

                  return (
                    <TouchableOpacity
                      key={`day-${dayNum}`}
                      style={[
                        styles.cell,
                        isPresent ? styles.presentCell : styles.absentCell,
                        isSelected && styles.selectedCell,
                      ]}
                      onPress={() => {
                        if (dayData) {
                          setSelectedDay(dayData);
                        } else {
                          setSelectedDay({
                            date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`,
                            status: 'UNMARKED',
                          });
                        }
                      }}
                    >
                      <Text
                        style={[
                          styles.cellText,
                          isPresent && styles.presentCellText,
                          isSelected && styles.selectedCellText,
                        ]}
                      >
                        {dayNum}
                      </Text>
                      <View
                        style={[
                          styles.dot,
                          { backgroundColor: isPresent ? '#22C55E' : '#EF4444' },
                        ]}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Selected Day Details Card */}
        {selectedDay && (
          <Card style={[styles.card, styles.detailCard]}>
            <Card.Title
              title={`Details for ${selectedDay.date}`}
              left={(props) => (
                <IconButton
                  {...props}
                  icon={selectedDay.status === 'PRESENT' ? 'check-circle' : 'close-circle'}
                  iconColor={selectedDay.status === 'PRESENT' ? '#22C55E' : '#EF4444'}
                />
              )}
            />
            <Card.Content>
              <Text style={styles.detailText}>
                Status:{' '}
                <Text
                  style={{
                    fontWeight: 'bold',
                    color: selectedDay.status === 'PRESENT' ? '#22C55E' : '#EF4444',
                  }}
                >
                  {selectedDay.status}
                </Text>
              </Text>
              {selectedDay.check_in_time && (
                <Text style={styles.detailText}>
                  Check-In: {selectedDay.check_in_time}
                </Text>
              )}
              {selectedDay.check_out_time && (
                <Text style={styles.detailText}>
                  Check-Out: {selectedDay.check_out_time}
                </Text>
              )}
              {selectedDay.total_hours !== undefined && (
                <Text style={styles.detailText}>
                  Duty Duration: {selectedDay.total_hours.toFixed(1)} hrs
                </Text>
              )}
            </Card.Content>
          </Card>
        )}
      </ScrollView>
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
    paddingBottom: 32,
  },
  monthBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 16,
    elevation: 2,
  },
  monthText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 4,
    borderRadius: 12,
    elevation: 2,
  },
  presentBorder: {
    borderLeftWidth: 4,
    borderLeftColor: '#22C55E',
  },
  absentBorder: {
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  summaryContent: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  summaryNum: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
  },
  ratioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  ratioLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  ratioValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6B2FA0',
  },
  ratioBarBg: {
    height: 10,
    backgroundColor: '#E5E7EB',
    borderRadius: 5,
    overflow: 'hidden',
  },
  ratioBarFill: {
    height: '100%',
    backgroundColor: '#22C55E',
    borderRadius: 5,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  weekdayText: {
    width: CELL_SIZE,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6B7280',
  },
  loadingBox: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginVertical: 2,
  },
  presentCell: {
    backgroundColor: '#DCFCE7',
  },
  absentCell: {
    backgroundColor: '#FEE2E2',
  },
  selectedCell: {
    borderColor: '#6B2FA0',
    borderWidth: 2,
  },
  cellText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  presentCellText: {
    color: '#166534',
  },
  selectedCellText: {
    color: '#6B2FA0',
    fontWeight: 'bold',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 2,
  },
  detailCard: {
    borderTopWidth: 3,
    borderTopColor: '#6B2FA0',
  },
  detailText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 6,
  },
});
