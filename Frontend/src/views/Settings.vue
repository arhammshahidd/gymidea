<template>
  <div class="settings-page">
    <div class="page-header">
      <h1>Settings</h1>
      <p>Manage your gym settings and preferences</p>
    </div>

    <div class="page-content">
      <div class="settings-tabs">
        <button 
          v-for="tab in tabs" 
          :key="tab.key"
          @click="activeTab = tab.key"
          :class="['tab-btn', { active: activeTab === tab.key }]"
        >
          {{ tab.name }}
        </button>
      </div>

      <div class="settings-content">
        <!-- Profile Settings -->
        <div v-if="activeTab === 'profile'" class="settings-section">
          <h3>Profile Settings</h3>
          <form @submit.prevent="updateProfile">
            <div class="form-group">
              <label>Name:</label>
              <input v-model="profileForm.name" type="text" required />
            </div>
            <div class="form-group">
              <label>Email:</label>
              <input v-model="profileForm.email" type="email" required />
            </div>
            <div class="form-group">
              <label>Phone:</label>
              <input v-model="profileForm.phone" type="text" required />
            </div>
            <button type="submit" :disabled="loading" class="btn-primary">
              {{ loading ? 'Updating...' : 'Update Profile' }}
            </button>
          </form>
        </div>

        <!-- Appearance -->
        <div v-if="activeTab === 'appearance'" class="settings-section">
          <h3>Appearance</h3>
          <div class="setting-item">
            <label>Theme</label>
            <div style="display:flex; gap:12px; align-items:center;">
              <button class="btn-primary" @click="setTheme('light')" :disabled="currentTheme==='light'">Light Mode</button>
              <button class="btn-primary" @click="setTheme('dark')" :disabled="currentTheme==='dark'">Dark Mode</button>
            </div>
            <p class="text-muted">Theme preference is saved per user account.</p>
          </div>
        </div>
        <!-- Security Settings -->
        <div v-if="activeTab === 'security'" class="settings-section">
          <h3>Security Settings</h3>
          <form @submit.prevent="updatePassword">
            <div class="form-group">
              <label>Current Password:</label>
              <input v-model="passwordForm.currentPassword" type="password" required />
            </div>
            <div class="form-group">
              <label>New Password:</label>
              <input v-model="passwordForm.newPassword" type="password" required />
            </div>
            <div class="form-group">
              <label>Confirm New Password:</label>
              <input v-model="passwordForm.confirmPassword" type="password" required />
            </div>
            <button type="submit" :disabled="loading" class="btn-primary">
              {{ loading ? 'Updating...' : 'Update Password' }}
            </button>
          </form>
        </div>

        <!-- Gym Settings -->
        <div v-if="activeTab === 'gym'" class="settings-section">
          <h3>Gym Settings</h3>
          <form @submit.prevent="updateGymSettings">
            <div class="form-group">
              <label>Gym Name:</label>
              <input v-model="gymForm.name" type="text" required />
            </div>
            <div class="form-group">
              <label>Address:</label>
              <textarea v-model="gymForm.address" rows="3" required></textarea>
            </div>
            <div class="form-group">
              <label>Phone:</label>
              <input v-model="gymForm.phone" type="text" required />
            </div>
            <div class="form-group">
              <label>Email:</label>
              <input v-model="gymForm.email" type="email" required />
            </div>
            <div class="form-group">
              <label>Operating Hours:</label>
              <div class="hours-grid">
                <div class="hour-input">
                  <label>Monday - Friday:</label>
                  <input v-model="gymForm.weekdayHours" type="text" placeholder="6:00 AM - 10:00 PM" />
                </div>
                <div class="hour-input">
                  <label>Saturday:</label>
                  <input v-model="gymForm.saturdayHours" type="text" placeholder="8:00 AM - 8:00 PM" />
                </div>
                <div class="hour-input">
                  <label>Sunday:</label>
                  <input v-model="gymForm.sundayHours" type="text" placeholder="9:00 AM - 6:00 PM" />
                </div>
              </div>
            </div>
            <button type="submit" :disabled="loading" class="btn-primary">
              {{ loading ? 'Updating...' : 'Update Gym Settings' }}
            </button>
          </form>
        </div>

        <!-- Notifications -->
        <div v-if="activeTab === 'notifications'" class="settings-section">
          <h3>Notification Settings</h3>
          <div class="notification-settings">
            <div class="setting-item">
              <label>
                <input type="checkbox" v-model="notificationSettings.emailNotifications" />
                Email Notifications
              </label>
              <p>Receive notifications via email</p>
            </div>
            <div class="setting-item">
              <label>
                <input type="checkbox" v-model="notificationSettings.smsNotifications" />
                SMS Notifications
              </label>
              <p>Receive notifications via SMS</p>
            </div>
            <div class="setting-item">
              <label>
                <input type="checkbox" v-model="notificationSettings.paymentReminders" />
                Payment Reminders
              </label>
              <p>Get reminded about pending payments</p>
            </div>
            <div class="setting-item">
              <label>
                <input type="checkbox" v-model="notificationSettings.sessionReminders" />
                Session Reminders
              </label>
              <p>Get reminded about upcoming training sessions</p>
            </div>
          </div>
          <button @click="updateNotifications" :disabled="loading" class="btn-primary">
            {{ loading ? 'Updating...' : 'Update Notifications' }}
          </button>
        </div>

        <!-- System Settings -->
        <div v-if="activeTab === 'system'" class="settings-section">
          <h3>System Settings</h3>
          <div class="system-settings">
            <div class="setting-item">
              <label>Timezone:</label>
              <select v-model="systemSettings.timezone">
                <option value="UTC">UTC</option>
                <option value="EST">Eastern Time</option>
                <option value="PST">Pacific Time</option>
                <option value="CST">Central Time</option>
                <option value="MST">Mountain Time</option>
              </select>
            </div>
            <div class="setting-item">
              <label>Date Format:</label>
              <select v-model="systemSettings.dateFormat">
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>
            <div class="setting-item">
              <label>Currency:</label>
              <select v-model="systemSettings.currency">
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CAD">CAD (C$)</option>
              </select>
            </div>
            <div class="setting-item">
              <label>Language:</label>
              <select v-model="systemSettings.language">
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
              </select>
            </div>
          </div>
          <button @click="updateSystemSettings" :disabled="loading" class="btn-primary">
            {{ loading ? 'Updating...' : 'Update System Settings' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()

const loading = ref(false)
const activeTab = ref('profile')

const tabs = [
  { key: 'profile', name: 'Profile' },
  { key: 'security', name: 'Security' },
  { key: 'gym', name: 'Gym Settings' },
  { key: 'notifications', name: 'Notifications' },
  { key: 'system', name: 'System' },
  { key: 'appearance', name: 'Appearance' }
]

const profileForm = ref({
  name: '',
  email: '',
  phone: ''
})

const passwordForm = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const gymForm = ref({
  name: '',
  address: '',
  phone: '',
  email: '',
  weekdayHours: '',
  saturdayHours: '',
  sundayHours: ''
})

const notificationSettings = ref({
  emailNotifications: true,
  smsNotifications: false,
  paymentReminders: true,
  sessionReminders: true
})

const systemSettings = ref({
  timezone: 'UTC',
  dateFormat: 'MM/DD/YYYY',
  currency: 'USD',
  language: 'en'
})

const currentTheme = ref('light')

onMounted(() => {
  loadSettings()
  loadUserTheme()
})

const loadSettings = () => {
  // Load current user data
  if (authStore.user) {
    profileForm.value = {
      name: authStore.user.name || '',
      email: authStore.user.email || '',
      phone: authStore.user.phone || ''
    }
  }
  
  // TODO: Load other settings from API
}

const updateProfile = async () => {
  loading.value = true
  
  try {
    // TODO: Implement API call
    console.log('Updating profile:', profileForm.value)
    
    // Mock success
    setTimeout(() => {
      loading.value = false
      alert('Profile updated successfully!')
    }, 1000)
  } catch (error) {
    console.error('Error updating profile:', error)
    loading.value = false
  }
}

const updatePassword = async () => {
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    alert('New passwords do not match!')
    return
  }
  
  loading.value = true
  
  try {
    // TODO: Implement API call
    console.log('Updating password')
    
    // Mock success
    setTimeout(() => {
      loading.value = false
      passwordForm.value = {
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }
      alert('Password updated successfully!')
    }, 1000)
  } catch (error) {
    console.error('Error updating password:', error)
    loading.value = false
  }
}

const updateGymSettings = async () => {
  loading.value = true
  
  try {
    // TODO: Implement API call
    console.log('Updating gym settings:', gymForm.value)
    
    // Mock success
    setTimeout(() => {
      loading.value = false
      alert('Gym settings updated successfully!')
    }, 1000)
  } catch (error) {
    console.error('Error updating gym settings:', error)
    loading.value = false
  }
}

const updateNotifications = async () => {
  loading.value = true
  
  try {
    // TODO: Implement API call
    console.log('Updating notifications:', notificationSettings.value)
    
    // Mock success
    setTimeout(() => {
      loading.value = false
      alert('Notification settings updated successfully!')
    }, 1000)
  } catch (error) {
    console.error('Error updating notifications:', error)
    loading.value = false
  }
}

const updateSystemSettings = async () => {
  loading.value = true
  
  try {
    // TODO: Implement API call
    console.log('Updating system settings:', systemSettings.value)
    
    // Mock success
    setTimeout(() => {
      loading.value = false
      alert('System settings updated successfully!')
    }, 1000)
  } catch (error) {
    console.error('Error updating system settings:', error)
    loading.value = false
  }
}

const loadUserTheme = () => {
  if (authStore.user) {
    const userThemeKey = `theme_${authStore.user.id}_${authStore.user.role}`
    const savedTheme = localStorage.getItem(userThemeKey)
    if (savedTheme) {
      currentTheme.value = savedTheme
      applyTheme(savedTheme)
    } else {
      // Default to light theme if no saved preference
      currentTheme.value = 'light'
      applyTheme('light')
    }
  }
}

const applyTheme = (mode) => {
  const root = document.documentElement
  if (mode === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

const setTheme = (mode) => {
  if (authStore.user) {
    const userThemeKey = `theme_${authStore.user.id}_${authStore.user.role}`
    currentTheme.value = mode
    applyTheme(mode)
    localStorage.setItem(userThemeKey, mode)
  }
}
</script>

<style scoped>
.settings-page {
  padding: 2rem;
  max-width: 1000px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 2rem;
}

.page-header h1 {
  color: #333;
  margin-bottom: 0.5rem;
}

.page-header p {
  color: #666;
  font-size: 1.1rem;
}

.settings-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 2rem;
  border-bottom: 1px solid #eee;
}

.tab-btn {
  padding: 1rem 1.5rem;
  border: none;
  background: none;
  cursor: pointer;
  font-weight: 500;
  color: #666;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: #333;
}

.tab-btn.active {
  color: #007bff;
  border-bottom-color: #007bff;
}

.settings-content {
  background: white;
  padding: 2rem;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.settings-section h3 {
  margin: 0 0 1.5rem 0;
  color: #333;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #333;
}

.form-group input, .form-group textarea, .form-group select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 1rem;
}

.hours-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.hour-input label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #333;
}

.hour-input input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 1rem;
}

.notification-settings, .system-settings {
  margin-bottom: 2rem;
}

.setting-item {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
}

.setting-item label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  color: #333;
  margin-bottom: 0.5rem;
}

.setting-item p {
  margin: 0;
  color: #666;
  font-size: 0.9rem;
}

.setting-item select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 1rem;
}

.btn-primary {
  padding: 0.75rem 1.5rem;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-primary:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .settings-page {
    padding: 1rem;
  }
  
  .settings-tabs {
    flex-wrap: wrap;
  }
  
  .tab-btn {
    padding: 0.75rem 1rem;
    font-size: 0.9rem;
  }
  
  .settings-content {
    padding: 1rem;
  }
  
  .hours-grid {
    grid-template-columns: 1fr;
  }
}
</style>
