<template>
  <div class="gym-admin-layout">
    <!-- Sidebar Component -->
    <Sidebar />
    
    <!-- Main Content Area -->
    <div class="main-content">
      <router-view />
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import Sidebar from '../components/Sidebar.vue'

const authStore = useAuthStore()

onMounted(() => {
  console.log('=== GYM ADMIN COMPONENT MOUNTED ===')
  console.log('This is the proper gym admin dashboard')
  console.log('Current route:', window.location.pathname)
  console.log('Auth state:', {
    isAuthenticated: authStore.isAuthenticated,
    role: authStore.role,
    user: authStore.user?.name
  })
})
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