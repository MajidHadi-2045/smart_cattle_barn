import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

/**
 * Menyimpan JWT Token secara terenkripsi menggunakan Hardware Keystore/Keychain (SecureStore).
 * Menggunakan fallback ke AsyncStorage untuk environment Web.
 */
export const saveToken = async (token: string): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(TOKEN_KEY, token);
    } else {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    }
  } catch (error) {
    console.error('Error saving secure token:', error);
    await AsyncStorage.setItem(TOKEN_KEY, token);
  }
};

/**
 * Mengambil JWT Token terenkripsi dari SecureStore.
 */
export const getToken = async (): Promise<string | null> => {
  try {
    if (Platform.OS === 'web') {
      return await AsyncStorage.getItem(TOKEN_KEY);
    }
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!token) {
      // Fallback untuk token lama yang mungkin tersimpan di AsyncStorage
      return await AsyncStorage.getItem(TOKEN_KEY);
    }
    return token;
  } catch (error) {
    console.error('Error getting secure token:', error);
    return await AsyncStorage.getItem(TOKEN_KEY);
  }
};

/**
 * Menghapus JWT Token dari penyimpanan aman.
 */
export const removeToken = async (): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(TOKEN_KEY);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch (error) {
    console.error('Error removing secure token:', error);
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
};

/**
 * Menyimpan data profil user.
 */
export const saveUser = async (user: any): Promise<void> => {
  const userStr = typeof user === 'string' ? user : JSON.stringify(user);
  try {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(USER_KEY, userStr);
    } else {
      await SecureStore.setItemAsync(USER_KEY, userStr);
    }
  } catch (error) {
    await AsyncStorage.setItem(USER_KEY, userStr);
  }
};

/**
 * Mengambil data profil user.
 */
export const getUser = async (): Promise<any | null> => {
  try {
    let userStr: string | null = null;
    if (Platform.OS === 'web') {
      userStr = await AsyncStorage.getItem(USER_KEY);
    } else {
      userStr = await SecureStore.getItemAsync(USER_KEY);
      if (!userStr) {
        userStr = await AsyncStorage.getItem(USER_KEY);
      }
    }
    return userStr ? JSON.parse(userStr) : null;
  } catch (error) {
    const fallback = await AsyncStorage.getItem(USER_KEY);
    return fallback ? JSON.parse(fallback) : null;
  }
};

/**
 * Menghapus seluruh sesi autentikasi (Token & Data User).
 */
export const clearAuthSession = async (): Promise<void> => {
  await removeToken();
  try {
    if (Platform.OS !== 'web') {
      await SecureStore.deleteItemAsync(USER_KEY);
    }
  } catch (e) {}
  await AsyncStorage.removeItem(USER_KEY);
};
