import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {CheckCircle2, Wifi} from 'lucide-react-native';
import COLORS from '../theme/colors';
import {useNetworkRestriction} from '../context/NetworkRestrictionContext';

/**
 * NetworkStatusBanner - Compact status banner indicating authorized school Wi-Fi connection.
 * Displayed cleanly below the header on protected dashboards without altering AppHeader.
 */
export default function NetworkStatusBanner({style}) {
  const {status, policy, networkInfo, isVerified} = useNetworkRestriction();

  // Only render when authorized under an active policy
  if (status !== 'authorized' || !policy || !policy.is_enabled) {
    return null;
  }

  const ssidLabel = networkInfo?.ssid || policy.authorized_ssid || 'School Wi-Fi';

  return (
    <View style={[styles.banner, style]}>
      <View style={styles.leftGroup}>
        <View style={styles.iconWrapper}>
          <Wifi size={17} color={COLORS.green} strokeWidth={2.4} />
        </View>
        <View style={styles.textColumn}>
          <View style={styles.headlineRow}>
            <Text style={styles.headline}>School Network Connected</Text>
            {isVerified ? (
              <View style={styles.badgeVerified}>
                <CheckCircle2 size={11} color={COLORS.greenDark} strokeWidth={2.6} />
                <Text style={styles.badgeTextVerified}>Verified</Text>
              </View>
            ) : (
              <View style={styles.badgePreliminary}>
                <Text style={styles.badgeTextPreliminary}>SSID Matched</Text>
              </View>
            )}
          </View>
          <Text style={styles.ssidText} numberOfLines={1}>
            {ssidLabel}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.greenBorder,
    shadowColor: COLORS.navyDark,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.greenLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textColumn: {
    flex: 1,
  },
  headlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  headline: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  ssidText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
    marginTop: 1,
  },
  badgeVerified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.greenLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeTextVerified: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.greenDark,
    letterSpacing: 0.2,
  },
  badgePreliminary: {
    backgroundColor: COLORS.blueLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeTextPreliminary: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.blueDark,
    letterSpacing: 0.2,
  },
});
