<template>
  <q-layout view="lHh Lpr lFf" class="gym-admin-layout">
    <!-- Mobile Header with Menu Button -->
    <q-header elevated class="bg-primary text-white">
      <q-toolbar>
        <q-btn
          flat
          dense
          round
          icon="menu"
          aria-label="Menu"
          @click="toggleLeftDrawer"
          class="q-mr-sm"
        />
        <q-toolbar-title>
          <div class="flex items-center">
            <div class="logo-icon q-mr-sm">🏋️</div>
            Gym Management
          </div>
        </q-toolbar-title>
        <div class="flex items-center q-gutter-sm">
          <q-btn flat round icon="notifications" />
          <q-btn flat round icon="account_circle" />
        </div>
      </q-toolbar>
    </q-header>

    <!-- Sidebar Drawer -->
    <q-drawer
      v-model="leftDrawerOpen"
      show-if-above
      bordered
      :width="280"
      :breakpoint="768"
      class="sidebar-drawer"
    >
      <Sidebar @close-drawer="leftDrawerOpen = false" />
    </q-drawer>

    <!-- Main Content Area -->
    <q-page-container class="main-content">
      <router-view :key="$route.fullPath" />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRoute } from 'vue-router'
import Sidebar from '../components/Sidebar.vue'

const authStore = useAuthStore()
const route = useRoute()

// Drawer state
const leftDrawerOpen = ref(false)

// Toggle drawer function
const toggleLeftDrawer = () => {
  leftDrawerOpen.value = !leftDrawerOpen.value
}

onMounted(() => {
  console.log('=== GYM ADMIN COMPONENT MOUNTED ===')
  console.log('This is the proper gym admin dashboard')
  console.log('Current route:', window.location.pathname)
  console.log('Auth state:', {
    isAuthenticated: authStore.isAuthenticated,
    role: authStore.role,
    user: authStore.user?.name
  })
  console.log('User permissions:', authStore.user?.permissions)
})

// Watch for route changes
watch(() => route.path, (newPath, oldPath) => {
  console.log('=== ROUTE CHANGED ===')
  console.log('From:', oldPath)
  console.log('To:', newPath)
  console.log('Route params:', route.params)
  console.log('Route query:', route.query)
  
  // Close drawer on mobile when navigating
  if (window.innerWidth < 768) {
    leftDrawerOpen.value = false
  }
}, { immediate: true })
</script>

<style scoped>
.gym-admin-layout {
  background: #f8f9fa;
}

.main-content {
  background: #f8f9fa;
}

.sidebar-drawer {
  background: #f8f9fa;
}

.logo-icon {
  font-size: 1.5rem;
  background: #27ae60;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(39, 174, 96, 0.3);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .main-content {
    padding: 0;
  }
}
</style>