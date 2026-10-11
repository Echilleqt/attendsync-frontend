import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Filter,
  RotateCw,
  ShieldCheck,
  X,
} from 'lucide-react-native';
import {apiRequest} from '../api/client';
import {
  formatAttendanceDate,
  formatAttendanceDateTime,
  formatAttendanceTime,
} from '../utils/attendanceFormat';
import COLORS from '../theme/colors';
import AppHeader from '../components/AppHeader';
import StatusBadge from '../components/StatusBadge';
import Banner from '../components/Banner';

const RANGE_OPTIONS = [
  {id: 'this_week', label: 'This Week'},
  {id: 'this_month', label: 'This Month'},
  {id: 'all', label: 'All Records'},
];

const STATUS_FILTERS = [
  {id: 'all', label: 'All'},
  {id: 'present', label: 'On Time'},
  {id: 'late', label: 'Late'},
  {id: 'absent', label: 'Absent'},
  {id: 'on_leave', label: 'On Leave'},
];

export default function AttendanceHistoryScreen({navigation, token}) {
  const insets = useSafeAreaInsets();
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter States
  const [selectedRange, setSelectedRange] = useState('this_month');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Detail Modal State
  const [selectedRecord, setSelectedRecord] = useState(null);

  const fetchHistory = useCallback(async () => {
    if (!token) {
      setRecords([]);
      setSummary(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const queryParams = new URLSearchParams();
      if (selectedRange !== 'all') {
        queryParams.append('range', selectedRange);
      }
      if (selectedStatus !== 'all') {
        queryParams.append('status', selectedStatus);
      }

      const queryString = queryParams.toString();
      const path = `/attendance/history${queryString ? `?${queryString}` : ''}`;
      const response = await apiRequest(path, token);

      if (!response.success) {
        throw new Error(response.message || 'Unable to load attendance history.');
      }

      setRecords(response.records || []);
      setSummary(response.summary || null);
    } catch (err) {
      setError(err.message || 'Unable to connect to the attendance service.');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [token, selectedRange, selectedStatus]);

  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [fetchHistory]),
  );

  return (
    <View style={styles.container}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          {paddingBottom: Math.max(insets.bottom, 16) + 32},
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchHistory}
            progressViewOffset={70}
            tintColor={COLORS.white}
            colors={[COLORS.blue]}
          />
        }
      >
        {/* Reusable Compact Header with Back Navigation */}
        <AppHeader
          variant="compact"
          title="Attendance History"
          subtitle="Official DepEd Bansud Central School attendance logs"
          schoolName="BANSUD CENTRAL SCHOOL"
          onBack={() => navigation.goBack()}
          rightAction={
            <TouchableOpacity
              onPress={fetchHistory}
              style={styles.refreshIconBtn}
              accessibilityRole="button"
              accessibilityLabel="Refresh attendance history"
              activeOpacity={0.7}
            >
              <RotateCw size={16} color={COLORS.white} strokeWidth={2.4} />
            </TouchableOpacity>
          }
        />

        <View style={styles.body}>
          {/* Range Filter Segmented Control */}
          <View style={styles.filterCard}>
            <View style={styles.rangeTabs}>
              {RANGE_OPTIONS.map(opt => {
                const isActive = selectedRange === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.rangeTab, isActive && styles.rangeTabActive]}
                    onPress={() => setSelectedRange(opt.id)}
                    activeOpacity={0.8}
                    accessibilityRole="tab"
                    accessibilityState={{selected: isActive}}
                  >
                    <Text style={[styles.rangeTabText, isActive && styles.rangeTabTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Status Filter Horizontal Pills */}
            <View style={styles.statusFilterRow}>
              <View style={styles.filterIconLabel}>
                <Filter size={13} color={COLORS.muted} strokeWidth={2.4} />
                <Text style={styles.filterLabel}>Status:</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.statusScroll}
              >
                {STATUS_FILTERS.map(st => {
                  const isStActive = selectedStatus === st.id;
                  return (
                    <TouchableOpacity
                      key={st.id}
                      style={[styles.statusPill, isStActive && styles.statusPillActive]}
                      onPress={() => setSelectedStatus(st.id)}
                      activeOpacity={0.75}
                      accessibilityRole="radio"
                      accessibilityState={{selected: isStActive}}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          isStActive && styles.statusPillTextActive,
                        ]}
                      >
                        {st.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>

          {/* Compact Summary Statistics Card */}
          {summary ? (
            <View style={styles.summaryCard}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{summary.total || 0}</Text>
                <Text style={styles.summaryLabel}>Total Days</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, {color: COLORS.green}]}>
                  {summary.present || 0}
                </Text>
                <Text style={styles.summaryLabel}>On Time</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, {color: COLORS.amber}]}>
                  {summary.late || 0}
                </Text>
                <Text style={styles.summaryLabel}>Late</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, {color: COLORS.red}]}>
                  {summary.absent || 0}
                </Text>
                <Text style={styles.summaryLabel}>Absent</Text>
              </View>
            </View>
          ) : null}

          {/* Error Banner */}
          {error ? (
            <Banner
              type="error"
              message={error}
              actionText="Retry"
              onAction={fetchHistory}
            />
          ) : null}

          {/* Records List Heading */}
          <View style={styles.listHeadingRow}>
            <Text style={styles.listHeadingTitle}>Attendance Records</Text>
            <Text style={styles.listHeadingCount}>
              {records.length} {records.length === 1 ? 'record' : 'records'}
            </Text>
          </View>

          {/* List Content */}
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={COLORS.blue} />
              <Text style={styles.loadingText}>Loading attendance records...</Text>
            </View>
          ) : records.length > 0 ? (
            records.map(rec => {
              const displayDate = formatAttendanceDate(rec.attendance_date);
              const displayTimeIn = formatAttendanceTime(rec.time_in);
              const displayTimeOut = formatAttendanceTime(rec.time_out);

              return (
                <TouchableOpacity
                  key={rec.id}
                  style={styles.recordItem}
                  onPress={() => setSelectedRecord(rec)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                >
                  <View style={styles.recordMain}>
                    <View style={styles.recordDateRow}>
                      <Text style={styles.recordDate}>{displayDate}</Text>
                      <StatusBadge status={rec.status} size="sm" />
                    </View>

                    <View style={styles.recordTimeGrid}>
                      <View style={styles.timeCol}>
                        <Text style={styles.timeColLabel}>TIME IN</Text>
                        <Text style={styles.timeColValue}>
                          {displayTimeIn || 'Not recorded'}
                        </Text>
                        {rec.time_in_verification_method ? (
                          <Text style={styles.timeMethod}>
                            via {rec.time_in_verification_method}
                          </Text>
                        ) : null}
                      </View>

                      <View style={styles.timeCol}>
                        <Text style={styles.timeColLabel}>TIME OUT</Text>
                        <Text style={styles.timeColValue}>
                          {displayTimeOut || 'Not recorded'}
                        </Text>
                        {rec.time_out_verification_method ? (
                          <Text style={styles.timeMethod}>
                            via {rec.time_out_verification_method}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </View>

                  <View style={styles.recordChevronBox}>
                    <ChevronRight size={18} color="#9AA7B8" />
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconCircle}>
                <Calendar size={28} color={COLORS.muted} strokeWidth={2} />
              </View>
              <Text style={styles.emptyTitle}>No Records Found</Text>
              <Text style={styles.emptyDescription}>
                No official attendance records match the selected date range or status filter.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Record Details Modal */}
      {selectedRecord ? (
        <Modal
          visible={Boolean(selectedRecord)}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedRecord(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleBox}>
                  <Text style={styles.modalEyebrow}>RECORD DETAILS</Text>
                  <Text style={styles.modalTitle}>
                    {formatAttendanceDate(selectedRecord.attendance_date)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setSelectedRecord(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Close record details"
                >
                  <X size={18} color={COLORS.navy} strokeWidth={2.4} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBadgeRow}>
                <StatusBadge status={selectedRecord.status} />
                <View style={styles.verifiedServerTag}>
                  <ShieldCheck size={13} color={COLORS.blue} strokeWidth={2.4} />
                  <Text style={styles.verifiedServerText}>Server Verified</Text>
                </View>
              </View>

              <View style={styles.modalDetailsList}>
                <View style={styles.modalDetailRow}>
                  <View style={styles.modalDetailIcon}>
                    <Clock3 size={16} color={COLORS.green} strokeWidth={2.2} />
                  </View>
                  <View style={styles.modalDetailCopy}>
                    <Text style={styles.modalDetailLabel}>Official Time In</Text>
                    <Text style={styles.modalDetailValue}>
                      {selectedRecord.time_in
                        ? formatAttendanceDateTime(selectedRecord.time_in)
                        : 'No Time In recorded'}
                    </Text>
                    {selectedRecord.time_in_verification_method ? (
                      <Text style={styles.modalDetailSub}>
                        Verification: {selectedRecord.time_in_verification_method === 'face' ? 'Face Recognition' : 'Fingerprint Keystore'}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.modalDetailRow}>
                  <View style={styles.modalDetailIcon}>
                    <Clock3 size={16} color={COLORS.blue} strokeWidth={2.2} />
                  </View>
                  <View style={styles.modalDetailCopy}>
                    <Text style={styles.modalDetailLabel}>Official Time Out</Text>
                    <Text style={styles.modalDetailValue}>
                      {selectedRecord.time_out
                        ? formatAttendanceDateTime(selectedRecord.time_out)
                        : 'No Time Out recorded'}
                    </Text>
                    {selectedRecord.time_out_verification_method ? (
                      <Text style={styles.modalDetailSub}>
                        Verification: {selectedRecord.time_out_verification_method === 'face' ? 'Face Recognition' : 'Fingerprint Keystore'}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {selectedRecord.late_starting_time_snapshot ? (
                  <View style={styles.modalNoticeBox}>
                    <Text style={styles.modalNoticeLabel}>DepEd Late Threshold:</Text>
                    <Text style={styles.modalNoticeValue}>
                      {selectedRecord.late_starting_time_snapshot} (PHT)
                    </Text>
                  </View>
                ) : null}
              </View>

              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setSelectedRecord(null)}
                activeOpacity={0.85}
              >
                <CheckCircle2 size={16} color={COLORS.white} strokeWidth={2.4} />
                <Text style={styles.modalCloseButtonText}>Close Record</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.canvas,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  refreshIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: 20,
    marginTop: -16,
  },
  filterCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    elevation: 3,
    shadowColor: COLORS.navyDark,
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  rangeTabs: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 3,
  },
  rangeTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  rangeTabActive: {
    backgroundColor: COLORS.white,
    elevation: 1,
    shadowColor: COLORS.navyDark,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  rangeTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.muted,
  },
  rangeTabTextActive: {
    color: COLORS.navy,
    fontWeight: '800',
  },
  statusFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  filterIconLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 8,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.muted,
  },
  statusScroll: {
    gap: 6,
    paddingRight: 10,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusPillActive: {
    backgroundColor: COLORS.blueLight,
    borderColor: COLORS.blue,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.muted,
  },
  statusPillTextActive: {
    color: COLORS.blue,
    fontWeight: '800',
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    elevation: 2,
    shadowColor: COLORS.navyDark,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#EDF2F7',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.navy,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.muted,
    marginTop: 2,
  },
  listHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  listHeadingTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.navy,
  },
  listHeadingCount: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.muted,
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.muted,
    marginTop: 10,
  },
  recordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    elevation: 2,
    shadowColor: COLORS.navyDark,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  recordMain: {
    flex: 1,
  },
  recordDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  recordDate: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.navy,
  },
  recordTimeGrid: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    gap: 12,
  },
  timeCol: {
    flex: 1,
  },
  timeColLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.muted,
    letterSpacing: 0.8,
  },
  timeColValue: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 2,
  },
  timeMethod: {
    fontSize: 10,
    color: COLORS.muted,
    marginTop: 2,
  },
  recordChevronBox: {
    paddingLeft: 8,
  },
  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    alignItems: 'center',
    marginTop: 10,
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  emptyDescription: {
    fontSize: 12,
    color: COLORS.muted,
    lineHeight: 18,
    marginTop: 4,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(6, 23, 43, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: 20,
    elevation: 8,
    shadowColor: COLORS.navyDark,
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  modalTitleBox: {
    flex: 1,
  },
  modalEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.muted,
    letterSpacing: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.navy,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    marginBottom: 16,
  },
  verifiedServerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.blueLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  verifiedServerText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.blue,
  },
  modalDetailsList: {
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EDF2F7',
  },
  modalDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  modalDetailIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalDetailCopy: {
    flex: 1,
  },
  modalDetailLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.muted,
    letterSpacing: 0.5,
  },
  modalDetailValue: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 1,
  },
  modalDetailSub: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 2,
  },
  modalNoticeBox: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  modalNoticeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.muted,
  },
  modalNoticeValue: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 1,
  },
  modalCloseButton: {
    height: 48,
    backgroundColor: COLORS.navy,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
  },
  modalCloseButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.white,
  },
});
