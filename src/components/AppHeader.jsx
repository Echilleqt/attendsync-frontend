import React from 'react';
import {
  Image,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ChevronLeft} from 'lucide-react-native';
import COLORS from '../theme/colors';

/**
 * AppHeader - The single reusable global header component for ATTENDSYNC
 *
 * Supports 3 variants:
 * - 'expanded': Home / Dashboard (personalized greeting, school branding, avatar action)
 * - 'standard': Primary tabs (Attendance, Corrections, Profile)
 * - 'compact': Secondary screens with back navigation (Attendance History, Face Recognition)
 */
export default function AppHeader({
  title,
  subtitle,
  greeting,
  schoolName = 'BANSUD CENTRAL SCHOOL',
  showLogo = true,
  variant = 'standard',
  onBack,
  rightAction,
  children,
}) {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top || 0,
    Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
    24,
  );

  const isCompact = variant === 'compact';
  const isExpanded = variant === 'expanded';

  return (
    <View
      style={[
        styles.header,
        {paddingTop: topInset + (isCompact ? 10 : 16)},
        isCompact && styles.headerCompact,
        isExpanded && styles.headerExpanded,
      ]}
    >
      {/* Top bar with back button, brand/title, and right action */}
      <View style={styles.topBar}>
        <View style={styles.leftGroup}>
          {onBack ? (
            <TouchableOpacity
              style={styles.backButton}
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              activeOpacity={0.7}
            >
              <ChevronLeft size={22} color={COLORS.white} strokeWidth={2.6} />
            </TouchableOpacity>
          ) : null}

          {showLogo ? (
            <View style={[styles.logoBadge, isCompact && styles.logoBadgeCompact]}>
              <Image
                source={require('../../assets/images/attendsync.img.png')}
                style={styles.brandLogo}
                resizeMode="cover"
                accessibilityLabel="ATTENDSYNC logo"
              />
            </View>
          ) : null}

          <View style={styles.titleColumn}>
            {schoolName ? (
              <Text style={styles.schoolTag} numberOfLines={1}>
                {schoolName}
              </Text>
            ) : null}
            <Text
              style={[
                styles.titleText,
                isCompact && styles.titleTextCompact,
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
          </View>
        </View>

        {rightAction ? (
          <View style={styles.rightActionWrapper}>{rightAction}</View>
        ) : null}
      </View>

      {/* Expanded / Standard Subtitle / Greeting row */}
      {(!isCompact && (greeting || subtitle)) ? (
        <View style={styles.subtitleGroup}>
          {greeting ? (
            <Text style={styles.greetingText} numberOfLines={1}>
              {greeting}
            </Text>
          ) : null}
          {subtitle ? (
            <Text style={styles.subtitleText}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Compact subtitle when provided */}
      {isCompact && subtitle ? (
        <Text style={styles.compactSubtitleText} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}

      {/* Optional custom children */}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: COLORS.navyDark,
    paddingHorizontal: 20,
    paddingBottom: 36,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerCompact: {
    paddingBottom: 22,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  headerExpanded: {
    paddingBottom: 40,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
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
  logoBadgeCompact: {
    width: 38,
    height: 38,
    borderRadius: 12,
  },
  brandLogo: {
    width: '100%',
    height: '100%',
  },
  titleColumn: {
    flex: 1,
  },
  schoolTag: {
    color: '#82B1FF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  titleText: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.3,
    marginTop: 1,
  },
  titleTextCompact: {
    fontSize: 17,
  },
  rightActionWrapper: {
    marginLeft: 12,
  },
  subtitleGroup: {
    marginTop: 10,
  },
  greetingText: {
    fontSize: 25,
    color: COLORS.white,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitleText: {
    fontSize: 13,
    color: '#CBD5E1',
    marginTop: 4,
    lineHeight: 18,
    letterSpacing: 0.1,
  },
  compactSubtitleText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 6,
    marginLeft: 2,
  },
});
