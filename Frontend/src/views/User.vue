<template>
  <div class="user">
    <header class="header">
      <h1>Gym Member Dashboard</h1>
      <div class="user-info">
        <span>Welcome, {{ authStore.user?.name }}</span>
        <button @click="logout" class="logout-btn">Logout</button>
      </div>
    </header>

    <div class="dashboard">
      <div class="stats">
        <div class="stat-card">
          <h3>Membership Status</h3>
          <p class="status" :class="authStore.user?.status?.toLowerCase()">
            {{ authStore.user?.status }}
          </p>
        </div>
        <div class="stat-card">
          <h3>Membership Tier</h3>
          <p class="tier">{{ authStore.user?.membership_tier }}</p>
        </div>
        <div class="stat-card">
          <h3>Gym ID</h3>
          <p>{{ authStore.user?.gym_id }}</p>
        </div>
      </div>

      <div class="content">
        <div class="section">
          <h2>My Profile</h2>
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
              <strong>Membership Tier:</strong> {{ authStore.user?.membership_tier }}
            </div>
            <div class="profile-item">
              <strong>Status:</strong> 
              <span class="status" :class="authStore.user?.status?.toLowerCase()">
                {{ authStore.user?.status }}
              </span>
            </div>
          </div>
        </div>

        <div class="section">
          <h2>Available Services</h2>
          <div class="services-grid">
            <div class="service-card">
              <h3>🏋️ Workout Plans</h3>
              <p>Access personalized workout routines</p>
              <button class="service-btn">View Plans</button>
            </div>
            
            <div class="service-card">
              <h3>📅 Class Booking</h3>
              <p>Book fitness classes and sessions</p>
              <button class="service-btn">Book Classes</button>
            </div>
            
            <div class="service-card">
              <h3>🍎 Nutrition Guide</h3>
              <p>Get personalized nutrition advice</p>
              <button class="service-btn">View Guide</button>
            </div>
            
            <div class="service-card">
              <h3>📊 Progress Tracking</h3>
              <p>Track your fitness progress</p>
              <button class="service-btn">View Progress</button>
            </div>
            
            <div class="service-card">
              <h3>👨‍💼 Personal Trainer</h3>
              <p>Connect with personal trainers</p>
              <button class="service-btn">Find Trainer</button>
            </div>
            
            <div class="service-card">
              <h3>💳 Payment</h3>
              <p>Manage your membership payments</p>
              <button class="service-btn">Manage Payment</button>
            </div>
          </div>
        </div>

        <div class="section">
          <h2>Quick Actions</h2>
          <div class="quick-actions">
            <button class="quick-btn">Check-in to Gym</button>
            <button class="quick-btn">View Schedule</button>
            <button class="quick-btn">Contact Support</button>
            <button class="quick-btn">Update Profile</button>
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

const logout = () => {
  authStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.user {
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
  text-align: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.status {
  padding: 0.3rem 0.8rem;
  border-radius: 15px;
  font-size: 0.8rem;
  font-weight: bold;
  text-transform: uppercase;
}

.status.active {
  background: #d4edda;
  color: #155724;
}

.status.inactive {
  background: #f8d7da;
  color: #721c24;
}

.status.suspended {
  background: #fff3cd;
  color: #856404;
}

.tier {
  font-weight: bold;
  color: #3498db;
  font-size: 1.1rem;
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
  display: flex;
  align-items: center;
}

.profile-item:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.profile-item strong {
  color: #495057;
  margin-right: 0.5rem;
  min-width: 120px;
}

.services-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.service-card {
  border: 1px solid #ddd;
  padding: 1.5rem;
  border-radius: 8px;
  text-align: center;
  transition: transform 0.2s, box-shadow 0.2s;
}

.service-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.service-card h3 {
  margin-bottom: 0.5rem;
  color: #333;
  font-size: 1.1rem;
}

.service-card p {
  color: #666;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.service-btn {
  background: #27ae60;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 5px;
  cursor: pointer;
  transition: background 0.2s;
}

.service-btn:hover {
  background: #229954;
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.quick-btn {
  background: #3498db;
  color: white;
  border: none;
  padding: 0.75rem 1rem;
  border-radius: 5px;
  cursor: pointer;
  transition: background 0.2s;
}

.quick-btn:hover {
  background: #2980b9;
}
</style>
