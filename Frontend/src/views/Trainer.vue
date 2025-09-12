<template>
  <div class="trainer">
    <header class="header">
      <h1>Trainer Dashboard</h1>
      <div class="user-info">
        <span>Welcome, {{ authStore.user?.name }}</span>
        <button @click="logout" class="logout-btn">Logout</button>
      </div>
    </header>

    <div class="dashboard">
      <div class="stats">
        <div class="stat-card">
          <h3>My Permissions</h3>
          <div class="permissions">
            <span v-for="permission in authStore.user?.permissions" :key="permission" class="permission-tag">
              {{ permission }}
            </span>
          </div>
        </div>
        <div class="stat-card">
          <h3>Gym ID</h3>
          <p>{{ authStore.gymId }}</p>
        </div>
      </div>

      <div class="content">
        <div class="section">
          <h2>Available Actions</h2>
          <div class="actions-grid">
            <div v-if="hasPermission('users')" class="action-card">
              <h3>User Management</h3>
              <p>Manage gym members and their profiles</p>
              <button class="action-btn">Manage Users</button>
            </div>
            
            <div v-if="hasPermission('classes')" class="action-card">
              <h3>Class Management</h3>
              <p>Create and manage fitness classes</p>
              <button class="action-btn">Manage Classes</button>
            </div>
            
            <div v-if="hasPermission('schedule')" class="action-card">
              <h3>Schedule Management</h3>
              <p>Manage training schedules and appointments</p>
              <button class="action-btn">Manage Schedule</button>
            </div>
            
            <div v-if="hasPermission('nutrition')" class="action-card">
              <h3>Nutrition Plans</h3>
              <p>Create and manage nutrition plans for members</p>
              <button class="action-btn">Manage Nutrition</button>
            </div>
            
            <div v-if="hasPermission('equipment')" class="action-card">
              <h3>Equipment Management</h3>
              <p>Manage gym equipment and maintenance</p>
              <button class="action-btn">Manage Equipment</button>
            </div>
            
            <div v-if="hasPermission('reports')" class="action-card">
              <h3>Reports</h3>
              <p>View training reports and analytics</p>
              <button class="action-btn">View Reports</button>
            </div>
          </div>
        </div>

        <div class="section">
          <h2>Profile Information</h2>
          <div class="profile-card">
            <div class="profile-item">
              <strong>Name:</strong> {{ authStore.user?.name }}
            </div>
            <div class="profile-item">
              <strong>Phone:</strong> {{ authStore.user?.phone }}
            </div>
            <div class="profile-item">
              <strong>Email:</strong> {{ authStore.user?.email }}
            </div>
            <div class="profile-item">
              <strong>Role:</strong> {{ authStore.user?.role }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()

const hasPermission = (permission) => {
  return authStore.user?.permissions?.includes(permission) || false
}

const logout = () => {
  authStore.logout()
  router.push('/trainer-login')
}
</script>

<style scoped>
.trainer {
  min-height: 100vh;
  background: #f5f5f5;
}

.header {
  background: white;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.logout-btn {
  background: #e74c3c;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 5px;
  cursor: pointer;
}

.dashboard {
  padding: 2rem;
}

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  padding: 1.5rem;
  border-radius: 10px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.permissions {
  margin-top: 1rem;
}

.permission-tag {
  background: #e3f2fd;
  color: #1976d2;
  padding: 0.3rem 0.6rem;
  border-radius: 15px;
  font-size: 0.8rem;
  margin-right: 0.5rem;
  margin-bottom: 0.5rem;
  display: inline-block;
}

.content {
  display: grid;
  gap: 2rem;
}

.section {
  background: white;
  padding: 1.5rem;
  border-radius: 10px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.action-card {
  border: 1px solid #ddd;
  padding: 1.5rem;
  border-radius: 8px;
  text-align: center;
  transition: transform 0.2s, box-shadow 0.2s;
}

.action-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.action-card h3 {
  margin-bottom: 0.5rem;
  color: #333;
}

.action-card p {
  color: #666;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.action-btn {
  background: #3498db;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 5px;
  cursor: pointer;
  transition: background 0.2s;
}

.action-btn:hover {
  background: #2980b9;
}

.profile-card {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  margin-top: 1rem;
}

.profile-item {
  margin-bottom: 0.5rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid #e9ecef;
}

.profile-item:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.profile-item strong {
  color: #495057;
  margin-right: 0.5rem;
}
</style>
