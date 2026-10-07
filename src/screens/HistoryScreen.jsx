import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {apiRequest} from '../api/client';
import {formatAttendanceDate} from '../utils/attendanceFormat';

const COLORS = {
  navy: '#102A43',
  navyDeep: '#0B1F33',
  blue: '#1769AA',
  blueLight: '#EAF4FB',
  canvas: '#F3F6F9',
  white: '#FFFFFF',
  text: '#243B53',
  muted: '#627D98',
  border: '#D9E2EC',
  green: '#147D64',
  greenLight: '#E4F4EF',
  amber: '#A15C07',
  amberLight: '#FFF4D6',
  red: '#B42318',
  redLight: '#FEF3F2',
};

const REQUEST_TYPES = [
  {value: 'missing_time_in', label: 'Missing Time In'},
  {value: 'missing_time_out', label: 'Missing Time Out'},
  {value: 'incorrect_time', label: 'Incorrect time'},
  {value: 'incorrect_record', label: 'Incorrect record'},
];

function statusStyle(status) {
  if (status === 'approved') {
    return {backgroundColor: COLORS.greenLight, color: COLORS.green};
  }
  if (status === 'rejected') {
    return {backgroundColor: COLORS.redLight, color: COLORS.red};
  }
  return {backgroundColor: COLORS.amberLight, color: COLORS.amber};
}

