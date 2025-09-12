import { defineStore } from 'pinia'
import api from '../config/axios'

export const useGymStore = defineStore('gym', {
  state: () => ({
    gyms: [],
    gymAdmins: [],
    trainers: [],
    loading: false,
    error: null
  }),

  getters: {
    getGymById: (state) => (id) => state.gyms.find(gym => gym.id === id),
    getGymAdminsByGymId: (state) => (gymId) => state.gymAdmins.filter(admin => admin.gym_id === gymId),
    getTrainersByGymId: (state) => (gymId) => state.trainers.filter(trainer => trainer.gym_id === gymId)
  },

  actions: {
    // Super Admin - Gym Management
    async fetchGyms() {
      this.loading = true
      try {
        const response = await api.get('/superadmin/gyms')
        this.gyms = response.data.data
        return { success: true, data: response.data.data }
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to fetch gyms'
        return { success: false, message: this.error }
      } finally {
        this.loading = false
      }
    },

    async createGym(gymData) {
      this.loading = true
      try {
        const response = await api.post('/superadmin/gyms', gymData)
        this.gyms.push(response.data.data.gym)
        return { success: true, data: response.data.data }
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to create gym'
        return { success: false, message: this.error }
      } finally {
        this.loading = false
      }
    },

    async updateGym(id, gymData) {
      this.loading = true
      try {
        const response = await api.patch(`/superadmin/gyms/${id}`, gymData)
        const index = this.gyms.findIndex(gym => gym.id === id)
        if (index !== -1) {
          this.gyms[index] = response.data.data
        }
        return { success: true, data: response.data.data }
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to update gym'
        return { success: false, message: this.error }
      } finally {
        this.loading = false
      }
    },

    async deleteGym(id) {
      this.loading = true
      try {
        await api.delete(`/superadmin/gyms/${id}`)
        this.gyms = this.gyms.filter(gym => gym.id !== id)
        return { success: true }
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to delete gym'
        return { success: false, message: this.error }
      } finally {
        this.loading = false
      }
    },

    // Super Admin - Gym Admin Management
    async fetchGymAdmins() {
      this.loading = true
      try {
        const response = await api.get('/superadmin/gym-admins')
        this.gymAdmins = response.data.data
        return { success: true, data: response.data.data }
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to fetch gym admins'
        return { success: false, message: this.error }
      } finally {
        this.loading = false
      }
    },

    async createGymAdmin(adminData) {
      this.loading = true
      try {
        const response = await api.post('/superadmin/gym-admins', adminData)
        this.gymAdmins.push(response.data.data)
        return { success: true, data: response.data.data }
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to create gym admin'
        return { success: false, message: this.error }
      } finally {
        this.loading = false
      }
    },

    async updateGymAdmin(id, adminData) {
      this.loading = true
      try {
        const response = await api.patch(`/superadmin/gym-admins/${id}`, adminData)
        const index = this.gymAdmins.findIndex(admin => admin.id === id)
        if (index !== -1) {
          this.gymAdmins[index] = response.data.data
        }
        return { success: true, data: response.data.data }
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to update gym admin'
        return { success: false, message: this.error }
      } finally {
        this.loading = false
      }
    },

    async deleteGymAdmin(id) {
      this.loading = true
      try {
        await api.delete(`/superadmin/gym-admins/${id}`)
        this.gymAdmins = this.gymAdmins.filter(admin => admin.id !== id)
        return { success: true }
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to delete gym admin'
        return { success: false, message: this.error }
      } finally {
        this.loading = false
      }
    },

    async logoutGymAdmin(id) {
      this.loading = true
      try {
        await api.post(`/superadmin/gym-admins/${id}/logout`)
        return { success: true }
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to logout gym admin'
        return { success: false, message: this.error }
      } finally {
        this.loading = false
      }
    },

    async logoutGymUsers(id) {
      this.loading = true
      try {
        await api.post(`/superadmin/gym-admins/${id}/logout-users`)
        return { success: true }
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to logout gym users'
        return { success: false, message: this.error }
      } finally {
        this.loading = false
      }
    },

    // Gym Admin - Trainer Management
    async fetchTrainers() {
      this.loading = true
      try {
        const response = await api.get('/Trainer')
        this.trainers = response.data.trainers
        return { success: true, data: response.data.trainers }
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to fetch trainers'
        return { success: false, message: this.error }
      } finally {
        this.loading = false
      }
    },

    async createTrainer(trainerData) {
      this.loading = true
      try {
        const response = await api.post('/Trainer', trainerData)
        this.trainers.push(response.data.trainer)
        return { success: true, data: response.data.trainer }
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to create trainer'
        return { success: false, message: this.error }
      } finally {
        this.loading = false
      }
    },

    async updateTrainer(id, trainerData) {
      this.loading = true
      try {
        const response = await api.put(`/Trainer/${id}`, trainerData)
        const index = this.trainers.findIndex(trainer => trainer.id === id)
        if (index !== -1) {
          this.trainers[index] = response.data.trainer
        }
        return { success: true, data: response.data.trainer }
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to update trainer'
        return { success: false, message: this.error }
      } finally {
        this.loading = false
      }
    },

    async deleteTrainer(id) {
      this.loading = true
      try {
        await api.delete(`/Trainer/${id}`)
        this.trainers = this.trainers.filter(trainer => trainer.id !== id)
        return { success: true }
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to delete trainer'
        return { success: false, message: this.error }
      } finally {
        this.loading = false
      }
    }
  }
})
