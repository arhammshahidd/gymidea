<template>
  <div class="super-admin">
    <header class="header">
      <h1>Super Admin Dashboard</h1>
      <button @click="logout" class="logout-btn">Logout</button>
    </header>

    <div class="dashboard">
      <div class="stats">
        <div class="stat-card">
          <h3>Total Gyms</h3>
          <p>{{ gyms.length }}</p>
        </div>
        <div class="stat-card">
          <h3>Total Gym Admins</h3>
          <p>{{ gymAdmins.length }}</p>
        </div>
      </div>

      <div class="actions">
        <button @click="showCreateGym = true" class="action-btn">Create New Gym</button>
        <button @click="fetchGymAdmins" class="action-btn">Refresh Data</button>
      </div>

      <!-- Create Gym Modal -->
      <div v-if="showCreateGym" class="modal">
        <div class="modal-content">
          <h3>Create New Gym</h3>
          <form @submit.prevent="createGym">
            <div class="form-group">
              <label>Gym Name:</label>
              <input v-model="newGym.name" type="text" required />
            </div>
            <div class="form-group">
              <label>Contact Number:</label>
              <input v-model="newGym.contact_number" type="text" required />
            </div>
            <div class="form-group">
              <label>Email:</label>
              <input v-model="newGym.email" type="email" required />
            </div>
            <div class="form-group">
              <label>Admin Name:</label>
              <input v-model="newGym.admin.name" type="text" required />
            </div>
            <div class="form-group">
              <label>Admin Phone:</label>
              <input v-model="newGym.admin.phone" type="text" required />
            </div>
            <div class="form-group">
              <label>Admin Email:</label>
              <input v-model="newGym.admin.email" type="email" required />
            </div>
            <div class="form-group">
              <label>Admin Password:</label>
              <input v-model="newGym.admin.password" type="password" required />
            </div>
            <div class="form-actions">
              <button type="submit" :disabled="loading">Create Gym</button>
              <button type="button" @click="showCreateGym = false">Cancel</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Gyms List -->
      <div class="gyms-section">
        <h2>Gyms</h2>
        <div v-if="loading" class="loading">Loading...</div>
        <div v-else class="gyms-grid">
          <div v-for="gym in gyms" :key="gym.id" class="gym-card">
            <h3>{{ gym.name }}</h3>
            <p>Contact: {{ gym.contact_number }}</p>
            <p>Email: {{ gym.email }}</p>
            <div class="gym-actions">
              <button @click="editGym(gym)" class="btn-small">Edit</button>
              <button @click="deleteGym(gym.id)" class="btn-small danger">Delete</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Gym Admins List -->
      <div class="admins-section">
        <h2>Gym Admins</h2>
        <div v-if="loading" class="loading">Loading...</div>
        <div v-else class="admins-grid">
          <div v-for="admin in gymAdmins" :key="admin.id" class="admin-card">
            <h3>{{ admin.name }}</h3>
            <p>Gym: {{ admin.gym_name }}</p>
            <p>Phone: {{ admin.phone }}</p>
            <p>Email: {{ admin.email }}</p>
            <p><strong>Status:</strong> 
              <span :class="admin.is_blocked ? 'status-blocked' : 'status-active'">
                {{ admin.is_blocked ? 'Blocked' : 'Active' }}
              </span>
            </p>
            <div class="admin-actions">
              <button @click="editAdmin(admin)" class="btn-small">Edit</button>
              <button 
                @click="toggleBlock(admin)" 
                :class="admin.is_blocked ? 'btn-small success' : 'btn-small warning'"
              >
                {{ admin.is_blocked ? 'Unblock' : 'Block' }}
              </button>
              <button @click="deleteAdmin(admin.id)" class="btn-small danger">Delete</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Admin Modal -->
    <div v-if="showEditModal" class="modal">
      <div class="modal-content">
        <h3>Edit Gym Admin</h3>
        <form @submit.prevent="updateAdmin">
          <div class="form-group">
            <label>Gym Name:</label>
            <input v-model="editForm.gym_name" type="text" required />
          </div>
          <div class="form-group">
            <label>Admin Name:</label>
            <input v-model="editForm.name" type="text" required />
          </div>
          <div class="form-group">
            <label>Email:</label>
            <input v-model="editForm.email" type="email" required />
          </div>
          <div class="form-group">
            <label>Phone:</label>
            <input v-model="editForm.phone" type="text" required />
          </div>
          <div class="form-group">
            <label>Password (leave blank to keep current):</label>
            <input v-model="editForm.password" type="password" />
          </div>
          <div class="form-group">
            <label>Permissions:</label>
            <div class="permissions">
              <label v-for="permission in availablePermissions" :key="permission">
                <input 
                  type="checkbox" 
                  :value="permission" 
                  v-model="editForm.permissions"
                />
                {{ permission }}
              </label>
            </div>
          </div>
          <div class="form-actions">
            <button type="submit" :disabled="loading">Save Changes</button>
            <button type="button" @click="closeEditModal">Cancel</button>
          </div>
        </form>
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

