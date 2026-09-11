import React, { useEffect } from 'react';
import { Tabs, useRouter, usePathname } from 'expo-router';
import { BottomNavigation } from 'react-native-paper';
import { BackHandler } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { useChatStore } from '../../src/store/chatStore';

export default function EmployeeLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const unreadCount = useChatStore((state: any) => state.unreadCount);

  useEffect(() => {
    const onBackPress = () => {
      if (pathname === '/(employee)/home' || pathname === '/home') {
        BackHandler.exitApp();
        return true;
      } else {
        router.push('/(employee)/home');
        return true;
      }
    };

    BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
  }, [pathname, router]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      tabBar={({ navigation, state, descriptors, insets }) => (
        <BottomNavigation.Bar
          navigationState={state as any}
          safeAreaInsets={insets}
          onTabPress={({ route, preventDefault }) => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (event.defaultPrevented) {
              preventDefault();
            } else {
              navigation.navigate((route as any).name, (route as any).params);
            }
          }}
          renderIcon={({ route, focused, color }) => {
            const { options } = descriptors[route.key];
            if (options.tabBarIcon) {
              return options.tabBarIcon({ focused, color, size: 24 });
            }
            return null;
          }}
          getLabelText={({ route }) => {
            const { options } = descriptors[route.key];
            return (options.tabBarLabel as string) ?? options.title ?? (route as any).name;
          }}
          activeColor="#6B2FA0"
          inactiveColor="#9CA3AF"
          style={{ backgroundColor: '#FFFFFF' }}
        />
      )}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="home" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="message-text" size={24} color={color} />,
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Attendance',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="calendar-check" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="leaves"
        options={{
          title: 'Leaves',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="file-document-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="account-circle" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
