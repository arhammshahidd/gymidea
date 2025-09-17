<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <h1>Trainer Login</h1>
        <p>Access your training dashboard and manage clients</p>
      </div>
      
      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label for="phone">Phone Number:</label>
          <input 
            v-model="credentials.phone" 
            type="text" 
            id="phone" 
            placeholder="Enter phone number"
            required 
          />
        </div>

        <div class="form-group">
          <label for="password">Password:</label>
          <input 
            v-model="credentials.password" 
            type="password" 
            id="password" 
            placeholder="Enter password"
            required 
          />
        </div>

        <button type="submit" :disabled="loading" class="login-btn">
          {{ loading ? 'Logging in...' : 'Login as Trainer' }}
        </button>

        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <div v-if="success" class="success-message">
          {{ success }}
        </div>
      </form>

      <div class="login-footer">
        <p>Need trainer access? Contact your gym administrator</p>
        <div class="quick-links">
          <router-link to="/superadmin-login">Super Admin Login</router-link>
          <router-link to="/gymadmin-login">Gym Admin Login</router-link>
          <router-link to="/user-login">User Login</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watchEffect } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()

const loading = ref(false)
const error = ref('')
const success = ref('')

const credentials = ref({
  phone: '',
  password: ''
})

// ✅ Extra Guard inside component, mirroring GymAdminLogin
watchEffect(() => {
  if (authStore.isAuthenticated && authStore.role === 'trainer') {
    router.replace('/trainer/dashboard')
  }
})

const handleLogin = async () => {
  loading.value = true
  error.value = ''
  success.value = ''

  try {
    const result = await authStore.trainerLogin(credentials.value)

    if (result.success) {
      success.value = 'Login successful! Redirecting...'
      setTimeout(() => {
        router.push('/trainer/dashboard')
      }, 200)
    } else {
      error.value = result.message
    }
  } catch (err) {
    error.value = 'Login failed. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
}

.login-card {
  background: white;
  padding: 2rem;
  border-radius: 15px;
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 450px;
}

.login-header {
  text-align: center;
  margin-bottom: 2rem;
}

.login-header h1 {
  color: #333;
  margin-bottom: 0.5rem;
  font-size: 1.8rem;
}

.login-header p {
  color: #666;
  font-size: 0.9rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #555;
}

input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 1rem;
  box-sizing: border-box;
  transition: border-color 0.3s;
}

input:focus {
  outline: none;
  border-color: #fa709a;
  box-shadow: 0 0 0 3px rgba(250, 112, 154, 0.1);
}

.login-btn {
  width: 100%;
  padding: 0.75rem;
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  margin-bottom: 1rem;
}

.login-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(250, 112, 154, 0.3);
}

.login-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

.error-message {
  color: #e74c3c;
  text-align: center;
  padding: 0.75rem;
  background: #fdf2f2;
  border-radius: 8px;
  margin-bottom: 1rem;
  border: 1px solid #fecaca;
}

.success-message {
  color: #27ae60;
  text-align: center;
  padding: 0.75rem;
  background: #f0f9f0;
  border-radius: 8px;
  margin-bottom: 1rem;
  border: 1px solid #bbf7d0;
}

.login-footer {
  text-align: center;
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e1e5e9;
}

.login-footer p {
  color: #666;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.quick-links {
  display: flex;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.quick-links a {
  color: #fa709a;
  text-decoration: none;
  font-size: 0.9rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.quick-links a:hover {
  background-color: #fef7f0;
}
</style>
