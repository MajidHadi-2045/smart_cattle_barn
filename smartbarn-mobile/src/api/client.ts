import axios, { AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// IP Local komputer Anda (otomatis terdeteksi dari log Expo)
const BASE_URL = 'http://10.208.196.115:3000'; 

const apiClient = axios.create({
  baseURL: `${BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor untuk menyertakan token JWT di setiap request
apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
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
  (error: AxiosError) => {
    // Hindari trigger toast otomatis secara global untuk background query/caching
    // agar tidak mengganggu user experience. Layar (screen) akan menangani error secara mandiri jika diperlukan.
    return Promise.reject(error);
  }
);

export default apiClient;
export { BASE_URL };
