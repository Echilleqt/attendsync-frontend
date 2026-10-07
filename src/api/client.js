export const API_URL =
  'https://ambitious-untagged-semester.ngrok-free.dev/api';

export async function apiRequest(path, token, options = {}) {
  const {method = 'GET', body, headers = {}} = options;

  const requestHeaders = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
    ...headers,
  };

  let requestBody = body;

  if (body && !(body instanceof FormData)) {
    requestHeaders['Content-Type'] = 'application/json';
    requestBody = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: requestHeaders,
    body: requestBody,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const validationMessage = data.errors
      ? Object.values(data.errors).flat().join('\n')
      : null;

    throw new Error(
      validationMessage ||
        data.message ||
        'The server could not complete the request.',
    );
  }

  return data;
}