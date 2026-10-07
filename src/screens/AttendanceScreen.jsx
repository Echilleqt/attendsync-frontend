import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {Camera, CheckCircle, Clock3, RefreshCw} from 'lucide-react-native';
import {useFocusEffect} from '@react-navigation/native';
import ReactNativeBiometrics from 'react-native-biometrics';
import {launchCamera} from 'react-native-image-picker';
import {apiRequest} from '../api/client';
import {
  formatAttendanceDate,
  formatAttendanceTime,
} from '../utils/attendanceFormat';

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

const biometrics = new ReactNativeBiometrics({
  allowDeviceCredentials: false,
});

function formatCaptureTimestamp(value) {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(value);
}

export default function AttendanceScreen({token, navigation}) {
  const [attendance, setAttendance] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewImageError, setPreviewImageError] = useState(false);
  const [captureTime, setCaptureTime] = useState(null);
  const [verificationToken, setVerificationToken] = useState(null);
  const [pendingAttendanceAction, setPendingAttendanceAction] = useState(null);
  const [credentials, setCredentials] = useState([]);
  const [selectedCredential, setSelectedCredential] = useState(null);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [loadingEnrollment, setLoadingEnrollment] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const [submissionError, setSubmissionError] = useState('');
  const [enrollmentStatusError, setEnrollmentStatusError] = useState('');

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

      if (
        saved &&
        (!saved.attendance_date || !saved.time_in || !saved.status)
      ) {
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
      const fingerprintCredentials =
        result.methods?.fingerprint?.credentials;

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

  useFocusEffect(
    useCallback(() => {
      loadToday();
      loadBiometricCredentials();
    }, [loadToday, loadBiometricCredentials]),
  );

  const requestPhoto = async () => {
    if (Platform.OS === 'android') {
      const permission = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
      );

      if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
        throw new Error(
          'Camera permission is required to capture attendance proof.',
        );
      }
    }

    const result = await launchCamera({
      mediaType: 'photo',
      cameraType: 'back',
      saveToPhotos: false,
      maxWidth: 1280,
      maxHeight: 1280,
      quality: 0.8,
    });

    console.log(
      '[ATTENDSYNC] CAPTURE RESULT:',
      JSON.stringify({
        didCancel: result.didCancel,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        assets: result.assets?.map(asset => ({
          uri: asset.uri,
          originalPath: asset.originalPath,
          type: asset.type,
          fileName: asset.fileName,
          width: asset.width,
          height: asset.height,
        })),
      }),
    );

    if (result.didCancel) {
      return null;
    }

    if (result.errorCode) {
      throw new Error(
        result.errorMessage ||
          'The camera could not capture an attendance photo.',
      );
    }

    const photo = result.assets?.[0];

    if (!photo?.uri) {
      throw new Error('The camera did not return a photo.');
    }

    /*
     * IMPORTANT:
     * Use the URI returned by react-native-image-picker.
     * This is the URI intended for React Native Image rendering
     * and FormData upload.
     */
    const photoUri = photo.uri;

    console.log(
      '[ATTENDSYNC] PHOTO ASSET:',
      JSON.stringify(photo, null, 2),
    );

    console.log('[ATTENDSYNC] REVIEW PHOTO URI:', photoUri);

    if (!photoUri) {
      throw new Error(
        'The camera returned a photo but no usable image URI.',
      );
    }

    return {
      uri: photoUri,
      name: photo.fileName || `attendance-${Date.now()}.jpg`,
      type: photo.type || 'image/jpeg',
    };
  };

  const verifyAndPrepareAttendance = async action => {
    if (!token || !selectedCredential) {
      setSubmissionError(
        'Set up fingerprint authentication in Profile before recording attendance.',
      );
      return;
    }

    if (action === 'time-in' && attendance?.time_in) {
      return;
    }

    if (action === 'time-out' && !attendance?.time_in) {
      Alert.alert(
        'Time Out Unavailable',
        'Please record your Time In before recording Time Out.',
      );
      return;
    }

    if (action === 'time-out' && attendance?.time_out) {
      Alert.alert(
        'Time Out Already Recorded',
        `Your recorded Time Out is ${formatAttendanceTime(attendance.time_out) || attendance.time_out}.`,
      );
      return;
    }

    setSubmitting(true);
    setSubmissionError('');

    try {
      const sensor = await biometrics.isSensorAvailable();

      if (!sensor.available) {
        throw new Error(
          'This device does not have an enrolled biometric configured for secure signing. You can continue using email and password for account access.',
        );
      }

      const challenge = await apiRequest('/biometric/challenges', token, {
        method: 'POST',
        body: {
          verification_method: 'fingerprint',
          credential_id: selectedCredential.credential_id,
        },
      });

      const signed = await biometrics.createSignature({
        promptMessage: `Verify your identity to record ${action === 'time-out' ? 'Time Out' : 'Time In'}`,
        payload: challenge.message_to_sign,
      });

      if (!signed.success || !signed.signature) {
        throw new Error(
          'Biometric verification was cancelled or unsuccessful. No attendance was submitted.',
        );
      }

      const verified = await apiRequest('/biometric/verify', token, {
        method: 'POST',
        body: {
          challenge_id: challenge.challenge_id,
          signature: signed.signature,
        },
      });

      if (!verified.biometric_verification_token) {
        throw new Error(
          'The server did not confirm biometric verification. No attendance was submitted.',
        );
      }

      const photo = await requestPhoto();

      if (!photo) {
        setSubmissionError(
          'Photo capture was cancelled. No attendance was submitted.',
        );
        return;
      }

      console.log(
        '[ATTENDSYNC] SETTING CAPTURED PHOTO:',
        JSON.stringify(photo),
      );

      setCapturedPhoto(photo);
      setPreviewLoading(true);
      setPreviewImageError(false);
      setCaptureTime(new Date());
      setVerificationToken(verified.biometric_verification_token);
      setPendingAttendanceAction(action);
      setSubmissionError('');
    } catch (error) {
      setSubmissionError(
        error.message || 'Attendance could not be prepared.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const retakePhoto = async () => {
    setSubmitting(true);
    setSubmissionError('');

    try {
      const photo = await requestPhoto();

      if (photo) {
        console.log(
          '[ATTENDSYNC] SETTING CAPTURED PHOTO:',
          JSON.stringify(photo),
        );

        setCapturedPhoto(photo);
        setPreviewLoading(true);
        setPreviewImageError(false);
        setCaptureTime(new Date());
      }
    } catch (error) {
      setSubmissionError(
        error.message || 'The attendance photo could not be retaken.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const submitAttendance = async () => {
    if (!capturedPhoto || !verificationToken || !pendingAttendanceAction) {
      setSubmissionError(
        'Verify your identity and capture a photo before submitting attendance.',
      );
      return;
    }

    setSubmitting(true);
    setSubmissionError('');

    try {
      const body = new FormData();

      body.append(
        'biometric_verification_token',
        verificationToken,
      );

      body.append('photo', {
        uri: capturedPhoto.uri,
        name: capturedPhoto.name,
        type: capturedPhoto.type,
      });

      const isTimeOut = pendingAttendanceAction === 'time-out';
      const submission = await apiRequest(
        isTimeOut ? '/attendance/time-out' : '/attendance/time-in',
        token,
        {
        method: 'POST',
        body,
        },
      );

      const saved = submission.attendance;

      if (!saved?.attendance_date || !saved?.time_in ||
        (isTimeOut ? !saved?.time_out : !saved?.status)) {
        throw new Error(
          `The server did not return the official ${isTimeOut ? 'Time Out' : 'Time In'} record. Refresh attendance to confirm the saved record.`,
        );
      }

      setAttendance(saved);
      setCapturedPhoto(null);
      setCaptureTime(null);
      setVerificationToken(null);
      setPreviewLoading(false);
      setPreviewImageError(false);
      setPendingAttendanceAction(null);

      await loadToday();

      Alert.alert(
        isTimeOut ? 'Time Out recorded' : 'Time In recorded',
        `Your official ${isTimeOut ? 'Time Out' : 'Time In'} was returned by the attendance server.`,
      );
    } catch (error) {
      setSubmissionError(
        error.message || 'Attendance could not be submitted.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const formattedDate = formatAttendanceDate(
    attendance?.attendance_date,
  );

  const formattedTime = formatAttendanceTime(attendance?.time_in);

  const hasOfficialTimestamp = Boolean(
    formattedDate && formattedTime,
  );

  const hasTimeIn = Boolean(attendance?.time_in);
  const hasTimeOut = Boolean(attendance?.time_out);

  const canSubmit = Boolean(
    token &&
      selectedCredential &&
      !hasTimeOut &&
      !submitting &&
      !loadingAttendance,
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.navyDeep}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>
            BANSUD CENTRAL SCHOOL
          </Text>

          <Text style={styles.title}>Attendance</Text>

          <Text style={styles.subtitle}>
            Securely record your arrival using your enrolled device
            biometric.
          </Text>
        </View>

        <View style={styles.recordCard}>
          <View style={styles.recordHeader}>
            <View>
              <Text style={styles.cardEyebrow}>
                OFFICIAL SERVER RECORD
              </Text>

              <Text style={styles.cardTitle}>
                Today's attendance
              </Text>
            </View>

            <View
              style={[
                styles.statusBadge,
                hasTimeIn
                  ? styles.successBadge
                  : styles.pendingBadge,
              ]}>
              <View
                style={[
                  styles.statusDot,
                  hasTimeIn
                    ? styles.successDot
                    : styles.pendingDot,
                ]}
              />

              <Text
                style={[
                  styles.statusText,
                  hasTimeIn
                    ? styles.successText
                    : styles.pendingText,
                ]}>
                {loadingAttendance
                  ? 'Loading'
                  : hasTimeIn
                  ? attendance.status === 'late'
                    ? 'Late'
                    : 'Recorded'
                  : 'Not recorded'}
              </Text>
            </View>
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
                  <Clock3
                    size={18}
                    color={COLORS.green}
                    strokeWidth={2}
                  />

                  <View style={styles.attendanceTimeCopy}>
                    <Text style={styles.attendanceTimeLabel}>
                      Time In
                    </Text>

                    <Text style={styles.attendanceTimeValue}>
                      {formattedTime}
                    </Text>
                  </View>

                  <Text style={styles.officialTag}>
                    RECORDED
                  </Text>
                </View>
              ) : (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>
                    The saved server Time In is unavailable.
                    Refresh to retrieve the official record.
                  </Text>
                </View>
              )}

              <View style={styles.attendanceTimeRow}>
                <Clock3
                  size={18}
                  color={
                    attendance.time_out
                      ? COLORS.green
                      : COLORS.muted
                  }
                  strokeWidth={2}
                />

                <View style={styles.attendanceTimeCopy}>
                  <Text style={styles.attendanceTimeLabel}>
                    Time Out
                  </Text>

                  <Text style={styles.attendanceTimeValue}>
                    {formatAttendanceTime(attendance.time_out) ||
                      'Not recorded'}
                  </Text>
                </View>

                {attendance.time_out ? (
                  <Text style={styles.officialTag}>
                    RECORDED
                  </Text>
                ) : null}
              </View>

              <Text style={styles.recordDate}>
                {formattedDate}
              </Text>

              <Text style={styles.timezoneNote}>
                Official times · Asia/Manila
              </Text>
            </View>
          ) : (
            <View style={styles.emptyPanel}>
              <Clock3
                size={34}
                color={COLORS.blue}
                strokeWidth={1.8}
              />

              <Text style={styles.emptyTitle}>
                Ready when you are
              </Text>

              <Text style={styles.emptyDescription}>
                Verify your identity, take a photo, then review it
                before submitting Time In.
              </Text>
            </View>
          )}

          {attendance?.status && (
            <View style={styles.savedStatus}>
              <Text style={styles.savedStatusLabel}>
                Attendance status
              </Text>

              <Text
                style={[
                  styles.savedStatusValue,
                  attendance.status === 'late' &&
                    styles.lateValue,
                ]}>
                {attendance.status === 'late'
                  ? 'Late'
                  : attendance.status === 'present'
                  ? 'On Time'
                  : attendance.status.replace(/_/g, ' ')}
              </Text>
            </View>
          )}
        </View>

        {refreshError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>
              {refreshError}
            </Text>

            <TouchableOpacity
              onPress={loadToday}
              accessibilityRole="button">
              <Text style={styles.inlineAction}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {submissionError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>
              {submissionError}
            </Text>
          </View>
        ) : null}

        {(!hasTimeIn || !hasTimeOut) && (
          <View style={styles.actionCard}>
            {capturedPhoto ? (
              <>
                <Text style={styles.sectionTitle}>
                  Review attendance proof
                </Text>

                <Text style={styles.infoText}>
                  Check your photo and capture timestamp before
                  submitting {pendingAttendanceAction === 'time-out' ? 'Time Out' : 'Time In'}.
                </Text>

                <ImageBackground
                  key={capturedPhoto.uri}
                  source={{uri: capturedPhoto.uri}}
                  style={styles.photoPreview}
                  imageStyle={styles.previewImage}
                  resizeMode="contain"
                  onLoadStart={() => {
                    console.log(
                      '[ATTENDSYNC] PHOTO PREVIEW LOAD START',
                    );

                    setPreviewLoading(true);
                    setPreviewImageError(false);
                  }}
                  onLoad={() => {
                    console.log(
                      '[ATTENDSYNC] PHOTO PREVIEW LOADED',
                    );

                    setPreviewLoading(false);
                    setPreviewImageError(false);
                  }}
                  onError={event => {
                    console.warn(
                      '[ATTENDSYNC] PHOTO PREVIEW ERROR:',
                      event.nativeEvent,
                    );

                    setPreviewLoading(false);
                    setPreviewImageError(true);
                  }}>
                  {previewLoading && !previewImageError ? (
                    <View style={styles.photoLoadStatus}>
                      <ActivityIndicator
                        color={COLORS.white}
                      />

                      <Text style={styles.photoLoadStatusText}>
                        Loading photo preview...
                      </Text>
                    </View>
                  ) : null}

                  {previewImageError ? (
                    <View style={styles.photoLoadError}>
                      <Text
                        style={styles.photoLoadErrorText}>
                        Could not display the camera photo. Please
                        retake it before submitting.
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.photoTimestamp}>
                    <Text style={styles.photoTimestampDate}>
                      {formatCaptureTimestamp(captureTime)}
                    </Text>

                    <Text style={styles.photoTimestampNote}>
                      {pendingAttendanceAction === 'time-out' ? 'TIME OUT' : 'TIME IN'} PHOTO CAPTURE TIME · ASIA/MANILA
                    </Text>
                  </View>
                </ImageBackground>

                {__DEV__ ? (
                  <Text style={styles.photoUriDiagnostic}>
                    Photo URI:{' '}
                    {capturedPhoto.uri || 'NONE'}
                  </Text>
                ) : null}

                <Text style={styles.previewDisclaimer}>
                  This is the device photo-capture time for review.
                  The official attendance time is assigned by the
                  server after submission.
                </Text>

                <TouchableOpacity
                  style={[
                    styles.secondaryButton,
                    submitting && styles.buttonDisabled,
                  ]}
                  onPress={retakePhoto}
                  disabled={submitting}
                  accessibilityRole="button">
                  {submitting ? (
                    <ActivityIndicator
                      color={COLORS.navy}
                    />
                  ) : (
                    <>
                      <RefreshCw
                        size={17}
                        color={COLORS.navy}
                        strokeWidth={2.2}
                      />

                      <Text
                        style={styles.secondaryButtonText}>
                        Retake photo
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    (submitting || previewImageError) &&
                      styles.buttonDisabled,
                  ]}
                  onPress={submitAttendance}
                  disabled={
                    submitting || previewImageError
                  }
                  accessibilityRole="button">
                  {submitting ? (
                    <ActivityIndicator
                      color={COLORS.white}
                    />
                  ) : (
                    <>
                      <CheckCircle
                        size={18}
                        color={COLORS.white}
                        strokeWidth={2.2}
                      />

                      <Text style={styles.primaryButtonText}>
                        Submit {pendingAttendanceAction === 'time-out' ? 'Time Out' : 'Time In'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.sectionTitle}>
                  Verification method
                </Text>

                {loadingEnrollment ? (
                  <ActivityIndicator color={COLORS.blue} />
                ) : enrollmentStatusError ? (
                  <View style={styles.infoBanner}>
                    <Text style={styles.infoText}>
                      Enrollment status could not be confirmed:{' '}
                      {enrollmentStatusError}
                    </Text>

                    <TouchableOpacity
                      onPress={loadBiometricCredentials}
                      accessibilityRole="button">
                      <Text style={styles.inlineAction}>
                        Retry status check
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : credentials.length ? (
                  <View>
                    {credentials.map(credential => (
                      <TouchableOpacity
                        key={credential.credential_id}
                        style={[
                          styles.methodRow,
                          selectedCredential?.credential_id ===
                            credential.credential_id &&
                            styles.methodSelected,
                        ]}
                        onPress={() =>
                          setSelectedCredential(credential)
                        }
                        accessibilityRole="radio"
                        accessibilityState={{
                          selected:
                            selectedCredential?.credential_id ===
                            credential.credential_id,
                        }}>
                        <View style={styles.methodIcon}>
                          <Text style={styles.methodIconText}>
                            ✓
                          </Text>
                        </View>

                        <View style={styles.methodCopy}>
                          <Text style={styles.methodTitle}>
                            Fingerprint
                          </Text>

                          <Text style={styles.methodSubtitle}>
                            {credential.device_name} · enrolled
                            with server
                          </Text>
                        </View>

                        <View style={styles.radioOuter}>
                          {selectedCredential?.credential_id ===
                            credential.credential_id && (
                            <View style={styles.radioInner} />
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <View style={styles.infoBanner}>
                    <Text style={styles.infoText}>
                      Fingerprint is not enrolled on this account.
                      You can set it up in Profile; email and
                      password login remains available.
                    </Text>

                    <TouchableOpacity
                      onPress={() =>
                        navigation.navigate('Profile')
                      }
                      accessibilityRole="button">
                      <Text style={styles.inlineAction}>
                        Set up fingerprint
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View
                  style={[
                    styles.methodRow,
                    styles.disabledMethod,
                  ]}>
                  <View style={styles.faceIcon}>
                    <Text style={styles.methodIconText}>
                      ◎
                    </Text>
                  </View>

                  <View style={styles.methodCopy}>
                    <Text style={styles.methodTitle}>
                      Face recognition
                    </Text>

                    <Text style={styles.methodSubtitle}>
                      Unavailable until a secure face/liveness
                      verifier is integrated
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    !canSubmit && styles.buttonDisabled,
                  ]}
                  onPress={() =>
                    verifyAndPrepareAttendance(hasTimeIn ? 'time-out' : 'time-in')
                  }
                  disabled={!canSubmit}
                  accessibilityRole="button">
                  {submitting ? (
                    <ActivityIndicator
                      color={COLORS.white}
                    />
                  ) : (
                    <>
                      <Camera
                        size={18}
                        color={COLORS.white}
                        strokeWidth={2.2}
                      />

                      <Text style={styles.primaryButtonText}>
                        Verify &amp; take {hasTimeIn ? 'Time Out' : 'Time In'} proof photo
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <Text style={styles.privacyNote}>
                  Your phone signs a one-time server challenge.
                  Fingerprint images never leave your device.
                </Text>
              </>
            )}
          </View>
        )}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>
            Server-verified attendance
          </Text>

          <Text style={styles.infoDescription}>
            Official date and attendance times come only from the
            saved Laravel attendance record. The photo preview
            timestamp is informational and does not set your
            attendance time.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.canvas,
  },

  content: {
    padding: 20,
    paddingBottom: 32,
  },

  header: {
    backgroundColor: COLORS.navy,
    marginHorizontal: -20,
    marginTop: -20,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 30,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },

  eyebrow: {
    color: '#9FB3C8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 10,
  },

  title: {
    color: COLORS.white,
    fontSize: 29,
    fontWeight: '800',
    letterSpacing: -0.5,
  },

  subtitle: {
    color: '#D9E2EC',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    maxWidth: 320,
  },

  recordCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    marginTop: -14,
    padding: 20,
    elevation: 3,
    shadowColor: COLORS.navy,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },

  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  cardEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: COLORS.muted,
    marginBottom: 5,
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 20,
  },

  successBadge: {
    backgroundColor: COLORS.greenLight,
  },

  pendingBadge: {
    backgroundColor: COLORS.amberLight,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 7,
  },

  successDot: {
    backgroundColor: COLORS.green,
  },

  pendingDot: {
    backgroundColor: COLORS.amber,
  },

  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },

  successText: {
    color: COLORS.green,
  },

  pendingText: {
    color: COLORS.amber,
  },

  loader: {
    marginVertical: 36,
  },

  attendanceTimes: {
    paddingTop: 16,
  },

  attendanceTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 58,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
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
    marginTop: 3,
  },

  officialTag: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.green,
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
    marginTop: 5,
    textAlign: 'center',
  },

  emptyPanel: {
    alignItems: 'center',
    paddingVertical: 26,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 9,
  },

  emptyDescription: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 7,
    maxWidth: 280,
  },

  savedStatus: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  savedStatusLabel: {
    fontSize: 13,
    color: COLORS.muted,
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

  actionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 18,
    marginTop: 16,
    elevation: 2,
    shadowColor: COLORS.navy,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },

  sectionTitle: {
    color: COLORS.navy,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },

  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    padding: 12,
    marginBottom: 9,
  },

  methodSelected: {
    borderColor: COLORS.blue,
    backgroundColor: '#F5FAFE',
  },

  disabledMethod: {
    backgroundColor: '#F8FAFC',
    opacity: 0.8,
  },

  methodIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.greenLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  faceIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EEF2F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  methodIconText: {
    color: COLORS.green,
    fontWeight: '900',
    fontSize: 17,
  },

  methodCopy: {
    flex: 1,
    paddingRight: 8,
  },

  methodTitle: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '800',
  },

  methodSubtitle: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 3,
    lineHeight: 15,
  },

  radioOuter: {
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },

  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: COLORS.blue,
  },

  infoBanner: {
    backgroundColor: COLORS.blueLight,
    borderRadius: 12,
    padding: 13,
    marginBottom: 12,
  },

  infoText: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.text,
  },

  inlineAction: {
    color: COLORS.blue,
    fontWeight: '800',
    fontSize: 12,
    marginTop: 9,
  },

  primaryButton: {
    backgroundColor: COLORS.blue,
    borderRadius: 13,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
    marginTop: 8,
  },

  primaryButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '800',
  },

  secondaryButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    borderRadius: 13,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
    marginTop: 12,
  },

  secondaryButtonText: {
    color: COLORS.navy,
    fontSize: 13,
    fontWeight: '800',
  },

  buttonDisabled: {
    opacity: 0.65,
  },

  photoPreview: {
    position: 'relative',
    width: '100%',
    height: 280,
    overflow: 'hidden',
    borderRadius: 14,
    marginTop: 12,
    backgroundColor: '#E7EDF3',
  },

  previewImage: {
    ...StyleSheet.absoluteFillObject,
  },

  photoLoadStatus: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11, 31, 51, 0.68)',
    zIndex: 1,
  },

  photoLoadStatusText: {
    fontSize: 12,
    color: COLORS.white,
    fontWeight: '700',
    marginTop: 8,
  },

  photoLoadError: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: COLORS.redLight,
    zIndex: 2,
  },

  photoLoadErrorText: {
    fontSize: 11,
    color: COLORS.red,
    fontWeight: '700',
    textAlign: 'center',
  },

  photoTimestamp: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: 'rgba(11, 31, 51, 0.82)',
    zIndex: 2,
  },

  photoTimestampDate: {
    fontSize: 14,
    color: COLORS.white,
    fontWeight: '800',
  },

  photoTimestampNote: {
    fontSize: 9,
    color: '#D9E2EC',
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 3,
  },

  photoUriDiagnostic: {
    fontSize: 9,
    color: COLORS.muted,
    marginTop: 6,
  },

  previewDisclaimer: {
    fontSize: 10,
    lineHeight: 15,
    color: COLORS.muted,
    marginTop: 9,
  },

  privacyNote: {
    color: COLORS.muted,
    textAlign: 'center',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 12,
  },

  errorBanner: {
    backgroundColor: COLORS.redLight,
    borderColor: '#FECDCA',
    borderWidth: 1,
    borderRadius: 12,
    padding: 13,
    marginTop: 14,
  },

  errorText: {
    color: COLORS.red,
    fontSize: 12,
    lineHeight: 18,
  },

  infoCard: {
    backgroundColor: COLORS.white,
    borderRadius: 15,
    padding: 16,
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.blue,
  },

  infoTitle: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '800',
    marginBottom: 6,
  },

  infoDescription: {
    fontSize: 12,
    color: COLORS.muted,
    lineHeight: 18,
  },
});