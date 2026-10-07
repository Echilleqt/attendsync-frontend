import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
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
import ReactNativeBiometrics from 'react-native-biometrics';
import {apiRequest} from '../api/client';
import {publicKeyPem} from '../utils/biometricFormat';

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

const biometrics = new ReactNativeBiometrics({allowDeviceCredentials: false});

export default function ProfileScreen({user, token, onLogout}) {
  const [fingerprintCredentials, setFingerprintCredentials] = useState([]);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [error, setError] = useState('');
  const [statusError, setStatusError] = useState('');
  const [notice, setNotice] = useState('');
  const [cleanupPending, setCleanupPending] = useState(null);

  const loadStatus = useCallback(async () => {
    if (!token) {
      setFingerprintCredentials([]);
      setLoadingStatus(false);
      return;
    }

    setLoadingStatus(true);
    setError('');
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

  useFocusEffect(
    useCallback(() => {
      loadStatus();
    }, [loadStatus]),
  );

  const enrollFingerprint = async () => {
    if (!password) {
      setError('Enter your account password to confirm biometric enrollment.');
      return;
    }

    setLoading(true);
    setError('');
    setNotice('');
    let credentialId = null;
    let keyCreated = false;

    try {
      const sensor = await biometrics.isSensorAvailable();

      console.log('[ATTENDSYNC] Biometric sensor status:', sensor);

      if (!sensor.available) {
        throw new Error(
          `Biometric unavailable: ${sensor.error || 'Unknown reason'}. ` +
          `Biometry type: ${sensor.biometryType || 'Unknown'}. ` +
          'Email and password login remains available.',
        );
      }

      const keyPair = await biometrics.createKeys();
      if (!keyPair.publicKey) {
        throw new Error('The device did not create a secure public key.');
      }
      keyCreated = true;

      const enrolled = await apiRequest('/biometric/credentials', token, {
        method: 'POST',
        body: {
          password,
          verification_method: 'fingerprint',
          device_name: 'Android device',
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

      console.log(
  '[ATTENDSYNC] Message to sign:',
  challenge.message_to_sign,
);

console.log(
  '[ATTENDSYNC] Message length:',
  challenge.message_to_sign.length,
);

const signature = await biometrics.createSignature({
  promptMessage: 'Confirm your fingerprint key enrollment',
  payload: challenge.message_to_sign,
});

console.log(
  '[ATTENDSYNC] Signature created:',
  signature.success,
);

console.log(
  '[ATTENDSYNC] Signature length:',
  signature.signature ? signature.signature.length : 0,
);
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
        throw new Error('The server could not verify this device key. Enrollment was not completed.');
      }

      const status = await apiRequest('/biometric/credentials', token);
      const registered = status.methods?.fingerprint?.credentials;
      if (!Array.isArray(registered)) {
        throw new Error('The server did not return biometric enrollment status.');
      }
      if (!registered.some(item => item.credential_id === credentialId)) {
        throw new Error('The server did not confirm the completed fingerprint enrollment.');
      }

      setFingerprintCredentials(registered);
      setPassword('');
      setNotice('Fingerprint key enrollment is confirmed by the server.');
    } catch (requestError) {
      const pending = {
        credentialId,
        removeServer: Boolean(credentialId),
        removeLocal: keyCreated,
      };
      const cleanupErrors = [];

      if (credentialId) {
        try {
          await apiRequest('/biometric/credentials', token, {
            method: 'DELETE',
            body: {
              password,
              verification_method: 'fingerprint',
              credential_id: credentialId,
            },
          });
        } catch (cleanupError) {
          cleanupErrors.push(cleanupError.message || 'The incomplete server credential could not be removed.');
        }
        if (cleanupErrors.length === 0) {
          pending.removeServer = false;
        }
      }

      if (keyCreated) {
        try {
          await biometrics.deleteKeys();
          pending.removeLocal = false;
        } catch (cleanupError) {
          cleanupErrors.push(cleanupError.message || 'The device signing key could not be removed.');
        }
      }

      const cleanupRequired = pending.removeServer || pending.removeLocal;
      setCleanupPending(cleanupRequired ? pending : null);
      const failure = requestError.message || 'Fingerprint enrollment failed.';
      setError(
        cleanupErrors.length
          ? `${failure} Cleanup is incomplete: ${cleanupErrors.join(' ')}`
          : failure,
      );
    } finally {
      setLoading(false);
    }
  };

  const disableFingerprint = async () => {
    if (!password) {
      setError('Enter your account password to disable biometric enrollment.');
      return;
    }

    setLoading(true);
    setError('');
    setNotice('');
    try {
      await apiRequest('/biometric/credentials', token, {
        method: 'DELETE',
        body: {
          password,
          verification_method: 'fingerprint',
        },
      });
      try {
        await biometrics.deleteKeys();
      } catch {
        setCleanupPending({credentialId: null, removeServer: false, removeLocal: true});
        await loadStatus();
        throw new Error('The server credential was revoked, but local private key cleanup failed. Retry cleanup from this screen.');
      }
      await loadStatus();
      setPassword('');
      setNotice('Fingerprint enrollment was removed. Email and password login remains available.');
    } catch (requestError) {
      if (requestError.message && requestError.message.includes('local private key cleanup failed')) {
        setCleanupPending({credentialId: null, removeServer: false, removeLocal: true});
      }
      setError(requestError.message || 'Unable to disable biometric enrollment.');
    } finally {
      setLoading(false);
    }
  };

  const retryCleanup = async () => {
    if (!cleanupPending) {
      return;
    }

    setLoading(true);
    setError('');
    const pending = {...cleanupPending};
    const cleanupErrors = [];
    try {
      if (pending.removeServer) {
        try {
          await apiRequest('/biometric/credentials', token, {
            method: 'DELETE',
            body: {
              password,
              verification_method: 'fingerprint',
              credential_id: pending.credentialId,
            },
          });
          pending.removeServer = false;
        } catch (cleanupError) {
          cleanupErrors.push(cleanupError.message || 'The server credential could not be removed.');
        }
      }

      if (pending.removeLocal) {
        try {
          await biometrics.deleteKeys();
          pending.removeLocal = false;
        } catch (cleanupError) {
          cleanupErrors.push(cleanupError.message || 'The device signing key could not be removed.');
        }
      }

      if (pending.removeServer || pending.removeLocal) {
        setCleanupPending(pending);
        setError(`Cleanup is incomplete: ${cleanupErrors.join(' ')}`);
        return;
      }

      setCleanupPending(null);
      setPassword('');
      setNotice('Incomplete biometric enrollment cleanup completed.');
      await loadStatus();
    } catch (cleanupError) {
      setCleanupPending(pending);
      setError(cleanupError.message || 'Unable to complete biometric credential cleanup.');
    } finally {
      setLoading(false);
    }
  };

  const confirmDisable = () => {
    Alert.alert(
      'Disable device biometric enrollment?',
      'This removes all fingerprint/device biometric credentials registered to your account, on all devices. Password login will remain available.',
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Disable all', style: 'destructive', onPress: disableFingerprint},
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navyDeep} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ACCOUNT &amp; SECURITY</Text>
          <Text style={styles.title}>Your profile</Text>
          <Text style={styles.subtitle}>Manage account details and device verification.</Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.name || 'E').trim().charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.name}>{user?.name || 'Employee'}</Text>
            <Text style={styles.email}>{user?.email || 'No email available'}</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionEyebrow}>BIOMETRIC SECURITY</Text>
          <Text style={styles.sectionTitle}>Device enrollment</Text>
          <Text style={styles.sectionDescription}>Your device keeps the private signing key. Android's prompt may use any supported enrolled device biometric; the server cannot distinguish fingerprint from another modality. ATTENDSYNC stores only the public key and never collects fingerprint images.</Text>

          {loadingStatus ? (
            <ActivityIndicator style={styles.statusLoader} color={COLORS.blue} />
          ) : statusError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>Enrollment status could not be confirmed: {statusError}</Text>
              <TouchableOpacity onPress={loadStatus} disabled={loadingStatus}>
                <Text style={styles.inlineAction}>Retry status check</Text>
              </TouchableOpacity>
            </View>
          ) : fingerprintCredentials.length ? (
            fingerprintCredentials.map(credential => (
              <View style={styles.enrolledCard} key={credential.credential_id}>
                <View style={styles.enrolledIcon}><Text style={styles.enrolledIconText}>✓</Text></View>
                <View style={styles.enrolledCopy}>
                  <Text style={styles.enrolledTitle}>Fingerprint/device biometric key enrolled</Text>
                  <Text style={styles.enrolledSubtext}>{credential.device_name} · verified by server</Text>
                </View>
                <View style={styles.activePill}><Text style={styles.activePillText}>ACTIVE</Text></View>
              </View>
            ))
          ) : (
            <View style={styles.unenrolledCard}>
              <View style={styles.unenrolledIcon}><Text style={styles.unenrolledIconText}>○</Text></View>
              <View style={styles.enrolledCopy}>
                <Text style={styles.enrolledTitle}>Fingerprint/device biometric not set up</Text>
                <Text style={styles.enrolledSubtext}>Enrollment is confirmed only after the server verifies a signed challenge.</Text>
              </View>
            </View>
          )}

          <View style={styles.faceCard}>
            <Text style={styles.faceTitle}>Face recognition</Text>
            <Text style={styles.faceDescription}>Unavailable until a trusted face-matching and liveness verification service is connected. Camera permission alone is not face enrollment.</Text>
          </View>

          <Text style={styles.inputLabel}>Confirm your password</Text>
          <TextInput
            style={styles.passwordInput}
            value={password}
            onChangeText={setPassword}
            placeholder="Required to enroll or disable"
            placeholderTextColor="#829AB1"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
          />

          {error ? <View style={styles.errorBanner}><Text style={styles.errorText}>{error}</Text></View> : null}
          {notice ? <View style={styles.noticeBanner}><Text style={styles.noticeText}>{notice}</Text></View> : null}

          {cleanupPending ? (
            <TouchableOpacity style={[styles.secondaryButton, loading && styles.disabledButton]} onPress={retryCleanup} disabled={loading}>
              {loading ? <ActivityIndicator color={COLORS.navy} /> : <Text style={styles.secondaryButtonText}>Retry incomplete enrollment cleanup</Text>}
            </TouchableOpacity>
          ) : null}

          {!loadingStatus && !statusError && fingerprintCredentials.length === 0 && (
            <TouchableOpacity style={[styles.primaryButton, loading && styles.disabledButton]} onPress={enrollFingerprint} disabled={loading}>
              {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryButtonText}>Set up fingerprint</Text>}
            </TouchableOpacity>
          )}

          {!loadingStatus && fingerprintCredentials.length > 0 && (
            <TouchableOpacity
              style={[styles.secondaryButton, loading && styles.disabledButton]}
              onPress={confirmDisable}
              disabled={loading}>
              {loading ? <ActivityIndicator color={COLORS.navy} /> : <Text style={styles.secondaryButtonText}>Disable all fingerprint/device biometric keys</Text>}
            </TouchableOpacity>
          )}

          <Text style={styles.fallbackNote}>Email and password remain available if device enrollment fails or you disable biometrics.</Text>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={onLogout} accessibilityRole="button">
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: COLORS.canvas},
  content: {padding: 20, paddingBottom: 34},
  header: {backgroundColor: COLORS.navy, marginHorizontal: -20, marginTop: -20, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 30, borderBottomLeftRadius: 24, borderBottomRightRadius: 24},
  eyebrow: {color: '#9FB3C8', fontSize: 11, fontWeight: '800', letterSpacing: 1.3, marginBottom: 10},
  title: {color: COLORS.white, fontSize: 29, fontWeight: '800'},
  subtitle: {color: '#D9E2EC', fontSize: 14, marginTop: 7},
  profileCard: {backgroundColor: COLORS.white, borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'center', marginTop: -14, elevation: 2, shadowColor: COLORS.navy, shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.06, shadowRadius: 8},
  avatar: {width: 52, height: 52, borderRadius: 16, backgroundColor: COLORS.blueLight, alignItems: 'center', justifyContent: 'center', marginRight: 14},
  avatarText: {fontSize: 22, color: COLORS.blue, fontWeight: '800'},
  profileCopy: {flex: 1},
  name: {color: COLORS.text, fontSize: 17, fontWeight: '800'},
  email: {color: COLORS.muted, fontSize: 13, marginTop: 4},
  sectionCard: {backgroundColor: COLORS.white, borderRadius: 18, padding: 18, marginTop: 16, elevation: 2, shadowColor: COLORS.navy, shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 8},
  sectionEyebrow: {fontSize: 10, color: COLORS.blue, fontWeight: '800', letterSpacing: 1.1, marginBottom: 6},
  sectionTitle: {fontSize: 18, color: COLORS.navy, fontWeight: '800'},
  sectionDescription: {fontSize: 12, lineHeight: 18, color: COLORS.muted, marginTop: 7, marginBottom: 14},
  statusLoader: {marginVertical: 20},
  enrolledCard: {flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.greenLight, borderRadius: 13, padding: 13, marginBottom: 12},
  unenrolledCard: {flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.amberLight, borderRadius: 13, padding: 13, marginBottom: 12},
  enrolledIcon: {width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', marginRight: 11},
  unenrolledIcon: {width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', marginRight: 11},
  enrolledIconText: {color: COLORS.green, fontSize: 18, fontWeight: '900'},
  unenrolledIconText: {color: COLORS.amber, fontSize: 23, fontWeight: '800'},
  enrolledCopy: {flex: 1},
  enrolledTitle: {fontSize: 13, color: COLORS.text, fontWeight: '800'},
  enrolledSubtext: {fontSize: 11, color: COLORS.muted, lineHeight: 16, marginTop: 3},
  activePill: {backgroundColor: COLORS.white, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5},
  activePillText: {fontSize: 9, color: COLORS.green, fontWeight: '900'},
  faceCard: {backgroundColor: '#F7F9FB', borderColor: COLORS.border, borderWidth: 1, borderRadius: 12, padding: 13, marginBottom: 14},
  faceTitle: {fontSize: 13, color: COLORS.text, fontWeight: '800'},
  faceDescription: {fontSize: 11, lineHeight: 16, color: COLORS.muted, marginTop: 5},
  inputLabel: {fontSize: 12, fontWeight: '800', color: COLORS.text, marginBottom: 7},
  passwordInput: {height: 48, borderWidth: 1, borderColor: COLORS.border, borderRadius: 11, paddingHorizontal: 13, color: COLORS.text, backgroundColor: '#FAFCFE', fontSize: 13},
  errorBanner: {backgroundColor: COLORS.redLight, borderWidth: 1, borderColor: '#FECDCA', borderRadius: 11, padding: 12, marginTop: 12},
  errorText: {fontSize: 12, color: COLORS.red, lineHeight: 17},
  noticeBanner: {backgroundColor: COLORS.greenLight, borderRadius: 11, padding: 12, marginTop: 12},
  noticeText: {fontSize: 12, color: COLORS.green, lineHeight: 17, fontWeight: '600'},
  primaryButton: {height: 50, backgroundColor: COLORS.blue, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 14},
  primaryButtonText: {fontSize: 14, color: COLORS.white, fontWeight: '800'},
  secondaryButton: {minHeight: 48, borderColor: '#F2B8B5', borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 9},
  secondaryButtonText: {fontSize: 12, color: COLORS.red, fontWeight: '800'},
  inlineAction: {color: COLORS.blue, fontWeight: '800', fontSize: 12, marginTop: 9},
  disabledButton: {opacity: 0.65},
  fallbackNote: {fontSize: 11, color: COLORS.muted, lineHeight: 16, marginTop: 13},
  logoutButton: {height: 50, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', marginTop: 16},
  logoutText: {fontSize: 13, color: COLORS.navy, fontWeight: '800'},
});
