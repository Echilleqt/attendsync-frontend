import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
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
  ArrowRight,
  CalendarCheck,
  ChevronRight,
  Clock,
  Clock3,
  FileText,
  Fingerprint,
  History,
  ShieldCheck,
  User,
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

export default function DashboardScreen({navigation, token, user, employee}) {
  const insets = useSafeAreaInsets();
  const [attendance, setAttendance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!token) {
      setAttendance(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await apiRequest('/attendance/today', token);
      const saved = result.attendance || null;
      if (saved && (!saved.attendance_date || !saved.time_in || !saved.status)) {
        throw new Error('The server returned an incomplete attendance timestamp.');
      }
      setAttendance(saved);
    } catch (requestError) {
      setError(requestError.message || 'Attendance could not be loaded from the server.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const timeIn = formatAttendanceTime(attendance?.time_in);
  const timeOut = formatAttendanceTime(attendance?.time_out);
  const officialTimeInDateTime = formatAttendanceDateTime(attendance?.time_in);
  const officialTimeOutDateTime = formatAttendanceDateTime(attendance?.time_out);
  const date = formatAttendanceDate(attendance?.attendance_date);

  const displayName =
    employee?.first_name ||
    user?.name?.trim().split(/\s+/)[0] ||
    'Teacher';

  // Determine current attendance state
  const hasTimeIn = Boolean(attendance?.time_in);
  const hasTimeOut = Boolean(attendance?.time_out);

  let stateLabel = 'Not Yet Timed In';
  let badgeStatus = 'not_recorded';
  let badgeLabel = 'Not Recorded';
  let nextActionText = 'Go to Attendance';

  if (hasTimeIn && hasTimeOut) {
    stateLabel = 'Completed';
    badgeStatus = 'approved';
    badgeLabel = 'Completed';
    nextActionText = 'View attendance record';
  } else if (hasTimeIn) {
    stateLabel = attendance?.status === 'late' ? 'Late (In Progress)' : 'In Progress';
    badgeStatus = attendance?.status === 'late' ? 'late' : 'present';
    badgeLabel = attendance?.status === 'late' ? 'Late' : 'On Time';
    nextActionText = 'Record Time Out';
  }

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
            onRefresh={refresh}
            progressViewOffset={80}
            tintColor={COLORS.white}
            colors={[COLORS.blue]}
          />
        }
      >
        {/* Reusable Global Header */}
        <AppHeader
          variant="expanded"
          title="ATTENDSYNC"
          schoolName="BANSUD CENTRAL SCHOOL"
          greeting={`Good day, ${displayName}`}
          subtitle="School Employee Attendance Portal"
          rightAction={
            <TouchableOpacity
              style={styles.avatarButton}
              onPress={() => navigation.navigate('Profile')}
              accessibilityRole="button"
              accessibilityLabel="View profile"
              activeOpacity={0.8}
            >
              <Text style={styles.avatarText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </TouchableOpacity>
          }
        />

        {/* Main Body */}
        <View style={styles.body}>
          {/* Today's Daily Attendance Hero Card */}
          <View style={styles.recordCard}>
            <View style={styles.recordHeading}>
              <View style={styles.recordTitleGroup}>
                <View style={styles.recordIcon}>
                  <Clock size={20} color={COLORS.blue} strokeWidth={2.4} />
                </View>
                <View style={styles.recordTitleCopy}>
                  <Text style={styles.cardEyebrow}>TODAY'S RECORD</Text>
                  <Text style={styles.cardTitle}>Daily Attendance</Text>
                </View>
              </View>
              <StatusBadge
                status={loading ? 'loading' : badgeStatus}
                label={loading ? 'Checking...' : badgeLabel}
              />
            </View>

            {loading ? (
              <ActivityIndicator
                style={styles.loadingIndicator}
                color={COLORS.blue}
                size="large"
              />
            ) : error ? (
              <Banner
                type="error"
                message={error}
                actionText="Try again"
                onAction={refresh}
              />
            ) : hasTimeIn && date ? (
              <View style={styles.timestampBox}>
                <Text style={styles.stateSubtitle}>{stateLabel}</Text>
                <Text style={styles.timeValue}>{timeIn}</Text>
                {officialTimeInDateTime ? (
                  <View style={styles.timestampRow}>
                    <Clock3 size={14} color={COLORS.blue} strokeWidth={2.2} />
                    <Text style={styles.officialTimestamp}>
                      Time In: {officialTimeInDateTime}
                    </Text>
                  </View>
                ) : null}
                {hasTimeOut && (officialTimeOutDateTime || timeOut) ? (
                  <View style={styles.timestampRow}>
                    <Clock3 size={14} color={COLORS.green} strokeWidth={2.2} />
                    <Text style={styles.officialTimeOutTimestamp}>
                      Time Out: {officialTimeOutDateTime || timeOut}
                    </Text>
                  </View>
                ) : null}
                <Text style={styles.dateValue}>{date}</Text>
                <View style={styles.serverNoteRow}>
                  <View style={styles.serverNoteDot} />
                  <Text style={styles.serverNote}>
                    Verified by server • Asia/Manila (Device clock not used)
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.emptyRecord}>
                <View style={styles.emptyIconCircle}>
                  <CalendarCheck size={28} color={COLORS.muted} strokeWidth={2} />
                </View>
                <Text style={styles.emptyTitle}>No Time In recorded today</Text>
                <Text style={styles.emptyDescription}>
                  Complete biometric verification and camera capture to sign in for today's session.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate('Attendance')}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <Text style={styles.primaryButtonText}>
                {nextActionText}
              </Text>
              <ArrowRight size={17} color={COLORS.white} strokeWidth={2.4} />
            </TouchableOpacity>
          </View>

          {/* Quick Access Actions Header */}
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionHeadingTitle}>Quick Access</Text>
            <Text style={styles.sectionHeadingSubtitle}>
              Bansud Central School portal services
            </Text>
          </View>

          {/* Quick Access Action Cards */}
          <View style={styles.actionGrid}>
            {/* 1. Daily Attendance */}
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('Attendance')}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <View style={[styles.actionIconContainer, styles.actionIconNavy]}>
                <Clock3 size={20} color={COLORS.white} strokeWidth={2.2} />
              </View>
              <View style={styles.actionTextContainer}>
                <Text style={styles.actionTitle}>Attendance</Text>
                <Text style={styles.actionDescription}>
                  Daily biometric time in, time out & photo capture
                </Text>
              </View>
              <ChevronRight size={18} color="#9AA7B8" />
            </TouchableOpacity>

            {/* 2. Attendance History */}
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('AttendanceHistory')}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <View style={[styles.actionIconContainer, styles.actionIconBlue]}>
                <History size={20} color={COLORS.blue} strokeWidth={2.2} />
              </View>
              <View style={styles.actionTextContainer}>
                <Text style={styles.actionTitle}>Attendance History</Text>
                <Text style={styles.actionDescription}>
                  View past records, filter by week or month, and statistics
                </Text>
              </View>
              <ChevronRight size={18} color="#9AA7B8" />
            </TouchableOpacity>

            {/* 3. Attendance Correction */}
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('Corrections')}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <View style={[styles.actionIconContainer, styles.actionIconAmber]}>
                <FileText size={20} color={COLORS.amberDark} strokeWidth={2.2} />
              </View>
              <View style={styles.actionTextContainer}>
                <Text style={styles.actionTitle}>Attendance Correction</Text>
                <Text style={styles.actionDescription}>
                  Submit review requests or check administrator approval status
                </Text>
              </View>
              <ChevronRight size={18} color="#9AA7B8" />
            </TouchableOpacity>

            {/* 4. Biometric Security */}
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('Profile')}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <View style={[styles.actionIconContainer, styles.actionIconGreen]}>
                <Fingerprint size={20} color={COLORS.green} strokeWidth={2.2} />
              </View>
              <View style={styles.actionTextContainer}>
                <Text style={styles.actionTitle}>Biometric Security</Text>
                <Text style={styles.actionDescription}>
                  Manage device fingerprint & face recognition models
                </Text>
              </View>
              <ChevronRight size={18} color="#9AA7B8" />
            </TouchableOpacity>

           
            {/* 5. Employee Profile — Full Width */}
            <TouchableOpacity
              style={[styles.actionCard, styles.actionCardFullWidth]}
              onPress={() => navigation.navigate('Profile')}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <View style={[styles.actionIconContainer, styles.actionIconPurple, styles.actionCardFullWidthIcon]}>
                <User size={21} color={COLORS.blueDark} strokeWidth={2.2} />
              </View>

              <View style={styles.actionFullWidthText}>
                <Text style={styles.actionTitle}>Employee Profile & Settings</Text>
                <Text style={styles.actionDescription}>
                  Account details, change password, device info & log out
                </Text>
              </View>

              <ChevronRight size={20} color="#9AA7B8" />
            </TouchableOpacity>
          </View>

          {/* DepEd Institutional Trust Notice */}
          <View style={styles.securityCard}>
            <View style={styles.securityIconBox}>
              <ShieldCheck size={22} color={COLORS.blue} strokeWidth={2.2} />
            </View>
            <View style={styles.securityTextGroup}>
              <Text style={styles.securityTitle}>Official School Records</Text>
              <Text style={styles.securityDescription}>
                Attendance timestamps are authenticated and generated strictly by the DepEd school server (Asia/Manila). Device clock tampering is strictly prevented.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
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
    paddingBottom: 24,
  },

  // Header action
  avatarButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '800',
  },

  // Main content
  body: {
    paddingHorizontal: 16,
    marginTop: -22,
  },

  // Today's attendance card
  recordCard: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E8EEF4',
    elevation: 3,
    shadowColor: COLORS.navyDark,
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.07,
    shadowRadius: 9,
  },
  recordHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  recordIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  recordTitleCopy: {
    flexShrink: 1,
  },
  cardEyebrow: {
    fontSize: 10,
    color: COLORS.muted,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 3,
  },
  cardTitle: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '800',
    letterSpacing: -0.2,
  },

  // Loading and messages
  loadingIndicator: {
    marginVertical: 22,
  },

  // Attendance timestamp panel
  timestampBox: {
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 12,
    marginTop: 14,
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: '#F6F9FC',
    borderWidth: 1,
    borderColor: '#E8EEF4',
  },
  stateSubtitle: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.blue,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  timeValue: {
    fontSize: 32,
    color: COLORS.navy,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 5,
  },
  officialTimestamp: {
    fontSize: 12,
    color: COLORS.navy,
    fontWeight: '700',
    flexShrink: 1,
  },
  officialTimeOutTimestamp: {
    fontSize: 12,
    color: COLORS.greenDark,
    fontWeight: '700',
    flexShrink: 1,
  },
  dateValue: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  serverNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    backgroundColor: '#EDF4FC',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    maxWidth: '100%',
  },
  serverNoteDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.green,
    marginRight: 6,
  },
  serverNote: {
    flexShrink: 1,
    fontSize: 9,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },

  // Empty attendance state
  emptyRecord: {
    paddingVertical: 18,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  emptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 12,
    color: COLORS.muted,
    lineHeight: 18,
    marginTop: 5,
    textAlign: 'center',
    maxWidth: 280,
  },

  // Primary action
  primaryButton: {
    minHeight: 48,
    paddingHorizontal: 14,
    backgroundColor: COLORS.navy,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 5,
    elevation: 2,
    shadowColor: COLORS.navy,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },
  primaryButtonText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.2,
    textAlign: 'center',
  },

  // Quick Access heading
  sectionHeading: {
    marginTop: 23,
    marginBottom: 12,
    paddingHorizontal: 3,
  },
  sectionHeadingTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.navy,
    letterSpacing: -0.3,
  },
  sectionHeadingSubtitle: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 4,
  },

  
  
  // Quick Access cards
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    rowGap: 12,
  },

  actionCard: {
    width: '48.5%',
    minHeight: 170,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'column',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#E5EBF1',
    elevation: 2,
    shadowColor: COLORS.navyDark,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },

  actionCardFullWidth: {
    width: '100%',
    minHeight: 104,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },

  actionCardFullWidthIcon: {
    marginRight: 13,
    marginBottom: 0,
    flexShrink: 0,
  },

  actionFullWidthText: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },

  
