import React, {useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Eye, EyeOff, Lock, Mail, ShieldCheck} from 'lucide-react-native';
import COLORS from '../theme/colors';

const LoginScreen = ({onLogin}) => {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const topInset = Math.max(
    insets.top || 0,
    Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
    38,
  );

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(
        'Missing Information',
        'Please enter both your email address and password.',
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
        error?.message || 'Unable to connect to the server.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: topInset + 16,
              paddingBottom: Math.max(insets.bottom, 16) + 24,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Brand Header */}
          <View style={styles.brandContainer}>
            <View style={styles.logoBadge}>
              <Image
                source={require('../../assets/images/attendsync.img.png')}
                style={styles.brandLogo}
                resizeMode="cover"
                accessibilityLabel="ATTENDSYNC Logo"
              />
            </View>

            <View style={styles.schoolPill}>
              <ShieldCheck size={13} color="#82B1FF" strokeWidth={2.4} />
              <Text style={styles.schoolPillText}>BANSUD CENTRAL SCHOOL</Text>
            </View>

            <Text style={styles.brandTitle}>ATTENDSYNC</Text>
            <Text style={styles.brandTagline}>Mobile Biometric Attendance</Text>
          </View>

          {/* Login Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign In</Text>
            <Text style={styles.cardSubtitle}>
              Access your official employee attendance account
            </Text>

            {/* Email Field */}
            <Text style={styles.inputLabel}>Email Address</Text>
            <View style={styles.inputWrapper}>
              <Mail size={18} color={COLORS.muted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your registered email"
                placeholderTextColor="#9AA7B8"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
              />
            </View>

            {/* Password Field */}
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.inputWrapper}>
              <Lock size={18} color={COLORS.muted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Enter your password"
                placeholderTextColor="#9AA7B8"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff size={18} color={COLORS.muted} />
                ) : (
                  <Eye size={18} color={COLORS.muted} />
                )}
              </TouchableOpacity>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.loginButton, loading && styles.disabledButton]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <Text style={styles.loginButtonText}>SIGN IN</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.helperText}>
              Need an account or password reset?{'\n'}Contact your school administrator.
            </Text>
          </View>

          {/* Footer note */}
          <Text style={styles.footerNote}>
            DepEd Division of Oriental Mindoro • Asia/Manila
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.navyDark,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBadge: {
    width: 86,
    height: 86,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    backgroundColor: COLORS.navy,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 10,
    marginBottom: 14,
  },
  brandLogo: {
    width: '100%',
    height: '100%',
  },
  schoolPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  schoolPillText: {
    color: '#D9E6F5',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  brandTitle: {
    color: COLORS.white,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  brandTagline: {
    color: '#9FB3C8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  cardTitle: {
    color: COLORS.navy,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 4,
    marginBottom: 20,
    lineHeight: 18,
  },
  inputLabel: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
    marginTop: 10,
    letterSpacing: 0.2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.2,
    borderColor: COLORS.border,
    borderRadius: 13,
    backgroundColor: '#FAFCFE',
    paddingHorizontal: 13,
    minHeight: 50,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 48,
    color: COLORS.text,
    fontSize: 14,
    paddingVertical: 0,
  },
  passwordInput: {
    paddingRight: 8,
  },
  eyeButton: {
    padding: 6,
  },
  loginButton: {
    height: 52,
    backgroundColor: COLORS.navy,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    elevation: 4,
    shadowColor: COLORS.navy,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  disabledButton: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  helperText: {
    color: COLORS.muted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 18,
    lineHeight: 16,
  },
  footerNote: {
    color: '#8295A9',
    textAlign: 'center',
    marginTop: 24,
    fontSize: 11,
    letterSpacing: 0.5,
  },
});

export default LoginScreen;