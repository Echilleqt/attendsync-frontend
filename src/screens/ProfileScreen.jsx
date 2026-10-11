import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
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
  Camera,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Fingerprint,
  Info,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  ScanFace,
  Smartphone,
  X,
} from 'lucide-react-native';
import ReactNativeBiometrics from 'react-native-biometrics';
import {API_URL, apiRequest} from '../api/client';
import {publicKeyPem} from '../utils/biometricFormat';
import COLORS from '../theme/colors';
import AppHeader from '../components/AppHeader';
import StatusBadge from '../components/StatusBadge';
import Banner from '../components/Banner';

const biometrics = new ReactNativeBiometrics({allowDeviceCredentials: false});

function normalizeFaceStatus(response) {
  const payload = response?.data ?? response ?? {};
  const rawStatus = payload.status ?? payload.face_status ?? payload.enrollment_status ?? payload.state ?? '';
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
      ['enrolled', 'registered', 'active', 'verified', 'ready'].includes(rawStatus.toLowerCase()));

  return {
    enrolled: Boolean(isEnrolled),
    status: typeof rawStatus === 'string' ? rawStatus : isEnrolled ? 'enrolled' : 'not_enrolled',
    raw: payload,
  };
}

export default function ProfileScreen({user, employee, token, onLogout, navigation}) {
  const insets = useSafeAreaInsets();

  // Employee Profile State (fetches latest if available)
  const [employeeProfile, setEmployeeProfile] = useState(employee || null);

  // Biometric States
  const [fingerprintCredentials, setFingerprintCredentials] = useState([]);
  const [faceStatus, setFaceStatus] = useState({enrolled: false, status: 'not_enrolled'});
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [faceLoading, setFaceLoading] = useState(true);
  const [statusError, setStatusError] = useState('');
  const [faceStatusError, setFaceStatusError] = useState('');

  // Password Input for Biometric Operations
  const [biometricPassword, setBiometricPassword] = useState('');
  const [biometricActionLoading, setBiometricActionLoading] = useState(false);
  const [biometricError, setBiometricError] = useState('');
  const [biometricNotice, setBiometricNotice] = useState('');
  const [cleanupPending, setCleanupPending] = useState(null);

  // Password Change Modal State
  const [changePasswordModal, setChangePasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Expandable Settings Cards
  const [expandedSection, setExpandedSection] = useState(null); // 'device' | 'about' | null
  const [deviceInfo, setDeviceInfo] = useState({
    sensorAvailable: null,
    biometryType: null,
  });

  const loadUserProfile = useCallback(async () => {
    if (!token) {return;}
    try {
      const res = await apiRequest('/me', token);
      if (res.employee) {
        setEmployeeProfile(res.employee);
      }
    } catch {
      // Use existing passed employee prop
    }
  }, [token]);

  const loadFingerprintStatus = useCallback(async () => {
    if (!token) {
      setFingerprintCredentials([]);
      setLoadingStatus(false);
      return;
    }

    setLoadingStatus(true);
    setStatusError('');
    try {
      const result = await apiRequest('/biometric/credentials', token);
      const credentials = result.methods?.fingerprint?.credentials;
      if (!Array.isArray(credentials)) {
        throw new Error('The server did not return biometric enrollment status.');
      }
      setFingerprintCredentials(credentials);
    } catch (requestError) {
      setFingerprintCredentials([]);
      setStatusError(requestError.message || 'Unable to load biometric enrollment status.');
    } finally {
      setLoadingStatus(false);
    }
  }, [token]);

  const loadFaceStatus = useCallback(async () => {
    if (!token) {
      setFaceStatus({enrolled: false, status: 'not_enrolled'});
      setFaceLoading(false);
      return;
    }

    setFaceLoading(true);
    setFaceStatusError('');

    try {
      const result = await apiRequest('/face/status', token);
      setFaceStatus(normalizeFaceStatus(result));
    } catch (requestError) {
      setFaceStatus({enrolled: false, status: 'not_enrolled'});
      setFaceStatusError(requestError.message || 'Unable to confirm face enrollment status.');
    } finally {
      setFaceLoading(false);
    }
  }, [token]);

  const checkDeviceHardware = useCallback(async () => {
    try {
      const sensor = await biometrics.isSensorAvailable();
      setDeviceInfo({
        sensorAvailable: sensor.available,
        biometryType: sensor.biometryType || 'None',
      });
    } catch {
      setDeviceInfo({sensorAvailable: false, biometryType: 'Unknown'});
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      loadUserProfile(),
      loadFingerprintStatus(),
      loadFaceStatus(),
      checkDeviceHardware(),
    ]);
  }, [loadUserProfile, loadFingerprintStatus, loadFaceStatus, checkDeviceHardware]);

  useFocusEffect(
    useCallback(() => {
      refreshAll();
    }, [refreshAll]),
  );

  // Enroll Fingerprint
  const handleEnrollFingerprint = async () => {
    if (!biometricPassword) {
      setBiometricError('Enter your account password below to confirm biometric enrollment.');
      return;
    }

    setBiometricActionLoading(true);
    setBiometricError('');
    setBiometricNotice('');
    let credentialId = null;
    let keyCreated = false;

    try {
      const sensor = await biometrics.isSensorAvailable();
      if (!sensor.available) {
        throw new Error(
          `Biometric hardware unavailable: ${sensor.error || 'Sensor not found'}. ` +
          'Password authentication remains available.',
        );
      }

      const keyPair = await biometrics.createKeys();
      if (!keyPair.publicKey) {
        throw new Error('The device keystore did not create a secure cryptographic key.');
      }
      keyCreated = true;

      const enrolled = await apiRequest('/biometric/credentials', token, {
        method: 'POST',
        body: {
          password: biometricPassword,
          verification_method: 'fingerprint',
          device_name: `${Platform.OS === 'android' ? 'Android Device' : 'iOS Device'}`,
          public_key_pem: publicKeyPem(keyPair.publicKey),
        },
      });
      credentialId = enrolled.credential?.credential_id;
      if (!credentialId) {
        throw new Error('The server did not return a registered biometric credential.');
      }

      const challenge = await apiRequest('/biometric/challenges', token, {
        method: 'POST',
        body: {
          verification_method: 'fingerprint',
          credential_id: credentialId,
          purpose: 'biometric-enrollment',
        },
      });

      const signature = await biometrics.createSignature({
        promptMessage: 'Confirm fingerprint for ATTENDSYNC registration',
        payload: challenge.message_to_sign,
      });

      if (!signature.success || !signature.signature) {
        throw new Error('Biometric confirmation was cancelled. Enrollment was not completed.');
      }

      const confirmed = await apiRequest('/biometric/verify', token, {
        method: 'POST',
        body: {
          challenge_id: challenge.challenge_id,
          signature: signature.signature,
        },
      });
      if (!confirmed.credential_verified) {
        throw new Error('The server could not verify this device key.');
      }

      await loadFingerprintStatus();
      setBiometricPassword('');
      setBiometricNotice('Fingerprint key enrolled successfully in device keystore.');
    } catch (err) {
      if (credentialId) {
        try {
          await apiRequest('/biometric/credentials', token, {
            method: 'DELETE',
            body: {
              password: biometricPassword,
              verification_method: 'fingerprint',
              credential_id: credentialId,
            },
          });
        } catch {}
      }
      if (keyCreated) {
        try {
          await biometrics.deleteKeys();
        } catch {}
      }
      setBiometricError(err.message || 'Fingerprint enrollment failed.');
    } finally {
      setBiometricActionLoading(false);
    }
  };

  // Disable Fingerprint
  const handleDisableFingerprint = async () => {
    if (!biometricPassword) {
      setBiometricError('Enter your account password to disable biometric credentials.');
      return;
    }

    setBiometricActionLoading(true);
    setBiometricError('');
    setBiometricNotice('');

    try {
      await apiRequest('/biometric/credentials', token, {
        method: 'DELETE',
        body: {
          password: biometricPassword,
          verification_method: 'fingerprint',
        },
      });
      try {
        await biometrics.deleteKeys();
      } catch {}
      await loadFingerprintStatus();
      setBiometricPassword('');
      setBiometricNotice('Fingerprint enrollment removed. Password login remains active.');
    } catch (err) {
      setBiometricError(err.message || 'Unable to remove biometric enrollment.');
    } finally {
      setBiometricActionLoading(false);
    }
  };

  // Confirm remove face recognition
  const handleRemoveFace = () => {
    if (!biometricPassword) {
      setBiometricError('Enter your account password below to confirm face recognition removal.');
      return;
    }

    Alert.alert(
      'Remove Face Recognition?',
      'This removes your registered face biometric model from the school server.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setBiometricActionLoading(true);
            try {
              await apiRequest('/face/revoke', token, {
                method: 'DELETE',
                body: {password: biometricPassword},
              });
              setFaceStatus({enrolled: false, status: 'not_enrolled'});
              setBiometricPassword('');
              setBiometricNotice('Face recognition model was removed from the server.');
            } catch (err) {
              setBiometricError(err.message || 'Unable to remove face recognition.');
            } finally {
              setBiometricActionLoading(false);
            }
          },
        },
      ],
    );
  };

  // Change Password
  const handleChangePasswordSubmit = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Please fill in all password fields.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setChangingPassword(true);
    setPasswordError('');
    setPasswordSuccess('');

    try {
      const res = await apiRequest('/change-password', token, {
        method: 'POST',
        body: {
          current_password: currentPassword,
          new_password: newPassword,
          new_password_confirmation: confirmPassword,
        },
      });

      setPasswordSuccess(res.message || 'Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setChangePasswordModal(false);
        setPasswordSuccess('');
      }, 1500);
    } catch (err) {
      setPasswordError(err.message || 'Unable to change password.');
    } finally {
      setChangingPassword(false);
    }
  };

  const toggleSection = section => {
    setExpandedSection(prev => (prev === section ? null : section));
  };

  // Display fields
  const fullName =
    employeeProfile?.full_name ||
    user?.name ||
    'Bansud Central School Employee';
  const employeeId = employeeProfile?.employee_id || 'ID BCS-001';
  const position = employeeProfile?.position || 'Teacher';
  const department = employeeProfile?.department || 'Elementary Education';
  const email = user?.email || 'employee@attendsync.test';
  const status = employeeProfile?.status || 'Active';

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
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={loadingStatus || faceLoading}
            onRefresh={refreshAll}
            progressViewOffset={80}
            tintColor={COLORS.white}
            colors={[COLORS.blue]}
          />
        }
      >
        {/* Reusable Global Header */}
        <AppHeader
          variant="standard"
          title="Profile & Security"
          schoolName="BANSUD CENTRAL SCHOOL"
          subtitle="Employee credentials and biometric security settings."
        />

        <View style={styles.body}>
          {/* 1. Official Employee Profile Card */}
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {fullName.charAt(0).toUpperCase()}
              </Text>
            </View>

            <View style={styles.profileCopy}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>{fullName}</Text>
                <StatusBadge status={status} size="sm" />
              </View>

              <View style={styles.employeeBadgeRow}>
                <View style={styles.idBadge}>
                  <Text style={styles.idBadgeText}>{employeeId}</Text>
                </View>
                <Text style={styles.positionText}>
                  {position} • {department}
                </Text>
              </View>

              <View style={styles.emailRow}>
                <Mail size={12} color={COLORS.muted} strokeWidth={2.2} />
                <Text style={styles.email}>{email}</Text>
              </View>
            </View>
          </View>

          {/* Section: Biometric Security */}
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionHeadingTitle}>Biometric Security</Text>
            <Text style={styles.sectionHeadingSubtitle}>
              Hardware keystore and facial verification credentials
            </Text>
          </View>

          {/* Card 1: Device Fingerprint & Hardware Keystore */}
          <View style={styles.biometricCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.biometricIconBadge}>
                <Fingerprint size={20} color={COLORS.blue} strokeWidth={2.4} />
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.biometricCardTitle}>Fingerprint Authentication</Text>
                <Text style={styles.biometricCardSubtitle}>
                  Device hardware-backed cryptographic signing
                </Text>
              </View>
              {fingerprintCredentials.length > 0 ? (
                <StatusBadge status="enrolled" label="ENROLLED" size="sm" />
              ) : (
                <StatusBadge status="not_recorded" label="NOT ENROLLED" size="sm" />
              )}
            </View>

            <Text style={styles.biometricDesc}>
              Signs one-time attendance challenges securely within device hardware keystore. Private keys never leave the phone.
            </Text>

            {loadingStatus ? (
              <ActivityIndicator style={styles.statusLoader} color={COLORS.blue} />
            ) : statusError ? (
              <Banner
                type="warning"
                message={`Enrollment status check: ${statusError}`}
                actionText="Retry"
                onAction={loadFingerprintStatus}
              />
            ) : fingerprintCredentials.length > 0 ? (
              <View style={styles.enrolledInfoBox}>
                <CheckCircle size={16} color={COLORS.green} strokeWidth={2.4} />
                <Text style={styles.enrolledInfoText}>
                  {fingerprintCredentials[0]?.device_name || 'Device key registered'} • Hardware Verified
                </Text>
              </View>
            ) : null}
          </View>

          {/* Card 2: Face Recognition */}
          <View style={styles.biometricCard}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.biometricIconBadge, {backgroundColor: COLORS.greenLight}]}>
                <ScanFace size={20} color={COLORS.green} strokeWidth={2.4} />
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.biometricCardTitle}>Face Recognition</Text>
                <Text style={styles.biometricCardSubtitle}>
                  Server facial model & blink anti-spoofing
                </Text>
              </View>
              {faceStatus.enrolled ? (
                <StatusBadge status="active" label="ACTIVE" size="sm" />
              ) : (
                <StatusBadge status="not_recorded" label="NOT SET UP" size="sm" />
              )}
            </View>

            <Text style={styles.biometricDesc}>
              Biometric face model verified with real-time blink liveness detection against central server.
            </Text>

            {faceLoading ? (
              <ActivityIndicator style={styles.statusLoader} color={COLORS.blue} />
            ) : faceStatus.enrolled ? (
              <View style={styles.faceActionRow}>
                <TouchableOpacity
                  style={styles.faceTestBtn}
                  onPress={() => navigation.navigate('FaceRecognition', {mode: 'verify', token})}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  <Text style={styles.faceTestBtnText}>Test Verify</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.faceRemoveBtn}
                  onPress={handleRemoveFace}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  <Text style={styles.faceRemoveBtnText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.faceSetupBtn}
                onPress={() =>
                  navigation.navigate('FaceRecognition', {
                    mode: 'enroll',
                    token,
                    onEnrollmentComplete: () => loadFaceStatus(),
                  })
                }
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                <Camera size={16} color={COLORS.white} strokeWidth={2.4} />
                <Text style={styles.faceSetupBtnText}>Set Up Face Recognition</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Biometric Management Action Row: Password Confirmation Input */}
          <View style={styles.passwordCard}>
            <Text style={styles.passwordCardLabel}>
              Confirm Password for Biometric Operations
            </Text>
            <View style={styles.passwordInputBox}>
              <KeyRound size={16} color={COLORS.muted} style={{marginRight: 8}} />
              <TextInput
                style={styles.passwordInput}
                value={biometricPassword}
                onChangeText={setBiometricPassword}
                placeholder="Account password required to enroll or remove"
                placeholderTextColor="#9AA7B8"
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            {biometricError ? (
              <Banner type="error" message={biometricError} />
            ) : null}

            {biometricNotice ? (
              <Banner type="success" message={biometricNotice} />
            ) : null}

            {fingerprintCredentials.length === 0 ? (
              <TouchableOpacity
                style={[styles.primaryBiometricBtn, biometricActionLoading && styles.btnDisabled]}
                onPress={handleEnrollFingerprint}
                disabled={biometricActionLoading}
                activeOpacity={0.85}
              >
                {biometricActionLoading ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <>
                    <Fingerprint size={16} color={COLORS.white} strokeWidth={2.4} />
                    <Text style={styles.primaryBiometricBtnText}>Enroll Device Fingerprint</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.destructiveBiometricBtn, biometricActionLoading && styles.btnDisabled]}
                onPress={() => {
                  Alert.alert(
                    'Disable Fingerprint?',
                    'This removes device fingerprint credentials from your account. Password login will remain available.',
                    [
                      {text: 'Cancel', style: 'cancel'},
                      {text: 'Disable', style: 'destructive', onPress: handleDisableFingerprint},
                    ],
                  );
                }}
                disabled={biometricActionLoading}
                activeOpacity={0.85}
              >
                {biometricActionLoading ? (
                  <ActivityIndicator color={COLORS.red} size="small" />
                ) : (
                  <Text style={styles.destructiveBiometricBtnText}>
                    Disable Enrolled Fingerprint Key
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Section: Account Settings */}
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionHeadingTitle}>Account Settings</Text>
            <Text style={styles.sectionHeadingSubtitle}>
              Institutional security controls and preferences
            </Text>
          </View>

          <View style={styles.settingsGroup}>
            {/* 1. Change Password Row */}
            <TouchableOpacity
              style={styles.settingsRow}
              onPress={() => setChangePasswordModal(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <View style={[styles.settingsIconBox, {backgroundColor: COLORS.blueLight}]}>
                <Lock size={18} color={COLORS.blue} strokeWidth={2.2} />
              </View>
              <View style={styles.settingsCopy}>
                <Text style={styles.settingsTitle}>Change Password</Text>
                <Text style={styles.settingsSubtitle}>Update your portal login password</Text>
              </View>
              <ChevronRight size={18} color="#9AA7B8" />
            </TouchableOpacity>

            {/* 2. Device Information Row */}
            <TouchableOpacity
              style={styles.settingsRow}
              onPress={() => toggleSection('device')}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <View style={[styles.settingsIconBox, {backgroundColor: COLORS.greenLight}]}>
                <Smartphone size={18} color={COLORS.green} strokeWidth={2.2} />
              </View>
              <View style={styles.settingsCopy}>
                <Text style={styles.settingsTitle}>Device Information</Text>
                <Text style={styles.settingsSubtitle}>OS, platform & keystore capabilities</Text>
              </View>
              {expandedSection === 'device' ? (
                <ChevronUp size={18} color="#9AA7B8" />
              ) : (
                <ChevronDown size={18} color="#9AA7B8" />
              )}
            </TouchableOpacity>

            {expandedSection === 'device' ? (
              <View style={styles.settingsExpandBox}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Operating System:</Text>
                  <Text style={styles.detailValue}>
                    {Platform.OS === 'android' ? `Android API ${Platform.Version}` : 'iOS'}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Biometric Sensor:</Text>
                  <Text style={styles.detailValue}>
                    {deviceInfo.biometryType || 'Hardware Keystore'}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Server Endpoint:</Text>
                  <Text style={styles.detailValue} numberOfLines={1}>
                    {API_URL.replace('https://', '')}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* 3. About ATTENDSYNC Row */}
            <TouchableOpacity
              style={styles.settingsRow}
              onPress={() => toggleSection('about')}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <View style={[styles.settingsIconBox, {backgroundColor: '#EEF2FF'}]}>
                <Info size={18} color={COLORS.blueDark} strokeWidth={2.2} />
              </View>
              <View style={styles.settingsCopy}>
                <Text style={styles.settingsTitle}>About ATTENDSYNC</Text>
                <Text style={styles.settingsSubtitle}>Version 1.0.0 • Bansud Central School</Text>
              </View>
              {expandedSection === 'about' ? (
                <ChevronUp size={18} color="#9AA7B8" />
              ) : (
                <ChevronDown size={18} color="#9AA7B8" />
              )}
            </TouchableOpacity>

            {expandedSection === 'about' ? (
              <View style={styles.settingsExpandBox}>
                <Text style={styles.aboutText}>
                  ATTENDSYNC is the official mobile biometric attendance platform designed for Bansud Central School, Division of Oriental Mindoro.
                </Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Version:</Text>
                  <Text style={styles.detailValue}>1.0.0 (Release Build)</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Official Timezone:</Text>
                  <Text style={styles.detailValue}>Asia/Manila (PHT UTC+8)</Text>
                </View>
              </View>
            ) : null}

            {/* 4. Log Out Row */}
            <TouchableOpacity
              style={[styles.settingsRow, styles.logoutRow]}
              onPress={onLogout}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <View style={[styles.settingsIconBox, {backgroundColor: COLORS.redLight}]}>
                <LogOut size={18} color={COLORS.red} strokeWidth={2.2} />
              </View>
              <View style={styles.settingsCopy}>
                <Text style={[styles.settingsTitle, {color: COLORS.red}]}>Log Out</Text>
                <Text style={styles.settingsSubtitle}>Securely end your current session</Text>
              </View>
              <ChevronRight size={18} color={COLORS.red} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Change Password Modal */}
      {changePasswordModal ? (
        <Modal
          visible={changePasswordModal}
          transparent
          animationType="fade"
          onRequestClose={() => setChangePasswordModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.changePasswordCard}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Change Password</Text>
                  <Text style={styles.modalSubtitle}>
                    Secure your ATTENDSYNC employee portal account
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setChangePasswordModal(false)}
                >
                  <X size={18} color={COLORS.navy} strokeWidth={2.4} />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Current Password</Text>
              <TextInput
                style={styles.modalInput}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter current password"
                placeholderTextColor="#9AA7B8"
                secureTextEntry
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>New Password (min. 8 characters)</Text>
              <TextInput
                style={styles.modalInput}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new secure password"
                placeholderTextColor="#9AA7B8"
                secureTextEntry
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>Confirm New Password</Text>
              <TextInput
                style={styles.modalInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter new password"
                placeholderTextColor="#9AA7B8"
                secureTextEntry
                autoCapitalize="none"
              />

              {passwordError ? (
                <Banner type="error" message={passwordError} />
              ) : null}

              {passwordSuccess ? (
                <Banner type="success" message={passwordSuccess} />
              ) : null}

              <TouchableOpacity
                style={[styles.modalSubmitBtn, changingPassword && styles.btnDisabled]}
                onPress={handleChangePasswordSubmit}
                disabled={changingPassword}
                activeOpacity={0.85}
              >
                {changingPassword ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Update Password</Text>
                )}
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
  body: {
    paddingHorizontal: 20,
    marginTop: -20,
  },
  profileCard: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 4,
    shadowColor: COLORS.navyDark,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.08,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: '#EDF2F7',
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: COLORS.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 1.5,
    borderColor: COLORS.blueBorder,
  },
  avatarText: {
    fontSize: 22,
    color: COLORS.blue,
    fontWeight: '900',
  },
  profileCopy: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: {
    color: COLORS.navy,
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
  },
  employeeBadgeRow: {
    marginTop: 4,
    gap: 4,
  },
  idBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  idBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.navy,
  },
  positionText: {
    fontSize: 11,
    color: COLORS.muted,
    fontWeight: '600',
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  email: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '500',
  },
  sectionHeading: {
    marginTop: 20,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionHeadingTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.navy,
  },
  sectionHeadingSubtitle: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 2,
  },
  biometricCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    elevation: 2,
    shadowColor: COLORS.navyDark,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: '#EDF2F7',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  biometricIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.navy,
  },
  biometricCardSubtitle: {
    fontSize: 10,
    color: COLORS.muted,
    marginTop: 1,
  },
  biometricDesc: {
    fontSize: 11,
    color: COLORS.muted,
    lineHeight: 16,
    marginTop: 10,
  },
  statusLoader: {
    marginVertical: 12,
  },
  enrolledInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.greenLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    marginTop: 10,
  },
  enrolledInfoText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.greenDark,
  },
  faceActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  faceTestBtn: {
    flex: 1,
    height: 40,
    backgroundColor: COLORS.navy,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceTestBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.white,
  },
  faceRemoveBtn: {
    paddingHorizontal: 16,
    height: 40,
    backgroundColor: '#FFF8F8',
    borderWidth: 1.2,
    borderColor: COLORS.redBorder,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceRemoveBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.red,
  },
  faceSetupBtn: {
    height: 42,
    backgroundColor: COLORS.navy,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  faceSetupBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.white,
  },
  passwordCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    elevation: 2,
    shadowColor: COLORS.navyDark,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  passwordCardLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 6,
  },
  passwordInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderWidth: 1.2,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: '#FAFCFE',
    paddingHorizontal: 12,
  },
  passwordInput: {
    flex: 1,
    fontSize: 12,
    color: COLORS.text,
  },
  primaryBiometricBtn: {
    height: 46,
    backgroundColor: COLORS.navy,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  primaryBiometricBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.white,
  },
  destructiveBiometricBtn: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: COLORS.redBorder,
    backgroundColor: '#FFF8F8',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  destructiveBiometricBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.red,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  settingsGroup: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    overflow: 'hidden',
    elevation: 2,
    shadowColor: COLORS.navyDark,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  logoutRow: {
    borderBottomWidth: 0,
  },
  settingsIconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingsCopy: {
    flex: 1,
  },
  settingsTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.navy,
  },
  settingsSubtitle: {
    fontSize: 10,
    color: COLORS.muted,
    marginTop: 1,
  },
  settingsExpandBox: {
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.muted,
  },
  detailValue: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.navy,
  },
  aboutText: {
    fontSize: 11,
    color: COLORS.muted,
    lineHeight: 16,
    marginBottom: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(6, 23, 43, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  changePasswordCard: {
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
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.navy,
  },
  modalSubtitle: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 5,
    marginTop: 10,
  },
  modalInput: {
    height: 46,
    borderWidth: 1.2,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 12,
    color: COLORS.text,
    backgroundColor: '#FAFCFE',
  },
  modalSubmitBtn: {
    height: 48,
    backgroundColor: COLORS.navy,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  modalSubmitBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.white,
  },
});
