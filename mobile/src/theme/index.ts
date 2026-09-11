import { MD3LightTheme } from 'react-native-paper';

export const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#6B2FA0',
    secondary: '#9B59B6',
    success: '#22C55E',
    error: '#EF4444',
    warning: '#F59E0B',
    info: '#3B82F6',
    background: '#F8F9FA',
    surface: '#FFFFFF',
    onlineGreen: '#22C55E',
    offlineGray: '#9CA3AF',
  },
};

export type AppTheme = typeof theme;
