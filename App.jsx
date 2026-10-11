
import React, {useState} from 'react';

import {Alert} from 'react-native';

import {SafeAreaProvider} from 'react-native-safe-area-context';

import AppNavigator from './src/navigation/AppNavigator';
import {apiRequest} from './src/api/client';

export default function App() {
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [token, setToken] = useState(null);
  const [biometricStatus, setBiometricStatus] = useState(null);

  React.useEffect(() => {
    if (token && !employee) {
      apiRequest('/me', token)
        .then(res => {
          if (res.employee) {
            setEmployee(res.employee);
          }
        })
        .catch(() => {});
    }
  }, [token, employee]);

  const handleLogin = async (email, password) => {
    try {
      const data = await apiRequest('/login', null, {
        method: 'POST',
        body: {
          email: email.trim(),
          password: password,
        },
      });

      const receivedToken = data.access_token || data.token;

      if (!receivedToken) {
        throw new Error(
          'Login successful, but no authentication token was received.',
        );
      }

      let enrolledMethods = null;
      let biometricStatusError = '';
      try {
        const status = await apiRequest('/biometric/credentials', receivedToken);
        enrolledMethods = status.methods || null;
      } catch (error) {
        enrolledMethods = null;
        biometricStatusError = error.message || 'Biometric enrollment status is temporarily unavailable.';
      }

      setToken(receivedToken);
      setUser(data.user || null);
      setEmployee(data.employee || null);
      setBiometricStatus(enrolledMethods);

      Alert.alert(
        'Login Successful',
        `Welcome to ATTENDSYNC, ${data.user?.name || 'User'}!${
          biometricStatusError
            ? `\n\n${biometricStatusError} Password login is still available.`
            : ''
        }`,
      );
    } catch (error) {
      Alert.alert(
        'Login Failed',
        error?.message || 'Unable to connect to the server.',
      );
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout Confirmation',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            setToken(null);
            setUser(null);
            setEmployee(null);
            setBiometricStatus(null);
          },
        },
      ],
      {
        cancelable: true,
      },
    );
  };

  return (
    <SafeAreaProvider>
      <AppNavigator
        isLoggedIn={user !== null && token !== null}
        user={user}
        employee={employee}
        token={token}
        biometricStatus={biometricStatus}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />
    </SafeAreaProvider>
  );
}