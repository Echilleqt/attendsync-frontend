import {
  formatAttendanceDate,
  formatAttendanceDateTime,
  formatAttendanceTime,
  formatOfficialRecordTimestamp,
} from '../src/utils/attendanceFormat';
import {publicKeyPem} from '../src/utils/biometricFormat';

describe('official attendance formatting', () => {
  it('formats the server timestamp in Asia/Manila regardless of the device timezone', () => {
    expect(formatAttendanceTime('2026-10-03T08:15:00+08:00')).toBe('08:15 AM PHT');
  });

  it('formats combined date and time in the consistent Oct 11, 2026 · 2:35 PM format', () => {
    expect(formatAttendanceDateTime('2026-10-11T14:35:00+08:00')).toBe('Oct 11, 2026 · 2:35 PM');
    expect(
      formatOfficialRecordTimestamp({
        attendance_date: '2026-10-11',
        time_in: '2026-10-11T08:05:00+08:00',
      }, 'time_in')
    ).toBe('Oct 11, 2026 · 8:05 AM');
  });

  describe('biometric public key formatting', () => {
    it('wraps the native base64 DER key in PEM lines', () => {
      const encodedKey = 'A'.repeat(100);
      const pem = publicKeyPem(encodedKey);

      expect(pem.startsWith('-----BEGIN PUBLIC KEY-----\n')).toBe(true);
      expect(pem.endsWith('\n-----END PUBLIC KEY-----')).toBe(true);
      expect(pem.split('\n')[1]).toHaveLength(64);
      expect(pem.split('\n')[2]).toHaveLength(36);
    });

    it('rejects empty or malformed public keys', () => {
      expect(() => publicKeyPem('')).toThrow('invalid public key');
      expect(() => publicKeyPem('not a base64 key!')).toThrow('invalid public key');
    });
  });

  it('formats the date returned by the server without using the local clock', () => {
    expect(formatAttendanceDate('2026-10-03')).toBe('Saturday, October 3, 2026');
    expect(formatAttendanceDate('2026-10-03T00:00:00.000000Z')).toBe(
      'Saturday, October 3, 2026',
    );
  });

  it('does not invent a display value when the API timestamp is missing or invalid', () => {
    expect(formatAttendanceTime(null)).toBeNull();
    expect(formatAttendanceTime('not-a-date')).toBeNull();
    expect(formatAttendanceDate('')).toBeNull();
  });
});