actionIconContainer: {
  width: 40,
  height: 40,
  borderRadius: 14,
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 12,
  overflow: 'hidden',
},

  
actionIconNavy: {
  backgroundColor: COLORS.navy,
  borderRadius: 14,
},

  actionIconBlue: {
    backgroundColor: COLORS.blueLight,
  },

  actionIconAmber: {
    backgroundColor: COLORS.amberLight,
  },

  actionIconGreen: {
    backgroundColor: COLORS.greenLight,
  },

  actionIconPurple: {
    backgroundColor: '#EEF2FF',
  },

  actionTextContainer: {
    flex: 1,
    width: '100%',
  },

  actionTitle: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '800',
    lineHeight: 18,
    marginBottom: 5,
  },

  actionDescription: {
    fontSize: 11,
    color: COLORS.muted,
    lineHeight: 16,
  },

  actionChevron: {
    alignSelf: 'flex-start',
    marginTop: 6,
    color: COLORS.muted,
  },
  // Official records notice
  securityCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EDF4FC',
    borderRadius: 16,
    padding: 14,
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#E0EAF5',
  },
  securityIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  securityTextGroup: {
    flex: 1,
  },
  securityTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 5,
  },
  securityDescription: {
    fontSize: 11,
    color: COLORS.muted,
    lineHeight: 16,
  },
});