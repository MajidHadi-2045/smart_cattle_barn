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

  // Jika melakukan Mutasi (POST, PUT, PATCH, DELETE), hapus cache terkait
  if (method !== 'GET') {
    apiCache.delete(cacheKey);
    // Juga hapus cache root jika ini adalah data koleksi (misal /health/1 -> hapus /health)
    const rootEndpoint = endpoint.split('/').slice(0, 2).join('/');
    apiCache.delete(`GET:${rootEndpoint}`);
    
    // Khusus untuk dashboard summary yang sering terpengaruh
    apiCache.delete(`GET:/dashboard/summary`);
  }

  // SWR (Stale-While-Revalidate) Logic
  if (method === 'GET' && apiCache.has(cacheKey)) {
    const cachedItem = apiCache.get(cacheKey);
    const isExpired = Date.now() - cachedItem.timestamp > 300000; // 5 Menit

    if (!isExpired) {
      return cachedItem.response.clone();
    } else {
      fetch(`${API_URL}${endpoint}`, { ...options, headers })
        .then(res => {
          if (res.ok) {
            apiCache.set(cacheKey, { timestamp: Date.now(), response: res.clone() });
          }
        })
        .catch(err => console.error("SWR Background Fetch Error:", err));
      
      return cachedItem.response.clone();
    }
  }

  const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });

  if (method === 'GET' && response.ok) {
    apiCache.set(cacheKey, { timestamp: Date.now(), response: response.clone() });
  }

  return response;
};

/**
 * Fungsi untuk menghapus cache secara manual jika diperlukan
 * @param {string} endpoint 
 */
export const mutate = (endpoint) => {
  apiCache.delete(`GET:${endpoint}`);
};
