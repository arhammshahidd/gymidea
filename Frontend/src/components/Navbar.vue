<template>
  <nav class="navbar">
    <div class="navbar-container">
      <!-- Logo/Brand -->
      <div class="navbar-brand">
        <h2>Gym Management</h2>
      </div>

      <!-- Module Navigation -->
      <div class="navbar-modules">
        <div class="modules-list">
          <button
            v-for="module in availableModules"
            :key="module.key"
            @click="navigateToModule(module.key)"
            :class="['module-btn', { active: currentModule === module.key }]"
          >
            <span class="module-icon">{{ module.icon }}</span>
            <span class="module-name">{{ module.name }}</span>
          </button>
        </div>
      </div>

      <!-- User Info & Actions -->
      <div class="navbar-user">
        <div class="user-info">
          <span class="user-name">{{ authStore.user?.name }}</span>
          <span class="user-role">{{ getRoleDisplayName() }}</span>
        </div>
        <div class="user-actions">
          <button @click="toggleNotifications" class="action-btn notification-btn">
            <span class="icon">🔔</span>
            <span v-if="notificationCount > 0" class="notification-badge">{{ notificationCount }}</span>
          </button>
          <button @click="logout" class="action-btn logout-btn">
            <span class="icon">🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </div>
    </div>
  </nav>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRouter, useRoute } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

const currentModule = ref('')
const notificationCount = ref(0)

// Get the correct route prefix based on current user role
const routePrefix = computed(() => {
  const role = authStore.role
  if (role === 'GYM_ADMIN') {
    return '/gym-admin'
  } else if (role === 'trainer') {
    return '/trainer'
  } else if (role === 'SUPER_ADMIN') {
    return '/super-admin'
  }
  return ''
})

// Module definitions with icons and routing
const moduleDefinitions = {
  'Dashboard': {
    name: 'Dashboard',
    icon: '📊',
    key: 'dashboard'
  },
  'User Management': {
    name: 'User Management',
    icon: '👥',
    key: 'user-management'
  },
  'Trainer Management': {
    name: 'Trainer Management',
    icon: '🏋️',
    key: 'trainer-management'
  },
  'Trainer Scheduler': {
    name: 'Trainer Scheduler',
    icon: '📅',
    key: 'trainer-scheduler'
  },
  'Food Menu': {
    name: 'Food Menu',
    icon: '🍎',
    key: 'food-menu'
  },
  'Payment Status': {
    name: 'Payment Status',
    icon: '💳',
    key: 'payment-status'
  },
  'Settings': {
    name: 'Settings',
    icon: '⚙️',
    key: 'settings'
  }
}

// Get available modules based on user permissions
const availableModules = computed(() => {
  const userPermissions = authStore.user?.permissions || []
  return userPermissions
    .map(permission => moduleDefinitions[permission])
    .filter(module => module !== undefined)
})

// Get role display name
const getRoleDisplayName = () => {
  const role = authStore.role
  switch (role) {
    case 'GYM_ADMIN':
      return 'Gym Admin'
    case 'trainer':
      return 'Trainer'
    case 'SUPER_ADMIN':
      return 'Super Admin'
    default:
      return 'User'
  }
}

// Navigate to module
const navigateToModule = (moduleKey) => {
  console.log('=== NAVIGATING TO MODULE ===')
  console.log('Module key:', moduleKey)
  console.log('Route prefix:', routePrefix.value)
  
  const module = Object.values(moduleDefinitions).find(m => m.key === moduleKey)
  if (module) {
    const fullRoute = `${routePrefix.value}/${moduleKey}`
    currentModule.value = moduleKey
    console.log('Navigating to:', fullRoute)
    router.push(fullRoute)
  }
}

// Toggle notifications
const toggleNotifications = () => {
  console.log('Toggle notifications')
  // TODO: Implement notifications functionality
}

