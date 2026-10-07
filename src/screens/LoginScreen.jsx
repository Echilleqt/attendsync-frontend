import React, { useState } from 'react';

import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  StatusBar,
  ScrollView,
} from 'react-native';
import {ShieldCheck} from 'lucide-react-native';

const COLORS = {
  navy: '#092B57',
  navyDark: '#061D3B',
  white: '#FFFFFF',
  text: '#172B4D',
  muted: '#718096',
  border: '#E2E8F0',
};

const LoginScreen = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(
        'Missing Information',
        'Please enter your email and password.'
      );
      return;
    }

    try {
      setLoading(true);

      if (onLogin) {
        await onLogin(email.trim(), password);
      } else {
        Alert.alert('Login', 'Login function is not connected yet.');
      }
    } catch (error) {
      Alert.alert(
        'Login Failed',
        error?.message || 'Unable to connect to the server.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.navyDark}
      />

      <ScrollView
        contentContainerStyle={styles.loginScroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.loginHeader}>
          <View style={styles.logoCircle}>
            <ShieldCheck size={38} color={COLORS.white} strokeWidth={2.2} />
          </View>

          <Text style={styles.brandName}>ATTENDSYNC</Text>

          <Text style={styles.brandSubtitle}>
            School Employee Attendance System
          </Text>
        </View>

        <View style={styles.loginCard}>
          <Text style={styles.welcomeText}>Welcome Back!</Text>

          <Text style={styles.loginDescription}>
            Sign in to manage your attendance.
          </Text>

          <Text style={styles.inputLabel}>Email Address</Text>

          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor="#9AA7B8"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.inputLabel}>Password</Text>

          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            placeholderTextColor="#9AA7B8"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            style={[
              styles.loginButton,
              loading && styles.disabledButton,
            ]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.loginButtonText}>LOGIN</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.loginFooterText}>
            Need an account? Contact your school administrator.
          </Text>
        </View>

        <Text style={styles.loginBottomText}>
          Track • Manage • Improve
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.navyDark,
  },

  loginScroll: {
    flexGrow: 1,
    backgroundColor: COLORS.navyDark,
    paddingBottom: 25,
  },

  loginHeader: {
    alignItems: 'center',
    paddingTop: 55,
    paddingBottom: 35,
    paddingHorizontal: 25,
  },

  logoCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 3,
    borderColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  logoIcon: {
    color: COLORS.white,
    fontSize: 48,
    fontWeight: 'bold',
  },

  brandName: {
    color: COLORS.white,
    fontSize: 31,
    fontWeight: '900',
    letterSpacing: 1,
  },

  brandSubtitle: {
    color: '#D9E6F5',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 7,
  },

  loginCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 25,
    elevation: 8,
  },

  welcomeText: {
    color: COLORS.navy,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },

  loginDescription: {
    color: COLORS.muted,
    fontSize: 14,
    marginBottom: 28,
  },

  inputLabel: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 12,
  },

  input: {
    height: 52,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 15,
    color: COLORS.text,
    backgroundColor: '#FAFCFF',
    fontSize: 14,
  },

  loginButton: {
    height: 54,
    backgroundColor: COLORS.navy,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },

  disabledButton: {
    opacity: 0.7,
  },

  loginButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
  },

  loginFooterText: {
    color: COLORS.muted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 22,
    lineHeight: 18,
  },

  loginBottomText: {
    color: '#D9E6F5',
    textAlign: 'center',
    marginTop: 30,
    fontSize: 13,
    letterSpacing: 1,
  },
});

export default LoginScreen;