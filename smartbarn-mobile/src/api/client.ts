import axios, { AxiosError } from 'axios';
import { getToken, clearAuthSession } from '../utils/storage';

// ==========================================
// KONFIGURASI BASE URL API BACKEND
// ==========================================
// [MODE PRODUKSI] Gunakan alamat server production HTTPS di bawah ini ketika akan melakukan build APK:
const BASE_URL = 'https://smartcattlebarn.site'; 

// [MODE PENGEMBANGAN] Saat ini sedang diarahkan ke IP lokal PC (Jaringan Wi-Fi).
// Pastikan IP disesuaikan dengan yang muncul di terminal Expo Metro (contoh: 10.125.171.115) dan port server backend (4000).
// const BASE_URL = 'http://10.66.181.115:4000';

const apiClient = axios.create({
  baseURL: `${BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor untuk menyertakan token JWT terenkripsi di setiap request
apiClient.interceptors.request.use(
  async (config) => {
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Injectable error handler for global toasts
let toastHandler: (msg: string, type: 'error') => void;
export const injectToastHandler = (handler: typeof toastHandler) => {
  toastHandler = handler;
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    // Jika server mengembalikan 401 Unauthorized (token kedaluwarsa/invalid), bersihkan token & sesi lokal secara aman
    if (error.response?.status === 401) {
      try {
        await clearAuthSession();
      } catch (e) {}
    }
    return Promise.reject(error);
  }
);

export default apiClient;
export { BASE_URL };
