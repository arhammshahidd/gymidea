import { ref } from 'vue'
import api from '../config/axios'

export function useApi() {
  const loading = ref(false)
  const error = ref(null)

  const makeRequest = async (requestFn) => {
    loading.value = true
    error.value = null
    
    try {
      const response = await requestFn()
      return { success: true, data: response.data }
    } catch (err) {
      error.value = err.response?.data?.message || err.message || 'An error occurred'
      return { success: false, message: error.value }
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    makeRequest
  }
}

// Auth API calls
export const authApi = {
  superAdminLogin: (credentials) => api.post('/auth/superadmin/login', credentials),
  gymAdminLogin: (credentials) => api.post('/auth/gymadmin/login', credentials),
  userLogin: (credentials) => api.post('/auth/mobileuser/login', credentials),
  trainerLogin: (credentials) => api.post('/Trainer/login', credentials)
}

// Super Admin API calls
export const superAdminApi = {
  // Gym Management
  getGyms: () => api.get('/superadmin/gyms'),
  createGym: (data) => api.post('/superadmin/gyms', data),
  updateGym: (id, data) => api.patch(`/superadmin/gyms/${id}`, data),
  deleteGym: (id) => api.delete(`/superadmin/gyms/${id}`),
  
  // Gym Admin Management
  getGymAdmins: () => api.get('/superadmin/gym-admins'),
  createGymAdmin: (data) => api.post('/superadmin/gym-admins', data),
  updateGymAdmin: (id, data) => api.patch(`/superadmin/gym-admins/${id}`, data),
  deleteGymAdmin: (id) => api.delete(`/superadmin/gym-admins/${id}`),
  logoutGymAdmin: (id) => api.post(`/superadmin/gym-admins/${id}/logout`),
  logoutGymUsers: (id) => api.post(`/superadmin/gym-admins/${id}/logout-users`)
}

// Gym Admin API calls
export const gymAdminApi = {
  // Trainer Management
  getTrainers: () => api.get('/Trainer'),
  createTrainer: (data) => api.post('/Trainer', data),
  updateTrainer: (id, data) => api.put(`/Trainer/${id}`, data),
  deleteTrainer: (id) => api.delete(`/Trainer/${id}`)
}
