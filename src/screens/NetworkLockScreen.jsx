import React from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  AlertTriangle,
  LogOut,
  RefreshCw,
  Settings,
  ShieldAlert,
  Wifi,
  WifiOff,
} from 'lucide-react-native';
import COLORS from '../theme/colors';
import {useNetworkRestriction} from '../context/NetworkRestrictionContext';
import {openWifiSettings} from '../services/networkRestriction';

export default function NetworkLockScreen({onLogout}) {
  const insets = useSafeAreaInsets();
  const {
    status,
    policy,
    networkInfo,
    denialReason,
    isChecking,
    warningMessage,
    recheckNetwork,
    requestPermission,
  } = useNetworkRestriction();

  const isError = status === 'error';
  const isCheckingNow = isChecking || status === 'loading';

  // Format connection label
  let connectionLabel = 'Disconnected';
  if (networkInfo?.isConnected) {
    if (networkInfo.isWifi) {
      connectionLabel = networkInfo.ssid
        ? `Wi-Fi: ${networkInfo.ssid}`
        : 'Wi-Fi (SSID hidden / unknown)';
    } else if (networkInfo.isCellular) {
      connectionLabel = 'Mobile Data (Cellular)';
    } else {
      connectionLabel = 'Other Network';
    }
  }

  const authorizedNetworkName =
    policy?.network_description || policy?.authorized_ssid || 'Authorized School Network';

  return (
    <View style={styles.container}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      {/* Deep Navy Branded Header */}
      <View
        style={[
          styles.header,
          {paddingTop: Math.max(insets.top, 24) + 16},
        ]}
      >
        <View style={styles.headerTop}>
          <View style={styles.logoBadge}>
            <Image
              source={require('../../assets/images/attendsync.img.png')}
              style={styles.logo}
              resizeMode="cover"
            />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.schoolTag}>BANSUD CENTRAL SCHOOL</Text>
            <Text style={styles.headerTitle}>ATTENDSYNC</Text>
          </View>
        </View>

        <Text style={styles.headerSubtitle}>
          DepEd Employee Attendance Management System
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {paddingBottom: Math.max(insets.bottom, 20) + 24},
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Security Lock Card */}
        <View style={styles.card}>
          {/* Icon Badge */}
          <View
            style={[
              styles.iconCircle,
              isError ? styles.iconCircleAmber : styles.iconCircleNavy,
            ]}
          >
            {isError ? (
              <AlertTriangle size={36} color={COLORS.amberDark} strokeWidth={2.4} />
            ) : (
              <WifiOff size={36} color={COLORS.redDark} strokeWidth={2.4} />
            )}
          </View>

          <Text style={styles.title}>
            {isError ? 'Unable to Verify Network' : 'School Network Required'}
          </Text>

          <Text style={styles.description}>
            {isError
              ? 'The attendance server could not be reached to verify your connection.'
              : 'Connect to the authorized school network to access ATTENDSYNC.'}
          </Text>

          {/* Connection Status Box */}
          <View style={styles.detailsBox}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Required Network</Text>
              <Text style={styles.detailValue} numberOfLines={1}>
                {authorizedNetworkName}
              </Text>
              {policy?.authorized_ssid ? (
                <Text style={styles.detailSubValue}>
                  SSID: {policy.authorized_ssid}
                </Text>
              ) : null}
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Current Connection</Text>
              <View style={styles.statusPillRow}>
                <View
                  style={[
                    styles.statusDot,
                    networkInfo?.isConnected
                      ? styles.statusDotAmber
                      : styles.statusDotRed,
                  ]}
                />
                <Text style={styles.detailValue} numberOfLines={1}>
                  {connectionLabel}
                </Text>
              </View>
            </View>

            {denialReason ? (
              <>
                <View style={styles.divider} />
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status Reason</Text>
                  <Text style={styles.reasonText}>{denialReason}</Text>
                </View>
              </>
            ) : null}
          </View>

          {/* Android Permission Prompt Banner if SSID is missing */}
          {Platform.OS === 'android' &&
          networkInfo?.isWifi &&
          !networkInfo?.ssid ? (
            <TouchableOpacity
              style={styles.permissionBanner}
              onPress={requestPermission}
              activeOpacity={0.8}
            >
              <View style={styles.permissionIconWrapper}>
                <ShieldAlert size={18} color={COLORS.blue} strokeWidth={2.4} />
              </View>
              <View style={styles.permissionTextColumn}>
                <Text style={styles.permissionTitle}>
                  Location Permission Required
                </Text>
                <Text style={styles.permissionSubtitle}>
                  Android requires location access to identify the Wi-Fi network name. Tap to grant permission.
                </Text>
              </View>
            </TouchableOpacity>
          ) : null}

          {/* Action Buttons */}
          <View style={styles.actionColumn}>
            {/* Retry Button */}
            <TouchableOpacity
              style={[
                styles.primaryButton,
                isCheckingNow && styles.buttonDisabled,
              ]}
              onPress={recheckNetwork}
              disabled={isCheckingNow}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Check network connection"
            >
              {isCheckingNow ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <>
                  <RefreshCw size={18} color={COLORS.white} strokeWidth={2.4} />
                  <Text style={styles.primaryButtonText}>Check Connection</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Open Settings Button */}
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={openWifiSettings}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Open Wi-Fi settings"
            >
              <Settings size={18} color={COLORS.navy} strokeWidth={2.2} />
              <Text style={styles.secondaryButtonText}>Open Wi-Fi Settings</Text>
            </TouchableOpacity>

            {/* Sign Out Button */}
            {onLogout ? (
              <TouchableOpacity
                style={styles.logoutButton}
                onPress={onLogout}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Sign out"
              >
                <LogOut size={16} color={COLORS.muted} strokeWidth={2} />
                <Text style={styles.logoutButtonText}>Sign Out</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <Text style={styles.footerNote}>
          ATTENDSYNC enforces strict network authorization to safeguard official attendance logs.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.canvas,
  },
  header: {
    backgroundColor: COLORS.navyDark,
    paddingHorizontal: 20,
    paddingBottom: 36,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  headerCopy: {
    flex: 1,
  },
  schoolTag: {
    color: '#82B1FF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#CBD5E1',
    marginTop: 8,
  },
  content: {
    padding: 20,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    elevation: 3,
    shadowColor: COLORS.navyDark,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconCircleNavy: {
    backgroundColor: COLORS.redLight,
    borderWidth: 2,
    borderColor: COLORS.redBorder,
  },
  iconCircleAmber: {
    backgroundColor: COLORS.amberLight,
    borderWidth: 2,
    borderColor: COLORS.amberBorder,
  },
  title: {
    fontSize: 21,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  description: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  detailsBox: {
    width: '100%',
    backgroundColor: COLORS.cardSubtle,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 16,
    marginBottom: 20,
  },
  detailRow: {
    width: '100%',
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 3,
  },
  detailSubValue: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statusPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotRed: {
    backgroundColor: COLORS.red,
  },
  statusDotAmber: {
    backgroundColor: COLORS.amber,
  },
  reasonText: {
    fontSize: 13,
    color: COLORS.redDark,
    lineHeight: 18,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
  permissionBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.blueLight,
    borderWidth: 1,
    borderColor: COLORS.blueBorder,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  permissionIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionTextColumn: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.navy,
  },
  permissionSubtitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 15,
  },
  actionColumn: {
    width: '100%',
    gap: 10,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.navy,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  secondaryButtonText: {
    color: COLORS.navy,
    fontSize: 14,
    fontWeight: '700',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 4,
  },
  logoutButtonText: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  footerNote: {
    fontSize: 11,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 18,
    lineHeight: 16,
    paddingHorizontal: 16,
  },
});
