import {apiRequest, setDeviceId} from '../api/client';
import {Platform} from 'react-native';

let cachedDeviceId = 'ATTENDSYNC-DEV-' + (Platform.OS ? Platform.OS.toUpperCase() : 'DEVICE') + '-001';

export function getDeviceUuid() {
  return cachedDeviceId;
}

export function setDeviceUuid(id) {
  cachedDeviceId = id;
  setDeviceId(id);
}

// Initialize device ID in client headers
setDeviceId(cachedDeviceId);

export function getDeviceMetadata() {
  return {
    device_uuid: getDeviceUuid(),
    device_name: `${Platform.OS === 'android' ? 'Android' : 'iOS'} Work Phone`,
    device_model: `${Platform.OS === 'android' ? 'Android' : 'Apple'} Mobile`,
    device_os: `${Platform.OS} ${Platform.Version || ''}`.trim(),
  };
}

export async function checkDeviceApproval(token) {
  try {
    const uuid = getDeviceUuid();
    const res = await apiRequest(`/devices/status?device_uuid=${encodeURIComponent(uuid)}`, token);
    return res;
  } catch (err) {
    return {registered: false, status: 'error', message: err.message};
  }
}

export async function submitDeviceRegistration(token, faceVerificationToken) {
  const metadata = getDeviceMetadata();
  return apiRequest('/devices/register', token, {
    method: 'POST',
    body: {
      ...metadata,
      face_verification_token: faceVerificationToken,
    },
  });
}
