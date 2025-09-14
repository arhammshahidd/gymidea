<template>
  <div class="gym-admin-layout">
    <!-- Sidebar Component -->
    <Sidebar />
    
    <!-- Main Content Area -->
    <div class="main-content">
      <router-view :key="$route.fullPath" />
    </div>
  </div>
</template>

<script setup>
import { onMounted, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRoute } from 'vue-router'
import Sidebar from '../components/Sidebar.vue'

const authStore = useAuthStore()
const route = useRoute()

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
}, { immediate: true })
</script>

<style scoped>
.gym-admin-layout {
  display: flex;
  height: 100vh;
  background: #f8f9fa;
}

.main-content {
  flex: 1;
  background: #f8f9fa;
  overflow-y: auto;
  margin-left: 280px;
}
</style>