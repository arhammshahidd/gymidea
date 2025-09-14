<template>
  <div class="user-management">
    <div class="header">
      <h2>User Management</h2>
      <button @click="showCreateUser = true" class="btn-primary">Add New User</button>
    </div>

    <!-- Statistics Cards -->
    <div class="stats-grid">
      <div class="stat-card">
        <h3>Total Users</h3>
        <div class="stat-number">{{ userStore.stats.totalUsers }}</div>
      </div>
      <div class="stat-card">
        <h3>Active Users</h3>
        <div class="stat-number">{{ userStore.stats.totalActiveUsers }}</div>
      </div>
      <div class="stat-card">
        <h3>Inactive Users</h3>
        <div class="stat-number">{{ userStore.stats.totalInactiveUsers }}</div>
      </div>
      <div class="stat-card">
        <h3>Basic Members</h3>
        <div class="stat-number">{{ userStore.stats.totalBasicMemberships }}</div>
      </div>
      <div class="stat-card">
        <h3>Premium Members</h3>
        <div class="stat-number">{{ userStore.stats.totalPremiumMemberships }}</div>
      </div>
    </div>

    <!-- Users Table -->
    <div class="users-section">
      <div class="section-header">
        <h3>Users List</h3>
        <div class="loading" v-if="userStore.loading">Loading...</div>
      </div>

      <div v-if="userStore.error" class="error-message">
        {{ userStore.error }}
        <button @click="userStore.clearError()" class="btn-small">Dismiss</button>
      </div>

      <div v-if="!userStore.loading && userStore.users.length === 0" class="no-users">
        <p>No users found. Create your first user!</p>
      </div>

      <div v-else class="users-table">
        <table>
          <thead>
            <tr>
              <th>User ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Membership</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in userStore.users" :key="user.id">
              <td class="user-id-cell">
                <span class="user-id-badge">#{{ user.id }}</span>
              </td>
              <td>{{ user.name }}</td>
              <td>{{ user.email }}</td>
              <td>{{ user.phone }}</td>
              <td>
                <span :class="['status-badge', user.status.toLowerCase()]">
                  {{ user.status }}
                </span>
              </td>
              <td>
                <span :class="['membership-badge', user.membership_tier.toLowerCase()]">
                  {{ user.membership_tier }}
                </span>
              </td>
              <td>{{ new Date(user.created_at).toLocaleDateString() }}</td>
              <td class="actions">
                <button @click="editUser(user)" class="btn-small">Edit</button>
                <button @click="logoutUser(user.id)" class="btn-small warning">Logout</button>
                <button @click="deleteUser(user.id)" class="btn-small danger">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create/Edit User Modal -->
    <div v-if="showCreateUser || showEditUser" class="modal">
      <div class="modal-content">
        <h3>{{ showCreateUser ? 'Add New User' : 'Edit User' }}</h3>
        <form @submit.prevent="handleSubmit">
          <div class="form-group">
            <label>Name:</label>
            <input v-model="userForm.name" type="text" required />
          </div>
          <div class="form-group">
            <label>Email:</label>
            <input v-model="userForm.email" type="email" required />
          </div>
          <div class="form-group">
            <label>Phone:</label>
            <input v-model="userForm.phone" type="text" required />
          </div>
          <div class="form-group">
            <label>Password:</label>
            <input v-model="userForm.password" type="password" :required="showCreateUser" />
            <small v-if="showEditUser">Leave empty to keep current password</small>
          </div>
          <div class="form-group">
            <label>Status:</label>
            <select v-model="userForm.status">
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
          <div class="form-group">
            <label>Membership:</label>
            <select v-model="userForm.membership_tier">
              <option value="BASIC">Basic</option>
              <option value="PREMIUM">Premium</option>
            </select>
          </div>
          <div class="form-actions">
            <button type="submit" :disabled="userStore.loading">
              {{ userStore.loading ? 'Saving...' : (showCreateUser ? 'Create User' : 'Update User') }}
            </button>
            <button type="button" @click="closeModal">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useUserManagementStore } from '../stores/userManagement'

const userStore = useUserManagementStore()

const showCreateUser = ref(false)
const showEditUser = ref(false)
const editingUser = ref(null)

const userForm = ref({
  name: '',
  email: '',
  phone: '',
  password: '',
  status: 'ACTIVE',
  membership_tier: 'BASIC'
})

onMounted(async () => {
  console.log('=== USER MANAGEMENT COMPONENT MOUNTED ===')
  await userStore.fetchUserStats()
  await userStore.fetchUsers()
})

const editUser = (user) => {
  console.log('Editing user:', user)
  editingUser.value = user
  userForm.value = {
    name: user.name,
    email: user.email,
    phone: user.phone,
    password: '',
    status: user.status,
    membership_tier: user.membership_tier
  }
  showEditUser.value = true
}

