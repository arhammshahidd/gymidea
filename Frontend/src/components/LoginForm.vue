<template>
  <div class="login-container">
    <div class="login-card">
      <h2>Gym Management Login</h2>
      
      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label for="role">Login As:</label>
          <select v-model="loginType" id="role" required>
            <option value="super">Super Admin</option>
            <option value="gym">Gym Admin</option>
            <option value="trainer">Trainer</option>
            <option value="user">User</option>
          </select>
        </div>

        <div class="form-group">
          <label for="phone">Phone:</label>
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
          {{ loading ? 'Logging in...' : 'Login' }}
        </button>

        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <div v-if="success" class="success-message">
          {{ success }}
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()

const loginType = ref('super')
const loading = ref(false)
const error = ref('')
const success = ref('')

const credentials = ref({
  phone: '',
  password: ''
})

const handleLogin = async () => {
  loading.value = true
  error.value = ''
  success.value = ''

  try {
    let result

    switch (loginType.value) {
      case 'super':
        result = await authStore.superAdminLogin(credentials.value)
        break
      case 'gym':
        result = await authStore.gymAdminLogin(credentials.value)
        break
      case 'trainer':
        result = await authStore.trainerLogin(credentials.value)
        break
      case 'user':
        result = await authStore.userLogin(credentials.value)
        break
      default:
        throw new Error('Invalid login type')
    }

    if (result.success) {
      success.value = 'Login successful!'
      // Redirect based on role
      setTimeout(() => {
        switch (authStore.role) {
          case 'SUPER_ADMIN':
            router.push('/super-admin')
            break
          case 'GYM_ADMIN':
            router.push('/gym-admin')
            break
          case 'TRAINER':
            router.push('/trainer')
            break
          case 'USER':
            router.push('/user')
            break
        }
      }, 1000)
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-card {
  background: white;
  padding: 2rem;
  border-radius: 10px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
}

h2 {
  text-align: center;
  margin-bottom: 1.5rem;
  color: #333;
}

.form-group {
  margin-bottom: 1rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #555;
}

input, select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 1rem;
  box-sizing: border-box;
}

input:focus, select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
}

.login-btn {
  width: 100%;
  padding: 0.75rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 1rem;
  cursor: pointer;
  transition: transform 0.2s;
}

.login-btn:hover:not(:disabled) {
  transform: translateY(-2px);
}

.login-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.error-message {
  color: #e74c3c;
  text-align: center;
  margin-top: 1rem;
  padding: 0.5rem;
  background: #fdf2f2;
  border-radius: 5px;
}

.success-message {
  color: #27ae60;
  text-align: center;
  margin-top: 1rem;
  padding: 0.5rem;
  background: #f0f9f0;
  border-radius: 5px;
}
</style>