// Logout
const logout = () => {
  console.log('=== LOGOUT ===')
  
  // Store role before logout clears it
  const currentRole = authStore.role
  console.log('Current role before logout:', currentRole)
  
  authStore.logout()
  
  // Redirect to appropriate login page based on role
  if (currentRole === 'SUPER_ADMIN') {
    router.push('/superadmin-login')
  } else if (currentRole === 'GYM_ADMIN') {
    router.push('/gymadmin-login')
  } else if (currentRole === 'trainer') {
    router.push('/trainer-login')
  } else {
    router.push('/login-hub')
  }
}

// Set current module based on route
const setCurrentModuleFromRoute = () => {
  const currentPath = route.path
  console.log('Current path:', currentPath)
  console.log('Route prefix:', routePrefix.value)
  
  // Extract module key from current path
  const pathParts = currentPath.split('/')
  const moduleKey = pathParts[pathParts.length - 1] // Get the last part of the path
  
  // Check if this is a valid module key
  const module = Object.values(moduleDefinitions).find(m => m.key === moduleKey)
  if (module) {
    currentModule.value = moduleKey
    console.log('Set current module to:', moduleKey)
  } else {
    // Default to dashboard if on the main role route
    if (currentPath === routePrefix.value || currentPath === `${routePrefix.value}/`) {
      currentModule.value = 'dashboard'
      console.log('Defaulting to dashboard')
    } else if (availableModules.value.length > 0) {
      currentModule.value = availableModules.value[0].key
      console.log('Defaulting to first available module:', availableModules.value[0].key)
    }
  }
}

onMounted(() => {
  console.log('=== NAVBAR MOUNTED ===')
  console.log('User permissions:', authStore.user?.permissions)
  console.log('Available modules:', availableModules.value)
  setCurrentModuleFromRoute()
})
</script>

<style scoped>
.navbar {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 0;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  position: sticky;
  top: 0;
  z-index: 1000;
}

.navbar-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.navbar-brand h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: white;
}

.navbar-modules {
  flex: 1;
  display: flex;
  justify-content: center;
  margin: 0 2rem;
}

.modules-list {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
}

.module-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.9rem;
  font-weight: 500;
  backdrop-filter: blur(10px);
}

.module-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

.module-btn.active {
  background: rgba(255, 255, 255, 0.25);
  border-color: rgba(255, 255, 255, 0.4);
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

.module-icon {
  font-size: 1.1rem;
}

.module-name {
  white-space: nowrap;
}

.navbar-user {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-align: right;
}

.user-name {
  font-weight: 600;
  font-size: 1rem;
}

.user-role {
  font-size: 0.8rem;
  opacity: 0.8;
}

.user-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.9rem;
  position: relative;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
}

.notification-btn {
  position: relative;
}

.notification-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  background: #ff4757;
  color: white;
  border-radius: 50%;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: bold;
}

.logout-btn:hover {
  background: rgba(255, 71, 87, 0.2);
  border-color: rgba(255, 71, 87, 0.3);
}

/* Responsive Design */
@media (max-width: 1200px) {
  .navbar-container {
    padding: 1rem;
  }
  
  .navbar-modules {
    margin: 0 1rem;
  }
  
  .modules-list {
    gap: 0.25rem;
  }
  
  .module-btn {
    padding: 0.5rem 0.75rem;
    font-size: 0.8rem;
  }
  
  .module-name {
    display: none;
  }
}

@media (max-width: 768px) {
  .navbar-container {
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }
  
  .navbar-modules {
    order: 2;
    margin: 0;
    width: 100%;
  }
  
  .navbar-user {
    order: 1;
    width: 100%;
    justify-content: space-between;
  }
  
  .modules-list {
    justify-content: flex-start;
    overflow-x: auto;
    padding-bottom: 0.5rem;
  }
  
  .module-btn {
    flex-shrink: 0;
  }
}

@media (max-width: 480px) {
  .user-info {
    display: none;
  }
  
  .action-btn span:not(.icon) {
    display: none;
  }
  
  .action-btn {
    padding: 0.5rem;
  }
}
</style>
