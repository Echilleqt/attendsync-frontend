import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useIsFocused, usePreventRemove} from '@react-navigation/native';
import {
  Camera,
  CheckCircle,
  ScanFace,
  ShieldCheck,
} from 'lucide-react-native';
import {
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
} from 'react-native-vision-camera';
import {Camera as FaceDetectorCamera} from 'react-native-vision-camera-face-detector';
import {apiRequest} from '../api/client';
import {
  advanceBlinkLiveness,
  createBlinkLivenessState,
} from '../utils/blinkLiveness';

import COLORS from '../theme/colors';
import AppHeader from '../components/AppHeader';

const SCAN_TIMEOUT_MS = 25000;

const LiveFaceCamera = React.memo(function LiveFaceCamera({
  device,
  isActive,
  onFacesDetected,
  onError,
  onStarted,
  onStopped,
  photoOutput,
}) {
  return (
    <FaceDetectorCamera
      device={device}
      isActive={isActive}
      style={styles.cameraPreview}
      cameraFacing="front"
      runClassifications
      trackingEnabled
      outputResolution="preview"
      onFacesDetected={onFacesDetected}
      onError={onError}
      outputs={[photoOutput]}
      onStarted={onStarted}
      onStopped={onStopped}
    />
  );
});

function flattenMessageParts(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(item => flattenMessageParts(item));
  }
  if (typeof value === 'object') {
    return Object.values(value).flatMap(item => flattenMessageParts(item));
  }
  return [String(value)];
}

function extractResponseMessage(response, fallback) {
  const payload = response?.data ?? response ?? {};
  const messages = [];

  if (payload.message) {
    messages.push(payload.message);
  }
  if (payload.error) {
    messages.push(payload.error);
  }
  if (payload.errors) {
    messages.push(...flattenMessageParts(payload.errors));
  }
  if (payload.detail) {
    messages.push(payload.detail);
  }

  const combined = messages.filter(Boolean).join('\n');
  return combined || fallback;
}

function normalizeFaceStatus(response) {
  const payload = response?.data ?? response ?? {};

  const rawStatus =
    payload.status ??
    payload.face_status ??
    payload.enrollment_status ??
    payload.state ??
    payload.verification_status ??
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

  return {
    enrolled: isEnrolled,
    status: typeof rawStatus === 'string' ? rawStatus : isEnrolled ? 'enrolled' : 'not_enrolled',
    raw: payload,
  };
}

function isFaceVerified(response) {
  const payload = response?.data ?? response ?? {};

  const candidateValues = [
    payload.verified,
    payload.is_verified,
    payload.success,
    payload.face_verified,
    payload.verification_success,
    payload.match,
    payload.matches,
    payload.face_match,
  ];

  for (const value of candidateValues) {
    if (typeof value === 'boolean') {
      return value;
    }
  }

  const literalStatus = String(
    payload.status ?? payload.verification_status ?? payload.message ?? '',
  ).toLowerCase();

  return (
    literalStatus.includes('verified') ||
    literalStatus.includes('matched') ||
    literalStatus.includes('success')
  );
}

