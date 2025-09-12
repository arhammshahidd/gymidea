import { defineStore } from 'pinia'
import api from '../config/axios'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    token: localStorage.getItem('token') || null,
    role: null,
    gymId: null,
    isAuthenticated: false
  }),

  getters: {
    isLoggedIn: (state) => !!state.token,
    userRole: (state) => state.role,
    currentGymId: (state) => state.gymId
  },

  actions: {
    // Super Admin Login
    async superAdminLogin(credentials) {
      try {
        const response = await api.post('/auth/superadmin/login', credentials)
        const { token, user } = response.data
        
        this.setAuth(token, user, 'SUPER_ADMIN')
        return { success: true, data: response.data }
      } catch (error) {
        return { success: false, message: error.response?.data?.message || 'Login failed' }
      }
    },

    // Gym Admin Login
    async gymAdminLogin(credentials) {
      try {
        console.log('=== FRONTEND GYM ADMIN LOGIN ===');
        console.log('Credentials:', credentials);
        
        const response = await api.post('/auth/gymadmin/login', credentials)
        console.log('Login response:', response.data);
        
        const { token, admin } = response.data
        console.log('Admin data from response:', admin);
        console.log('Admin permissions:', admin.permissions);
        
        this.setAuth(token, admin, 'GYM_ADMIN', admin.gym_id)
        console.log('Auth store after setAuth:', {
          user: this.user,
          role: this.role,
          gymId: this.gymId
        });
        
        return { success: true, data: response.data }
      } catch (error) {
        console.error('Gym admin login error:', error);
        return { success: false, message: error.response?.data?.message || 'Login failed' }
      }
    },

    // User Login
    async userLogin(credentials) {
      try {
        const response = await api.post('/auth/mobileuser/login', credentials)
        const { token, user } = response.data
        
        this.setAuth(token, user, 'USER', user.gym_id)
        return { success: true, data: response.data }
      } catch (error) {
        return { success: false, message: error.response?.data?.message || 'Login failed' }
      }
    },

    // Trainer Login
    async trainerLogin(credentials) {
      try {
        console.log('=== FRONTEND TRAINER LOGIN ===');
        console.log('Credentials:', credentials);
        
        const response = await api.post('/Trainer/login', credentials)
        console.log('Trainer login response:', response.data);
        
        const { token, user } = response.data
        console.log('Trainer user data:', user);
        console.log('Trainer permissions:', user.permissions);
        
        this.setAuth(token, user, 'trainer', user.gym_id)
        console.log('Auth store after trainer setAuth:', {
          user: this.user,
          role: this.role,
          gymId: this.gymId,
          isAuthenticated: this.isAuthenticated
        });
        
        return { success: true, data: response.data }
      } catch (error) {
        console.error('Trainer login error:', error);
        return { success: false, message: error.response?.data?.message || 'Login failed' }
      }
    },

    // Set authentication data
    setAuth(token, user, role, gymId = null) {
      this.token = token
      this.user = user
      this.role = role
      this.gymId = gymId
      this.isAuthenticated = true
      
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
      localStorage.setItem('role', role)
      if (gymId) localStorage.setItem('gymId', gymId)
      
      // Authorization header is handled by axios interceptor
    },

    // Logout
    logout() {
      this.token = null
      this.user = null
      this.role = null
      this.gymId = null
      this.isAuthenticated = false
      
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('role')
      localStorage.removeItem('gymId')
      
      // Authorization header is handled by axios interceptor
    },

    // Initialize auth from localStorage
    initAuth() {
      const token = localStorage.getItem('token')
      const user = localStorage.getItem('user')
      const role = localStorage.getItem('role')
      const gymId = localStorage.getItem('gymId')
      
      if (token && user && role) {
        this.token = token
        this.user = JSON.parse(user)
        this.role = role
        this.gymId = gymId
        this.isAuthenticated = true
        
        // Authorization header is handled by axios interceptor
      }
    }
  }
})
