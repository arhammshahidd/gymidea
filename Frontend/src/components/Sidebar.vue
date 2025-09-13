<template>
  <div class="sidebar">
    <!-- Logo Section -->
    <div class="logo-section">
      <div class="logo-icon">🏋️</div>
    </div>

    <!-- Navigation Menu -->
    <div class="nav-menu">
      <div
        v-for="item in menuItems"
        :key="item.route"
        :class="['nav-item', { active: currentModule === item.key }]"
        @click="navigateTo(item.route)"
      >
        <div class="nav-icon">{{ item.icon }}</div>
        <div class="nav-text">{{ item.label }}</div>
      </div>
    </div>

    <!-- Sign Out Section -->
    <div class="signout-section">
      <div class="signout-item" @click="logout">
        <div class="signout-icon">↗️</div>
        <div class="signout-text">Signout</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const drawerOpen = ref(true)
const currentModule = ref('')

// Menu items configuration
const menuItems = ref([
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: '📊',
    route: '/gym-admin/dashboard'
  },
  {
    key: 'user-management',
    label: 'User Management',
    icon: '👥',
    route: '/gym-admin/user-management'
  },
  {
    key: 'trainer-management',
    label: 'Trainer Management',
    icon: '🏋️‍♂️',
    route: '/gym-admin/trainer-management'
  },
  {
    key: 'payment-status',
    label: 'Payment Status',
    icon: '📄',
    route: '/gym-admin/payment-status'
  },
  {
    key: 'food-menu',
    label: 'Food Menus',
    icon: '🍽️',
    route: '/gym-admin/food-menu'
  },
  {
    key: 'trainer-scheduler',
    label: 'Stats & Training Schedules',
    icon: '📊',
    route: '/gym-admin/trainer-scheduler'
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: '⚙️',
    route: '/gym-admin/settings'
  }
])

// Set current module based on route
const setCurrentModuleFromRoute = () => {
  const currentPath = route.path
  const pathParts = currentPath.split('/')
  const moduleKey = pathParts[pathParts.length - 1]
  
  if (moduleKey === 'dashboard' || moduleKey === 'gym-admin') {
    currentModule.value = 'dashboard'
  } else {
    currentModule.value = moduleKey
  }
}

// Navigate to route
const navigateTo = (route) => {
  router.push(route)
}

// Logout function
const logout = () => {
  console.log('=== LOGOUT ===')
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

onMounted(() => {
  setCurrentModuleFromRoute()
})
</script>

<style scoped>
.sidebar {
  width: 280px;
  background: #f8f9fa;
  border-right: 1px solid #e9ecef;
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: fixed;
  left: 0;
  top: 0;
}

.logo-section {
  padding: 24px 20px;
  display: flex;
  justify-content: center;
  align-items: center;
  border-bottom: 1px solid #e9ecef;
}

.logo-icon {
  font-size: 2.5rem;
  background: #27ae60;
  width: 60px;
  height: 60px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(39, 174, 96, 0.3);
}

.nav-menu {
  flex: 1;
  padding: 20px 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  margin: 2px 0;
  cursor: pointer;
  transition: all 0.3s ease;
  color: #495057;
  font-weight: 500;
}

.nav-item:hover {
  background: #e9ecef;
}

.nav-item.active {
  background: #27ae60;
  color: white;
}

.nav-icon {
  font-size: 1.2rem;
  width: 20px;
  text-align: center;
}

.nav-text {
  font-weight: 500;
  font-size: 14px;
}

.nav-item.active .nav-text {
  color: white;
  font-weight: 600;
}

.signout-section {
  padding: 20px;
  border-top: 1px solid #e9ecef;
  background: #f8f9fa;
}

.signout-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  color: #495057;
  font-weight: 500;
  font-size: 14px;
}

.signout-item:hover {
  background: #e9ecef;
  border-radius: 6px;
}

.signout-icon {
  font-size: 1.1rem;
}

.signout-text {
  font-weight: 500;
}
</style>
