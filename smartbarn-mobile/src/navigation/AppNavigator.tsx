import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LayoutDashboard, Beef, Utensils, User, History as HistoryIcon, HeartPulse } from 'lucide-react-native';
import { getToken, getUser } from '../utils/storage';

import LoginScreen from '../screens/LoginScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import PublicDashboardScreen from '../screens/PublicDashboardScreen';
import DashboardScreen from '../screens/DashboardScreen';
import LivestockScreen from '../screens/LivestockScreen';
import LivestockDetailScreen from '../screens/LivestockDetailScreen';
import EnvironmentScreen from '../screens/EnvironmentScreen';
import HealthScreen from '../screens/HealthScreen';
import FeedScreen from '../screens/FeedScreen';
import HistoryScreen from '../screens/HistoryScreen';
import ReportScreen from '../screens/ReportScreen';
import UserManagementScreen from '../screens/UserManagementScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { useToast } from '../context/ToastContext';
import { injectToastHandler } from '../api/client';
import { COLORS } from '../theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// --- BOTTOM TAB NAVIGATOR ---
const MainTabs = () => {
  const insets = useSafeAreaInsets();
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const getRole = async () => {
      const userObj = await getUser();
      if (userObj) {
        setUserRole(userObj.role);
      }
    };
    getRole();
  }, []);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textLight,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopWidth: 1,
          borderTopColor: '#f1f5f9',
          height: 60 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        }
      }}
    >
      <Tab.Screen 
        name="DashboardTab" 
        component={DashboardScreen} 
        options={{
          tabBarLabel: 'Beranda',
          tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} />
        }}
      />
      <Tab.Screen 
        name="LivestockTab" 
        component={LivestockScreen} 
        options={{
          tabBarLabel: 'Data Ternak',
          tabBarIcon: ({ color, size }) => <Beef color={color} size={size} />
        }}
      />
      {userRole !== 'VETERINER' && (
        <Tab.Screen 
          name="FeedTab" 
          component={FeedScreen} 
          options={{
            tabBarLabel: 'Silo Pakan',
            tabBarIcon: ({ color, size }) => <Utensils color={color} size={size} />
          }}
        />
      )}
      {userRole === 'VETERINER' && (
        <Tab.Screen 
          name="HealthTab" 
          component={HealthScreen} 
          options={{
            tabBarLabel: 'Rekam Medis',
            tabBarIcon: ({ color, size }) => <HeartPulse color={color} size={size} />
          }}
        />
      )}
      {userRole === 'STAFF' && (
        <Tab.Screen 
          name="HistoryTab" 
          component={HistoryScreen} 
          options={{
            tabBarLabel: 'Riwayat',
            tabBarIcon: ({ color, size }) => <HistoryIcon color={color} size={size} />
          }}
        />
      )}
      <Tab.Screen 
        name="ProfileTab" 
        component={ProfileScreen} 
        options={{
          tabBarLabel: 'Profil',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />
        }}
      />
    </Tab.Navigator>
  );
};

// --- MAIN APP NAVIGATOR ---
const AppNavigator = () => {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState('Welcome');
  
  useEffect(() => {
    injectToastHandler(showToast);
  }, [showToast]);

  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const token = await getToken();
        if (token) {
          setInitialRoute('Dashboard');
        }
      } catch (e) {
        console.error('Error checking token:', e);
      } finally {
        // Berikan delay sedikit agar logo dan animasi loading bisa dilihat user
        setTimeout(() => {
          setIsLoading(false);
        }, 1500);
      }
    };
    checkLoginStatus();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.splashContainer}>
        <View style={styles.logoBox}>
          <Beef size={64} color="#ffffff" />
        </View>
        <Text style={styles.splashTitle}>Smart Cattle Barn</Text>
        <Text style={styles.splashSubtitle}>Sistem Monitoring Pintar</Text>
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 30 }} />
        <Text style={styles.loadingText}>Memuat Komponen...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName={initialRoute}
        screenOptions={{
          headerShown: false,
          animation: 'fade_from_bottom'
        }}
      >
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="PublicDashboard" component={PublicDashboardScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        {/* Panggil MainTabs sebagai layar Dashboard utama */}
        <Stack.Screen name="Dashboard" component={MainTabs} />
        
        {/* Layar-layar lainnya tetap di Stack agar menutupi Bottom Tab saat dibuka */}
        <Stack.Screen name="Livestock" component={LivestockScreen} />
        <Stack.Screen name="LivestockDetail" component={LivestockDetailScreen} />
        <Stack.Screen name="Environment" component={EnvironmentScreen} />
        <Stack.Screen name="Health" component={HealthScreen} />
        <Stack.Screen name="Feed" component={FeedScreen} />
        <Stack.Screen name="Reports" component={ReportScreen} />
        <Stack.Screen name="UserManagement" component={UserManagementScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  logoBox: {
    backgroundColor: COLORS.primary,
    padding: 20,
    borderRadius: 24,
    marginBottom: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  splashTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  splashSubtitle: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: COLORS.textLight,
    fontWeight: '500',
  }
});

export default AppNavigator;
