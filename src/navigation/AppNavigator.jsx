
import React from 'react';

import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {CalendarDays, Clock3, Home, UserRound} from 'lucide-react-native';

import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import AttendanceScreen from '../screens/AttendanceScreen';
import HistoryScreen from '../screens/HistoryScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabBarIcon({name, color, focused}) {
  const size = 22;
  const commonProps = {size, color, strokeWidth: 2.2};

  if (name === 'home') {
    return <Home {...commonProps} fill={focused ? `${color}20` : 'transparent'} />;
  }
  if (name === 'attendance') {
    return <Clock3 {...commonProps} />;
  }
  if (name === 'corrections') {
    return <CalendarDays {...commonProps} />;
  }
  return <UserRound {...commonProps} />;
}

function MainTabs({user, employee, token, onLogout, biometricStatus}) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#102A43',
        tabBarInactiveTintColor: '#8A98AA',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 4,
        },
        tabBarStyle: {
          height: 80,
          paddingBottom: 10,
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: '#E2E8F0',
          backgroundColor: '#FFFFFF',
          shadowColor: '#102A43',
          shadowOffset: {width: 0, height: -2},
          shadowOpacity: 0.08,
          shadowRadius: 8,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({color, focused}) => <TabBarIcon name="home" color={color} focused={focused} />,
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
          tabBarIcon: ({color, focused}) => <TabBarIcon name="attendance" color={color} focused={focused} />,
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
          tabBarIcon: ({color, focused}) => <TabBarIcon name="corrections" color={color} focused={focused} />,
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
          tabBarIcon: ({color, focused}) => <TabBarIcon name="profile" color={color} focused={focused} />,
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
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
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
        ) : (
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
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}