export default function FaceRecognitionScreen({route, navigation, token: propToken}) {
  const insets = useSafeAreaInsets();
  const token = propToken || route?.params?.token;
  const initialMode = route?.params?.mode || 'verify';

  const [activeMode, setActiveMode] = useState(initialMode);
  const activeModeRef = useRef(initialMode);

  const device = useCameraDevice('front');
  const {hasPermission, requestPermission} = useCameraPermission();
  const photoOutput = usePhotoOutput({containerFormat: 'jpeg', quality: 0.85});
  const isFocused = useIsFocused();

  const scannerActiveRef = useRef(false);
  const completionStartedRef = useRef(false);
  const captureInProgressRef = useRef(false);
  const cameraStartedRef = useRef(false);
  const blinkScanStateRef = useRef(createBlinkLivenessState());
  const scanTimeoutRef = useRef(null);

  const [faceStatus, setFaceStatus] = useState({enrolled: false, status: 'not_enrolled'});
  const [statusError, setStatusError] = useState('');
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [scannerActive, setScannerActive] = useState(false);
  const [isFaceAligned, setIsFaceAligned] = useState(false);
  const [scanPrompt, setScanPrompt] = useState('Position your face inside the frame.');
  const [processing, setProcessing] = useState(false);
  const [captureInProgress, setCaptureInProgress] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  usePreventRemove(captureInProgress, () => {
    Alert.alert('Capture in progress', 'Please wait for the face photo capture to finish.');
  });

  useEffect(() => {
    activeModeRef.current = activeMode;
  }, [activeMode]);

  useEffect(
    () =>
      navigation.addListener('beforeRemove', event => {
        if (captureInProgressRef.current) {
          event.preventDefault();
        }
      }),
    [navigation],
  );

  const loadFaceStatus = useCallback(async () => {
    if (!token) {
      setFaceStatus({enrolled: false, status: 'not_enrolled'});
      setLoadingStatus(false);
      return;
    }

    setLoadingStatus(true);
    setStatusError('');

    try {
      const result = await apiRequest('/face/status', token);
      const normalized = normalizeFaceStatus(result);
      setFaceStatus(normalized);
      if (!normalized.enrolled && initialMode === 'verify') {
        setActiveMode('enroll');
      }
    } catch (requestError) {
      setFaceStatus({enrolled: false, status: 'not_enrolled'});
      setStatusError(requestError.message || 'Unable to confirm face enrollment status.');
    } finally {
      setLoadingStatus(false);
    }
  }, [initialMode, token]);

  useEffect(() => {
    loadFaceStatus();
  }, [loadFaceStatus]);

  useEffect(
    () => () => {
      scannerActiveRef.current = false;
      cameraStartedRef.current = false;
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    },
    [],
  );

  const handleCancel = useCallback(() => {
    if (captureInProgressRef.current) {
      return;
    }

    scannerActiveRef.current = false;
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    setScannerActive(false);
    setCapturedPhoto(null);
    setError('');
    setNotice('');

    if (route?.params?.onCancelled) {
      route.params.onCancelled();
    }

    navigation.goBack();
  }, [navigation, route]);

  const stopScanner = useCallback(() => {
    if (captureInProgressRef.current) {
      return;
    }

    scannerActiveRef.current = false;
    completionStartedRef.current = false;
    cameraStartedRef.current = false;
    blinkScanStateRef.current = createBlinkLivenessState();
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    setScannerActive(false);
    setIsFaceAligned(false);
  }, []);

  const submitEnrollment = useCallback(async photo => {
    setCapturedPhoto(photo);
    setProcessing(true);
    setError('');
    setNotice('');

    try {
      const body = new FormData();
      body.append('face_image', {
        uri: photo.uri,
        name: photo.name,
        type: photo.type,
      });
      body.append('photo', {
        uri: photo.uri,
        name: photo.name,
        type: photo.type,
      });

      const response = await apiRequest('/face/enroll', token, {
        method: 'POST',
        body,
        timeout: 45000,
      });

      const recognized = normalizeFaceStatus(response).enrolled || isFaceVerified(response);

      if (!recognized) {
        throw new Error(
          extractResponseMessage(
            response,
            'The server rejected this face enrollment. Try again with a clearer camera image.',
          ),
        );
      }

      setFaceStatus({enrolled: true, status: 'enrolled', raw: response});
      setNotice('Face recognition enrolled successfully.');
      setError('');
      setCapturedPhoto(null);

      if (route?.params?.onEnrollmentComplete) {
        route.params.onEnrollmentComplete(response);
      }

      Alert.alert(
        'Face Registered Successfully',
        'Your face has been securely registered on the server. You can now use Face Recognition for attendance verification.',
        [
          {
            text: 'OK',
            onPress: () => {
              if (initialMode === 'verify') {
                setActiveMode('verify');
              } else {
                navigation.goBack();
              }
            },
          },
        ],
      );
    } catch (requestError) {
      const message = requestError.message || 'Face enrollment failed. Please try again.';
      setError(message);
      Alert.alert('Face Registration Failed', message);
    } finally {
      setProcessing(false);
    }
  }, [initialMode, navigation, route, token]);

  const submitVerification = useCallback(async photo => {
    setCapturedPhoto(photo);
    setProcessing(true);
    setError('');
    setNotice('');

    try {
      const body = new FormData();
      body.append('face_image', {
        uri: photo.uri,
        name: photo.name,
        type: photo.type,
      });
      body.append('photo', {
        uri: photo.uri,
        name: photo.name,
        type: photo.type,
      });

      const response = await apiRequest('/face/verify', token, {
        method: 'POST',
        body,
        timeout: 45000,
      });

      if (!isFaceVerified(response) || !response.face_verification_token) {
        const message = extractResponseMessage(
          response,
          'Face verification failed. Please try again.',
        );
        throw new Error(message);
      }

      setNotice('Face verified successfully.');
      setCapturedPhoto(null);

      if (route?.params?.onVerified) {
        route.params.onVerified(response);
      }

      navigation.goBack();
    } catch (requestError) {
      const message = requestError.message || 'Face verification failed. Please try again.';
      setError(message);
      Alert.alert('Face Verification Failed', message);
    } finally {
      setProcessing(false);
    }
  }, [navigation, route, token]);

  const completeLivenessScan = useCallback(async () => {
    if (
      completionStartedRef.current ||
      !scannerActiveRef.current ||
      !cameraStartedRef.current ||
      !isFocused ||
      captureInProgressRef.current
    ) {
      return;
    }

    completionStartedRef.current = true;
    captureInProgressRef.current = true;
    setCaptureInProgress(true);

    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }

    const isEnroll = activeModeRef.current === 'enroll';
    setScanPrompt(
      isEnroll
        ? 'Blink detected! Registering your face...'
        : 'Blink detected! Verifying your face...',
    );
    setError('');

    try {
      const photoFile = await photoOutput.capturePhotoToFile({}, {});
      const path = photoFile.filePath;

      if (!path) {
        throw new Error('The camera did not return a usable face image.');
      }

      const photo = {
        uri: path.startsWith('file://') ? path : `file://${path}`,
        name: `face-${Date.now()}.jpg`,
        type: 'image/jpeg',
      };

      captureInProgressRef.current = false;
      setCaptureInProgress(false);
      stopScanner();

      if (isEnroll) {
        await submitEnrollment(photo);
      } else {
        await submitVerification(photo);
      }
    } catch (captureError) {
      captureInProgressRef.current = false;
      setCaptureInProgress(false);
      stopScanner();
      completionStartedRef.current = false;
      setError(captureError.message || 'Unable to capture the live face image.');
    }
  }, [isFocused, photoOutput, stopScanner, submitEnrollment, submitVerification]);

  const handleFacesDetected = useCallback(
    faces => {
      if (!scannerActiveRef.current || completionStartedRef.current) {
        return;
      }

      const isEnroll = activeModeRef.current === 'enroll';
      const result = advanceBlinkLiveness(blinkScanStateRef.current, faces, {isEnroll});
      blinkScanStateRef.current = result.state;

      const aligned =
        result.state.phase === 'waiting_for_blink' ||
        result.state.phase === 'waiting_for_reopen' ||
        result.state.phase === 'complete';
      setIsFaceAligned(aligned);

      if (result.prompt) {
        setScanPrompt(result.prompt);
      }
      if (result.complete) {
        completeLivenessScan();
      }
    },
    [completeLivenessScan],
  );

  const startScanner = useCallback(
    async (modeToStart = activeMode) => {
      setError('');
      setNotice('');
      setCapturedPhoto(null);
      setActiveMode(modeToStart);
      activeModeRef.current = modeToStart;

      if (!device) {
        setError('No front-facing camera is available on this device.');
        return;
      }

      try {
        const granted = hasPermission || (await requestPermission());
        if (!granted) {
          setError('Camera permission is required to use face recognition.');
          return;
        }
      } catch (permissionError) {
        setError(permissionError.message || 'Unable to access the camera.');
        return;
      }

      completionStartedRef.current = false;
      blinkScanStateRef.current = createBlinkLivenessState();
      scannerActiveRef.current = true;
      setIsFaceAligned(false);
      setScanPrompt('Position your face inside the frame.');
      setScannerActive(true);

      scanTimeoutRef.current = setTimeout(() => {
        if (scannerActiveRef.current) {
          const hadFace =
            blinkScanStateRef.current.phase === 'waiting_for_blink' ||
            blinkScanStateRef.current.phase === 'waiting_for_reopen';
          stopScanner();
          setError(
            hadFace
              ? 'Unable to detect your blink. Please try again.'
              : 'Face not detected. Please try again.',
          );
        }
      }, SCAN_TIMEOUT_MS);
    },
    [activeMode, device, hasPermission, requestPermission, stopScanner],
  );

  const handleScannerError = useCallback(
    cameraError => {
      if (captureInProgressRef.current) {
        setError(cameraError.message || 'The camera could not scan your face.');
        return;
      }

      stopScanner();
      setError(cameraError.message || 'The camera could not scan your face.');
    },
    [stopScanner],
  );

  const handleCameraStarted = useCallback(() => {
    cameraStartedRef.current = true;
  }, []);

  const handleCameraStopped = useCallback(() => {
    cameraStartedRef.current = false;
  }, []);

  const revokeFace = useCallback(async () => {
    if (!token) {
      return;
    }

    Alert.alert(
      'Remove face recognition?',
      'Password confirmation is required to remove biometric credentials. Would you like to go to Profile?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Go to Profile',
          onPress: () => {
            navigation.navigate('Profile');
          },
        },
      ],
    );
  }, [navigation, token]);

  const isEnrollMode = activeMode === 'enroll';

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
        keyboardShouldPersistTaps="handled">
        <AppHeader
          variant="compact"
          title={isEnrollMode ? 'Register Your Face' : 'Face Verification'}
          schoolName="BANSUD CENTRAL SCHOOL"
          subtitle={
            isEnrollMode
              ? 'Align your face inside the frame and blink when prompted to register.'
              : 'Align your face inside the frame and blink when prompted to verify arrival.'
          }
          onBack={handleCancel}
        />

        <View style={styles.body}>
          <View style={styles.card}>
            {loadingStatus ? (
              <View style={styles.statusPanel}>
                <ActivityIndicator color={COLORS.blue} />
                <Text style={styles.statusText}>Checking enrollment status…</Text>
              </View>
            ) : statusError ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{statusError}</Text>
                <TouchableOpacity onPress={loadFaceStatus} accessibilityRole="button">
                  <Text style={styles.inlineAction}>Retry status</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* ISSUE 3: Clean, explicit guidance card when employee hasn't registered */}
            {!loadingStatus && !faceStatus.enrolled && !scannerActive && !capturedPhoto ? (
              <View style={styles.unregisteredContainer}>
                <View style={styles.iconCircle}>
                  <ScanFace size={44} color={COLORS.navy} strokeWidth={2.2} />
                </View>
                <Text style={styles.unregisteredTitle}>Register Your Face</Text>
                <Text style={styles.unregisteredDescription}>
                  You haven't registered your face yet. Register your face first to use Face Recognition for attendance verification.
                </Text>

                <TouchableOpacity
                  style={[styles.primaryButton, processing && styles.disabledButton]}
                  onPress={() => startScanner('enroll')}
                  disabled={processing}
                  accessibilityRole="button"
                  activeOpacity={0.85}>
                  {processing ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Register My Face</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : null}

            {/* When already registered, show active status card */}
            {!loadingStatus && faceStatus.enrolled && !scannerActive && !capturedPhoto ? (
              <View style={styles.registeredContainer}>
                <View style={styles.statusPanelSuccess}>
                  <CheckCircle size={22} color={COLORS.green} strokeWidth={2.5} />
                  <View style={{flex: 1, marginLeft: 10}}>
                    <Text style={styles.statusTitle}>Face Recognition Registered</Text>
                    <Text style={styles.statusBody}>Your face model is active on the server.</Text>
                  </View>
                  <TouchableOpacity style={styles.removeButton} onPress={revokeFace} disabled={processing}>
                    <Text style={styles.removeButtonText}>Remove</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.primaryButton, processing && styles.disabledButton]}
                  onPress={() => startScanner('verify')}
                  disabled={processing}
                  accessibilityRole="button"
                  activeOpacity={0.85}>
                  {processing ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Start Live Scan & Verify</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Active camera scanner with face-positioning guide and dynamic prompt */}
            {scannerActive ? (
              <View style={styles.scannerPanel}>
                {!hasPermission ? (
                  <View style={styles.permissionCard}>
                    <Camera size={38} color={COLORS.blue} style={{marginBottom: 10}} />
                    <Text style={styles.permissionTitle}>Camera Permission Required</Text>
                    <Text style={styles.permissionBody}>
                      Camera access is required to detect facial landmarks and perform live blink detection for attendance verification.
                    </Text>
                    <TouchableOpacity
                      style={styles.primaryButton}
                      onPress={requestPermission}
                      activeOpacity={0.85}>
                      <Text style={styles.primaryButtonText}>Grant Camera Permission</Text>
                    </TouchableOpacity>
                  </View>
                ) : device ? (
                  <View style={styles.cameraWrapper}>
                    <LiveFaceCamera
                      device={device}
                      isActive={scannerActive && isFocused}
                      onFacesDetected={handleFacesDetected}
                      onError={handleScannerError}
                      onStarted={handleCameraStarted}
                      onStopped={handleCameraStopped}
                      photoOutput={photoOutput}
                    />

                    {/* Face Positioning Guide Overlay */}
                    <View style={styles.guideOverlay} pointerEvents="none">
                      <View
                        style={[
                          styles.faceGuideOval,
                          isFaceAligned && styles.faceGuideOvalAligned,
                        ]}
                      />
                    </View>

                    {/* Dynamic Prompt Pill Overlay */}
                    <View style={styles.scannerPrompt}>
                      <Text style={styles.scannerText}>{scanPrompt}</Text>
                    </View>

                    {/* Capturing / Verifying Loading Indicator Overlay */}
                    {(captureInProgress || processing) ? (
                      <View style={styles.processingBackdrop}>
                        <ActivityIndicator size="large" color={COLORS.white} />
                        <Text style={styles.processingText}>
                          {isEnrollMode
                            ? 'Registering your face…'
                            : 'Verifying your face…'}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <View style={[styles.cameraPreview, styles.cameraUnavailable]}>
                    <Text style={styles.scannerText}>Front camera is unavailable.</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.stopButton}
                  onPress={stopScanner}
                  disabled={processing || captureInProgress}
                  accessibilityRole="button">
                  <Text style={styles.stopButtonText}>Stop Scan</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {capturedPhoto ? (
              <View style={styles.previewPanel}>
                <Image source={{uri: capturedPhoto.uri}} style={styles.previewImage} resizeMode="cover" />
                <Text style={styles.previewText}>Captured face image</Text>
              </View>
            ) : null}

            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {notice ? (
              <View style={styles.noticeBanner}>
                <Text style={styles.noticeText}>{notice}</Text>
              </View>
            ) : null}

            {/* Retry Button when scan or verification failed */}
            {!scannerActive && error ? (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => startScanner(activeMode)}
                disabled={processing}
                activeOpacity={0.85}>
                <Text style={styles.retryButtonText}>Scan Again</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleCancel}
              disabled={processing || captureInProgress}
              activeOpacity={0.85}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
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
    paddingBottom: 40,
  },
  body: {
    paddingHorizontal: 16,
    marginTop: -16,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.navyDark,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    gap: 16,
  },
  statusPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  statusPanelSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 14,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#065F46',
  },
  statusBody: {
    fontSize: 12,
    color: '#047857',
    marginTop: 2,
  },
  removeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  removeButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.red,
  },
  unregisteredContainer: {
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  registeredContainer: {
    gap: 16,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  unregisteredTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.navy,
    textAlign: 'center',
  },
  unregisteredDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 12,
  },
  scannerPanel: {
    alignItems: 'center',
    gap: 12,
  },
  cameraWrapper: {
    width: '100%',
    height: 380,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000000',
  },
  cameraPreview: {
    width: '100%',
    height: '100%',
  },
  cameraUnavailable: {
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceGuideOval: {
    width: 230,
    height: 290,
    borderRadius: 115,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.75)',
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  faceGuideOvalAligned: {
    borderColor: '#10B981',
    borderStyle: 'solid',
    borderWidth: 3.5,
  },
  scannerPrompt: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(16, 42, 67, 0.88)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  scannerText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
    textAlign: 'center',
  },
  processingBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16, 42, 67, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  processingText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.white,
  },
  permissionCard: {
    padding: 24,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  permissionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.navy,
  },
  permissionBody: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 8,
  },
  stopButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  stopButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.red,
  },
  previewPanel: {
    alignItems: 'center',
    gap: 8,
  },
  previewImage: {
    width: '100%',
    height: 260,
    borderRadius: 16,
  },
  previewText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  primaryButton: {
    backgroundColor: COLORS.navy,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: COLORS.navyDark,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.white,
  },
  retryButton: {
    backgroundColor: COLORS.blueLight,
    borderWidth: 1,
    borderColor: COLORS.blue,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.blue,
  },
  secondaryButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.navy,
  },
  disabledButton: {
    opacity: 0.6,
  },
  errorBanner: {
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    gap: 6,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.red,
    lineHeight: 18,
    fontWeight: '500',
  },
  inlineAction: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.blue,
  },
  noticeBanner: {
    padding: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
  },
  noticeText: {
    fontSize: 13,
    color: COLORS.blue,
    lineHeight: 18,
    fontWeight: '500',
  },
});
