export const API_URL = import.meta.env.VITE_API_BASE_URL;

// Cache global untuk menyimpan hasil fetch GET
const apiCache = new Map();

/**
 * Helper function to make API requests with authentication token.
 * 
 * @param {string} endpoint - The API endpoint (e.g., '/users/staff')
 * @param {object} options - Fetch options (method, body, etc.)
 * @returns {Promise<Response>} The fetch Response object
 */
/**
 * Helper function to make API requests with authentication token.
 */
export const fetchApi = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  const method = (options.method || 'GET').toUpperCase();
  const cacheKey = `GET:${endpoint}`; // Cache selalu merujuk ke GET request

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  };

  // Saat terjadi operasi mutasi data (POST, PUT, PATCH, atau DELETE), kita harus melakukan invalidasi cache yang relevan
  if (method !== 'GET') {
    apiCache.delete(cacheKey);
    // Lakukan pembersihan cache pada level root endpoint apabila terjadi perubahan pada sub-item (contoh: endpoint /health/1 diupdate, maka bersihkan cache /health)
    const rootEndpoint = endpoint.split('/').slice(0, 2).join('/');
    apiCache.delete(`GET:${rootEndpoint}`);
    
    // Invalidasi spesifik untuk cache dashboard summary karena datanya sering kali bergantung pada mutasi ini
    apiCache.delete(`GET:/dashboard/summary`);
  }

  const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  return response;
};

/**
 * Utility function yang berguna untuk melakukan invalidasi/penghapusan data cache secara paksa berdasarkan endpoint tertentu
 * @param {string} endpoint - Path endpoint yang cachenya ingin dibersihkan
 */
export const mutate = (endpoint) => {
  apiCache.delete(`GET:${endpoint}`);
};
