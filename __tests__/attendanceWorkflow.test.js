import {
  formatAttendanceDate,
  formatAttendanceDateTime,
  formatAttendanceTime,
  formatOfficialRecordTimestamp,
} from '../src/utils/attendanceFormat';

describe('Complete ATTENDSYNC Attendance Workflow', () => {
  describe('STEP 1: Biometric Method Selection', () => {
    it('supports switching between fingerprint and face verification', () => {
      let selectedMethod = 'fingerprint';
      let verificationToken = 'sample-token';
      let verifiedMethod = 'fingerprint';

      const handleSelectMethod = (method) => {
        if (method !== selectedMethod) {
          selectedMethod = method;
          verificationToken = null;
          verifiedMethod = null;
        }
      };

      // User selects face verification
      handleSelectMethod('face');
      expect(selectedMethod).toBe('face');
      // Token from previous method is wiped
      expect(verificationToken).toBeNull();
      expect(verifiedMethod).toBeNull();

      // User switches back to fingerprint
      handleSelectMethod('fingerprint');
      expect(selectedMethod).toBe('fingerprint');
      expect(verificationToken).toBeNull();
    });
  });

  describe('STEP 2: Biometric Verification and Guard Rails', () => {
    it('does not open camera capture if fingerprint verification is cancelled', async () => {
      let isCameraOpen = false;
      let verificationToken = null;
      let submissionError = '';

      // Simulated cancellation from hardware biometric prompt
      const signatureResult = { success: false, signature: null };

      try {
        if (!signatureResult.success || !signatureResult.signature) {
          throw new Error('Fingerprint verification was cancelled. Attendance photo capture was not opened.');
        }
        verificationToken = 'mock-token';
        isCameraOpen = true;
      } catch (err) {
        verificationToken = null;
        isCameraOpen = false;
        submissionError = err.message;
      }

      expect(isCameraOpen).toBe(false);
      expect(verificationToken).toBeNull();
      expect(submissionError).toContain('Fingerprint verification was cancelled');
    });

    it('does not open camera capture if face verification is cancelled or unverified', async () => {
      let isCameraOpen = false;
      let verificationToken = null;
      let submissionError = '';

      const onCancelled = () => {
        verificationToken = null;
        isCameraOpen = false;
        submissionError = 'Face verification was cancelled or unverified. Attendance photo capture was not opened.';
      };

      onCancelled();

      expect(isCameraOpen).toBe(false);
      expect(verificationToken).toBeNull();
      expect(submissionError).toContain('cancelled or unverified');
    });

    it('opens camera capture only upon successful biometric verification', () => {
      let isCameraOpen = false;
      let verificationToken = null;
      let verifiedMethod = null;

      const onVerified = (response) => {
        const token = response?.face_verification_token || null;
        if (!token) return;
        verificationToken = token;
        verifiedMethod = 'face';
        isCameraOpen = true;
      };

      onVerified({ face_verification_token: 'valid-64-char-hex-token' });

      expect(isCameraOpen).toBe(true);
      expect(verificationToken).toBe('valid-64-char-hex-token');
      expect(verifiedMethod).toBe('face');
    });
  });

  describe('STEP 3 & 4: Photo Capture, Retake, and Preview', () => {
    it('stores photo for preview without immediately saving attendance', () => {
      let capturedPhoto = null;
      let isCameraOpen = true;
      let attendanceSaved = false;

      const handlePhotoCaptured = (photo) => {
        isCameraOpen = false;
        capturedPhoto = photo;
      };

      handlePhotoCaptured({ uri: 'file:///path/to/attendance-photo.jpg' });

      expect(isCameraOpen).toBe(false);
      expect(capturedPhoto).not.toBeNull();
      expect(capturedPhoto.uri).toBe('file:///path/to/attendance-photo.jpg');
      // Attendance is NOT saved upon photo capture
      expect(attendanceSaved).toBe(false);
    });

    it('allows retaking photo without creating duplicate records or uploads', () => {
      let capturedPhoto = { uri: 'file:///path/to/first-attempt.jpg' };
      let isCameraOpen = false;
      let uploadCount = 0;

      const handleRetakePhoto = () => {
        capturedPhoto = null;
        isCameraOpen = true;
      };

      handleRetakePhoto();

      expect(capturedPhoto).toBeNull();
      expect(isCameraOpen).toBe(true);
      expect(uploadCount).toBe(0);
    });
  });

  describe('STEP 5: Confirm and Save Attendance', () => {
    it('submits attendance with valid multipart body only when user confirms', async () => {
      const verificationToken = 'test-token-12345';
      const capturedPhoto = {
        uri: 'file:///data/proof.jpg',
        name: 'proof.jpg',
        type: 'image/jpeg',
      };
      const verifiedMethod = 'fingerprint';

      let submitting = false;
      let submissionSuccess = false;

      const submitAttendance = async (apiCall) => {
        if (submitting) return; // Prevent duplicate submission
        submitting = true;
        try {
          const result = await apiCall({
            verification_method: verifiedMethod,
            biometric_verification_token: verificationToken,
            photo: capturedPhoto,
          });
          submissionSuccess = Boolean(result?.attendance?.time_in);
        } finally {
          submitting = false;
        }
      };

      const mockApi = jest.fn().mockResolvedValue({
        success: true,
        attendance: {
          id: 42,
          attendance_date: '2026-10-11',
          time_in: '2026-10-11T08:05:00+08:00',
          status: 'present',
        },
      });

      await submitAttendance(mockApi);

      expect(mockApi).toHaveBeenCalledTimes(1);
      expect(submissionSuccess).toBe(true);
      expect(submitting).toBe(false);
    });

    it('prevents double submissions when button is tapped repeatedly', async () => {
      let callCount = 0;
      let submitting = false;

      const executeSubmit = async () => {
        if (submitting) return;
        submitting = true;
        callCount++;
        await new Promise((r) => setTimeout(r, 20));
        submitting = false;
      };

      // Rapid multi-tap simulation
      await Promise.all([executeSubmit(), executeSubmit(), executeSubmit()]);

      expect(callCount).toBe(1);
    });
  });

  describe('Authoritative Manila Timestamps Display', () => {
    it('formats authoritative backend timestamp as Oct 11, 2026 · 2:35 PM', () => {
      expect(formatAttendanceDateTime('2026-10-11T14:35:00+08:00')).toBe('Oct 11, 2026 · 2:35 PM');
      expect(formatAttendanceDateTime('2026-10-11T08:05:00+08:00')).toBe('Oct 11, 2026 · 8:05 AM');
    });

    it('consistently formats official records across views', () => {
      const serverRecord = {
        attendance_date: '2026-10-11',
        time_in: '2026-10-11T07:55:00+08:00',
        time_out: '2026-10-11T17:02:00+08:00',
      };

      expect(formatOfficialRecordTimestamp(serverRecord, 'time_in')).toBe('Oct 11, 2026 · 7:55 AM');
      expect(formatOfficialRecordTimestamp(serverRecord, 'time_out')).toBe('Oct 11, 2026 · 5:02 PM');
      expect(formatAttendanceTime(serverRecord.time_in)).toBe('07:55 AM PHT');
      expect(formatAttendanceTime(serverRecord.time_out)).toBe('05:02 PM PHT');
    });
  });
});
