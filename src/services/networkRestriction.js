import {Linking, PermissionsAndroid, Platform} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {updateNetworkHeaders} from '../api/client';

/**
 * Safely request Android location permission required to read Wi-Fi SSID.
 */
export async function requestLocationPermissionForWifi() {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const granted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );

    if (granted) {
      return true;
    }

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'School Wi-Fi Identification',
        message:
          'ATTENDSYNC requires location permission to detect your connected school Wi-Fi network name (SSID) for attendance security.',
        buttonPositive: 'Allow',
        buttonNegative: 'Not Now',
      },
    );

    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch (error) {
    return false;
  }
}

/**
 * Clean up raw SSID values (stripping Android quotes and placeholder strings).
 */
export function sanitizeSsid(raw) {
  if (!raw || typeof raw !== 'string') {
    return null;
  }

  const clean = raw.trim().replace(/^["']|["']$/g, '');

  if (
    clean === '' ||
    clean.toLowerCase() === '<unknown ssid>' ||
    clean.toLowerCase() === 'null' ||
    clean.toLowerCase() === '0x'
  ) {
    return null;
  }

  return clean;
}

/**
 * Clean up raw BSSID values.
 */
export function sanitizeBssid(raw) {
  if (!raw || typeof raw !== 'string') {
    return null;
  }

  const clean = raw.trim().replace(/^["']|["']$/g, '');

  if (
    clean === '' ||
    clean.toLowerCase() === '<unknown bssid>' ||
    clean.toLowerCase() === 'null' ||
    clean === '02:00:00:00:00:00'
  ) {
    return null;
  }

  return clean.toUpperCase();
}

/**
 * Query the device's current network state and synchronize API client headers.
 */
export async function getCurrentNetworkInfo() {
  try {
    const state = await NetInfo.fetch();
    const details = state.details || {};

    const rawSsid = details.ssid || null;
    const rawBssid = details.bssid || null;

    const ssid = sanitizeSsid(rawSsid);
    const bssid = sanitizeBssid(rawBssid);
    const type = state.type || 'unknown';

    const networkInfo = {
      isConnected: Boolean(state.isConnected),
      isInternetReachable: state.isInternetReachable,
      type,
      isWifi: type === 'wifi',
      isCellular: type === 'cellular',
      ssid,
      bssid,
      ipAddress: details.ipAddress || null,
      subnet: details.subnet || null,
    };

    // Synchronize client outgoing headers
    updateNetworkHeaders({
      type,
      ssid,
      bssid,
    });

    return networkInfo;
  } catch (error) {
    return {
      isConnected: false,
      isInternetReachable: false,
      type: 'unknown',
      isWifi: false,
      isCellular: false,
      ssid: null,
      bssid: null,
      ipAddress: null,
      subnet: null,
      error: error?.message,
    };
  }
}

/**
 * Open Android Wi-Fi settings safely.
 */
export async function openWifiSettings() {
  if (Platform.OS === 'android') {
    try {
      await Linking.sendIntent('android.settings.WIFI_SETTINGS');
      return;
    } catch {
      // Fallback
    }
  }

  try {
    await Linking.openSettings();
  } catch {
    // Ignore error
  }
}

/**
 * Evaluate client-side compliance against the server-controlled policy.
 */
export function evaluateCompliance(policy, networkInfo) {
  if (!policy || !policy.is_enabled) {
    return {
      authorized: true,
      code: 'AUTHORIZED',
      reason: 'School network restriction is currently disabled.',
      isPreliminary: false,
    };
  }

  if (!networkInfo || !networkInfo.isConnected) {
    return {
      authorized: false,
      code: 'OFFLINE',
      reason:
        'No active network connection detected. Please connect to the authorized school Wi-Fi network.',
      isPreliminary: false,
    };
  }

  if (!networkInfo.isWifi) {
    return {
      authorized: false,
      code: 'CELLULAR_RESTRICTED',
      reason:
        'Connected to mobile data. ATTENDSYNC attendance and employee features require connection to the authorized school Wi-Fi network.',
      isPreliminary: false,
    };
  }

  const authorizedSsid = policy.authorized_ssid ? policy.authorized_ssid.trim() : '';

  if (!authorizedSsid) {
    return {
      authorized: false,
      code: 'POLICY_MISCONFIGURED',
      reason:
        'School network restriction is enabled on the server, but no authorized SSID has been configured.',
      isPreliminary: false,
    };
  }

  if (!networkInfo.ssid) {
    return {
      authorized: false,
      code: 'SSID_UNAVAILABLE',
      reason:
        'Connected to Wi-Fi, but the network name (SSID) could not be detected. Please ensure Location is turned on and location permission is granted on Android.',
      isPreliminary: false,
    };
  }

  if (networkInfo.ssid.toLowerCase() !== authorizedSsid.toLowerCase()) {
    return {
      authorized: false,
      code: 'NETWORK_NOT_AUTHORIZED',
      reason: `Connected to Wi-Fi "${networkInfo.ssid}". You must connect to the authorized school network: "${authorizedSsid}".`,
      isPreliminary: false,
    };
  }

  return {
    authorized: true,
    code: 'AUTHORIZED',
    reason: `Connected to authorized school Wi-Fi (${networkInfo.ssid}).`,
    isPreliminary: policy.verification_method === 'client_assisted',
  };
}