const loading = ref(false)
const showCreateGym = ref(false)
const gyms = ref([])
const gymAdmins = ref([])

const newGym = ref({
  name: '',
  contact_number: '',
  email: '',
  admin: {
    name: '',
    phone: '',
    email: '',
    password: ''
  }
})

onMounted(() => {
  fetchGyms()
  fetchGymAdmins()
})

const fetchGyms = async () => {
  const result = await gymStore.fetchGyms()
  if (result.success) {
    gyms.value = result.data
  }
}

const fetchGymAdmins = async () => {
  const result = await gymStore.fetchGymAdmins()
  if (result.success) {
    gymAdmins.value = result.data
  }
}

const createGym = async () => {
  loading.value = true
  const result = await gymStore.createGym(newGym.value)
  if (result.success) {
    gyms.value.push(result.data.gym)
    gymAdmins.value.push(result.data.gymAdmin)
    showCreateGym.value = false
    newGym.value = {
      name: '',
      contact_number: '',
      email: '',
      admin: {
        name: '',
        phone: '',
        email: '',
        password: ''
      }
    }
  }
  loading.value = false
}

const editGym = (gym) => {
  // TODO: Implement edit gym functionality
  console.log('Edit gym:', gym)
}

const deleteGym = async (id) => {
  if (confirm('Are you sure you want to delete this gym?')) {
    const result = await gymStore.deleteGym(id)
    if (result.success) {
      gyms.value = gyms.value.filter(gym => gym.id !== id)
    }
  }
}

const showEditModal = ref(false)
const editForm = ref({
  id: null,
  gym_name: '',
  name: '',
  email: '',
  phone: '',
  password: '',
  permissions: []
})

const availablePermissions = [
  'Dashboard',
  'Trainer Management',
  'User Management',
  'Trainer Scheduler',
  'Food Menu',
  'Payment Status',
  'Settings'
]

const editAdmin = (admin) => {
  editForm.value = {
    id: admin.id,
    gym_name: admin.gym_name,
    name: admin.name,
    email: admin.email,
    phone: admin.phone,
    password: '',
    permissions: admin.permissions || []
  }
  showEditModal.value = true
}

const updateAdmin = async () => {
  loading.value = true
  try {
    const updateData = { ...editForm.value }
    if (!updateData.password) {
      delete updateData.password
    }
    
    const response = await fetch(`http://localhost:5000/api/superadmin/gym-admins/${editForm.value.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify(updateData)
    })
    
    if (response.ok) {
      await fetchGymAdmins()
      showEditModal.value = false
    }
  } catch (error) {
    console.error('Error updating admin:', error)
  } finally {
    loading.value = false
  }
}

const closeEditModal = () => {
  showEditModal.value = false
  editForm.value = {
    id: null,
    gym_name: '',
    name: '',
    email: '',
    phone: '',
    password: '',
    permissions: []
  }
}

const toggleBlock = async (admin) => {
  try {
    if (admin.is_blocked) {
      // Unblock - just update the status
      const response = await fetch(`http://localhost:5000/api/superadmin/gym-admins/${admin.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authStore.token}`
        },
        body: JSON.stringify({ is_blocked: false })
      })
    } else {
      // Block - logout admin and users
      const response = await fetch(`http://localhost:5000/api/superadmin/gym-admins/${admin.id}/logout-users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authStore.token}`
        }
      })
    }
    await fetchGymAdmins()
  } catch (error) {
    console.error('Error toggling block status:', error)
  }
}

const deleteAdmin = async (id) => {
  if (confirm('Are you sure you want to delete this admin?')) {
    const result = await gymStore.deleteGymAdmin(id)
    if (result.success) {
      gymAdmins.value = gymAdmins.value.filter(admin => admin.id !== id)
    }
  }
}

const logout = () => {
  authStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.super-admin {
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

.gyms-section, .admins-section {
  background: white;
  padding: 1.5rem;
  border-radius: 10px;
  margin-bottom: 2rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.gyms-grid, .admins-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.gym-card, .admin-card {
  border: 1px solid #ddd;
  padding: 1rem;
  border-radius: 5px;
}

.gym-actions, .admin-actions {
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

.btn-small:not(.danger):not(.warning) {
  background: #3498db;
  color: white;
}

.btn-small.warning {
  background: #f39c12;
  color: white;
}

.btn-small.danger {
  background: #e74c3c;
  color: white;
}

.btn-small.success {
  background: #27ae60;
  color: white;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #666;
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
  font-size: 0.9rem;
}

.status-active {
  color: #27ae60;
  font-weight: bold;
}

.status-blocked {
  color: #e74c3c;
  font-weight: bold;
}
</style>