export default function HistoryScreen({token}) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [attendanceDate, setAttendanceDate] = useState('');
  const [requestType, setRequestType] = useState('missing_time_in');
  const [requestedTimeIn, setRequestedTimeIn] = useState('');
  const [requestedTimeOut, setRequestedTimeOut] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadRequests = useCallback(async () => {
    if (!token) {
      setRequests([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest('/attendance-correction-requests', token);
      setRequests(result.requests?.data || []);
    } catch (requestError) {
      setError(requestError.message || 'Unable to load correction requests from the server.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [loadRequests]),
  );

  const submitRequest = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(attendanceDate)) {
      setError('Enter the attendance date as YYYY-MM-DD.');
      return;
    }
    if (!reason.trim()) {
      setError('Add a reason to help the administrator evaluate your request.');
      return;
    }

    setSubmitting(true);
    setError('');
    setNotice('');

    try {
      await apiRequest('/attendance-correction-requests', token, {
        method: 'POST',
        body: {
          attendance_date: attendanceDate,
          request_type: requestType,
          requested_time_in: requestedTimeIn || null,
          requested_time_out: requestedTimeOut || null,
          reason: reason.trim(),
        },
      });
      setAttendanceDate('');
      setRequestedTimeIn('');
      setRequestedTimeOut('');
      setReason('');
      setNotice('Your request was submitted. Its status below is loaded from the server.');
      await loadRequests();
    } catch (requestError) {
      setError(requestError.message || 'Unable to submit your correction request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navyDeep} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ATTENDANCE SUPPORT</Text>
          <Text style={styles.title}>Attendance correction</Text>
          <Text style={styles.subtitle}>Ask an administrator to review an attendance record.</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.cardTitle}>Request a correction</Text>
          <Text style={styles.cardSubtitle}>Submitting a request does not change your attendance record.</Text>

          <Text style={styles.label}>Attendance date</Text>
          <TextInput
            style={styles.input}
            value={attendanceDate}
            onChangeText={setAttendanceDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#829AB1"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />

          <Text style={styles.label}>Request type</Text>
          <View style={styles.typeGrid}>
            {REQUEST_TYPES.map(item => (
              <TouchableOpacity
                key={item.value}
                style={[styles.typeOption, requestType === item.value && styles.typeSelected]}
                onPress={() => setRequestType(item.value)}
                accessibilityRole="radio"
                accessibilityState={{selected: requestType === item.value}}>
                <Text style={[styles.typeText, requestType === item.value && styles.typeTextSelected]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.timeFields}>
            <View style={styles.timeField}>
              <Text style={styles.label}>Requested Time In</Text>
              <TextInput
                style={styles.input}
                value={requestedTimeIn}
                onChangeText={setRequestedTimeIn}
                placeholder="HH:mm"
                placeholderTextColor="#829AB1"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            </View>
            <View style={styles.timeField}>
              <Text style={styles.label}>Requested Time Out</Text>
              <TextInput
                style={styles.input}
                value={requestedTimeOut}
                onChangeText={setRequestedTimeOut}
                placeholder="HH:mm"
                placeholderTextColor="#829AB1"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            </View>
          </View>

          <Text style={styles.label}>Reason</Text>
          <TextInput
            style={[styles.input, styles.reasonInput]}
            value={reason}
            onChangeText={setReason}
            placeholder="Explain what needs to be reviewed"
            placeholderTextColor="#829AB1"
            multiline
            maxLength={2000}
            textAlignVertical="top"
          />

          {error ? <View style={styles.errorBanner}><Text style={styles.errorText}>{error}</Text></View> : null}
          {notice ? <View style={styles.noticeBanner}><Text style={styles.noticeText}>{notice}</Text></View> : null}

          <TouchableOpacity style={[styles.primaryButton, submitting && styles.disabledButton]} onPress={submitRequest} disabled={submitting}>
            {submitting ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryButtonText}>Submit for review</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.listHeading}>
          <View>
            <Text style={styles.listTitle}>Request status</Text>
            <Text style={styles.listSubtitle}>Statuses are provided by the attendance server.</Text>
          </View>
          <TouchableOpacity onPress={loadRequests} accessibilityRole="button">
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator style={styles.listLoader} color={COLORS.blue} />
        ) : requests.length ? (
          requests.map(item => {
            const badge = statusStyle(item.status);
            const requestLabel = REQUEST_TYPES.find(type => type.value === item.request_type)?.label || item.request_type;
            return (
              <View key={item.id} style={styles.requestCard}>
                <View style={styles.requestHeader}>
                  <View style={styles.requestHeadCopy}>
                    <Text style={styles.requestType}>{requestLabel}</Text>
                    <Text style={styles.requestDate}>{formatAttendanceDate(item.attendance_date) || item.attendance_date}</Text>
                  </View>
                  <View style={[styles.statusBadge, {backgroundColor: badge.backgroundColor}]}>
                    <Text style={[styles.statusBadgeText, {color: badge.color}]}>{item.status}</Text>
                  </View>
                </View>
                <Text style={styles.reasonPreview}>{item.reason}</Text>
                <Text style={styles.requestTimes}>
                  Requested In: {item.requested_time_in || '—'}   ·   Requested Out: {item.requested_time_out || '—'}
                </Text>
                {item.admin_review_notes ? (
                  <View style={styles.reviewNotes}>
                    <Text style={styles.reviewLabel}>Administrator note</Text>
                    <Text style={styles.reviewText}>{item.admin_review_notes}</Text>
                  </View>
                ) : null}
                {item.reviewed_at ? (
                  <Text style={styles.reviewedAt}>Reviewed {item.reviewed_at}</Text>
                ) : null}
              </View>
            );
          })
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No correction requests yet</Text>
            <Text style={styles.emptyDescription}>Requests and their review status will appear here after submission.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: COLORS.canvas},
  content: {padding: 20, paddingBottom: 32},
  header: {backgroundColor: COLORS.navy, marginHorizontal: -20, marginTop: -20, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 32, borderBottomLeftRadius: 24, borderBottomRightRadius: 24},
  eyebrow: {fontSize: 10, color: '#9FB3C8', fontWeight: '800', letterSpacing: 1.3, marginBottom: 10},
  title: {fontSize: 28, color: COLORS.white, fontWeight: '800'},
  subtitle: {fontSize: 13, color: '#D9E2EC', marginTop: 7},
  formCard: {backgroundColor: COLORS.white, borderRadius: 18, padding: 17, marginTop: -14, elevation: 2, shadowColor: COLORS.navy, shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 7},
  cardTitle: {fontSize: 17, color: COLORS.navy, fontWeight: '800'},
  cardSubtitle: {fontSize: 11, color: COLORS.muted, lineHeight: 16, marginTop: 4, marginBottom: 12},
  label: {fontSize: 11, color: COLORS.text, fontWeight: '800', marginTop: 11, marginBottom: 6},
  input: {minHeight: 45, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, color: COLORS.text, backgroundColor: '#FAFCFE', fontSize: 13},
  reasonInput: {height: 88, paddingTop: 11},
  typeGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  typeOption: {width: '48%', minHeight: 39, borderWidth: 1, borderColor: COLORS.border, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6},
  typeSelected: {borderColor: COLORS.blue, backgroundColor: COLORS.blueLight},
  typeText: {fontSize: 10, color: COLORS.muted, fontWeight: '700'},
  typeTextSelected: {color: COLORS.blue},
  timeFields: {flexDirection: 'row', justifyContent: 'space-between'},
  timeField: {width: '48%'},
  primaryButton: {height: 49, borderRadius: 11, backgroundColor: COLORS.blue, alignItems: 'center', justifyContent: 'center', marginTop: 14},
  primaryButtonText: {fontSize: 13, color: COLORS.white, fontWeight: '800'},
  disabledButton: {opacity: 0.7},
  errorBanner: {backgroundColor: COLORS.redLight, borderRadius: 10, padding: 11, marginTop: 12},
  errorText: {fontSize: 11, lineHeight: 16, color: COLORS.red},
  noticeBanner: {backgroundColor: COLORS.greenLight, borderRadius: 10, padding: 11, marginTop: 12},
  noticeText: {fontSize: 11, lineHeight: 16, color: COLORS.green},
  listHeading: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 11},
  listTitle: {fontSize: 17, color: COLORS.navy, fontWeight: '800'},
  listSubtitle: {fontSize: 10, color: COLORS.muted, marginTop: 4},
  refreshText: {fontSize: 12, color: COLORS.blue, fontWeight: '800'},
  listLoader: {marginVertical: 25},
  requestCard: {backgroundColor: COLORS.white, borderRadius: 15, padding: 15, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border},
  requestHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'},
  requestHeadCopy: {flex: 1, paddingRight: 8},
  requestType: {fontSize: 13, color: COLORS.text, fontWeight: '800'},
  requestDate: {fontSize: 11, color: COLORS.muted, marginTop: 4},
  statusBadge: {paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20},
  statusBadgeText: {fontSize: 10, fontWeight: '800', textTransform: 'capitalize'},
  reasonPreview: {fontSize: 12, color: COLORS.text, lineHeight: 17, marginTop: 12},
  requestTimes: {fontSize: 10, color: COLORS.muted, lineHeight: 16, marginTop: 8},
  reviewNotes: {borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 9, marginTop: 10},
  reviewLabel: {fontSize: 10, color: COLORS.muted, fontWeight: '800'},
  reviewText: {fontSize: 11, color: COLORS.text, lineHeight: 16, marginTop: 4},
  reviewedAt: {fontSize: 9, color: COLORS.muted, marginTop: 8},
  emptyCard: {backgroundColor: COLORS.white, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: COLORS.border},
  emptyTitle: {fontSize: 13, color: COLORS.text, fontWeight: '800'},
  emptyDescription: {fontSize: 11, color: COLORS.muted, lineHeight: 16, marginTop: 5},
});
