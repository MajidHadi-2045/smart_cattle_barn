import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import LivestockScreen from '../screens/LivestockScreen';
import LivestockDetailScreen from '../screens/LivestockDetailScreen';
import EnvironmentScreen from '../screens/EnvironmentScreen';
import HealthScreen from '../screens/HealthScreen';
import FeedScreen from '../screens/FeedScreen';
import ReportScreen from '../screens/ReportScreen';
import UserManagementScreen from '../screens/UserManagementScreen';
import { useToast } from '../context/ToastContext';
import { injectToastHandler } from '../api/client';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  const { showToast } = useToast();
  
  // Inject toast handler agar bisa dipakai di axios interceptor
  React.useEffect(() => {
    injectToastHandler(showToast);
  }, [showToast]);

  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Login"
        screenOptions={{
          headerShown: false,
          animation: 'fade_from_bottom'
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="Livestock" component={LivestockScreen} />
        <Stack.Screen name="LivestockDetail" component={LivestockDetailScreen} />
        <Stack.Screen name="Environment" component={EnvironmentScreen} />
        <Stack.Screen name="Health" component={HealthScreen} />
        <Stack.Screen name="Feed" component={FeedScreen} />
        <Stack.Screen name="Reports" component={ReportScreen} />
        <Stack.Screen name="UserManagement" component={UserManagementScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
