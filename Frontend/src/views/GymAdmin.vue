<template>
  <div class="gym-admin">
    <header class="header">
      <h1>Gym Admin Dashboard</h1>
      <div class="user-info">
        <span>Welcome, {{ authStore.user?.name }}</span>
        <button @click="logout" class="logout-btn">Logout</button>
      </div>
    </header>

    <div class="dashboard">
      <div class="stats">
        <div class="stat-card">
          <h3>Total Trainers</h3>
          <p>{{ trainers.length }}</p>
        </div>
        <div class="stat-card">
          <h3>Gym ID</h3>
          <p>{{ authStore.gymId }}</p>
        </div>
        <div class="stat-card">
          <h3>Your Permissions</h3>
          <p>{{ authStore.user?.permissions?.length || 0 }} modules</p>
        </div>
      </div>

      <!-- Permissions Section -->
      <div class="permissions-section">
        <h2>Your Module Permissions</h2>
        <div class="permissions-grid">
          <div 
            v-for="permission in authStore.user?.permissions || []" 
            :key="permission" 
            class="permission-card"
          >
            <h4>{{ permission }}</h4>
            <span class="permission-status">✓ Enabled</span>
          </div>
          <div v-if="!authStore.user?.permissions?.length" class="no-permissions">
            <p>No permissions assigned</p>
          </div>
        </div>
      </div>

      <div class="actions">
        <button @click="showCreateTrainer = true" class="action-btn">Add New Trainer</button>
        <button @click="fetchTrainers" class="action-btn">Refresh Trainers</button>
      </div>

      <!-- Create Trainer Modal -->
      <div v-if="showCreateTrainer" class="modal">
        <div class="modal-content">
          <h3>Add New Trainer</h3>
          <form @submit.prevent="createTrainer">
            <div class="form-group">
              <label>Trainer Name:</label>
              <input v-model="newTrainer.name" type="text" required />
            </div>
            <div class="form-group">
              <label>Phone:</label>
              <input v-model="newTrainer.phone" type="text" required />
            </div>
            <div class="form-group">
              <label>Email:</label>
              <input v-model="newTrainer.email" type="email" required />
            </div>
            <div class="form-group">
              <label>Password:</label>
              <input v-model="newTrainer.password" type="password" required />
            </div>
            <div class="form-group">
              <label>Permissions (from your available modules):</label>
              <div v-if="authStore.user?.permissions?.length" class="permissions-info">
                <p class="permissions-note">You can assign any of your {{ authStore.user.permissions.length }} available modules to this trainer:</p>
              </div>
              <div class="permissions">
                <label v-for="permission in authStore.user?.permissions || []" :key="permission">
                  <input 
                    type="checkbox" 
                    :value="permission" 
                    v-model="newTrainer.permissions"
                  />
                  {{ permission }}
                </label>
                <div v-if="!authStore.user?.permissions?.length" class="no-permissions-available">
                  <p>No permissions available to assign. Contact Super Admin.</p>
                </div>
              </div>
            </div>
            <div class="form-actions">
              <button type="submit" :disabled="loading">Add Trainer</button>
              <button type="button" @click="showCreateTrainer = false">Cancel</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Trainers List -->
      <div class="trainers-section">
        <h2>Trainers</h2>
        <div v-if="loading" class="loading">Loading...</div>
        <div v-else-if="trainers.length === 0" class="no-data">
          <p>No trainers found. Add your first trainer!</p>
        </div>
        <div v-else class="trainers-grid">
          <div v-for="trainer in trainers" :key="trainer.id" class="trainer-card">
            <h3>{{ trainer.name }}</h3>
            <p>Phone: {{ trainer.phone }}</p>
            <p>Email: {{ trainer.email }}</p>
            <div class="permissions">
              <strong>Permissions:</strong>
              <span v-for="permission in trainer.permissions" :key="permission" class="permission-tag">
                {{ permission }}
              </span>
            </div>
            <div class="trainer-actions">
              <button @click="editTrainer(trainer)" class="btn-small">Edit</button>
              <button @click="deleteTrainer(trainer.id)" class="btn-small danger">Delete</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useGymStore } from '../stores/gym'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const gymStore = useGymStore()
const router = useRouter()

// Debug permissions
console.log('=== GYM ADMIN COMPONENT DEBUG ===');
console.log('Auth store user:', authStore.user);
console.log('Auth store user permissions:', authStore.user?.permissions);
console.log('Auth store role:', authStore.role);
console.log('Auth store gymId:', authStore.gymId);

