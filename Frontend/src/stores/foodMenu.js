import { defineStore } from 'pinia'
import api from '../config/axios'

export const useFoodMenuStore = defineStore('foodMenu', {
  state: () => ({
    // Food Menu Plans
    foodMenus: [],
    loadingFoodMenus: false,
    
    // Approval Requests
    approvalRequests: [],
    loadingApprovalRequests: false,
    
    // Statistics
    stats: {
      total: 0,
      active: 0,
      inactive: 0
    },
    
    // Categories
    categories: [],
    
    // Error handling
    error: null
  }),

  getters: {
    // Get active food menus
    activeFoodMenus: (state) => {
      return state.foodMenus.filter(menu => menu.status === 'ACTIVE')
    },
    
    // Get inactive food menus
    inactiveFoodMenus: (state) => {
      return state.foodMenus.filter(menu => menu.status === 'INACTIVE')
    },
    
    // Get pending approval requests
    pendingApprovalRequests: (state) => {
      return state.approvalRequests.filter(request => request.approval_status === 'PENDING')
    },
    
    // Get approved requests
    approvedRequests: (state) => {
      return state.approvalRequests.filter(request => request.approval_status === 'APPROVED')
    },
    
    // Get rejected requests
    rejectedRequests: (state) => {
      return state.approvalRequests.filter(request => request.approval_status === 'REJECTED')
    },
    
    // Get food menus by category
    getFoodMenusByCategory: (state) => {
      return (category) => {
        return state.foodMenus.filter(menu => menu.menu_plan_category === category)
      }
    },
    
    // Get approval requests by category
    getApprovalRequestsByCategory: (state) => {
      return (category) => {
        return state.approvalRequests.filter(request => request.menu_plan_category === category)
      }
    }
  },

  actions: {
    // Food Menu Actions
    async fetchFoodMenus(params = {}) {
      try {
        this.loadingFoodMenus = true
        this.error = null
        
        const response = await api.get('/foodMenu', { params })
        this.foodMenus = response.data.data
        
        return response.data
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to fetch food menus'
        console.error('Error fetching food menus:', error)
        throw error
      } finally {
        this.loadingFoodMenus = false
      }
    },

    async getFoodMenu(id) {
      try {
        this.error = null
        
        const response = await api.get(`/foodMenu/${id}`)
        return response.data.data
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to fetch food menu'
        console.error('Error fetching food menu:', error)
        throw error
      }
    },

    async createFoodMenu(menuData) {
      try {
        this.error = null
        
        const response = await api.post('/foodMenu', menuData)
        
        // Add to local state
        this.foodMenus.unshift(response.data.data)
        
        return response.data
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to create food menu'
        console.error('Error creating food menu:', error)
        throw error
      }
    },

    async updateFoodMenu(id, menuData) {
      try {
        this.error = null
        
        const response = await api.put(`/foodMenu/${id}`, menuData)
        
        // Update local state
        const index = this.foodMenus.findIndex(menu => menu.id === id)
        if (index !== -1) {
          this.foodMenus[index] = response.data.data
        }
        
        return response.data
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to update food menu'
        console.error('Error updating food menu:', error)
        throw error
      }
    },

    async deleteFoodMenu(id) {
      try {
        this.error = null
        
        await api.delete(`/foodMenu/${id}`)
        
        // Remove from local state
        this.foodMenus = this.foodMenus.filter(menu => menu.id !== id)
        
        return true
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to delete food menu'
        console.error('Error deleting food menu:', error)
        throw error
      }
    },

    async updateFoodMenuStatus(id, status) {
      try {
        this.error = null
        
        const response = await api.patch(`/foodMenu/${id}/status`, { status })
        
        // Update local state
        const index = this.foodMenus.findIndex(menu => menu.id === id)
        if (index !== -1) {
          this.foodMenus[index].status = status
        }
        
        return response.data
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to update food menu status'
        console.error('Error updating food menu status:', error)
        throw error
      }
    },

    async getFoodMenuCategories() {
      try {
        this.error = null
        
        const response = await api.get('/foodMenu/categories')
        this.categories = response.data.data
        
        return response.data.data
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to fetch categories'
        console.error('Error fetching categories:', error)
        throw error
      }
    },

    // Approval Request Actions
    async fetchApprovalRequests(params = {}) {
      try {
        this.loadingApprovalRequests = true
        this.error = null
        
        const response = await api.get('/approvalFoodMenu', { params })
        this.approvalRequests = response.data.data
        
        return response.data
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to fetch approval requests'
        console.error('Error fetching approval requests:', error)
        throw error
      } finally {
        this.loadingApprovalRequests = false
      }
    },

    async getApprovalRequest(id) {
      try {
        this.error = null
        
        const response = await api.get(`/approvalFoodMenu/${id}`)
        return response.data.data
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to fetch approval request'
        console.error('Error fetching approval request:', error)
        throw error
      }
    },

    async createApprovalRequest(requestData) {
      try {
        this.error = null
        
        const response = await api.post('/approvalFoodMenu', requestData)
        
        // Add to local state
        this.approvalRequests.unshift(response.data.data)
        
        return response.data
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to create approval request'
        console.error('Error creating approval request:', error)
        throw error
      }
    },

    async updateApprovalRequest(id, requestData) {
      try {
        this.error = null
        
        const response = await api.put(`/approvalFoodMenu/${id}`, requestData)
        
        // Update local state
        const index = this.approvalRequests.findIndex(request => request.id === id)
        if (index !== -1) {
          this.approvalRequests[index] = response.data.data
        }
        
        return response.data
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to update approval request'
        console.error('Error updating approval request:', error)
        throw error
      }
    },

    async deleteApprovalRequest(id) {
      try {
        this.error = null
        
        await api.delete(`/approvalFoodMenu/${id}`)
        
        // Remove from local state
        this.approvalRequests = this.approvalRequests.filter(request => request.id !== id)
        
        return true
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to delete approval request'
        console.error('Error deleting approval request:', error)
        throw error
      }
    },

    async updateApprovalStatus(id, status, notes = null) {
      try {
        this.error = null
        
        const response = await api.patch(`/approvalFoodMenu/${id}/approval`, {
          approval_status: status,
          approval_notes: notes
        })
        
        // Update local state
        const index = this.approvalRequests.findIndex(request => request.id === id)
        if (index !== -1) {
          this.approvalRequests[index].approval_status = status
          this.approvalRequests[index].approval_notes = notes
          this.approvalRequests[index].approved_by = response.data.data.approved_by
          this.approvalRequests[index].approved_at = response.data.data.approved_at
        }
        
        return response.data
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to update approval status'
        console.error('Error updating approval status:', error)
        throw error
      }
    },

    async getApprovalCategories() {
      try {
        this.error = null
        
        const response = await api.get('/approvalFoodMenu/categories')
        return response.data.data
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to fetch approval categories'
        console.error('Error fetching approval categories:', error)
        throw error
      }
    },

    async getApprovalStats() {
      try {
        this.error = null
        
        const response = await api.get('/approvalFoodMenu/stats')
        this.stats = response.data.data
        
        return response.data.data
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to fetch approval stats'
        console.error('Error fetching approval stats:', error)
        throw error
      }
    },

    // Utility Actions
    async calculateNutrition(foodItemName, grams) {
      try {
        // This would typically call an AI service to calculate nutrition
        // For now, we'll use mock data based on common food items
        const mockNutrition = this.getMockNutrition(foodItemName, grams)
        return mockNutrition
      } catch (error) {
        console.error('Error calculating nutrition:', error)
        throw error
      }
    },

    getMockNutrition(foodItemName, grams) {
      // Mock nutrition calculation based on food item name
      const foodItem = foodItemName.toLowerCase()
      
      // Common food items with approximate nutrition per 100g
      const nutritionData = {
        'chicken': { protein: 25, fats: 3, carbs: 0, calories: 165 },
        'rice': { protein: 2.7, fats: 0.3, carbs: 28, calories: 130 },
        'salmon': { protein: 25, fats: 12, carbs: 0, calories: 208 },
        'broccoli': { protein: 3, fats: 0.4, carbs: 7, calories: 34 },
        'oatmeal': { protein: 17, fats: 7, carbs: 66, calories: 389 },
        'banana': { protein: 1.1, fats: 0.3, carbs: 23, calories: 89 },
        'egg': { protein: 13, fats: 11, carbs: 1.1, calories: 155 },
        'bread': { protein: 9, fats: 3.2, carbs: 49, calories: 265 },
        'milk': { protein: 3.4, fats: 1, carbs: 5, calories: 42 },
        'yogurt': { protein: 10, fats: 0.4, carbs: 4, calories: 59 }
      }
      
      // Find matching food item
      let nutrition = { protein: 10, fats: 5, carbs: 15, calories: 150 } // Default
      
      for (const [key, value] of Object.entries(nutritionData)) {
        if (foodItem.includes(key)) {
          nutrition = value
          break
        }
      }
      
      // Calculate nutrition based on grams
      const factor = grams / 100
      return {
        protein: Math.round(nutrition.protein * factor * 10) / 10,
        fats: Math.round(nutrition.fats * factor * 10) / 10,
        carbs: Math.round(nutrition.carbs * factor * 10) / 10,
        calories: Math.round(nutrition.calories * factor)
      }
    },

    // Clear error
    clearError() {
      this.error = null
    },

    // Reset store
    reset() {
      this.foodMenus = []
      this.approvalRequests = []
      this.stats = { total: 0, active: 0, inactive: 0 }
      this.categories = []
      this.error = null
    }
  }
})
