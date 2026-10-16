import React from 'react';
import {NavigationContainer, DefaultTheme} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {CalendarDays, Clock3, Home, UserRound} from 'lucide-react-native';
import {View, StyleSheet, Platform} from 'react-native';

import COLORS from '../theme/colors';
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import AttendanceScreen from '../screens/AttendanceScreen';
import HistoryScreen from '../screens/HistoryScreen';
import ProfileScreen from '../screens/ProfileScreen';
import FaceRecognitionScreen from '../screens/FaceRecognitionScreen';
import AttendanceHistoryScreen from '../screens/AttendanceHistoryScreen';
import NetworkLockScreen from '../screens/NetworkLockScreen';
import {useNetworkRestriction} from '../context/NetworkRestrictionContext';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const appTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: COLORS.canvas,
    card: COLORS.white,
    text: COLORS.text,
    border: COLORS.border,
  },
};

function TabBarIcon({name, color, focused}) {
  const size = 20;
  const commonProps = {size, color, strokeWidth: focused ? 2.4 : 1.9};

  let iconNode = null;
  if (name === 'home') {
    iconNode = <Home {...commonProps} fill={focused ? `${color}18` : 'transparent'} />;
  } else if (name === 'attendance') {
    iconNode = <Clock3 {...commonProps} />;
  } else if (name === 'corrections') {
    iconNode = <CalendarDays {...commonProps} />;
  } else {
    iconNode = <UserRound {...commonProps} />;
  }

  return (
    <View style={[styles.iconWrapper, focused && styles.iconWrapperFocused]}>
      {iconNode}
    </View>
  );
}

const renderHomeIcon = ({color, focused}) => <TabBarIcon name="home" color={color} focused={focused} />;
const renderAttendanceIcon = ({color, focused}) => <TabBarIcon name="attendance" color={color} focused={focused} />;
const renderCorrectionsIcon = ({color, focused}) => <TabBarIcon name="corrections" color={color} focused={focused} />;
const renderProfileIcon = ({color, focused}) => <TabBarIcon name="profile" color={color} focused={focused} />;

function MainTabs({user, employee, token, onLogout, biometricStatus}) {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 6 : 10);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.navy,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: -2,
          marginBottom: 2,
        },
        tabBarStyle: {
          height: 58 + bottomInset,
          paddingBottom: bottomInset,
          paddingTop: 6,
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          backgroundColor: COLORS.white,
          elevation: 10,
          shadowColor: COLORS.navyDark,
          shadowOffset: {width: 0, height: -3},
          shadowOpacity: 0.06,
          shadowRadius: 10,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: renderHomeIcon,
        }}
      >
        {props => (
          <DashboardScreen
            {...props}
            user={user}
            employee={employee}
            token={token}
            biometricStatus={biometricStatus}
            onLogout={onLogout}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="Attendance"
        options={{
          tabBarLabel: 'Attendance',
          tabBarIcon: renderAttendanceIcon,
        }}
      >
        {props => (
          <AttendanceScreen
            {...props}
            user={user}
            employee={employee}
            token={token}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="Corrections"
        options={{
          tabBarLabel: 'Corrections',
          tabBarIcon: renderCorrectionsIcon,
        }}
      >
        {props => (
          <HistoryScreen
            {...props}
            user={user}
            employee={employee}
            token={token}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="Profile"
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: renderProfileIcon,
        }}
      >
        {props => (
          <ProfileScreen
            {...props}
            user={user}
            employee={employee}
            token={token}
            biometricStatus={biometricStatus}
            onLogout={onLogout}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function AppNavigator({
  isLoggedIn,
  user,
  employee,
  token,
  biometricStatus,
  onLogin,
  onLogout,
}) {
  const {status} = useNetworkRestriction();
  const isLocked = isLoggedIn && status !== 'authorized';

  return (
    <NavigationContainer theme={appTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: {backgroundColor: COLORS.canvas},
        }}
      >
        {!isLoggedIn ? (
          <Stack.Screen name="Login">
            {props => (
              <LoginScreen
                {...props}
                onLogin={onLogin}
              />
            )}
          </Stack.Screen>
        ) : isLocked ? (
          <Stack.Screen name="NetworkLock">
            {() => (
              <NetworkLockScreen
                onLogout={onLogout}
              />
            )}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="MainTabs">
              {() => (
                <MainTabs
                  user={user}
                  employee={employee}
                  token={token}
                  biometricStatus={biometricStatus}
                  onLogout={onLogout}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="FaceRecognition">
              {props => (
                <FaceRecognitionScreen
                  {...props}
                  token={token}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="AttendanceHistory">
              {props => (
                <AttendanceHistoryScreen
                  {...props}
                  token={token}
                  user={user}
                  employee={employee}
                />
              )}
            </Stack.Screen>
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  iconWrapperFocused: {
    backgroundColor: COLORS.blueLight,
  },
});