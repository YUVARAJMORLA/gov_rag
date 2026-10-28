import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('gov_rag_jwt_token') || null);
  const [loading, setLoading] = useState(true);

  // Validate existing token on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('gov_rag_jwt_token');
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const res = await authAPI.getMe();
        if (res.data && res.data.success) {
          setUser(res.data.user);
          setToken(storedToken);
        } else {
          logout();
        }
      } catch (err) {
        console.warn('Session verification failed:', err.message);
        logout();
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (username, password) => {
    const res = await authAPI.login({ username, password });
    if (res.data && res.data.success) {
      const { token: newToken, user: newUser } = res.data;
      localStorage.setItem('gov_rag_jwt_token', newToken);
      localStorage.setItem('gov_rag_user', JSON.stringify(newUser));
      setToken(newToken);
      setUser(newUser);
      return { success: true, user: newUser };
    }
    throw new Error(res.data?.error || 'Login failed');
  };

  const register = async (userData) => {
    const res = await authAPI.register(userData);
    if (res.data && res.data.success) {
      const { token: newToken, user: newUser, defaultSessionId } = res.data;
      localStorage.setItem('gov_rag_jwt_token', newToken);
      localStorage.setItem('gov_rag_user', JSON.stringify(newUser));
      setToken(newToken);
      setUser(newUser);
      return { success: true, user: newUser, defaultSessionId };
    }
    throw new Error(res.data?.error || 'Registration failed');
  };

  const forgotPassword = async (payload) => {
    const res = await authAPI.forgotPassword(payload);
    if (res.data && res.data.success) {
      return { success: true, message: res.data.message };
    }
    throw new Error(res.data?.error || 'Password reset failed');
  };

  const logout = () => {
    localStorage.removeItem('gov_rag_jwt_token');
    localStorage.removeItem('gov_rag_user');
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!token && !!user,
    isAdmin: user?.role === 'admin',
    login,
    register,
    forgotPassword,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
