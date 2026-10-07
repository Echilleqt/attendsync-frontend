import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {apiRequest} from '../api/client';
import {formatAttendanceDate, formatAttendanceTime} from '../utils/attendanceFormat';

const COLORS = {
  navy: '#102A43',
  navyDeep: '#0B1F33',
  blue: '#1769AA',
  blueLight: '#EAF4FB',
  canvas: '#F3F6F9',
  white: '#FFFFFF',
  text: '#243B53',
  muted: '#627D98',
  green: '#147D64',
  greenLight: '#E4F4EF',
  amber: '#A15C07',
  red: '#B42318',
  redLight: '#FEF3F2',
};

function DashboardIcon({name, color}) {
  if (name === 'history') {
    return (
      <View style={styles.historyIcon}>
        <View style={[styles.historyFace, {borderColor: color}]} />
        <View style={[styles.historyHandLong, {backgroundColor: color}]} />
        <View style={[styles.historyHandShort, {backgroundColor: color}]} />
      </View>
    );
  }

  if (name === 'calendar') {
    return (
      <View style={styles.calendarIcon}>
        <View style={[styles.calendarBody, {borderColor: color}]} />
        <View style={[styles.calendarTopLine, {backgroundColor: color}]} />
        <View style={[styles.calendarRing, styles.calendarRingLeft, {backgroundColor: color}]} />
        <View style={[styles.calendarRing, styles.calendarRingRight, {backgroundColor: color}]} />
        <View style={[styles.calendarDate, styles.calendarDateOne, {backgroundColor: color}]} />
        <View style={[styles.calendarDate, styles.calendarDateTwo, {backgroundColor: color}]} />
        <View style={[styles.calendarDate, styles.calendarDateThree, {backgroundColor: color}]} />
      </View>
    );
  }

  if (name === 'lock') {
    return (
      <View style={styles.lockIcon}>
        <View style={[styles.lockShackle, {borderColor: color}]} />
        <View style={[styles.lockBody, {borderColor: color}]}>
          <View style={[styles.lockKeyhole, {backgroundColor: color}]} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.shieldIcon}>
      <View style={[styles.shieldShape, {borderColor: color}]} />
      <View style={[styles.shieldCheckShort, {backgroundColor: color}]} />
      <View style={[styles.shieldCheckLong, {backgroundColor: color}]} />
    </View>
  );
}

