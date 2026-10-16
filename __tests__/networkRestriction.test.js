import {
  evaluateCompliance,
  sanitizeBssid,
  sanitizeSsid,
} from '../src/services/networkRestriction';

describe('Network Restriction Mobile Service', () => {
  describe('sanitizeSsid', () => {
    it('strips enclosing quotes from Android SSIDs', () => {
      expect(sanitizeSsid('"BansudCS-Faculty"')).toBe('BansudCS-Faculty');
      expect(sanitizeSsid("'BansudCS-Faculty'")).toBe('BansudCS-Faculty');
      expect(sanitizeSsid('BansudCS-Faculty')).toBe('BansudCS-Faculty');
    });

    it('returns null for unknown, placeholder, or empty SSIDs', () => {
      expect(sanitizeSsid('<unknown ssid>')).toBeNull();
      expect(sanitizeSsid('null')).toBeNull();
      expect(sanitizeSsid('')).toBeNull();
      expect(sanitizeSsid(null)).toBeNull();
      expect(sanitizeSsid(undefined)).toBeNull();
    });
  });

  describe('sanitizeBssid', () => {
    it('normalizes valid BSSID MAC addresses to uppercase', () => {
      expect(sanitizeBssid('aa:bb:cc:dd:ee:ff')).toBe('AA:BB:CC:DD:EE:FF');
      expect(sanitizeBssid('"00:11:22:33:44:55"')).toBe('00:11:22:33:44:55');
    });

    it('returns null for placeholder or unknown BSSIDs', () => {
      expect(sanitizeBssid('<unknown bssid>')).toBeNull();
      expect(sanitizeBssid('02:00:00:00:00:00')).toBeNull();
      expect(sanitizeBssid(null)).toBeNull();
    });
  });

  describe('evaluateCompliance', () => {
    const activePolicy = {
      is_enabled: true,
      authorized_ssid: 'BansudCS-Faculty',
      network_description: 'Bansud Central School Main Wi-Fi',
      verification_method: 'client_assisted',
      is_strong_verification: false,
    };

    it('authorizes any connection when policy is disabled', () => {
      const disabledPolicy = {...activePolicy, is_enabled: false};
      const result = evaluateCompliance(disabledPolicy, {
        isConnected: true,
        isWifi: false,
        type: 'cellular',
      });

      expect(result.authorized).toBe(true);
      expect(result.code).toBe('AUTHORIZED');
    });

    it('rejects access when device is offline', () => {
      const result = evaluateCompliance(activePolicy, {
        isConnected: false,
        isWifi: false,
      });

      expect(result.authorized).toBe(false);
      expect(result.code).toBe('OFFLINE');
    });

    it('rejects cellular mobile data access', () => {
      const result = evaluateCompliance(activePolicy, {
        isConnected: true,
        isWifi: false,
        isCellular: true,
        type: 'cellular',
      });

      expect(result.authorized).toBe(false);
      expect(result.code).toBe('CELLULAR_RESTRICTED');
    });

    it('rejects when connected to Wi-Fi but SSID is unavailable (no location permission)', () => {
      const result = evaluateCompliance(activePolicy, {
        isConnected: true,
        isWifi: true,
        type: 'wifi',
        ssid: null,
      });

      expect(result.authorized).toBe(false);
      expect(result.code).toBe('SSID_UNAVAILABLE');
    });

    it('rejects when connected to unauthorized Wi-Fi SSID', () => {
      const result = evaluateCompliance(activePolicy, {
        isConnected: true,
        isWifi: true,
        type: 'wifi',
        ssid: 'Home-WiFi-5G',
      });

      expect(result.authorized).toBe(false);
      expect(result.code).toBe('NETWORK_NOT_AUTHORIZED');
      expect(result.reason).toContain('Home-WiFi-5G');
    });

    it('authorizes when connected to the exact matching authorized SSID', () => {
      const result = evaluateCompliance(activePolicy, {
        isConnected: true,
        isWifi: true,
        type: 'wifi',
        ssid: 'BansudCS-Faculty',
      });

      expect(result.authorized).toBe(true);
      expect(result.code).toBe('AUTHORIZED');
      expect(result.isPreliminary).toBe(true);
    });

    it('performs case-insensitive SSID matching', () => {
      const result = evaluateCompliance(activePolicy, {
        isConnected: true,
        isWifi: true,
        type: 'wifi',
        ssid: 'bansudcs-faculty',
      });

      expect(result.authorized).toBe(true);
    });
  });
});
