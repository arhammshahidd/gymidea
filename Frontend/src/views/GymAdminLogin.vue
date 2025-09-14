<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <h1>Gym Admin Login</h1>
        <p>Manage your gym operations and staff</p>
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
          {{ loading ? 'Logging in...' : 'Login as Gym Admin' }}
        </button>

        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <div v-if="success" class="success-message">
          {{ success }}
        </div>
      </form>

      <div class="login-footer">
        <p>Don't have access? Contact your super administrator</p>
        <div class="quick-links">
          <router-link to="/superadmin-login">Super Admin Login</router-link>
          <router-link to="/trainer-login">Trainer Login</router-link>
          <router-link to="/user-login">User Login</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// import { ref } from 'vue'
// import { useAuthStore } from '../stores/auth'
// import { useRouter } from 'vue-router'

// const authStore = useAuthStore()
// const router = useRouter()

// const loading = ref(false)

// // Direct navigation after login - no watcher needed
// const error = ref('')
// const success = ref('')

// const credentials = ref({
//   phone: '',
//   password: ''
// })

// const handleLogin = async () => {
//   loading.value = true
//   error.value = ''
//   success.value = ''

//   try {
//     const result = await authStore.gymAdminLogin(credentials.value)

//     if (result.success) {
//       success.value = 'Login successful! Redirecting...'
//       console.log('=== LOGIN SUCCESS - TRIGGERING NAVIGATION ===')
//       console.log('Auth state:', {
//         isAuthenticated: authStore.isAuthenticated,
//         role: authStore.role,
//         user: authStore.user?.name
//       })
      
//       // 🔑 Navigate to gym admin dashboard after ensuring auth state is set
//       console.log('=== NAVIGATING TO GYM ADMIN DASHBOARD ===')
//       console.log('Current route:', router.currentRoute.value.path)
//       console.log('Auth state before navigation:', {
//         isAuthenticated: authStore.isAuthenticated,
//         role: authStore.role,
//         user: authStore.user?.name,
//         token: !!authStore.token
//       })
      
//       // Longer delay to ensure auth state is fully updated
//       setTimeout(() => {
//         console.log('Navigating to /gym-admin/dashboard with router.push')
//         console.log('Current route before push:', router.currentRoute.value.path)
//         console.log('Auth state before navigation:', {
//           isAuthenticated: authStore.isAuthenticated,
//           role: authStore.role,
//           user: authStore.user?.name,
//           token: !!authStore.token
//         })
        
//         // Navigate directly to dashboard
//         router.push('/gym-admin/dashboard').then(() => {
//           console.log('Navigation completed, new route:', router.currentRoute.value.path)
//         }).catch((error) => {
//           console.error('Navigation failed:', error)
//         })
//       }, 200)
//     } else {
//       error.value = result.message
//     }
//   } catch (err) {
//     error.value = 'Login failed. Please try again.'
//   } finally {
//     loading.value = false
//   }
// }

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

// ✅ Extra Guard inside component
watchEffect(() => {
  if (authStore.isAuthenticated && authStore.role === 'GYM_ADMIN') {
    const firstAvailableModule = authStore.getFirstAvailableModule
    if (firstAvailableModule) {
      router.replace(firstAvailableModule)
    } else {
      // If no permissions, redirect to no-permissions page
      router.replace('/gym-admin/no-permissions')
    }
  }
})

const handleLogin = async () => {
  loading.value = true
  error.value = ''
  success.value = ''

  try {
    const result = await authStore.gymAdminLogin(credentials.value)

    if (result.success) {
      success.value = 'Login successful! Redirecting...'
      
      // Wait for auth state to be updated
      setTimeout(() => {
        console.log('=== PERMISSION CHECK ===')
        console.log('User permissions:', authStore.user?.permissions)
        console.log('Permission type:', typeof authStore.user?.permissions)
        console.log('Is array:', Array.isArray(authStore.user?.permissions))
        
        const firstAvailableModule = authStore.getFirstAvailableModule
        console.log('First available module:', firstAvailableModule)
        
        if (firstAvailableModule) {
          console.log('Redirecting to first available module:', firstAvailableModule)
          router.push(firstAvailableModule)
        } else {
          console.log('No permissions available, redirecting to no-permissions page')
          router.push('/gym-admin/no-permissions')
        }
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
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
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
  border-color: #4facfe;
  box-shadow: 0 0 0 3px rgba(79, 172, 254, 0.1);
}

.login-btn {
  width: 100%;
  padding: 0.75rem;
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
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
  box-shadow: 0 5px 15px rgba(79, 172, 254, 0.3);
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
  color: #4facfe;
  text-decoration: none;
  font-size: 0.9rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.quick-links a:hover {
  background-color: #f0f9ff;
}
</style>
