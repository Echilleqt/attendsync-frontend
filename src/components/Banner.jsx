import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {AlertCircle, CheckCircle, Info} from 'lucide-react-native';
import COLORS from '../theme/colors';

export default function Banner({
  type = 'info',
  message,
  actionText,
  onAction,
  style,
}) {
  if (!message) {return null;}

  let bg = COLORS.blueLight;
  let borderColor = COLORS.blueBorder;
  let iconColor = COLORS.blue;
  let textColor = COLORS.text;
  let IconComponent = Info;

  if (type === 'error') {
    bg = COLORS.redLight;
    borderColor = COLORS.redBorder;
    iconColor = COLORS.red;
    textColor = COLORS.red;
    IconComponent = AlertCircle;
  } else if (type === 'success') {
    bg = COLORS.greenLight;
    borderColor = COLORS.greenBorder;
    iconColor = COLORS.green;
    textColor = COLORS.greenDark;
    IconComponent = CheckCircle;
  } else if (type === 'warning') {
    bg = COLORS.amberLight;
    borderColor = COLORS.amberBorder;
    iconColor = COLORS.amber;
    textColor = COLORS.amberDark;
    IconComponent = AlertCircle;
  }

  return (
    <View style={[styles.banner, {backgroundColor: bg, borderColor}, style]}>
      <IconComponent size={16} color={iconColor} strokeWidth={2.4} style={styles.icon} />
      <View style={styles.textContainer}>
        <Text style={[styles.message, {color: textColor}]}>{message}</Text>
        {actionText && onAction ? (
          <TouchableOpacity onPress={onAction} style={styles.actionBtn}>
            <Text style={[styles.actionText, {color: iconColor}]}>{actionText}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 14,
    borderWidth: 1,
    padding: 13,
    marginVertical: 10,
  },
  icon: {
    marginRight: 10,
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  message: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  actionBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '800',
  },
});