const loading = ref(false)
const showCreateTrainer = ref(false)
const trainers = ref([])

// Permissions are now taken from the Gym Admin's own permissions
// const availablePermissions = authStore.user?.permissions || []

const newTrainer = ref({
  name: '',
  phone: '',
  email: '',
  password: '',
  permissions: []
})

onMounted(() => {
  fetchTrainers()
})

const fetchTrainers = async () => {
  const result = await gymStore.fetchTrainers()
  if (result.success) {
    trainers.value = result.data
  }
}

const createTrainer = async () => {
  loading.value = true
  
  console.log('=== CREATING TRAINER ===');
  console.log('Trainer data:', newTrainer.value);
  console.log('Gym Admin permissions:', authStore.user?.permissions);
  console.log('Trainer permissions being assigned:', newTrainer.value.permissions);
  
  const result = await gymStore.createTrainer(newTrainer.value)
  if (result.success) {
    console.log('Trainer created successfully:', result.data);
    trainers.value.push(result.data)
    showCreateTrainer.value = false
    newTrainer.value = {
      name: '',
      phone: '',
      email: '',
      password: '',
      permissions: []
    }
  } else {
    console.error('Failed to create trainer:', result.message);
  }
  loading.value = false
}

const editTrainer = (trainer) => {
  // TODO: Implement edit trainer functionality
  console.log('Edit trainer:', trainer)
}

const deleteTrainer = async (id) => {
  if (confirm('Are you sure you want to delete this trainer?')) {
    const result = await gymStore.deleteTrainer(id)
    if (result.success) {
      trainers.value = trainers.value.filter(trainer => trainer.id !== id)
    }
  }
}

const logout = () => {
  authStore.logout()
  router.push('/gymadmin-login')
}
</script>

<style scoped>
.gym-admin {
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

.actions {
  margin-bottom: 2rem;
}

.action-btn {
  background: #3498db;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 5px;
  cursor: pointer;
  margin-right: 1rem;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 10px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.form-group input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 5px;
  box-sizing: border-box;
}

.permissions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.permissions label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: normal;
}

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
}

.form-actions button {
  flex: 1;
  padding: 0.75rem;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}

.form-actions button[type="submit"] {
  background: #27ae60;
  color: white;
}

.permissions-section {
  background: white;
  padding: 1.5rem;
  border-radius: 10px;
  margin-bottom: 2rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.permissions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.permission-card {
  border: 2px solid #27ae60;
  padding: 1rem;
  border-radius: 8px;
  background: #f8fff8;
  text-align: center;
}

.permission-card h4 {
  margin: 0 0 0.5rem 0;
  color: #27ae60;
  font-size: 1rem;
}

.permission-status {
  color: #27ae60;
  font-weight: bold;
  font-size: 0.9rem;
}

.no-permissions {
  grid-column: 1 / -1;
  text-align: center;
  padding: 2rem;
  color: #666;
  font-style: italic;
}

.permissions-info {
  margin-bottom: 0.5rem;
}

.permissions-note {
  font-size: 0.9rem;
  color: #666;
  font-style: italic;
  margin: 0;
}

.no-permissions-available {
  text-align: center;
  padding: 1rem;
  color: #e74c3c;
  font-style: italic;
  background: #fdf2f2;
  border: 1px solid #fecaca;
  border-radius: 5px;
  margin-top: 0.5rem;
}

.trainers-section {
  background: white;
  padding: 1.5rem;
  border-radius: 10px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.trainers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.trainer-card {
  border: 1px solid #ddd;
  padding: 1rem;
  border-radius: 5px;
}

.permission-tag {
  background: #e3f2fd;
  color: #1976d2;
  padding: 0.2rem 0.5rem;
  border-radius: 3px;
  font-size: 0.8rem;
  margin-right: 0.5rem;
  margin-top: 0.5rem;
  display: inline-block;
}

.trainer-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.btn-small {
  padding: 0.25rem 0.5rem;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.8rem;
}

.btn-small:not(.danger) {
  background: #3498db;
  color: white;
}

.btn-small.danger {
  background: #e74c3c;
  color: white;
}

.loading, .no-data {
  text-align: center;
  padding: 2rem;
  color: #666;
}
</style>
