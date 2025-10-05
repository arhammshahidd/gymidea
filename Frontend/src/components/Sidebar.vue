<template>
  <div class="sidebar">
    <!-- Logo Section -->
    <div class="logo-section">
      <div class="logo-icon">🏋️</div>
      <div class="logo-text">Gym Management</div>
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
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

// Emit events to parent
const emit = defineEmits(['close-drawer'])

const drawerOpen = ref(true)
const currentModule = ref('')

// All possible menu items (role-aware routes)
const allMenuItems = ref([
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: '📊',
    route: computed(() => authStore.role === 'trainer' ? '/trainer/dashboard' : '/gym-admin/dashboard'),
    permission: 'Dashboard'
  },
  {
    key: 'user-management',
    label: 'User Management',
    icon: '👥',
    route: computed(() => authStore.role === 'trainer' ? '/trainer/user-management' : '/gym-admin/user-management'),
    permission: 'User Management'
  },
  {
    key: 'trainer-management',
    label: 'Trainer Management',
    icon: '🏋️‍♂️',
    route: computed(() => authStore.role === 'trainer' ? '/trainer/trainer-management' : '/gym-admin/trainer-management'),
    permission: 'Trainer Management'
  },
  {
    key: 'payment-status',
    label: 'Payment Status',
    icon: '📄',
    route: computed(() => authStore.role === 'trainer' ? '/trainer/payment-status' : '/gym-admin/payment-status'),
    permission: 'Payment Status'
  },
  {
    key: 'food-menu',
    label: 'Food Menus',
    icon: '🍽️',
    route: computed(() => authStore.role === 'trainer' ? '/trainer/food-menu' : '/gym-admin/food-menu'),
    permission: 'Food Menu'
  },
  {
    key: 'trainer-scheduler',
    label: 'Stats & Training Schedules',
    icon: '📊',
    route: computed(() => authStore.role === 'trainer' ? '/trainer/trainer-scheduler' : '/gym-admin/trainer-scheduler'),
    permission: 'Trainer Scheduler'
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: '⚙️',
    route: computed(() => authStore.role === 'trainer' ? '/trainer/settings' : '/gym-admin/settings'),
    permission: 'Settings'
  }
])

// Computed menu items based on permissions
const menuItems = computed(() => {
  if (!authStore.user || !authStore.user.permissions) {
    return []
  }
  
  return allMenuItems.value
    .filter(item => authStore.user.permissions?.includes(item.permission))
    .map(item => {
      const routePath = typeof item.route === 'string' ? item.route : item.route.value
      return { ...item, route: routePath, isActive: computed(() => route.path.startsWith(routePath)) }
    })
})

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
  console.log('=== SIDEBAR NAVIGATION ===')
  console.log('Navigating to route:', route)
  console.log('Current route:', router.currentRoute.value.path)
  
  try {
    router.push(route)
    console.log('Navigation successful')
    
    // Close drawer on mobile after navigation
    if (window.innerWidth < 768) {
      emit('close-drawer')
    }
  } catch (error) {
    console.error('Navigation error:', error)
  }
}

// Logout function
const logout = () => {
  console.log('=== LOGOUT ===')
  const currentRole = authStore.role
  console.log('Current role before logout:', currentRole)
  
  authStore.logout()
  
  // Close drawer on mobile
  if (window.innerWidth < 768) {
    emit('close-drawer')
  }
  
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
  console.log('=== SIDEBAR MOUNTED ===')
  console.log('Auth store user:', authStore.user)
  console.log('User permissions:', authStore.user?.permissions)
  console.log('Menu items:', menuItems.value)
  console.log('Current route:', route.path)
  
  setCurrentModuleFromRoute()
})

// Keep highlight in sync when navigating
watch(() => route.path, () => {
  setCurrentModuleFromRoute()
}, { immediate: true })
</script>

<style scoped>
.sidebar {
  width: 100%;
  background: #f8f9fa;
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.logo-section {
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-bottom: 1px solid #e9ecef;
  text-align: center;
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
  margin-bottom: 12px;
}

.logo-text {
  font-size: 1.1rem;
  font-weight: 600;
  color: #2c3e50;
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
