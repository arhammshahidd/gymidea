import { defineStore } from 'pinia'
import api from '../config/axios'

export const usePaymentStatusStore = defineStore('paymentStatus', {
  state: () => ({
    payments: [],
    overview: {
      total_amount: 0,
      paid_members: 0,
      unpaid_members: 0,
      all_payments: []
    },
    loading: false,
    error: null
  }),

  getters: {
    getPaymentById: (state) => (id) => {
      return state.payments.find(payment => payment.id === id)
    },
    getPaymentsByStatus: (state) => (status) => {
      return state.payments.filter(payment => payment.payment_status === status)
    },
    getUnpaidPayments: (state) => {
      return state.payments.filter(payment => payment.payment_status === 'Unpaid')
    },
    getPaidPayments: (state) => {
      return state.payments.filter(payment => payment.payment_status === 'Paid')
    }
  },

  actions: {
    // Get payment overview
    async getOverview() {
      try {
        this.loading = true
        this.error = null
        
        const response = await api.get('/paymentStatus/overview')
        
        if (response.data.success) {
          this.overview = response.data.data
          return { success: true, data: response.data.data }
        } else {
          this.error = response.data.message
          return { success: false, message: response.data.message }
        }
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to fetch payment overview'
        return { success: false, message: this.error }
      } finally {
        this.loading = false
      }
    },

    // Get all payments with pagination and filters
    async getPayments(params = {}) {
      try {
        this.loading = true
        this.error = null
        
        const response = await api.get('/paymentStatus', { params })
        
        console.log('PaymentStatus Store - API Response:', response.data)
        
        if (response.data.success) {
          console.log('PaymentStatus Store - Payments data:', response.data.payments)
          this.payments = response.data.payments
          return { 
            success: true, 
            data: response.data.payments,
            pagination: response.data.pagination
          }
        } else {
          this.error = response.data.message
          return { success: false, message: response.data.message }
        }
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to fetch payments'
        return { success: false, message: this.error }
      } finally {
        this.loading = false
      }
    },

    // Get single payment
    async getPayment(id) {
      try {
        this.loading = true
        this.error = null
        
        const response = await api.get(`/paymentStatus/${id}`)
        
        if (response.data.success) {
          return { success: true, data: response.data.payment }
        } else {
          this.error = response.data.message
          return { success: false, message: response.data.message }
        }
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to fetch payment'
        return { success: false, message: this.error }
      } finally {
        this.loading = false
      }
    },

    // Create payment
    async createPayment(paymentData) {
      try {
        this.loading = true
        this.error = null
        
        const response = await api.post('/paymentStatus', paymentData)
        
        if (response.data.success) {
          // Add to local state
          this.payments.unshift(response.data.payment)
          return { success: true, data: response.data.payment }
        } else {
          this.error = response.data.message
          return { success: false, message: response.data.message }
        }
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to create payment'
        return { success: false, message: this.error }
      } finally {
        this.loading = false
      }
    },

    // Update payment
    async updatePayment(id, paymentData) {
      try {
        this.loading = true
        this.error = null
        
        const response = await api.put(`/paymentStatus/${id}`, paymentData)
        
        if (response.data.success) {
          // Update local state
          const index = this.payments.findIndex(payment => payment.id === id)
          if (index !== -1) {
            this.payments[index] = response.data.payment
          }
          return { success: true, data: response.data.payment }
        } else {
          this.error = response.data.message
          return { success: false, message: response.data.message }
        }
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to update payment'
        return { success: false, message: this.error }
      } finally {
        this.loading = false
      }
    },

    // Delete payment
    async deletePayment(id) {
      try {
        this.loading = true
        this.error = null
        
        const response = await api.delete(`/paymentStatus/${id}`)
        
        if (response.data.success) {
          // Remove from local state
          this.payments = this.payments.filter(payment => payment.id !== id)
          return { success: true }
        } else {
          this.error = response.data.message
          return { success: false, message: response.data.message }
        }
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to delete payment'
        return { success: false, message: this.error }
      } finally {
        this.loading = false
    }
  },

  // Get payment history for a specific user
  async getPaymentHistory(userId) {
    try {
      this.loading = true
      this.error = null
      
      const response = await api.get(`/paymentStatus/history/${userId}`)
      
      console.log('Payment History API Response:', response.data)
      
      if (response.data.success) {
        return { 
          success: true, 
          data: response.data.data
        }
      } else {
        this.error = response.data.message
        return { success: false, message: response.data.message }
      }
    } catch (error) {
      this.error = error.response?.data?.message || 'Failed to fetch payment history'
      return { success: false, message: this.error }
    } finally {
      this.loading = false
    }
  },

  // Send WhatsApp reminders to all unpaid members
  async sendWhatsAppReminders() {
      try {
        this.loading = true
        this.error = null
        
        const response = await api.post('/paymentStatus/whatsapp-reminder')
        
        if (response.data.success) {
          return { success: true, data: response.data }
        } else {
          this.error = response.data.message
          return { success: false, message: response.data.message }
        }
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to send WhatsApp reminders'
        return { success: false, message: this.error }
      } finally {
        this.loading = false
      }
    },

    // Send WhatsApp reminder to specific member
    async sendIndividualReminder(id) {
      try {
        this.loading = true
        this.error = null
        
        const response = await api.post(`/paymentStatus/whatsapp-reminder/${id}`)
        
        if (response.data.success) {
          return { success: true, data: response.data }
        } else {
          this.error = response.data.message
          return { success: false, message: response.data.message }
        }
      } catch (error) {
        this.error = error.response?.data?.message || 'Failed to send WhatsApp reminder'
        return { success: false, message: this.error }
      } finally {
        this.loading = false
      }
    },

    // Clear error
    clearError() {
      this.error = null
    },

    // Reset state
    reset() {
      this.payments = []
      this.overview = {
        total_amount: 0,
        paid_members: 0,
        unpaid_members: 0,
        all_payments: []
      }
      this.loading = false
      this.error = null
    }
  }
})
