import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {AppState} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {apiRequest, onNetworkDenied} from '../api/client';
import {
  evaluateCompliance,
  getCurrentNetworkInfo,
  requestLocationPermissionForWifi,
} from '../services/networkRestriction';

const NetworkRestrictionContext = createContext({
  status: 'loading',
  policy: null,
  networkInfo: null,
  isVerified: false,
  denialReason: '',
  isChecking: false,
  warningMessage: null,
  recheckNetwork: async () => {},
  requestPermission: async () => false,
});

export function NetworkRestrictionProvider({children, token, isLoggedIn}) {
  const [status, setStatus] = useState('loading');
  const [policy, setPolicy] = useState(null);
  const [networkInfo, setNetworkInfo] = useState(null);
  const [isVerified, setIsVerified] = useState(false);
  const [denialReason, setDenialReason] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [warningMessage, setWarningMessage] = useState(null);

  const isCheckingRef = useRef(false);
  const activeTokenRef = useRef(token);
  activeTokenRef.current = token;

  const performCheck = useCallback(async () => {
    if (isCheckingRef.current) {
      return;
    }

    if (!isLoggedIn || !activeTokenRef.current) {
      setStatus('authorized');
      setIsChecking(false);
      return;
    }

    isCheckingRef.current = true;
    setIsChecking(true);

    try {
      // 1. Snapshot current hardware network state
      const currentNet = await getCurrentNetworkInfo();
      setNetworkInfo(currentNet);

      // 2. Fetch authoritative policy from Laravel server
      let fetchedPolicy = null;
      try {
        const policyRes = await apiRequest('/network-policy', activeTokenRef.current, {
          timeout: 10000,
        });
        fetchedPolicy = policyRes.policy || null;
        setPolicy(fetchedPolicy);
      } catch (policyErr) {
        // If server is unreachable
        if (
          policyErr.message?.includes('Unable to connect') ||
          policyErr.message?.includes('temporarily unavailable')
        ) {
          setStatus('error');
          setDenialReason('Unable to verify school network. The ATTENDSYNC server is temporarily unreachable.');
          setIsChecking(false);
          isCheckingRef.current = false;
          return;
        }

        if (policyErr.code === 'NETWORK_NOT_AUTHORIZED') {
          setStatus('unauthorized');
          setDenialReason(policyErr.message || 'Access denied by school network restriction policy.');
          setIsChecking(false);
          isCheckingRef.current = false;
          return;
        }

        throw policyErr;
      }

      // If restriction is disabled on server, immediately authorize
      if (!fetchedPolicy || !fetchedPolicy.is_enabled) {
        setStatus('authorized');
        setIsVerified(true);
        setDenialReason('');
        setWarningMessage(null);
        setIsChecking(false);
        isCheckingRef.current = false;
        return;
      }

      setWarningMessage(fetchedPolicy.warning_message || null);

      // 3. Preliminary client-side compliance check
      const clientEval = evaluateCompliance(fetchedPolicy, currentNet);

      if (!clientEval.authorized) {
        setStatus('unauthorized');
        setDenialReason(clientEval.reason);
        setIsVerified(false);
        setIsChecking(false);
        isCheckingRef.current = false;
        return;
      }

      // 4. Server-side verification challenge
      try {
        const verifyRes = await apiRequest(
          '/network-verify',
          activeTokenRef.current,
          {
            method: 'POST',
            body: {
              network_type: currentNet.type,
              network_ssid: currentNet.ssid,
              network_bssid: currentNet.bssid,
            },
            timeout: 10000,
          },
        );

        if (verifyRes.authorized) {
          setStatus('authorized');
          setIsVerified(Boolean(fetchedPolicy.is_strong_verification));
          setDenialReason('');
        } else {
          setStatus('unauthorized');
          setDenialReason(verifyRes.message || 'School network verification failed.');
          setIsVerified(false);
        }
      } catch (verifyErr) {
        if (verifyErr.code === 'NETWORK_NOT_AUTHORIZED') {
          setStatus('unauthorized');
          setDenialReason(verifyErr.message || 'Network is not authorized.');
          setIsVerified(false);
        } else {
          setStatus('error');
          setDenialReason('Server network verification could not be completed.');
          setIsVerified(false);
        }
      }
    } catch (err) {
      setStatus('error');
      setDenialReason(err.message || 'An error occurred while verifying network authorization.');
      setIsVerified(false);
    } finally {
      setIsChecking(false);
      isCheckingRef.current = false;
    }
  }, [isLoggedIn]);

  // Request Android location permission for SSID detection
  const handleRequestPermission = useCallback(async () => {
    const granted = await requestLocationPermissionForWifi();
    if (granted) {
      await performCheck();
    }
    return granted;
  }, [performCheck]);

  // Initial verification on login / mount
  useEffect(() => {
    if (isLoggedIn && token) {
      performCheck();
    } else {
      setStatus('authorized');
    }
  }, [isLoggedIn, token, performCheck]);

  // Listen for hardware connectivity changes
  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }

    const unsubscribeNetInfo = NetInfo.addEventListener(() => {
      performCheck();
    });

    const unsubscribeAppState = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        performCheck();
      }
    });

    const unsubscribeApiDenied = onNetworkDenied(deniedData => {
      setStatus('unauthorized');
      setDenialReason(
        deniedData?.message ||
          'Protected operation denied. Connect to the authorized school network.',
      );
      setIsVerified(false);
    });

    return () => {
      unsubscribeNetInfo();
      unsubscribeAppState.remove();
      unsubscribeApiDenied();
    };
  }, [isLoggedIn, performCheck]);

  return (
    <NetworkRestrictionContext.Provider
      value={{
        status,
        policy,
        networkInfo,
        isVerified,
        denialReason,
        isChecking,
        warningMessage,
        recheckNetwork: performCheck,
        requestPermission: handleRequestPermission,
      }}
    >
      {children}
    </NetworkRestrictionContext.Provider>
  );
}

export function useNetworkRestriction() {
  return useContext(NetworkRestrictionContext);
}