export default function DashboardScreen({navigation, token, user}) {
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
  const date = formatAttendanceDate(attendance?.attendance_date);
  const firstName = user?.name?.trim().split(/\s+/)[0] || 'there';
  const status = attendance?.status === 'late'
    ? 'Late'
    : attendance?.status === 'present'
      ? 'On Time'
      : attendance?.status
        ? attendance.status.replace(/_/g, ' ')
        : 'Not recorded';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navyDeep} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>BANSUD CENTRAL SCHOOL</Text>
          <Text style={styles.greeting}>Good day, {firstName}</Text>
          <Text style={styles.headerSubtitle}>Your school day, at a glance.</Text>
        </View>

        <View style={styles.recordCard}>
          <View style={styles.recordHeading}>
            <View style={styles.recordTitleGroup}>
              <View style={styles.recordIcon}>
                <DashboardIcon name="calendar" color={COLORS.blue} />
              </View>
              <View style={styles.recordTitleCopy}>
                <Text style={styles.cardEyebrow}>TODAY'S ATTENDANCE</Text>
                <Text style={styles.cardTitle}>Arrival record</Text>
              </View>
            </View>
            <View style={[styles.statusPill, attendance ? styles.presentPill : styles.pendingPill]}>
              <View style={[styles.dot, attendance ? styles.presentDot : styles.pendingDot]} />
              <Text style={[styles.statusText, attendance ? styles.presentText : styles.pendingText]}>
                {loading ? 'Loading' : status}
              </Text>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator style={styles.loadingIndicator} color={COLORS.blue} size="large" />
          ) : error ? (
            <View style={styles.errorPanel}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={refresh} accessibilityRole="button" style={styles.retryButton}>
                <Text style={styles.retryText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : attendance && timeIn && date ? (
            <View style={styles.timestampBox}>
              <Text style={styles.timeValue}>{timeIn}</Text>
              <Text style={styles.dateValue}>{date}</Text>
              <View style={styles.serverNoteRow}>
                <View style={styles.serverNoteDot} />
                <Text style={styles.serverNote}>Saved by server · Asia/Manila</Text>
              </View>
            </View>
          ) : attendance ? (
            <View style={styles.errorPanel}>
              <Text style={styles.errorText}>The official attendance timestamp is unavailable.</Text>
              <TouchableOpacity onPress={refresh} accessibilityRole="button" style={styles.retryButton}>
                <Text style={styles.retryText}>Refresh from server</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyRecord}>
              <Text style={styles.emptyTitle}>No Time In recorded today</Text>
              <Text style={styles.emptyDescription}>Complete biometric verification and photo capture in Attendance.</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Attendance')}
            accessibilityRole="button">
            <Text style={styles.primaryButtonText}>{attendance ? 'View attendance' : 'Go to attendance'}</Text>
            <View style={styles.buttonArrow} />
          </TouchableOpacity>
        </View>

        {error ? null : (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('Corrections')}
              accessibilityRole="button">
              <View style={[styles.actionIcon, styles.iconBlue]}>
                <DashboardIcon name="history" color={COLORS.blue} />
              </View>
              <Text style={styles.actionTitle}>Attendance correction</Text>
              <Text style={styles.actionDescription}>Submit a request or check its review status.</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('Profile')}
              accessibilityRole="button">
              <View style={[styles.actionIcon, styles.iconGreen]}>
                <DashboardIcon name="lock" color={COLORS.green} />
              </View>
              <Text style={styles.actionTitle}>Account security</Text>
              <Text style={styles.actionDescription}>Manage your verified device enrollment.</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.privacyCard}>
          <View style={styles.privacyIcon}>
            <DashboardIcon name="shield" color={COLORS.blue} />
          </View>
          <View style={styles.privacyCopy}>
            <Text style={styles.privacyTitle}>Your data stays protected</Text>
            <Text style={styles.privacyDescription}>Attendance times come from the school server. The app never uses the phone clock as the official record.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: COLORS.canvas},
  content: {paddingHorizontal: 20, paddingBottom: 32},
  header: {
    backgroundColor: COLORS.navy,
    marginHorizontal: -20,
    paddingHorizontal: 24,
    paddingTop: 34,
    paddingBottom: 44,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  eyebrow: {color: '#B8CADB', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 13},
  greeting: {fontSize: 28, color: COLORS.white, fontWeight: '700', letterSpacing: -0.5},
  headerSubtitle: {fontSize: 14, color: '#D9E2EC', marginTop: 8},
  recordCard: {
    backgroundColor: COLORS.white,
    padding: 19,
    borderRadius: 20,
    marginTop: -20,
    elevation: 3,
    shadowColor: COLORS.navy,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  recordHeading: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  recordTitleGroup: {flexDirection: 'row', alignItems: 'center', flexShrink: 1},
  recordIcon: {width: 42, height: 42, borderRadius: 13, backgroundColor: COLORS.blueLight, alignItems: 'center', justifyContent: 'center', marginRight: 11},
  recordTitleCopy: {flexShrink: 1},
  cardEyebrow: {fontSize: 9, color: COLORS.muted, fontWeight: '700', letterSpacing: 1, marginBottom: 4},
  cardTitle: {fontSize: 17, color: COLORS.text, fontWeight: '700', letterSpacing: -0.2},
  statusPill: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, marginLeft: 8},
  presentPill: {backgroundColor: COLORS.greenLight},
  pendingPill: {backgroundColor: '#FFF4D6'},
  dot: {width: 7, height: 7, borderRadius: 4, marginRight: 7},
  presentDot: {backgroundColor: COLORS.green},
  pendingDot: {backgroundColor: COLORS.amber},
  statusText: {fontSize: 10, fontWeight: '700'},
  presentText: {color: COLORS.green},
  pendingText: {color: COLORS.amber},
  loadingIndicator: {marginVertical: 30},
  timestampBox: {alignItems: 'center', paddingVertical: 20, marginTop: 14, marginBottom: 14, borderRadius: 15, backgroundColor: '#F7FAFC'},
  timeValue: {fontSize: 36, color: COLORS.navy, fontWeight: '700', letterSpacing: -0.8, fontVariant: ['tabular-nums']},
  dateValue: {fontSize: 13, color: COLORS.text, fontWeight: '500', marginTop: 5},
  serverNoteRow: {flexDirection: 'row', alignItems: 'center', marginTop: 9},
  serverNoteDot: {width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.green, marginRight: 6},
  serverNote: {fontSize: 10, color: COLORS.muted},
  emptyRecord: {paddingVertical: 24},
  emptyTitle: {fontSize: 15, color: COLORS.text, fontWeight: '700'},
  emptyDescription: {fontSize: 12, color: COLORS.muted, lineHeight: 18, marginTop: 6},
  errorPanel: {backgroundColor: COLORS.redLight, borderRadius: 13, padding: 14, marginVertical: 16, borderWidth: 1, borderColor: '#FEE4E2'},
  errorText: {fontSize: 12, lineHeight: 18, color: COLORS.red},
  retryButton: {alignSelf: 'flex-start', paddingTop: 9, paddingRight: 12},
  retryText: {fontSize: 12, fontWeight: '700', color: COLORS.blue},
  primaryButton: {height: 48, backgroundColor: COLORS.navy, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', marginTop: 2},
  primaryButtonText: {fontSize: 13, fontWeight: '700', color: COLORS.white},
  buttonArrow: {width: 7, height: 7, borderTopWidth: 1.7, borderRightWidth: 1.7, borderColor: COLORS.white, transform: [{rotate: '45deg'}], marginLeft: 10},
  actionRow: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 16},
  actionCard: {flex: 1, backgroundColor: COLORS.white, borderRadius: 17, padding: 15, minHeight: 158, marginHorizontal: 4, borderWidth: 1, borderColor: '#E8EEF3'},
  actionIcon: {width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 14},
  iconBlue: {backgroundColor: COLORS.blueLight},
  iconGreen: {backgroundColor: COLORS.greenLight},
  actionTitle: {fontSize: 13, color: COLORS.text, fontWeight: '700', lineHeight: 18},
  actionDescription: {fontSize: 11, color: COLORS.muted, lineHeight: 16, marginTop: 6},
  privacyCard: {flexDirection: 'row', alignItems: 'flex-start', backgroundColor: COLORS.white, borderRadius: 16, padding: 15, marginTop: 16, borderWidth: 1, borderColor: '#E8EEF3'},
  privacyIcon: {width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.blueLight, alignItems: 'center', justifyContent: 'center', marginRight: 12},
  privacyCopy: {flex: 1},
  privacyTitle: {fontSize: 12, fontWeight: '700', color: COLORS.text},
  privacyDescription: {fontSize: 11, color: COLORS.muted, lineHeight: 16, marginTop: 5},
  historyIcon: {width: 24, height: 24, position: 'relative', alignItems: 'center', justifyContent: 'center'},
  historyFace: {position: 'absolute', width: 20, height: 20, borderWidth: 1.8, borderRadius: 10},
  historyHandLong: {position: 'absolute', left: 11, top: 5, width: 1.8, height: 6, borderRadius: 1},
  historyHandShort: {position: 'absolute', left: 11, top: 10, width: 5, height: 1.8, borderRadius: 1},
  calendarIcon: {width: 24, height: 24, position: 'relative'},
  calendarBody: {position: 'absolute', left: 2, top: 5, width: 20, height: 17, borderWidth: 1.7, borderRadius: 4},
  calendarTopLine: {position: 'absolute', left: 4, top: 10, width: 16, height: 1.5},
  calendarRing: {position: 'absolute', top: 2, width: 2, height: 6, borderRadius: 1},
  calendarRingLeft: {left: 7},
  calendarRingRight: {right: 7},
  calendarDate: {position: 'absolute', width: 2, height: 2, borderRadius: 1},
  calendarDateOne: {left: 7, top: 14},
  calendarDateTwo: {left: 12, top: 14},
  calendarDateThree: {left: 7, top: 18},
  lockIcon: {width: 24, height: 24, position: 'relative', alignItems: 'center'},
  lockShackle: {position: 'absolute', top: 2, width: 13, height: 13, borderWidth: 1.8, borderBottomWidth: 0, borderTopLeftRadius: 7, borderTopRightRadius: 7},
  lockBody: {position: 'absolute', top: 11, width: 21, height: 13, borderWidth: 1.8, borderRadius: 4, alignItems: 'center'},
  lockKeyhole: {position: 'absolute', top: 3, width: 3, height: 4, borderRadius: 2},
  shieldIcon: {width: 24, height: 24, alignItems: 'center', justifyContent: 'center'},
  shieldShape: {position: 'absolute', width: 17, height: 20, borderWidth: 1.7, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomLeftRadius: 9, borderBottomRightRadius: 9},
  shieldCheckShort: {position: 'absolute', width: 2, height: 5, left: 8, top: 11, transform: [{rotate: '-45deg'}], borderRadius: 1},
  shieldCheckLong: {position: 'absolute', width: 2, height: 8, left: 13, top: 9, transform: [{rotate: '45deg'}], borderRadius: 1},
});
