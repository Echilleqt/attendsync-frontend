import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import {
  Calendar,
  CalendarDays,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Clock3,
  FileText,
  Info,
  RotateCw,
  Send,
} from 'lucide-react-native';
import {apiRequest} from '../api/client';
import {formatAttendanceDate} from '../utils/attendanceFormat';
import COLORS from '../theme/colors';
import AppHeader from '../components/AppHeader';
import StatusBadge from '../components/StatusBadge';
import Banner from '../components/Banner';

const REQUEST_TYPES = [
  {value: 'missing_time_in', label: 'Missing Time In', desc: 'Missed recording morning arrival'},
  {value: 'missing_time_out', label: 'Missing Time Out', desc: 'Missed recording afternoon departure'},
  {value: 'incorrect_time', label: 'Incorrect Time', desc: 'Timestamp recorded inaccurately'},
  {value: 'incorrect_record', label: 'Incorrect Record', desc: 'Other attendance discrepancy'},
];

const STATUS_FILTERS = [
  {id: 'all', label: 'All'},
  {id: 'pending', label: 'Pending'},
  {id: 'approved', label: 'Approved'},
  {id: 'rejected', label: 'Rejected'},
];

export default function HistoryScreen({token}) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('form'); // 'form' | 'history'

  // History State
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyFilter, setHistoryFilter] = useState('all');
  const [expandedRequestId, setExpandedRequestId] = useState(null);

  // Form State
  const [attendanceDate, setAttendanceDate] = useState('');
  const [requestType, setRequestType] = useState('missing_time_in');
  const [requestedTimeIn, setRequestedTimeIn] = useState('');
  const [requestedTimeOut, setRequestedTimeOut] = useState('');
  const [reason, setReason] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Confirmation Modal State
  const [submittedRequest, setSubmittedRequest] = useState(null);

  const loadRequests = useCallback(async () => {
    if (!token) {
      setRequests([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setSubmitError('');
    try {
      const result = await apiRequest('/attendance-correction-requests', token);
      setRequests(result.requests?.data || []);
    } catch (requestError) {
      setSubmitError(requestError.message || 'Unable to load correction requests from the server.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [loadRequests]),
  );

  // Quick fill today's date in YYYY-MM-DD
  const handleFillToday = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setAttendanceDate(`${yyyy}-${mm}-${dd}`);
    setFormErrors(prev => ({...prev, attendanceDate: null}));
  };

  // Validate form
  const validateForm = () => {
    const errors = {};

    // Date validation
    if (!attendanceDate.trim()) {
      errors.attendanceDate = 'Attendance date is required.';
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(attendanceDate.trim())) {
      errors.attendanceDate = 'Date must be formatted as YYYY-MM-DD.';
    } else {
      const parts = attendanceDate.trim().split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      const reqDate = new Date(year, month - 1, day);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (reqDate > today) {
        errors.attendanceDate = 'Date cannot be in the future.';
      }
    }

    // Time validation depending on request type
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

    if (requestType === 'missing_time_in') {
      if (!requestedTimeIn.trim()) {
        errors.requestedTimeIn = 'Requested Time In is required for Missing Time In.';
      } else if (!timeRegex.test(requestedTimeIn.trim())) {
        errors.requestedTimeIn = 'Time must be formatted as HH:mm (24-hr, e.g. 07:30).';
      }
    } else if (requestType === 'missing_time_out') {
      if (!requestedTimeOut.trim()) {
        errors.requestedTimeOut = 'Requested Time Out is required for Missing Time Out.';
      } else if (!timeRegex.test(requestedTimeOut.trim())) {
        errors.requestedTimeOut = 'Time must be formatted as HH:mm (24-hr, e.g. 17:00).';
      }
    } else {
      // incorrect_time or incorrect_record
      if (!requestedTimeIn.trim() && !requestedTimeOut.trim()) {
        errors.requestedTimeIn = 'Provide at least one requested time value.';
      }
      if (requestedTimeIn.trim() && !timeRegex.test(requestedTimeIn.trim())) {
        errors.requestedTimeIn = 'Time In must be formatted as HH:mm (e.g. 07:30).';
      }
      if (requestedTimeOut.trim() && !timeRegex.test(requestedTimeOut.trim())) {
        errors.requestedTimeOut = 'Time Out must be formatted as HH:mm (e.g. 17:00).';
      }
      if (
        requestedTimeIn.trim() &&
        requestedTimeOut.trim() &&
        timeRegex.test(requestedTimeIn.trim()) &&
        timeRegex.test(requestedTimeOut.trim()) &&
        requestedTimeOut.trim() <= requestedTimeIn.trim()
      ) {
        errors.requestedTimeOut = 'Requested Time Out must be later than Time In.';
      }
    }

    // Reason validation
    if (!reason.trim()) {
      errors.reason = 'Please explain the circumstance for the school administrator.';
    } else if (reason.trim().length < 5) {
      errors.reason = 'Reason must be at least 5 characters.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submitRequest = async () => {
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const payload = {
        attendance_date: attendanceDate.trim(),
        request_type: requestType,
        requested_time_in: requestedTimeIn.trim() || null,
        requested_time_out: requestedTimeOut.trim() || null,
        reason: reason.trim(),
      };

      const result = await apiRequest('/attendance-correction-requests', token, {
        method: 'POST',
        body: payload,
      });

      const serverRequest = result.request || {
        attendance_date: payload.attendance_date,
        request_type: payload.request_type,
        requested_time_in: payload.requested_time_in,
        requested_time_out: payload.requested_time_out,
        reason: payload.reason,
        status: 'pending',
      };

      // Show confirmation dialog with actual server data
      setSubmittedRequest(serverRequest);

      // Reset form
      setAttendanceDate('');
      setRequestedTimeIn('');
      setRequestedTimeOut('');
      setReason('');
      setFormErrors({});

      await loadRequests();
    } catch (requestError) {
      setSubmitError(requestError.message || 'Unable to submit your correction request.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered requests list
  const filteredRequests = requests.filter(req => {
    if (historyFilter === 'all') {return true;}
    return (req.status || 'pending').toLowerCase() === historyFilter;
  });

  const toggleExpand = id => {
    setExpandedRequestId(prev => (prev === id ? null : id));
  };

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
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadRequests}
            progressViewOffset={80}
            tintColor={COLORS.white}
            colors={[COLORS.blue]}
          />
        }
      >
        {/* Reusable Global Header */}
        <AppHeader
          variant="standard"
          title="Corrections"
          schoolName="BANSUD CENTRAL SCHOOL"
          subtitle="Submit and track official DepEd attendance review requests."
          rightAction={
            <TouchableOpacity
              onPress={loadRequests}
              style={styles.headerRefreshBtn}
              accessibilityRole="button"
              accessibilityLabel="Refresh correction requests"
              activeOpacity={0.7}
            >
              <RotateCw size={16} color={COLORS.white} strokeWidth={2.4} />
            </TouchableOpacity>
          }
        />

        <View style={styles.body}>
          {/* Segmented Tab Switcher */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'form' && styles.tabButtonActive]}
              onPress={() => setActiveTab('form')}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{selected: activeTab === 'form'}}
            >
              <FileText
                size={15}
                color={activeTab === 'form' ? COLORS.navy : COLORS.muted}
                strokeWidth={2.4}
              />
              <Text
                style={[
                  styles.tabButtonText,
                  activeTab === 'form' && styles.tabButtonTextActive,
                ]}
              >
                New Request
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'history' && styles.tabButtonActive]}
              onPress={() => setActiveTab('history')}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{selected: activeTab === 'history'}}
            >
              <Clock3
                size={15}
                color={activeTab === 'history' ? COLORS.navy : COLORS.muted}
                strokeWidth={2.4}
              />
              <Text
                style={[
                  styles.tabButtonText,
                  activeTab === 'history' && styles.tabButtonTextActive,
                ]}
              >
                Request History ({requests.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* TAB 1: NEW REQUEST FORM */}
          {activeTab === 'form' ? (
            <View style={styles.formCard}>
              <View style={styles.formTitleRow}>
                <View style={styles.formIconBox}>
                  <FileText size={18} color={COLORS.blue} strokeWidth={2.4} />
                </View>
                <View style={{flex: 1}}>
                  <Text style={styles.cardTitle}>New Correction Request</Text>
                  <Text style={styles.cardSubtitle}>
                    Official DepEd Bansud Central School administrative review
                  </Text>
                </View>
              </View>

              {/* Field 1: Attendance Date */}
              <View style={styles.fieldHeaderRow}>
                <Text style={styles.label}>1. Attendance Date</Text>
                <TouchableOpacity
                  onPress={handleFillToday}
                  style={styles.todayShortcutBtn}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                >
                  <Calendar size={12} color={COLORS.blue} strokeWidth={2.4} />
                  <Text style={styles.todayShortcutText}>Use Today</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[
                  styles.input,
                  formErrors.attendanceDate && styles.inputError,
                ]}
                value={attendanceDate}
                onChangeText={text => {
                  setAttendanceDate(text);
                  setFormErrors(prev => ({...prev, attendanceDate: null}));
                }}
                placeholder="YYYY-MM-DD (e.g. 2026-10-11)"
                placeholderTextColor="#9AA7B8"
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />
              {formErrors.attendanceDate ? (
                <Text style={styles.errorText}>{formErrors.attendanceDate}</Text>
              ) : null}

              {/* Field 2: Request Type */}
              <Text style={styles.label}>2. Request Type</Text>
              <View style={styles.typeGrid}>
                {REQUEST_TYPES.map(item => {
                  const isSelected = requestType === item.value;
                  return (
                    <TouchableOpacity
                      key={item.value}
                      style={[
                        styles.typeOption,
                        isSelected && styles.typeSelected,
                      ]}
                      onPress={() => {
                        setRequestType(item.value);
                        setFormErrors({});
                      }}
                      activeOpacity={0.8}
                      accessibilityRole="radio"
                      accessibilityState={{selected: isSelected}}
                    >
                      <View style={styles.typeOptionTop}>
                        <View
                          style={[
                            styles.typeRadioDot,
                            isSelected && styles.typeRadioDotSelected,
                          ]}
                        />
                        <Text
                          style={[
                            styles.typeText,
                            isSelected && styles.typeTextSelected,
                          ]}
                        >
                          {item.label}
                        </Text>
                      </View>
                      <Text style={styles.typeDesc}>{item.desc}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Field 3: Dynamic Requested Times */}
              <Text style={styles.label}>3. Requested Time Value(s)</Text>

              {/* Show Time In if relevant */}
              {requestType !== 'missing_time_out' ? (
                <View style={styles.timeInputBlock}>
                  <Text style={styles.inputSubLabel}>Requested Time In (24-hour)</Text>
                  <TextInput
                    style={[
                      styles.input,
                      formErrors.requestedTimeIn && styles.inputError,
                    ]}
                    value={requestedTimeIn}
                    onChangeText={text => {
                      setRequestedTimeIn(text);
                      setFormErrors(prev => ({...prev, requestedTimeIn: null}));
                    }}
                    placeholder="HH:mm (e.g. 07:30)"
                    placeholderTextColor="#9AA7B8"
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                  />
                  {formErrors.requestedTimeIn ? (
                    <Text style={styles.errorText}>{formErrors.requestedTimeIn}</Text>
                  ) : null}
                </View>
              ) : null}

              {/* Show Time Out if relevant */}
              {requestType !== 'missing_time_in' ? (
                <View style={styles.timeInputBlock}>
                  <Text style={styles.inputSubLabel}>Requested Time Out (24-hour)</Text>
                  <TextInput
                    style={[
                      styles.input,
                      formErrors.requestedTimeOut && styles.inputError,
                    ]}
                    value={requestedTimeOut}
                    onChangeText={text => {
                      setRequestedTimeOut(text);
                      setFormErrors(prev => ({...prev, requestedTimeOut: null}));
                    }}
                    placeholder="HH:mm (e.g. 17:00)"
                    placeholderTextColor="#9AA7B8"
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                  />
                  {formErrors.requestedTimeOut ? (
                    <Text style={styles.errorText}>{formErrors.requestedTimeOut}</Text>
                  ) : null}
                </View>
              ) : null}

              {/* Field 4: Reason for Request */}
              <View style={styles.fieldHeaderRow}>
                <Text style={styles.label}>4. Reason for Request</Text>
                <Text style={styles.charCount}>
                  {reason.trim().length} chars (min 5)
                </Text>
              </View>
              <TextInput
                style={[
                  styles.input,
                  styles.reasonInput,
                  formErrors.reason && styles.inputError,
                ]}
                value={reason}
                onChangeText={text => {
                  setReason(text);
                  setFormErrors(prev => ({...prev, reason: null}));
                }}
                placeholder="Explain the circumstance clearly for the school administrator..."
                placeholderTextColor="#9AA7B8"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              {formErrors.reason ? (
                <Text style={styles.errorText}>{formErrors.reason}</Text>
              ) : null}

              {/* Field 5: Supporting Evidence / DepEd Institutional Notice */}
              <View style={styles.depedNoticeCard}>
                <Info size={16} color={COLORS.blue} strokeWidth={2.4} style={styles.depedNoticeIcon} />
                <View style={{flex: 1}}>
                  <Text style={styles.depedNoticeTitle}>Administrator Review Process</Text>
                  <Text style={styles.depedNoticeText}>
                    Requests are reviewed against official logs by the school administrator. Official attendance records are only updated upon approval.
                  </Text>
                </View>
              </View>

              {/* Submission Error Banner */}
              {submitError ? (
                <Banner type="error" message={submitError} />
              ) : null}

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.primaryButton, submitting && styles.disabledButton]}
                onPress={submitRequest}
                disabled={submitting}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                {submitting ? (
                  <>
                    <ActivityIndicator color={COLORS.white} size="small" />
                    <Text style={styles.primaryButtonText}>Submitting to Server…</Text>
                  </>
                ) : (
                  <>
                    <Send size={16} color={COLORS.white} strokeWidth={2.4} />
                    <Text style={styles.primaryButtonText}>Submit Correction Request</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            /* TAB 2: REQUEST HISTORY */
            <View style={styles.historySection}>
              {/* Status Filter Row */}
              <View style={styles.historyFilterBar}>
                {STATUS_FILTERS.map(f => {
                  const isActive = historyFilter === f.id;
                  return (
                    <TouchableOpacity
                      key={f.id}
                      style={[styles.historyFilterTab, isActive && styles.historyFilterTabActive]}
                      onPress={() => setHistoryFilter(f.id)}
                      activeOpacity={0.75}
                      accessibilityRole="radio"
                      accessibilityState={{selected: isActive}}
                    >
                      <Text
                        style={[
                          styles.historyFilterTabText,
                          isActive && styles.historyFilterTabTextActive,
                        ]}
                      >
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {loading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color={COLORS.blue} />
                  <Text style={styles.loadingText}>Loading correction requests...</Text>
                </View>
              ) : filteredRequests.length > 0 ? (
                filteredRequests.map(req => {
                  const isExpanded = expandedRequestId === req.id;
                  const typeLabel = req.request_type
                    ? req.request_type.replace(/_/g, ' ')
                    : 'Correction';

                  return (
                    <View key={req.id} style={styles.requestCard}>
                      <TouchableOpacity
                        style={styles.requestCardHeader}
                        onPress={() => toggleExpand(req.id)}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                      >
                        <View style={styles.requestHeaderLeft}>
                          <Text style={styles.requestType}>{typeLabel}</Text>
                          <Text style={styles.requestDate}>
                            Date: {formatAttendanceDate(req.attendance_date) || req.attendance_date}
                          </Text>
                        </View>
                        <View style={styles.requestHeaderRight}>
                          <StatusBadge status={req.status || 'pending'} size="sm" />
                          {isExpanded ? (
                            <ChevronUp size={18} color={COLORS.muted} />
                          ) : (
                            <ChevronDown size={18} color={COLORS.muted} />
                          )}
                        </View>
                      </TouchableOpacity>

                      {/* Reason preview */}
                      <Text style={styles.reasonText} numberOfLines={isExpanded ? undefined : 2}>
                        "{req.reason}"
                      </Text>

                      {/* Requested Times Row */}
                      {(req.requested_time_in || req.requested_time_out) ? (
                        <View style={styles.requestedTimesBox}>
                          <Clock size={13} color={COLORS.muted} strokeWidth={2.2} />
                          <Text style={styles.requestedTimesText}>
                            Requested:{' '}
                            {req.requested_time_in ? `In: ${req.requested_time_in}` : ''}
                            {req.requested_time_in && req.requested_time_out ? ' • ' : ''}
                            {req.requested_time_out ? `Out: ${req.requested_time_out}` : ''}
                          </Text>
                        </View>
                      ) : null}

                      {/* Expanded Details */}
                      {isExpanded ? (
                        <View style={styles.expandedContent}>
                          {req.created_at ? (
                            <Text style={styles.submittedDateText}>
                              Submitted on: {new Date(req.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </Text>
                          ) : null}

                          {req.admin_review_notes || req.admin_notes ? (
                            <View style={styles.reviewNotes}>
                              <Text style={styles.reviewLabel}>Administrator Review Notes:</Text>
                              <Text style={styles.reviewText}>
                                {req.admin_review_notes || req.admin_notes}
                              </Text>
                            </View>
                          ) : (
                            <View style={styles.pendingReviewNotice}>
                              <Text style={styles.pendingReviewText}>
                                Awaiting administrator review. You will see review notes once evaluated.
                              </Text>
                            </View>
                          )}
                        </View>
                      ) : null}
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptyCard}>
                  <View style={styles.emptyIconCircle}>
                    <CalendarDays size={28} color={COLORS.muted} strokeWidth={2} />
                  </View>
                  <Text style={styles.emptyTitle}>No Requests Found</Text>
                  <Text style={styles.emptyDescription}>
                    {historyFilter === 'all'
                      ? 'You have not submitted any attendance correction requests yet.'
                      : `No requests match the "${historyFilter}" status filter.`}
                  </Text>
                  <TouchableOpacity
                    style={styles.emptySubmitBtn}
                    onPress={() => setActiveTab('form')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.emptySubmitBtnText}>Submit a Request</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Submission Confirmation Modal */}
      {submittedRequest ? (
        <Modal
          visible={Boolean(submittedRequest)}
          transparent
          animationType="fade"
          onRequestClose={() => setSubmittedRequest(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.confirmCard}>
              <View style={styles.confirmIconCircle}>
                <CheckCircle size={36} color={COLORS.green} strokeWidth={2.4} />
              </View>

              <Text style={styles.confirmTitle}>Request Submitted!</Text>
              <Text style={styles.confirmSubtitle}>
                Your attendance correction request was successfully sent to the school administration.
              </Text>

              <View style={styles.confirmDetailsBox}>
                <View style={styles.confirmDetailRow}>
                  <Text style={styles.confirmDetailLabel}>Attendance Date:</Text>
                  <Text style={styles.confirmDetailValue}>
                    {formatAttendanceDate(submittedRequest.attendance_date) || submittedRequest.attendance_date}
                  </Text>
                </View>

                <View style={styles.confirmDetailRow}>
                  <Text style={styles.confirmDetailLabel}>Request Type:</Text>
                  <Text style={[styles.confirmDetailValue, {textTransform: 'capitalize'}]}>
                    {submittedRequest.request_type ? submittedRequest.request_type.replace(/_/g, ' ') : ''}
                  </Text>
                </View>

                {submittedRequest.requested_time_in ? (
                  <View style={styles.confirmDetailRow}>
                    <Text style={styles.confirmDetailLabel}>Requested Time In:</Text>
                    <Text style={styles.confirmDetailValue}>
                      {submittedRequest.requested_time_in}
                    </Text>
                  </View>
                ) : null}

                {submittedRequest.requested_time_out ? (
                  <View style={styles.confirmDetailRow}>
                    <Text style={styles.confirmDetailLabel}>Requested Time Out:</Text>
                    <Text style={styles.confirmDetailValue}>
                      {submittedRequest.requested_time_out}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.confirmDetailRow}>
                  <Text style={styles.confirmDetailLabel}>Current Status:</Text>
                  <StatusBadge status={submittedRequest.status || 'pending'} size="sm" />
                </View>
              </View>

              <View style={styles.confirmButtonRow}>
                <TouchableOpacity
                  style={styles.confirmSecondaryBtn}
                  onPress={() => {
                    setSubmittedRequest(null);
                    setActiveTab('form');
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.confirmSecondaryBtnText}>Submit Another</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.confirmPrimaryBtn}
                  onPress={() => {
                    setSubmittedRequest(null);
                    setActiveTab('history');
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.confirmPrimaryBtnText}>View Requests</Text>
                </TouchableOpacity>
              </View>
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
  headerRefreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  body: {
    paddingHorizontal: 20,
    marginTop: -20,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    elevation: 3,
    shadowColor: COLORS.navyDark,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  tabButtonActive: {
    backgroundColor: COLORS.blueLight,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.muted,
  },
  tabButtonTextActive: {
    color: COLORS.navy,
    fontWeight: '800',
  },
  formCard: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: 20,
    elevation: 4,
    shadowColor: COLORS.navyDark,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.08,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: '#EDF2F7',
  },
  formTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  formIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    color: COLORS.navy,
    fontWeight: '800',
  },
  cardSubtitle: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 2,
  },
  fieldHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 6,
  },
  label: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 6,
  },
  todayShortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.blueLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  todayShortcutText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.blue,
  },
  input: {
    minHeight: 48,
    borderWidth: 1.2,
    borderColor: COLORS.border,
    borderRadius: 13,
    paddingHorizontal: 14,
    color: COLORS.text,
    backgroundColor: '#FAFCFE',
    fontSize: 13,
  },
  inputError: {
    borderColor: COLORS.red,
    backgroundColor: '#FFF8F8',
  },
  errorText: {
    fontSize: 11,
    color: COLORS.red,
    marginTop: 4,
    fontWeight: '600',
  },
  typeGrid: {
    gap: 8,
  },
  typeOption: {
    borderWidth: 1.2,
    borderColor: COLORS.border,
    borderRadius: 13,
    padding: 12,
    backgroundColor: '#FAFCFE',
  },
  typeSelected: {
    borderColor: COLORS.blue,
    backgroundColor: COLORS.blueLight,
  },
  typeOptionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeRadioDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: COLORS.muted,
    backgroundColor: COLORS.white,
  },
  typeRadioDotSelected: {
    borderColor: COLORS.blue,
    backgroundColor: COLORS.blue,
  },
  typeText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '700',
  },
  typeTextSelected: {
    color: COLORS.navy,
    fontWeight: '800',
  },
  typeDesc: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 3,
    marginLeft: 22,
  },
  timeInputBlock: {
    marginTop: 6,
  },
  inputSubLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  charCount: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.muted,
  },
  reasonInput: {
    height: 85,
    paddingTop: 10,
  },
  depedNoticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: 13,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#EDF2F7',
  },
  depedNoticeIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  depedNoticeTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.navy,
  },
  depedNoticeText: {
    fontSize: 11,
    color: COLORS.muted,
    lineHeight: 15,
    marginTop: 2,
  },
  primaryButton: {
    height: 50,
    borderRadius: 14,
    backgroundColor: COLORS.navy,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
    elevation: 3,
    shadowColor: COLORS.navy,
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },
  primaryButtonText: {
    fontSize: 14,
    color: COLORS.white,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  disabledButton: {
    opacity: 0.7,
  },
  historySection: {
    gap: 10,
  },
  historyFilterBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 3,
    borderWidth: 1,
    borderColor: '#EDF2F7',
  },
  historyFilterTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 11,
  },
  historyFilterTabActive: {
    backgroundColor: COLORS.blueLight,
  },
  historyFilterTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.muted,
  },
  historyFilterTabTextActive: {
    color: COLORS.blue,
    fontWeight: '800',
  },
  loadingBox: {
    paddingVertical: 35,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 8,
  },
  requestCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    elevation: 2,
    shadowColor: COLORS.navyDark,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  requestCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  requestHeaderLeft: {
    flex: 1,
    paddingRight: 8,
  },
  requestType: {
    fontSize: 14,
    color: COLORS.navy,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  requestDate: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 2,
  },
  requestHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reasonText: {
    fontSize: 12,
    color: COLORS.text,
    lineHeight: 18,
    marginTop: 10,
    fontStyle: 'italic',
  },
  requestedTimesBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    marginTop: 8,
  },
  requestedTimesText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  expandedContent: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  submittedDateText: {
    fontSize: 10,
    color: COLORS.muted,
    marginBottom: 8,
  },
  reviewNotes: {
    backgroundColor: '#EDF4FC',
    borderRadius: 11,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.blue,
  },
  reviewLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.blue,
  },
  reviewText: {
    fontSize: 12,
    color: COLORS.text,
    lineHeight: 16,
    marginTop: 3,
  },
  pendingReviewNotice: {
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.amber,
  },
  pendingReviewText: {
    fontSize: 11,
    color: COLORS.amberDark,
    lineHeight: 15,
  },
  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    alignItems: 'center',
    marginTop: 6,
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
    color: COLORS.text,
    fontWeight: '800',
  },
  emptyDescription: {
    fontSize: 11,
    color: COLORS.muted,
    lineHeight: 16,
    marginTop: 4,
    textAlign: 'center',
    maxWidth: 260,
  },
  emptySubmitBtn: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.blueLight,
    borderRadius: 10,
  },
  emptySubmitBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.blue,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(6, 23, 43, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmCard: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
    elevation: 8,
    shadowColor: COLORS.navyDark,
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  confirmIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.greenLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.navy,
  },
  confirmSubtitle: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 4,
    marginBottom: 16,
  },
  confirmDetailsBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    marginBottom: 18,
  },
  confirmDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confirmDetailLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.muted,
  },
  confirmDetailValue: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.navy,
  },
  confirmButtonRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  confirmSecondaryBtn: {
    flex: 1,
    height: 46,
    borderRadius: 13,
    borderWidth: 1.2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  confirmSecondaryBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.text,
  },
  confirmPrimaryBtn: {
    flex: 1,
    height: 46,
    borderRadius: 13,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmPrimaryBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.white,
  },
});
