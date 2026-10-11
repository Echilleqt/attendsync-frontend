import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  Camera as VisionCamera,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
} from 'react-native-vision-camera';
import {CameraOff, RefreshCw, X} from 'lucide-react-native';
import COLORS from '../theme/colors';

export default function AttendanceCameraModal({
  visible,
  title = 'Attendance Proof Capture',
  subtitle = 'Position yourself clearly in the viewfinder',
  onCapture,
  onClose,
}) {
  const insets = useSafeAreaInsets();
  const [cameraPosition, setCameraPosition] = useState('front');
  const [capturing, setCapturing] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const device = useCameraDevice(cameraPosition);
  const {hasPermission, requestPermission} = useCameraPermission();
  const photoOutput = usePhotoOutput({
    containerFormat: 'jpeg',
    quality: 0.85,
  });

  const toggleCameraFacing = useCallback(() => {
    setCameraPosition(prev => (prev === 'front' ? 'back' : 'front'));
  }, []);

  const handleCapturePress = useCallback(async () => {
    if (capturing) {
      return;
    }

    setCameraError('');
    setCapturing(true);

    try {
      const photoFile = await photoOutput.capturePhotoToFile({}, {});
      const path = photoFile?.filePath;

      if (!path) {
        throw new Error('The in-app camera could not retrieve the captured image.');
      }

      const photo = {
        uri: path.startsWith('file://') ? path : `file://${path}`,
        name: `attendance-proof-${Date.now()}.jpg`,
        type: 'image/jpeg',
      };

      onCapture?.(photo);
    } catch (err) {
      setCameraError(err.message || 'Failed to capture attendance photo proof.');
    } finally {
      setCapturing(false);
    }
  }, [capturing, onCapture, photoOutput]);

  const handleRequestPermission = useCallback(async () => {
    try {
      const granted = await requestPermission();
      if (!granted) {
        setCameraError('Camera access was denied. Please allow camera permissions in Settings.');
      }
    } catch (err) {
      setCameraError(err.message || 'Unable to request camera permission.');
    }
  }, [requestPermission]);

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <StatusBar
          translucent
          backgroundColor="transparent"
          barStyle="light-content"
        />

        {!hasPermission ? (
          <View style={[styles.permissionContainer, {paddingTop: insets.top + 40}]}>
            <View style={styles.permissionIconCircle}>
              <CameraOff size={36} color={COLORS.red} strokeWidth={2.2} />
            </View>
            <Text style={styles.permissionTitle}>Camera Access Required</Text>
            <Text style={styles.permissionMessage}>
              Attendance proof requires an active camera snapshot to accompany your verified biometric record.
            </Text>

            {cameraError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{cameraError}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={styles.primaryPermButton}
              onPress={handleRequestPermission}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <Text style={styles.primaryPermButtonText}>Grant Camera Access</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelPermButton}
              onPress={onClose}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <Text style={styles.cancelPermButtonText}>Cancel & Return</Text>
            </TouchableOpacity>
          </View>
        ) : !device ? (
          <View style={[styles.permissionContainer, {paddingTop: insets.top + 40}]}>
            <View style={styles.permissionIconCircle}>
              <CameraOff size={36} color={COLORS.amber} strokeWidth={2.2} />
            </View>
            <Text style={styles.permissionTitle}>Camera Unavailable</Text>
            <Text style={styles.permissionMessage}>
              No {cameraPosition === 'front' ? 'front' : 'rear'} camera was detected on this device.
            </Text>

            <TouchableOpacity
              style={styles.primaryPermButton}
              onPress={toggleCameraFacing}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <Text style={styles.primaryPermButtonText}>Switch Camera Facing</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelPermButton}
              onPress={onClose}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <Text style={styles.cancelPermButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={StyleSheet.absoluteFill}>
            <VisionCamera
              device={device}
              isActive={visible}
              outputs={[photoOutput]}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />

            {/* Top Overlay Header */}
            <View
              style={[
                styles.topHeader,
                {paddingTop: Math.max(insets.top, 16) + 8},
              ]}
            >
              <TouchableOpacity
                style={styles.headerIconButton}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close camera"
                activeOpacity={0.8}
              >
                <X size={22} color={COLORS.white} strokeWidth={2.5} />
              </TouchableOpacity>

              <View style={styles.headerTitleGroup}>
                <Text style={styles.headerEyebrow}>BANSUD CENTRAL SCHOOL</Text>
                <Text style={styles.headerTitle}>{title}</Text>
                <Text style={styles.headerSubtitle}>{subtitle}</Text>
              </View>

              <TouchableOpacity
                style={styles.headerIconButton}
                onPress={toggleCameraFacing}
                accessibilityRole="button"
                accessibilityLabel="Switch camera facing"
                activeOpacity={0.8}
              >
                <RefreshCw size={20} color={COLORS.white} strokeWidth={2.2} />
              </TouchableOpacity>
            </View>

            {/* Central Viewfinder Guide */}
            <View style={styles.viewfinderCenter}>
              <View style={styles.viewfinderFrame}>
                <View style={[styles.cornerMarker, styles.cornerTL]} />
                <View style={[styles.cornerMarker, styles.cornerTR]} />
                <View style={[styles.cornerMarker, styles.cornerBL]} />
                <View style={[styles.cornerMarker, styles.cornerBR]} />
              </View>
              <Text style={styles.viewfinderHint}>
                Keep face centered in frame
              </Text>
            </View>

            {/* Bottom Controls Overlay */}
            <View
              style={[
                styles.bottomControls,
                {paddingBottom: Math.max(insets.bottom, 16) + 20},
              ]}
            >
              {cameraError ? (
                <View style={styles.cameraErrorBanner}>
                  <Text style={styles.cameraErrorBannerText}>{cameraError}</Text>
                </View>
              ) : null}

              <Text style={styles.shutterNotice}>
                Photo will be reviewed before attendance submission.
              </Text>

              <View style={styles.shutterRow}>
                <TouchableOpacity
                  style={[
                    styles.shutterOuterRing,
                    capturing && styles.shutterDisabled,
                  ]}
                  onPress={handleCapturePress}
                  disabled={capturing}
                  accessibilityRole="button"
                  accessibilityLabel="Take attendance photo proof"
                  activeOpacity={0.85}
                >
                  <View style={styles.shutterInnerCircle}>
                    {capturing ? (
                      <ActivityIndicator color={COLORS.navy} size="small" />
                    ) : null}
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070E18',
  },
  permissionContainer: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.canvas,
  },
  permissionIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  permissionMessage: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    width: '100%',
  },
  errorText: {
    color: '#991B1B',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
  },
  primaryPermButton: {
    backgroundColor: COLORS.navy,
    borderRadius: 14,
    height: 50,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  primaryPermButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '800',
  },
  cancelPermButton: {
    borderColor: COLORS.border,
    borderWidth: 1.2,
    borderRadius: 14,
    height: 50,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  cancelPermButtonText: {
    color: COLORS.navy,
    fontSize: 14,
    fontWeight: '700',
  },
  topHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: 'rgba(6, 23, 43, 0.75)',
    zIndex: 10,
  },
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleGroup: {
    flex: 1,
    marginHorizontal: 12,
    alignItems: 'center',
  },
  headerEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: '#90CDF4',
    letterSpacing: 1.1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
    marginTop: 2,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#CBD5E1',
    marginTop: 2,
    textAlign: 'center',
  },
  viewfinderCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewfinderFrame: {
    width: 260,
    height: 320,
    borderRadius: 24,
    position: 'relative',
    backgroundColor: 'transparent',
  },
  cornerMarker: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: 'rgba(255, 255, 255, 0.85)',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3.5,
    borderLeftWidth: 3.5,
    borderTopLeftRadius: 18,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3.5,
    borderRightWidth: 3.5,
    borderTopRightRadius: 18,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3.5,
    borderLeftWidth: 3.5,
    borderBottomLeftRadius: 18,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3.5,
    borderRightWidth: 3.5,
    borderBottomRightRadius: 18,
  },
  viewfinderHint: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    overflow: 'hidden',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(6, 23, 43, 0.8)',
    paddingTop: 18,
    alignItems: 'center',
    zIndex: 10,
  },
  cameraErrorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 12,
    marginHorizontal: 20,
  },
  cameraErrorBannerText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  shutterNotice: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  shutterRow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterOuterRing: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  shutterInnerCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterDisabled: {
    opacity: 0.6,
  },
});
