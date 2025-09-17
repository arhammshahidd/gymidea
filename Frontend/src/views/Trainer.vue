<template>
  <div class="gym-admin-layout">
    <Sidebar />
    <div class="main-content">
      <router-view :key="$route.fullPath" />
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'
import Sidebar from '../components/Sidebar.vue'

const authStore = useAuthStore()
const router = useRouter()

// Debug permissions
console.log('=== TRAINER COMPONENT DEBUG ===');
console.log('Auth store user:', authStore.user);
console.log('Auth store user permissions:', authStore.user?.permissions);
console.log('Auth store role:', authStore.role);
console.log('Auth store gymId:', authStore.gymId);

onMounted(() => {
  // Router handles the redirect to dashboard automatically
  console.log('Trainer component mounted')
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