import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import COLORS from '../theme/colors';

export default function StatusBadge({status, label, size = 'md'}) {
  const normalized = (status || '').toLowerCase().replace(/_/g, ' ');

  let bg = COLORS.amberLight;
  let text = COLORS.amber;
  let dotColor = COLORS.amber;
  let displayLabel = label;

  if (['present', 'on time', 'approved', 'enrolled', 'active', 'verified', 'recorded'].includes(normalized)) {
    bg = COLORS.greenLight;
    text = COLORS.green;
    dotColor = COLORS.green;
    if (!displayLabel) {
      displayLabel = normalized === 'present' ? 'On Time' : normalized.charAt(0).toUpperCase() + normalized.slice(1);
    }
  } else if (['late'].includes(normalized)) {
    bg = COLORS.amberLight;
    text = COLORS.amber;
    dotColor = COLORS.amber;
    if (!displayLabel) {displayLabel = 'Late';}
  } else if (['rejected', 'failed', 'missing'].includes(normalized)) {
    bg = COLORS.redLight;
    text = COLORS.red;
    dotColor = COLORS.red;
    if (!displayLabel) {displayLabel = normalized.charAt(0).toUpperCase() + normalized.slice(1);}
  } else if (['pending'].includes(normalized)) {
    bg = COLORS.amberLight;
    text = COLORS.amber;
    dotColor = COLORS.amber;
    if (!displayLabel) {displayLabel = 'Pending';}
  } else {
    bg = '#F1F5F9';
    text = COLORS.muted;
    dotColor = COLORS.muted;
    if (!displayLabel) {displayLabel = normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : 'Not recorded';}
  }

  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {backgroundColor: bg},
        isSmall && styles.badgeSm,
      ]}
    >
      <View
        style={[
          styles.dot,
          {backgroundColor: dotColor},
          isSmall && styles.dotSm,
        ]}
      />
      <Text
        style={[
          styles.label,
          {color: text},
          isSmall && styles.labelSm,
        ]}
      >
        {displayLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  badgeSm: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  dotSm: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
    textTransform: 'capitalize',
  },
  labelSm: {
    fontSize: 10,
  },
});