const closeModal = () => {
  showCreateUser.value = false
  showEditUser.value = false
  editingUser.value = null
  userForm.value = {
    name: '',
    email: '',
    phone: '',
    password: '',
    status: 'ACTIVE',
    membership_tier: 'BASIC'
  }
}

const handleSubmit = async () => {
  console.log('=== SUBMITTING USER FORM ===')
  console.log('Form data:', userForm.value)
  console.log('Is creating:', showCreateUser.value)
  console.log('Is editing:', showEditUser.value)

  try {
    let result
    if (showCreateUser.value) {
      result = await userStore.createUser(userForm.value)
    } else {
      // Remove empty password for updates
      const updateData = { ...userForm.value }
      if (!updateData.password) {
        delete updateData.password
      }
      result = await userStore.updateUser(editingUser.value.id, updateData)
    }

    if (result.success) {
      console.log('User operation successful:', result)
      closeModal()
    } else {
      console.error('User operation failed:', result.message)
    }
  } catch (error) {
    console.error('Error in handleSubmit:', error)
  }
}

const logoutUser = async (userId) => {
  console.log('=== LOGGING OUT USER ===', userId)
  if (confirm('Are you sure you want to logout this user from the mobile app?')) {
    const result = await userStore.logoutUser(userId)
    if (result.success) {
      console.log('User logged out successfully')
    } else {
      console.error('Failed to logout user:', result.message)
    }
  }
}

const deleteUser = async (userId) => {
  console.log('=== DELETING USER ===', userId)
  if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
    const result = await userStore.deleteUser(userId)
    if (result.success) {
      console.log('User deleted successfully')
    } else {
      console.error('Failed to delete user:', result.message)
    }
  }
}
</script>

<style scoped>
.user-management {
  padding: 1.5rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.header h2 {
  color: #333;
  margin: 0;
}

.stats-grid {
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
  text-align: center;
}

.stat-card h3 {
  margin: 0 0 0.5rem 0;
  color: #666;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-number {
  font-size: 2rem;
  font-weight: bold;
  color: #333;
}

.users-section {
  background: white;
  padding: 1.5rem;
  border-radius: 10px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.users-table {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid #eee;
}

th {
  background: #f8f9fa;
  font-weight: 600;
  color: #333;
}

.user-id-cell {
  width: 80px;
  text-align: center;
}

.user-id-badge {
  background: #e9ecef;
  color: #495057;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  font-family: 'Courier New', monospace;
}

.status-badge, .membership-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
  text-transform: uppercase;
}

.status-badge.active {
  background: #d4edda;
  color: #155724;
}

.status-badge.inactive {
  background: #f8d7da;
  color: #721c24;
}

.membership-badge.basic {
  background: #d1ecf1;
  color: #0c5460;
}

.membership-badge.premium {
  background: #fff3cd;
  color: #856404;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.btn-primary, .btn-small, .btn-small.warning, .btn-small.danger {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover {
  background: #0056b3;
}

.btn-small {
  background: #6c757d;
  color: white;
  padding: 0.25rem 0.5rem;
  font-size: 0.8rem;
}

.btn-small:hover {
  background: #545b62;
}

.btn-small.warning {
  background: #ffc107;
  color: #212529;
}

.btn-small.warning:hover {
  background: #e0a800;
}

.btn-small.danger {
  background: #dc3545;
  color: white;
}

.btn-small.danger:hover {
  background: #c82333;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 10px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #333;
}

.form-group input, .form-group select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 1rem;
}

.form-group small {
  color: #666;
  font-size: 0.8rem;
}

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
}

.error-message {
  background: #f8d7da;
  color: #721c24;
  padding: 1rem;
  border-radius: 5px;
  margin-bottom: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.no-users {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.loading {
  color: #007bff;
  font-weight: 500;
}

/* Responsive Design */
@media (max-width: 768px) {
  .users-table {
    font-size: 0.9rem;
  }
  
  .user-id-cell {
    width: 60px;
  }
  
  .user-id-badge {
    font-size: 0.7rem;
    padding: 0.2rem 0.4rem;
  }
  
  th, td {
    padding: 0.5rem 0.25rem;
  }
  
  .actions {
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .btn-small {
    font-size: 0.7rem;
    padding: 0.2rem 0.4rem;
  }
}

@media (max-width: 480px) {
  .users-table {
    font-size: 0.8rem;
  }
  
  .user-id-cell {
    width: 50px;
  }
  
  .user-id-badge {
    font-size: 0.6rem;
    padding: 0.15rem 0.3rem;
  }
  
  th, td {
    padding: 0.4rem 0.2rem;
  }
}
</style>
