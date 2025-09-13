import { defineStore } from 'pinia'
import api from '../config/axios'

export const useUserManagementStore = defineStore('userManagement', {
  state: () => ({
    users: [],
    stats: {
      totalUsers: 0,
      totalActiveUsers: 0,
      totalInactiveUsers: 0,
      totalBasicMemberships: 0,
      totalPremiumMemberships: 0
    },
    loading: false,
    error: null
  }),

  getters: {
    getActiveUsers: (state) => state.users.filter(user => user.status === 'ACTIVE'),
    getInactiveUsers: (state) => state.users.filter(user => user.status === 'INACTIVE'),
    getBasicMembers: (state) => state.users.filter(user => user.membership_tier === 'BASIC'),
    getPremiumMembers: (state) => state.users.filter(user => user.membership_tier === 'PREMIUM')
  },

  actions: {
    // Get user statistics
    async fetchUserStats() {
      this.loading = true
      this.error = null
      try {
        console.log('=== FETCHING USER STATS ===')
        const response = await api.get('/userManagement/stats')
        console.log('User stats response:', response.data)
        this.stats = response.data.data
        return { success: true, data: response.data.data }
      } catch (error) {
        console.error('Error fetching user stats:', error)
        this.error = error.response?.data?.message || 'Failed to fetch user statistics'
        return { success: false, message: this.error }
      } finally {
        this.loading = false
      }
    },

    // Get all users
    async fetchUsers() {
      this.loading = true
      this.error = null
      try {
        console.log('=== FETCHING ALL USERS ===')
        const response = await api.get('/userManagement/')
        console.log('Users response:', response.data)
        this.users = response.data.data
        return { success: true, data: response.data.data }
      } catch (error) {
        console.error('Error fetching users:', error)
        this.error = error.response?.data?.message || 'Failed to fetch users'
        return { success: false, message: this.error }
      } finally {
        this.loading = false
      }
    },

    // Get user by ID
    async fetchUserById(id) {
      this.loading = true
      this.error = null
      try {
        console.log('=== FETCHING USER BY ID ===', id)
        const response = await api.get(`/userManagement/${id}`)
        console.log('User response:', response.data)
        return { success: true, data: response.data.data }
      } catch (error) {
        console.error('Error fetching user:', error)
        this.error = error.response?.data?.message || 'Failed to fetch user'
        return { success: false, message: this.error }
      } finally {
        this.loading = false
      }
    },

    // Create new user
    async createUser(userData) {
      this.loading = true
      this.error = null
      try {
        console.log('=== CREATING USER ===')
        console.log('User data:', userData)
        const response = await api.post('/userManagement/', userData)
        console.log('Create user response:', response.data)
        
        // Add the new user to the local state
        this.users.unshift(response.data.data)
        
        // Refresh stats
        await this.fetchUserStats()
        
        return { success: true, data: response.data.data, message: response.data.message }
      } catch (error) {
        console.error('Error creating user:', error)
        this.error = error.response?.data?.message || 'Failed to create user'
        return { success: false, message: this.error }
      } finally {
        this.loading = false
      }
    },

    // Update user
    async updateUser(id, userData) {
      this.loading = true
      this.error = null
      try {
        console.log('=== UPDATING USER ===', id)
        console.log('Update data:', userData)
        const response = await api.put(`/userManagement/${id}`, userData)
        console.log('Update user response:', response.data)
        
        // Update the user in local state
        const index = this.users.findIndex(user => user.id === id)
        if (index !== -1) {
          this.users[index] = { ...this.users[index], ...response.data.data }
        }
        
        // Refresh stats
        await this.fetchUserStats()
        
        return { success: true, data: response.data.data, message: response.data.message }
      } catch (error) {
        console.error('Error updating user:', error)
        this.error = error.response?.data?.message || 'Failed to update user'
        return { success: false, message: this.error }
      } finally {
        this.loading = false
      }
    },

    // Delete user
    async deleteUser(id) {
      this.loading = true
      this.error = null
      try {
        console.log('=== DELETING USER ===', id)
        const response = await api.delete(`/userManagement/${id}`)
        console.log('Delete user response:', response.data)
        
        // Remove the user from local state
        this.users = this.users.filter(user => user.id !== id)
        
        // Refresh stats
        await this.fetchUserStats()
        
        return { success: true, message: response.data.message }
      } catch (error) {
        console.error('Error deleting user:', error)
        this.error = error.response?.data?.message || 'Failed to delete user'
        return { success: false, message: this.error }
      } finally {
        this.loading = false
      }
    },

    // Logout user
    async logoutUser(id) {
      this.loading = true
      this.error = null
      try {
        console.log('=== LOGGING OUT USER ===', id)
        const response = await api.post(`/userManagement/${id}/logout`)
        console.log('Logout user response:', response.data)
        return { success: true, message: response.data.message }
      } catch (error) {
        console.error('Error logging out user:', error)
        this.error = error.response?.data?.message || 'Failed to logout user'
        return { success: false, message: this.error }
      } finally {
        this.loading = false
      }
    },

    // Clear error
    clearError() {
      this.error = null
    }
  }
})
