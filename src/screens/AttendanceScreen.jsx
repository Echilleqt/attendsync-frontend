import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  Camera,
  CheckCircle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Fingerprint,
  History,
  RefreshCw,
  ScanFace,
  ShieldCheck,
} from 'lucide-react-native';
import {useFocusEffect} from '@react-navigation/native';
import ReactNativeBiometrics from 'react-native-biometrics';
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
import AttendanceCameraModal from '../components/AttendanceCameraModal';

const biometrics = new ReactNativeBiometrics({
  allowDeviceCredentials: false,
});

export default function AttendanceScreen({token, navigation}) {
  const insets = useSafeAreaInsets();

  // Core Attendance State
  const [attendance, setAttendance] = useState(null);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [refreshError, setRefreshError] = useState('');

  // Biometric Enrollment States
  const [credentials, setCredentials] = useState([]);
  const [selectedCredential, setSelectedCredential] = useState(null);
  const [loadingEnrollment, setLoadingEnrollment] = useState(true);
  const [enrollmentStatusError, setEnrollmentStatusError] = useState('');

  const [faceStatus, setFaceStatus] = useState({enrolled: false, status: 'not_enrolled'});
  const [loadingFaceStatus, setLoadingFaceStatus] = useState(true);
  const [faceStatusError, setFaceStatusError] = useState('');

  // STEP 1: Biometric Method Selection ('fingerprint' | 'face')
  const [selectedMethod, setSelectedMethod] = useState('fingerprint');

  // STEP 2: Biometric Verification States
  const [verifying, setVerifying] = useState(false);
  const [verificationToken, setVerificationToken] = useState(null);
  const [verifiedMethod, setVerifiedMethod] = useState(null);
  const [verificationSuccessNotice, setVerificationSuccessNotice] = useState('');

  // STEP 3: In-App Camera Viewfinder Modal State
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  // STEP 4: Captured Photo Preview State
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewImageError, setPreviewImageError] = useState(false);
  const [pendingAttendanceAction, setPendingAttendanceAction] = useState(null);

  // STEP 5: Submission & Confirmation States
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState('');
  const [submissionSuccessRecord, setSubmissionSuccessRecord] = useState(null);

  // Load Today's Record from authoritative server
  const loadToday = useCallback(async () => {
    if (!token) {
      setAttendance(null);
      setLoadingAttendance(false);
      return;
    }

    setLoadingAttendance(true);
    setRefreshError('');

    try {
      const result = await apiRequest('/attendance/today', token);
      const saved = result.attendance || null;

      if (saved && (!saved.attendance_date || !saved.time_in || !saved.status)) {
        throw new Error(
          'The server response did not include the saved attendance timestamp.',
        );
      }

      setAttendance(saved);
    } catch (error) {
      setRefreshError(
        error.message || 'Unable to retrieve attendance from the server.',
      );
    } finally {
      setLoadingAttendance(false);
    }
  }, [token]);

  // Load Enrolled Fingerprint Credentials
  const loadBiometricCredentials = useCallback(async () => {
    if (!token) {
      setCredentials([]);
      setLoadingEnrollment(false);
      return;
    }

    setLoadingEnrollment(true);
    setEnrollmentStatusError('');

    try {
      const result = await apiRequest('/biometric/credentials', token);
      const fingerprintCredentials = result.methods?.fingerprint?.credentials;

      if (!Array.isArray(fingerprintCredentials)) {
        throw new Error(
          'The server did not return biometric enrollment status.',
        );
      }

      setCredentials(fingerprintCredentials);

      setSelectedCredential(current => {
        if (
          current &&
          fingerprintCredentials.some(
            item => item.credential_id === current.credential_id,
          )
        ) {
          return current;
        }
        return fingerprintCredentials[0] || null;
      });
    } catch (error) {
      setCredentials([]);
      setSelectedCredential(null);
      setEnrollmentStatusError(
        error.message ||
          'Unable to check biometric enrollment with the server.',
      );
    } finally {
      setLoadingEnrollment(false);
    }
  }, [token]);

  // Load Enrolled Face Status
  const loadFaceStatus = useCallback(async () => {
    if (!token) {
      setFaceStatus({enrolled: false, status: 'not_enrolled'});
      setLoadingFaceStatus(false);
      return;
    }

    setLoadingFaceStatus(true);
    setFaceStatusError('');

    try {
      const result = await apiRequest('/face/status', token);
      const payload = result?.data ?? result ?? {};
      const rawStatus =
        payload.status ??
        payload.face_status ??
        payload.enrollment_status ??
        payload.state ??
        '';

      const isEnrolled =
        Boolean(
          payload.enrolled ??
            payload.is_enrolled ??
            payload.face_enrolled ??
            payload.has_face ??
            payload.registered ??
            payload.face_registered,
        ) ||
        (typeof rawStatus === 'string' &&
          ['enrolled', 'registered', 'active', 'verified', 'ready'].includes(
            rawStatus.toLowerCase(),
          ));

      setFaceStatus({
        enrolled: Boolean(isEnrolled),
        status:
          typeof rawStatus === 'string'
            ? rawStatus
            : isEnrolled
            ? 'enrolled'
            : 'not_enrolled',
      });
    } catch (error) {
      setFaceStatus({enrolled: false, status: 'not_enrolled'});
      setFaceStatusError(error.message || 'Unable to confirm face enrollment status.');
    } finally {
      setLoadingFaceStatus(false);
    }
  }, [token]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadToday(), loadBiometricCredentials(), loadFaceStatus()]);
  }, [loadToday, loadBiometricCredentials, loadFaceStatus]);

  useFocusEffect(
    useCallback(() => {
      refreshAll();
    }, [refreshAll]),
  );

  // Determine current transaction type
  const hasTimeIn = Boolean(attendance?.time_in);
  const hasTimeOut = Boolean(attendance?.time_out);
  const currentAction = hasTimeIn ? 'time-out' : 'time-in';
  const actionLabel = currentAction === 'time-out' ? 'Time Out' : 'Time In';

  // STEP 1: Handle method selection and reset token if method changes
  const handleSelectMethod = method => {
    if (method !== selectedMethod) {
      setSelectedMethod(method);
      setVerificationToken(null);
      setVerifiedMethod(null);
      setVerificationSuccessNotice('');
      setSubmissionError('');
    }
  };

  const handleTriggerAction = () => {
    if (verificationToken && !capturedPhoto) {
      setIsCameraOpen(true);
      return;
    }
    executeBiometricVerification();
  };

  // STEP 2: Execute Verification for the Selected Biometric Method
  const executeBiometricVerification = async () => {
    if (!token) {
      setSubmissionError('Authentication session expired. Please sign in again.');
      return;
    }

    // Business validations before verification
    if (currentAction === 'time-in' && attendance?.time_in) {
      setSubmissionError('Time In has already been recorded for today.');
      return;
    }
    if (currentAction === 'time-out' && attendance?.time_out) {
      setSubmissionError('Time Out has already been recorded for today.');
      return;
    }
    if (currentAction === 'time-out' && !attendance?.time_in) {
      setSubmissionError('Time In must be recorded before Time Out can be submitted.');
      return;
    }

    setSubmissionError('');
    setVerificationSuccessNotice('');
    setVerificationToken(null);
    setVerifiedMethod(null);

    // --- FINGERPRINT FLOW ---
    if (selectedMethod === 'fingerprint') {
      if (!selectedCredential) {
        setSubmissionError(
          'Please enroll fingerprint authentication in Profile before recording attendance.',
        );
        return;
      }

      setVerifying(true);

      try {
        const challenge = await apiRequest(
          '/biometric/challenges',
          token,
          {
            method: 'POST',
            body: {
              verification_method: 'fingerprint',
              credential_id: selectedCredential.credential_id,
              purpose: currentAction === 'time-out' ? 'attendance-time-out' : 'attendance-time-in',
            },
          },
        );

        const signature = await biometrics.createSignature({
          promptMessage: `Confirm fingerprint for ${actionLabel}`,
          payload: challenge.message_to_sign,
        });

        if (!signature.success || !signature.signature) {
          throw new Error(
            'Fingerprint verification was cancelled. Attendance photo capture was not opened.',
          );
        }

        const verified = await apiRequest('/biometric/verify', token, {
          method: 'POST',
          body: {
            challenge_id: challenge.challenge_id,
            signature: signature.signature,
          },
        });

        const tokenString =
          verified.biometric_verification_token ||
          verified.verification_token ||
          null;

        if (!tokenString) {
          throw new Error(
            'The server could not verify your biometric signature. Attendance was not recorded.',
          );
        }

        // Biometric verification SUCCEEDED
        setVerificationToken(tokenString);
        setVerifiedMethod('fingerprint');
        setPendingAttendanceAction(currentAction);
        setVerificationSuccessNotice('Fingerprint verified. Please capture your photo proof.');

        // STEP 3: Open in-app camera
        setIsCameraOpen(true);
      } catch (error) {
        setVerificationToken(null);
        setVerifiedMethod(null);
        setPendingAttendanceAction(null);
        setIsCameraOpen(false);
        setSubmissionError(
          error.message || 'Fingerprint verification could not be completed.',
        );
      } finally {
        setVerifying(false);
      }
      return;
    }

    // --- FACE VERIFICATION FLOW ---
    if (selectedMethod === 'face') {
      if (!faceStatus.enrolled) {
        navigation.navigate('FaceRecognition', {
          mode: 'enroll',
          token,
          onEnrollmentComplete: () => {
            loadFaceStatus();
          },
        });
        return;
      }

      setPendingAttendanceAction(currentAction);

      // Navigate to existing FaceRecognition screen with verify mode
      navigation.navigate('FaceRecognition', {
        mode: 'verify',
        token,
        onVerified: response => {
          const faceToken =
            response?.face_verification_token ||
            response?.data?.face_verification_token ||
            null;

          if (!faceToken) {
            setSubmissionError(
              'Face verification completed, but no verification token was received from the server.',
            );
            return;
          }

          // Biometric verification SUCCEEDED
          setVerificationToken(faceToken);
          setVerifiedMethod('face');
          setPendingAttendanceAction(currentAction);
          setVerificationSuccessNotice('Face recognized & verified. Please capture your photo proof.');

          // STEP 3: Open in-app camera
          setIsCameraOpen(true);
        },
        onCancelled: () => {
          setVerificationToken(null);
          setVerifiedMethod(null);
          setPendingAttendanceAction(null);
          setIsCameraOpen(false);
          setSubmissionError(
            'Face verification was cancelled or unverified. Attendance photo capture was not opened.',
          );
        },
      });
    }
  };

  // STEP 3 Callback: In-App Photo Captured
  const handlePhotoCaptured = photo => {
    if (!photo?.uri) {
      setSubmissionError('The in-app camera did not return a valid photo.');
      return;
    }

    setIsCameraOpen(false);
    // STEP 4: Store captured photo for review BEFORE submitting
    setCapturedPhoto(photo);
    setPreviewLoading(false);
    setPreviewImageError(false);
  };

  // STEP 4 Callback: Retake Photo
  const handleRetakePhoto = () => {
    setCapturedPhoto(null);
    setPreviewLoading(false);
    setPreviewImageError(false);
    setSubmissionError('');
    // Re-open in-app camera directly without duplicate submission
    setIsCameraOpen(true);
  };

  // STEP 5: Confirm & Submit Attendance to Laravel
  const submitAttendance = async () => {
    if (!verificationToken || !capturedPhoto) {
      setSubmissionError(
        'Please complete biometric verification and capture an attendance photo proof first.',
      );
      return;
    }

    setSubmitting(true);
    setSubmissionError('');

    try {
      const isTimeOut = pendingAttendanceAction === 'time-out';
      const body = new FormData();

      body.append('verification_method', verifiedMethod || selectedMethod);

      if (verifiedMethod === 'face') {
        body.append('face_verification_token', verificationToken);
      } else {
        body.append('biometric_verification_token', verificationToken);
      }

      body.append('photo', {
        uri: capturedPhoto.uri,
        name: capturedPhoto.name || `attendance-${Date.now()}.jpg`,
        type: capturedPhoto.type || 'image/jpeg',
      });

      const submission = await apiRequest(
        isTimeOut ? '/attendance/time-out' : '/attendance/time-in',
        token,
        {
          method: 'POST',
          body,
          timeout: 25000,
        },
      );

      const saved = submission.attendance;

      if (
        !saved?.attendance_date ||
        !saved?.time_in ||
        (isTimeOut ? !saved?.time_out : !saved?.status)
      ) {
        throw new Error(
          `The server did not return the official saved ${
            isTimeOut ? 'Time Out' : 'Time In'
          } record. Refresh attendance to confirm.`,
        );
      }

      // Success cleanup
      setAttendance(saved);
      setSubmissionSuccessRecord({
        action: isTimeOut ? 'Time Out' : 'Time In',
        officialTimestamp: isTimeOut ? saved.time_out : saved.time_in,
        status: saved.status,
        method: verifiedMethod || selectedMethod,
      });

      setCapturedPhoto(null);
      setVerificationToken(null);
      setVerifiedMethod(null);
      setPendingAttendanceAction(null);
      setVerificationSuccessNotice('');

      // Refresh today's record and credentials
      await loadToday();
    } catch (error) {
      setSubmissionError(
        error.message || 'Attendance could not be submitted to the school server.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const formattedDate = formatAttendanceDate(attendance?.attendance_date);
  const formattedTimeIn = formatAttendanceTime(attendance?.time_in);
  const formattedTimeOut = formatAttendanceTime(attendance?.time_out);
  const hasOfficialTimestamp = Boolean(formattedDate && formattedTimeIn);

  // Can verify check for the currently selected method
  const isMethodReady =
    selectedMethod === 'fingerprint'
      ? Boolean(selectedCredential && credentials.length > 0)
      : true;

  const canTriggerVerification = Boolean(
    token &&
      isMethodReady &&
      !hasTimeOut &&
      !verifying &&
      !submitting &&
      !loadingAttendance &&
      !loadingEnrollment &&
      !loadingFaceStatus,
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
            refreshing={loadingAttendance || loadingEnrollment || loadingFaceStatus}
            onRefresh={refreshAll}
            progressViewOffset={80}
            tintColor={COLORS.white}
            colors={[COLORS.blue]}
          />
        }
      >
        {/* Full-width Reusable Header */}
        <AppHeader
          variant="standard"
          title="Daily Attendance"
          schoolName="BANSUD CENTRAL SCHOOL"
          subtitle="Official DepEd biometric time recording & proof capture."
          rightAction={
            <TouchableOpacity
              style={styles.historyHeaderBtn}
              onPress={() => navigation.navigate('AttendanceHistory')}
              accessibilityRole="button"
              accessibilityLabel="View attendance history"
              activeOpacity={0.7}
            >
              <History size={17} color={COLORS.white} strokeWidth={2.4} />
            </TouchableOpacity>
          }
        />

        <View style={styles.body}>
          {/* Today's Official Record Hero Card */}
          <View style={styles.recordCard}>
            <View style={styles.recordHeader}>
              <View>
                <Text style={styles.cardEyebrow}>OFFICIAL SERVER RECORD</Text>
                <Text style={styles.cardTitle}>Today's attendance</Text>
              </View>

              <StatusBadge
                status={
                  loadingAttendance
                    ? 'loading'
                    : hasTimeIn
                    ? attendance?.status || 'recorded'
                    : 'not_recorded'
                }
                label={
                  loadingAttendance
                    ? 'Checking...'
                    : hasTimeIn
                    ? attendance?.status === 'late'
                      ? 'Late'
                      : 'Recorded'
                    : 'Not recorded'
                }
              />
            </View>

            {loadingAttendance ? (
              <ActivityIndicator
                style={styles.loader}
                color={COLORS.blue}
                size="large"
              />
            ) : hasTimeIn ? (
              <View style={styles.attendanceTimes}>
                {hasOfficialTimestamp ? (
                  <View style={styles.attendanceTimeRow}>
                    <Clock3 size={18} color={COLORS.green} strokeWidth={2.2} />
                    <View style={styles.attendanceTimeCopy}>
                      <Text style={styles.attendanceTimeLabel}>Time In</Text>
                      <Text style={styles.attendanceTimeValue}>{formattedTimeIn}</Text>
                      {attendance?.time_in ? (
                        <Text style={styles.attendanceTimeExact}>
                          {formatAttendanceDateTime(attendance.time_in)}
                        </Text>
                      ) : null}
                      <Text style={styles.attendanceTimeMethod}>
                        Verified by {attendance.time_in_verification_method || 'biometrics'}
                      </Text>
                    </View>
                    <View style={styles.recordedTag}>
                      <Text style={styles.recordedTagText}>RECORDED</Text>
                    </View>
                  </View>
                ) : (
                  <Banner
                    type="warning"
                    message="The saved server Time In is unavailable. Refresh to retrieve the official record."
                  />
                )}

                <View style={styles.attendanceTimeRow}>
                  <Clock3
                    size={18}
                    color={hasTimeOut ? COLORS.green : COLORS.muted}
                    strokeWidth={2.2}
                  />
                  <View style={styles.attendanceTimeCopy}>
                    <Text style={styles.attendanceTimeLabel}>Time Out</Text>
                    <Text style={styles.attendanceTimeValue}>
                      {formattedTimeOut || 'Not recorded'}
                    </Text>
                    {hasTimeOut && attendance?.time_out ? (
                      <Text style={styles.attendanceTimeExact}>
                        {formatAttendanceDateTime(attendance.time_out)}
                      </Text>
                    ) : null}
                    {hasTimeOut ? (
                      <Text style={styles.attendanceTimeMethod}>
                        Verified by {attendance.time_out_verification_method || 'biometrics'}
                      </Text>
                    ) : null}
                  </View>
                  {hasTimeOut ? (
                    <View style={styles.recordedTag}>
                      <Text style={styles.recordedTagText}>RECORDED</Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.recordDate}>{formattedDate}</Text>
                <Text style={styles.timezoneNote}>Official times · Asia/Manila</Text>
              </View>
            ) : (
              <View style={styles.emptyPanel}>
                <View style={styles.emptyIconCircle}>
                  <Clock3 size={32} color={COLORS.blue} strokeWidth={2} />
                </View>
                <Text style={styles.emptyTitle}>Ready for {actionLabel}</Text>
                <Text style={styles.emptyDescription}>
                  Select your biometric verification method, take an in-app photo proof, and confirm before recording.
                </Text>
              </View>
            )}

            {attendance?.status && (
              <View style={styles.savedStatus}>
                <Text style={styles.savedStatusLabel}>Attendance status</Text>
                <Text
                  style={[
                    styles.savedStatusValue,
                    attendance.status === 'late' && styles.lateValue,
                  ]}
                >
                  {attendance.status === 'late'
                    ? 'Late'
                    : attendance.status === 'present'
                    ? 'On Time'
                    : attendance.status.replace(/_/g, ' ')}
                </Text>
              </View>
            )}

            {/* Link to Dedicated Attendance History Screen */}
            <TouchableOpacity
              style={styles.historyLinkRow}
              onPress={() => navigation.navigate('AttendanceHistory')}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <View style={styles.historyLinkLeft}>
                <History size={16} color={COLORS.blue} strokeWidth={2.2} />
                <Text style={styles.historyLinkText}>View Attendance History & Logs</Text>
              </View>
              <ChevronRight size={16} color={COLORS.blue} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          {/* Submission Success Alert Card */}
          {submissionSuccessRecord ? (
            <View style={styles.successCard}>
              <View style={styles.successIconCircle}>
                <CheckCircle size={32} color={COLORS.green} strokeWidth={2.4} />
              </View>
              <Text style={styles.successTitle}>
                {submissionSuccessRecord.action} Successfully Recorded!
              </Text>
              <Text style={styles.successDescription}>
                Official server timestamp authenticated and saved to your school record.
              </Text>

              <View style={styles.successDetailsBox}>
                <View style={styles.successDetailRow}>
                  <Text style={styles.successDetailLabel}>Official Timestamp</Text>
                  <Text style={styles.successDetailValue}>
                    {formatAttendanceDateTime(submissionSuccessRecord.officialTimestamp) || 'Recorded'}
                  </Text>
                </View>

                <View style={styles.successDetailRow}>
                  <Text style={styles.successDetailLabel}>Attendance Status</Text>
                  <Text
                    style={[
                      styles.successDetailValue,
                      submissionSuccessRecord.status === 'late'
                        ? styles.lateValue
                        : styles.onTimeValue,
                    ]}
                  >
                    {submissionSuccessRecord.status === 'late' ? 'Late' : 'On Time'}
                  </Text>
                </View>

                <View style={styles.successDetailRow}>
                  <Text style={styles.successDetailLabel}>Verified Biometric</Text>
                  <Text style={styles.successDetailValue}>
                    {submissionSuccessRecord.method === 'face'
                      ? 'Face Verification'
                      : 'Fingerprint Authentication'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.dismissSuccessBtn}
                onPress={() => setSubmissionSuccessRecord(null)}
                accessibilityRole="button"
              >
                <Text style={styles.dismissSuccessBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {refreshError ? (
            <Banner
              type="error"
              message={refreshError}
              actionText="Retry"
              onAction={loadToday}
            />
          ) : null}

          {submissionError ? (
            <Banner
              type="error"
              message={submissionError}
            />
          ) : null}

          {verificationSuccessNotice ? (
            <Banner
              type="success"
              message={verificationSuccessNotice}
            />
          ) : null}

          {/* Daily Attendance Completed Confirmation Card */}
          {hasTimeOut && (
            <View style={styles.completedCard}>
              <View style={styles.completedIconBox}>
                <CheckCircle2 size={24} color={COLORS.green} strokeWidth={2.4} />
              </View>
              <View style={styles.completedCopy}>
                <Text style={styles.completedTitle}>Attendance Complete for Today</Text>
                <Text style={styles.completedSubtitle}>
                  Both Time In and Time Out have been successfully recorded with verified biometrics and photo proofs.
                </Text>
              </View>
            </View>
          )}

          {/* ATTENDANCE TRANSACTION WORKFLOW CARD */}
          {!hasTimeOut && (
            <View style={styles.actionCard}>
              {/* STEP 4: PHOTO PREVIEW & CONFIRMATION */}
              {capturedPhoto ? (
                <>
                  <View style={styles.flowHeader}>
                    <Text style={styles.flowStepBadge}>STEP 4 OF 4</Text>
                    <Text style={styles.sectionTitle}>Review Attendance Proof</Text>
                  </View>

                  <Text style={styles.infoText}>
                    Verify your in-app camera snapshot before submitting{' '}
                    <Text style={{fontWeight: '800', color: COLORS.navy}}>
                      {pendingAttendanceAction === 'time-out' ? 'Time Out' : 'Time In'}
                    </Text>
                    . Official timestamp will be generated by the school server upon confirmation.
                  </Text>

                  <ImageBackground
                    key={capturedPhoto.uri}
                    source={{uri: capturedPhoto.uri}}
                    style={styles.photoPreview}
                    imageStyle={styles.previewImage}
                    resizeMode="cover"
                    onLoadStart={() => {
                      setPreviewLoading(true);
                      setPreviewImageError(false);
                    }}
                    onLoad={() => {
                      setPreviewLoading(false);
                      setPreviewImageError(false);
                    }}
                    onError={() => {
                      setPreviewLoading(false);
                      setPreviewImageError(true);
                    }}
                  >
                    {previewLoading && !previewImageError ? (
                      <View style={styles.photoLoadStatus}>
                        <ActivityIndicator color={COLORS.white} />
                        <Text style={styles.photoLoadStatusText}>
                          Loading photo preview...
                        </Text>
                      </View>
                    ) : null}

                    {previewImageError ? (
                      <View style={styles.photoLoadError}>
                        <Text style={styles.photoLoadErrorText}>
                          Could not display the photo preview. Please retake it before submitting.
                        </Text>
                      </View>
                    ) : null}

                    <View style={styles.photoTimestamp}>
                      <Text style={styles.photoTimestampDate}>
                        {pendingAttendanceAction === 'time-out' ? 'TIME OUT PROOF' : 'TIME IN PROOF'}
                      </Text>
                      <Text style={styles.photoTimestampNote}>
                        VERIFIED BY{' '}
                        {verifiedMethod === 'face'
                          ? 'FACE RECOGNITION'
                          : 'FINGERPRINT KEYSTORE'}
                        {' · '}AUTHORITATIVE SERVER TIMESTAMP WILL APPLY
                      </Text>
                    </View>
                  </ImageBackground>

                  <View style={styles.photoButtonGroup}>
                    <TouchableOpacity
                      style={[
                        styles.secondaryButton,
                        submitting && styles.buttonDisabled,
                      ]}
                      onPress={handleRetakePhoto}
                      disabled={submitting}
                      accessibilityRole="button"
                    >
                      <RefreshCw size={16} color={COLORS.navy} strokeWidth={2.4} />
                      <Text style={styles.secondaryButtonText}>Retake Photo</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.primaryButton,
                        styles.primarySubmitBtn,
                        (submitting || previewImageError) && styles.buttonDisabled,
                      ]}
                      onPress={submitAttendance}
                      disabled={submitting || previewImageError}
                      accessibilityRole="button"
                    >
                      {submitting ? (
                        <>
                          <ActivityIndicator color={COLORS.white} size="small" />
                          <Text style={styles.primaryButtonText}>Submitting to Server…</Text>
                        </>
                      ) : (
                        <>
                          <CheckCircle size={18} color={COLORS.white} strokeWidth={2.4} />
                          <Text style={styles.primaryButtonText}>
                            Use Photo / Confirm {actionLabel}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                /* STEP 1: SELECT BIOMETRIC METHOD */
                <>
                  <View style={styles.flowHeader}>
                    <Text style={styles.flowStepBadge}>STEP 1 & 2</Text>
                    <Text style={styles.sectionTitle}>
                      Choose Biometric Verification
                    </Text>
                  </View>

                  <Text style={styles.infoText}>
                    Select your preferred biometric method for{' '}
                    <Text style={{fontWeight: '800', color: COLORS.navy}}>{actionLabel}</Text>.
                    Verification is required before camera photo proof opens.
                  </Text>

                  {/* METHOD 1: FINGERPRINT OPTION */}
                  <TouchableOpacity
                    style={[
                      styles.methodCard,
                      selectedMethod === 'fingerprint' && styles.methodCardSelected,
                    ]}
                    onPress={() => handleSelectMethod('fingerprint')}
                    accessibilityRole="radio"
                    accessibilityState={{selected: selectedMethod === 'fingerprint'}}
                    activeOpacity={0.85}
                  >
                    <View
                      style={[
                        styles.methodIconBox,
                        selectedMethod === 'fingerprint' && styles.methodIconBoxSelected,
                      ]}
                    >
                      <Fingerprint
                        size={22}
                        color={selectedMethod === 'fingerprint' ? COLORS.blue : COLORS.navy}
                        strokeWidth={2.2}
                      />
                    </View>

                    <View style={styles.methodCopy}>
                      <View style={styles.methodTitleRow}>
                        <Text style={styles.methodTitle}>Fingerprint Authentication</Text>
                        {credentials.length > 0 ? (
                          <View style={styles.enrolledBadge}>
                            <Text style={styles.enrolledBadgeText}>ENROLLED</Text>
                          </View>
                        ) : null}
                      </View>

                      <Text style={styles.methodSubtitle}>
                        {loadingEnrollment
                          ? 'Checking fingerprint enrollment…'
                          : credentials.length > 0
                          ? `${selectedCredential?.device_name || 'Device key registered'} · Hardware keystore verified`
                          : 'Not enrolled on this device. Set up fingerprint in Profile.'}
                      </Text>

                      {!loadingEnrollment && credentials.length === 0 ? (
                        <TouchableOpacity
                          style={styles.setupInlineBtn}
                          onPress={() => navigation.navigate('Profile')}
                          accessibilityRole="button"
                        >
                          <Text style={styles.setupInlineBtnText}>Set Up Fingerprint in Profile →</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    <View
                      style={[
                        styles.radioCircle,
                        selectedMethod === 'fingerprint' && styles.radioCircleSelected,
                      ]}
                    >
                      {selectedMethod === 'fingerprint' ? (
                        <View style={styles.radioDot} />
                      ) : null}
                    </View>
                  </TouchableOpacity>

                  {/* METHOD 2: FACE VERIFICATION OPTION */}
                  <TouchableOpacity
                    style={[
                      styles.methodCard,
                      selectedMethod === 'face' && styles.methodCardSelected,
                    ]}
                    onPress={() => handleSelectMethod('face')}
                    accessibilityRole="radio"
                    accessibilityState={{selected: selectedMethod === 'face'}}
                    activeOpacity={0.85}
                  >
                    <View
                      style={[
                        styles.methodIconBox,
                        selectedMethod === 'face' && styles.methodIconBoxSelected,
                      ]}
                    >
                      <ScanFace
                        size={22}
                        color={selectedMethod === 'face' ? COLORS.blue : COLORS.navy}
                        strokeWidth={2.2}
                      />
                    </View>

                    <View style={styles.methodCopy}>
                      <View style={styles.methodTitleRow}>
                        <Text style={styles.methodTitle}>Face Verification</Text>
                        {faceStatus.enrolled ? (
                          <View style={styles.enrolledBadge}>
                            <Text style={styles.enrolledBadgeText}>ENROLLED</Text>
                          </View>
                        ) : null}
                      </View>

                      <Text style={styles.methodSubtitle}>
                        {loadingFaceStatus
                          ? 'Checking server face model…'
                          : faceStatus.enrolled
                          ? 'Server face model active · Real-time blink liveness detection'
                          : "You haven't registered your face yet. Register your face first to use Face Recognition for attendance verification."}
                      </Text>

                      {!loadingFaceStatus && !faceStatus.enrolled ? (
                        <TouchableOpacity
                          style={styles.setupInlineBtn}
                          onPress={() =>
                            navigation.navigate('FaceRecognition', {
                              mode: 'enroll',
                              token,
                              onEnrollmentComplete: () => loadFaceStatus(),
                            })
                          }
                          accessibilityRole="button"
                        >
                          <Text style={styles.setupInlineBtnText}>Register My Face →</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    <View
                      style={[
                        styles.radioCircle,
                        selectedMethod === 'face' && styles.radioCircleSelected,
                      ]}
                    >
                      {selectedMethod === 'face' ? (
                        <View style={styles.radioDot} />
                      ) : null}
                    </View>
                  </TouchableOpacity>

                  {/* STEP 2 TRIGGER BUTTON */}
                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      !canTriggerVerification && !verificationToken && styles.buttonDisabled,
                    ]}
                    onPress={handleTriggerAction}
                    disabled={!canTriggerVerification && !verificationToken}
                    accessibilityRole="button"
                    activeOpacity={0.85}
                  >
                    {verifying ? (
                      <>
                        <ActivityIndicator color={COLORS.white} size="small" />
                        <Text style={styles.primaryButtonText}>
                          {selectedMethod === 'fingerprint'
                            ? 'Verifying Fingerprint Hardware…'
                            : 'Preparing Face Verification…'}
                        </Text>
                      </>
                    ) : verificationToken ? (
                      <>
                        <Camera size={19} color={COLORS.white} strokeWidth={2.4} />
                        <Text style={styles.primaryButtonText}>
                          Open Camera ({verifiedMethod === 'face' ? 'Face Verified' : 'Fingerprint Verified'})
                        </Text>
                      </>
                    ) : (
                      <>
                        {selectedMethod === 'fingerprint' ? (
                          <Fingerprint size={19} color={COLORS.white} strokeWidth={2.4} />
                        ) : (
                          <ScanFace size={19} color={COLORS.white} strokeWidth={2.4} />
                        )}
                        <Text style={styles.primaryButtonText}>
                          {selectedMethod === 'fingerprint'
                            ? `Verify Fingerprint & Open Camera`
                            : !faceStatus.enrolled
                            ? `Register My Face`
                            : `Verify Face & Open Camera`}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <Text style={styles.privacyNote}>
                    {selectedMethod === 'fingerprint'
                      ? 'Device signs a one-time cryptographic challenge. Biometric data never leaves the hardware.'
                      : 'Live face liveness and facial geometry are authenticated strictly against the central server.'}
                  </Text>
                </>
              )}
            </View>
          )}

          {/* Institutional Integrity Note */}
          <View style={styles.infoCard}>
            <View style={styles.infoIconBox}>
              <ShieldCheck size={20} color={COLORS.blue} strokeWidth={2.2} />
            </View>
            <View style={{flex: 1}}>
              <Text style={styles.infoTitle}>DepEd Biometric Integrity</Text>
              <Text style={styles.infoDescription}>
                Official arrival and departure timestamps are authenticated strictly against the central school server. Tamper detection is enforced.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* STEP 3: EMBEDDED IN-APP CAMERA MODAL */}
      <AttendanceCameraModal
        visible={isCameraOpen}
        title={`${actionLabel} Photo Proof`}
        subtitle="In-app DepEd attendance verification"
        onCapture={handlePhotoCaptured}
        onClose={() => {
          setIsCameraOpen(false);
        }}
      />
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
  body: {
    paddingHorizontal: 20,
    marginTop: -20,
  },
  recordCard: {
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
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: COLORS.muted,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  loader: {
    marginVertical: 32,
  },
  attendanceTimes: {
    paddingTop: 14,
  },
  attendanceTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 4,
  },
  attendanceTimeCopy: {
    flex: 1,
    marginLeft: 12,
  },
  attendanceTimeLabel: {
    fontSize: 11,
    color: COLORS.muted,
    fontWeight: '700',
  },
  attendanceTimeValue: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '800',
    marginTop: 2,
  },
  attendanceTimeExact: {
    fontSize: 12,
    color: COLORS.navy,
    fontWeight: '700',
    marginTop: 2,
  },
  attendanceTimeMethod: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  recordedTag: {
    backgroundColor: COLORS.greenLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  recordedTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.green,
    letterSpacing: 0.5,
  },
  recordDate: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  timezoneNote: {
    fontSize: 10,
    color: COLORS.muted,
    marginTop: 4,
    textAlign: 'center',
  },
  emptyPanel: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  emptyDescription: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 6,
    maxWidth: 290,
  },
  savedStatus: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  savedStatusLabel: {
    fontSize: 12,
    color: COLORS.muted,
    fontWeight: '600',
  },
  savedStatusValue: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.green,
    textTransform: 'capitalize',
  },
  lateValue: {
    color: COLORS.amber,
  },
  onTimeValue: {
    color: COLORS.green,
  },
  actionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 18,
    marginTop: 14,
    elevation: 2,
    shadowColor: COLORS.navyDark,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#EDF2F7',
  },
  flowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  flowStepBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.blue,
    backgroundColor: COLORS.blueLight,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    letterSpacing: 0.5,
  },
  sectionTitle: {
    color: COLORS.navy,
    fontSize: 16,
    fontWeight: '800',
  },
  infoText: {
    fontSize: 12,
    color: COLORS.muted,
    lineHeight: 17,
    marginBottom: 14,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    backgroundColor: '#FAFCFE',
  },
  methodCardSelected: {
    borderColor: COLORS.blue,
    backgroundColor: '#F5FAFE',
  },
  methodIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  methodIconBoxSelected: {
    backgroundColor: COLORS.blueLight,
  },
  methodCopy: {
    flex: 1,
    paddingRight: 8,
  },
  methodTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  methodTitle: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '800',
  },
  enrolledBadge: {
    backgroundColor: COLORS.greenLight,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  enrolledBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: COLORS.green,
    letterSpacing: 0.4,
  },
  methodSubtitle: {
    fontSize: 11,
    color: COLORS.muted,
    lineHeight: 15,
    marginTop: 2,
  },
  setupInlineBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  setupInlineBtnText: {
    fontSize: 11,
    color: COLORS.blue,
    fontWeight: '800',
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  radioCircleSelected: {
    borderColor: COLORS.blue,
  },
  radioDot: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: COLORS.blue,
  },
  photoPreview: {
    width: '100%',
    height: 240,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0A1A2F',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  previewImage: {
    borderRadius: 16,
  },
  photoLoadStatus: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoLoadStatusText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
  },
  photoLoadError: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  photoLoadErrorText: {
    color: '#FCA5A5',
    fontSize: 12,
    textAlign: 'center',
  },
  photoTimestamp: {
    backgroundColor: 'rgba(6, 23, 43, 0.82)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  photoTimestampDate: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  photoTimestampNote: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  photoButtonGroup: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  primarySubmitBtn: {
    flex: 1,
    marginTop: 0,
  },
  primaryButton: {
    height: 52,
    backgroundColor: COLORS.navy,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    elevation: 3,
    shadowColor: COLORS.navy,
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.3,
  },
  secondaryButton: {
    height: 52,
    paddingHorizontal: 16,
    borderColor: COLORS.border,
    borderWidth: 1.2,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: {
    fontSize: 13,
    color: COLORS.navy,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  privacyNote: {
    fontSize: 11,
    color: COLORS.muted,
    lineHeight: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  successCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
    borderWidth: 1.5,
    borderRadius: 20,
    padding: 20,
    marginTop: 14,
    alignItems: 'center',
  },
  successIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  successTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#15803D',
    textAlign: 'center',
  },
  successDescription: {
    fontSize: 12,
    color: '#166534',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  successDetailsBox: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    width: '100%',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: 14,
  },
  successDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  successDetailLabel: {
    fontSize: 12,
    color: COLORS.muted,
    fontWeight: '600',
  },
  successDetailValue: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '800',
  },
  dismissSuccessBtn: {
    backgroundColor: '#15803D',
    borderRadius: 12,
    height: 44,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissSuccessBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '800',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    elevation: 2,
    shadowColor: COLORS.navyDark,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 6,
    gap: 12,
  },
  infoIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 3,
  },
  infoDescription: {
    fontSize: 11,
    color: COLORS.muted,
    lineHeight: 16,
  },
  completedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 20,
    padding: 16,
    marginTop: 14,
    gap: 12,
  },
  completedIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedCopy: {
    flex: 1,
  },
  completedTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#15803D',
  },
  completedSubtitle: {
    fontSize: 11,
    color: '#166534',
    marginTop: 2,
    lineHeight: 16,
  },
  historyHeaderBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  historyLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  historyLinkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyLinkText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.blue,
  },
});