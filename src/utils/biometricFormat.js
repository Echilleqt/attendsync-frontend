export function publicKeyPem(encodedKey) {
  const normalizedKey = typeof encodedKey === 'string' ? encodedKey.replace(/\s/g, '') : '';
  if (!normalizedKey || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalizedKey)) {
    throw new Error('The device returned an invalid public key.');
  }

  const lines = normalizedKey.match(/.{1,64}/g);
  return `-----BEGIN PUBLIC KEY-----\n${lines.join('\n')}\n-----END PUBLIC KEY-----`;
}
