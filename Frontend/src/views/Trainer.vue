<template>
  <div class="trainer">
    <!-- Navbar Component -->
    <Navbar />
    
    <!-- Main Content Area -->
    <div class="main-content">
      <router-view />
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'
import Navbar from '../components/Navbar.vue'

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
.trainer {
  min-height: 100vh;
  background: #f5f5f5;
}

.main-content {
  padding-top: 0; /* Navbar handles the top spacing */
}
</style>