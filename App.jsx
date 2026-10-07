
import React, {useState} from 'react';

import {Alert} from 'react-native';

import AppNavigator from './src/navigation/AppNavigator';
import {API_URL, apiRequest} from './src/api/client';

export default function App() {
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [token, setToken] = useState(null);
  const [biometricStatus, setBiometricStatus] = useState(null);

  const handleLogin = async (email, password) => {
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'Invalid email or password.',
        );
      }

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
    <AppNavigator
      isLoggedIn={user !== null && token !== null}
      user={user}
      employee={employee}
      token={token}
      biometricStatus={biometricStatus}
      onLogin={handleLogin}
      onLogout={handleLogout}
    />
  );
}