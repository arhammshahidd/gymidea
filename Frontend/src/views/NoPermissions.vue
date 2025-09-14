<template>
  <div class="no-permissions-page">
    <div class="no-permissions-container">
      <div class="icon-section">
        <q-icon name="block" size="80px" color="grey-6" />
      </div>
      
      <div class="content-section">
        <h1 class="title">No Permissions Assigned</h1>
        <p class="subtitle">
          You don't have access to any modules yet. Please contact your Super Admin to assign permissions.
        </p>
        
        <div class="contact-info">
          <q-card class="contact-card">
            <q-card-section>
              <div class="contact-item">
                <q-icon name="admin_panel_settings" size="24px" color="primary" />
                <span>Contact Super Admin</span>
              </div>
              <p class="contact-text">
                Your Super Admin needs to assign module permissions to your account.
              </p>
            </q-card-section>
          </q-card>
        </div>
        
        <div class="actions">
          <q-btn 
            @click="logout" 
            color="primary" 
            label="Sign Out" 
            icon="logout"
            unelevated
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const logout = () => {
  console.log('=== LOGOUT FROM NO PERMISSIONS PAGE ===')
  authStore.logout()
  router.push('/gymadmin-login')
}
</script>

<style scoped>
.no-permissions-page {
  min-height: 100vh;
  background: #f8f9fa;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.no-permissions-container {
  max-width: 500px;
  width: 100%;
  text-align: center;
}

.icon-section {
  margin-bottom: 32px;
}

.content-section {
  background: white;
  border-radius: 16px;
  padding: 40px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  border: 1px solid #e9ecef;
}

.title {
  font-size: 28px;
  font-weight: 700;
  color: #2c3e50;
  margin: 0 0 16px 0;
  line-height: 1.2;
}

.subtitle {
  font-size: 16px;
  color: #6c757d;
  margin: 0 0 32px 0;
  line-height: 1.5;
}

.contact-info {
  margin-bottom: 32px;
}

.contact-card {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 12px;
}

.contact-item {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  font-weight: 600;
  color: #2c3e50;
  font-size: 16px;
}

.contact-text {
  color: #6c757d;
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
}

.actions {
  display: flex;
  justify-content: center;
  gap: 16px;
}
</style>
