export const API_URL =
  'https://ambitious-untagged-semester.ngrok-free.dev/api';

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

export async function apiRequest(path, token, options = {}) {
  const isMultipart = options.body instanceof FormData;
  const defaultTimeout = isMultipart ? 45000 : 15000;
  const {method = 'GET', body, headers = {}, timeout = defaultTimeout} = options;

  const requestHeaders = {
    Accept: 'application/json',
    'ngrok-skip-browser-warning': 'true',
    ...headers,
  };

  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  let requestBody = body;
  if (body && !isMultipart) {
    requestHeaders['Content-Type'] = 'application/json';
    requestBody = JSON.stringify(body);
  }

  const fetchOptions = {
    method,
    headers: requestHeaders,
    body: requestBody,
  };

  const url = `${API_URL}${path}`;

  let response = null;
  try {
    response = await fetchWithTimeout(url, fetchOptions, timeout);
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Unable to connect to the server. Please check your connection.');
    }
    const errMsg = String(err?.message || '');
    if (errMsg.includes('Network request failed') || errMsg.includes('Failed to fetch')) {
      throw new Error('Unable to connect to the server. Please check your connection.');
    }
    throw new Error(err?.message || 'Unable to connect to the server. Please check your connection.');
  }

  if (response.status === 401) {
    throw new Error('Your session has expired. Please log in again.');
  }

  if (response.status === 502 || response.status === 503 || response.status === 504) {
    throw new Error('The server is temporarily unavailable.');
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 404 && path.includes('/face/verify')) {
      throw new Error('Face verification failed. Please try again.');
    }

    const validationMessage = data.errors
      ? Object.values(data.errors).flat().join('\n')
      : null;

    const rawMessage = validationMessage || data.message || data.error;

    if (rawMessage && String(rawMessage).toLowerCase().includes('face verification failed')) {
      throw new Error('Face verification failed. Please try again.');
    }

    const message = rawMessage || 'The server could not complete the request.';
    throw new Error(message);
  }

  return data;
}