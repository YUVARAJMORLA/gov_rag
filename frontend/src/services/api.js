import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT Bearer Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('gov_rag_jwt_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle Token Expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Do not trigger logout loop on login or register or forgot-password endpoints
      const url = error.config?.url || '';
      if (!url.includes('/auth/login') && !url.includes('/auth/register') && !url.includes('/auth/forgot-password')) {
        localStorage.removeItem('gov_rag_jwt_token');
        localStorage.removeItem('gov_rag_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth Endpoints
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  forgotPassword: (payload) => api.post('/auth/forgot-password', payload),
  getMe: () => api.get('/auth/me'),
};

// Session Endpoints (Isolated per user)
export const sessionAPI = {
  getSessions: () => api.get('/sessions'),
  createSession: (title) => api.post('/sessions', { title }),
  getSessionMessages: (sessionId) => api.get(`/sessions/${sessionId}/messages`),
  renameSession: (sessionId, title) => api.put(`/sessions/${sessionId}`, { title }),
  deleteSession: (sessionId) => api.delete(`/sessions/${sessionId}`),
};

// Chat & Feedback Endpoints
export const chatAPI = {
  sendQuery: (sessionId, query, model, numResults, targetLanguage = 'en', isVoice = false) =>
    api.post('/chat/query', { sessionId, query, model, numResults, targetLanguage, isVoice }),
  sendQueryStream: async (sessionId, query, model, numResults, targetLanguage = 'en', isVoice = false, onToken, onDone, onError) => {
    const token = localStorage.getItem('gov_rag_jwt_token');
    try {
      const response = await fetch('/api/chat/query-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ sessionId, query, model, numResults, targetLanguage, isVoice })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP error ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.replace(/^data:\s*/, '');
          try {
            const parsed = JSON.parse(jsonStr);
            const { event, data } = parsed;
            if (event === 'token' && onToken) {
              onToken(data.token);
            } else if (event === 'done' && onDone) {
              onDone(data);
            } else if (event === 'error' && onError) {
              onError(data.error);
            }
          } catch (e) {
            console.warn('[CLIENT SSE PARSE NOTICE]', e);
          }
        }
      }
    } catch (err) {
      if (onError) onError(err.message || 'Stream connection error');
      throw err;
    }
  },
  submitFeedback: (questionId, rating, feedbackText, sessionId) =>
    api.post('/chat/feedback', { questionId, rating, feedbackText, sessionId }),
  synthesizeSpeech: (text, targetLanguage = 'en', voiceGender = 'Female', isNovaSonic = false) =>
    api.post('/chat/synthesize-speech', { text, targetLanguage, voiceGender, isNovaSonic }),
  launchEdge: (url = (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000')) =>
    api.post('/chat/launch-edge', { url }),
};

// Admin Endpoints
export const adminAPI = {
  getConnections: () => api.get('/admin/connections'),
  testConnections: () => api.get('/admin/connections/test'),
  getTablesInfo: () => api.get('/admin/tables'),
  getTableData: (table, limit) => api.get('/admin/tables/data', { params: { table, limit } }),
  getUsers: () => api.get('/admin/users'),
  toggleUserStatus: (userId, isActive) => api.patch(`/admin/users/${userId}/status`, { isActive }),
  updateUserRole: (userId, role) => api.patch(`/admin/users/${userId}/role`, { role }),
  getAnalytics: () => api.get('/admin/analytics'),
  getDatabricksDashboardMetrics: () => api.get('/admin/dashboard-metrics'),
  getKnowledgeGraph: (params) => api.get('/admin/knowledge-graph', { params }),
};

export default api;
