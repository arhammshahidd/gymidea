<template>
  <div class="user-management">
    <!-- Header Section -->
    <q-card class="header-card q-mb-lg" elevated>
      <q-card-section class="q-pa-lg">
        <div class="row items-center justify-between">
          <div class="header-content">
            <div class="text-h4 text-weight-bold text-primary q-mb-xs">User Management</div>
            <div class="text-subtitle1 text-grey-6">Manage your gym members and their information</div>
          </div>
          <q-btn 
            color="primary" 
            label="Add New User" 
            icon="person_add"
            @click="showCreateUser = true" 
            unelevated
            class="add-user-btn"
            size="md"
          />
        </div>
      </q-card-section>
    </q-card>

    <!-- Statistics Cards -->
    <div class="stats-grid q-mb-xl">
      <q-card 
        v-for="card in statCards" 
        :key="card.label"
        class="stat-card"
        elevated
        :class="card.color"
      >
        <q-card-section class="q-pa-lg">
          <div class="row items-center no-wrap">
            <q-avatar 
              :color="card.iconColor" 
              text-color="white" 
              :icon="card.icon" 
              size="48px"
              class="q-mr-md"
            />
            <div class="stat-content">
              <div class="text-caption text-weight-medium text-grey-6 q-mb-xs">{{ card.label }}</div>
              <div class="text-h4 text-weight-bold">{{ card.value }}</div>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>

    <!-- Users Table Section -->
    <div class="users-section">
      <!-- Filters Card -->
      <q-card class="filters-card q-mb-lg" elevated>
        <q-card-section class="q-pa-lg">
          <div class="row items-center q-col-gutter-lg">
            <div class="col-12 col-md-4">
              <div class="text-h6 text-weight-bold text-primary q-mb-sm">Users List</div>
              <div class="text-caption text-grey-6" v-if="userStore.loading">
                <q-spinner-dots size="16px" class="q-mr-sm" />
                Loading users...
              </div>
            </div>
            <div class="col-12 col-md-4">
              <q-input 
                v-model="searchQuery" 
                outlined 
                placeholder="Search by name, email or phone"
                class="search-input"
                clearable
              >
                <template v-slot:prepend>
                  <q-icon name="search" color="primary" />
                </template>
              </q-input>
            </div>
            <div class="col-6 col-md-2">
              <q-select 
                v-model="statusFilter" 
                :options="statusOptions" 
                outlined 
                clearable 
                label="Status"
                class="filter-select"
                emit-value
                map-options
              />
            </div>
            <div class="col-6 col-md-2">
              <q-select 
                v-model="membershipFilter" 
                :options="membershipOptions" 
                outlined 
                clearable 
                label="Membership"
                class="filter-select"
                emit-value
                map-options
              />
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- Error Message -->
      <q-banner v-if="userStore.error" class="bg-negative text-white q-mb-md" rounded>
        <template v-slot:avatar>
          <q-icon name="error" />
        </template>
        {{ userStore.error }}
        <template v-slot:action>
          <q-btn flat label="Dismiss" @click="userStore.clearError()" />
        </template>
      </q-banner>

      <!-- Empty State -->
      <q-card v-if="!userStore.loading && userStore.users.length === 0" class="empty-state-card q-mb-lg" elevated>
        <q-card-section class="text-center q-pa-xl">
          <q-icon name="people_outline" size="64px" color="grey-5" class="q-mb-md" />
          <div class="text-h6 text-grey-7 q-mb-sm">No users found</div>
          <div class="text-body2 text-grey-6 q-mb-lg">Create your first user to get started!</div>
          <q-btn color="primary" label="Add New User" icon="person_add" @click="showCreateUser = true" />
        </q-card-section>
      </q-card>

      <!-- Users Table -->
      <q-card v-else class="table-card" elevated>
        <q-table
          :rows="filteredRows"
          :columns="columns"
          row-key="id"
          flat
          bordered
          :rows-per-page-options="[5,10,20,50]"
          class="users-table"
          :loading="userStore.loading"
          loading-label="Loading users..."
          no-data-label="No users found"
          rows-per-page-label="Records per page:"
        >
          <template v-slot:body-cell-id="props">
            <q-td :props="props" class="text-center">
              <q-badge color="primary" class="user-id-badge">#{{ props.row.id }}</q-badge>
            </q-td>
          </template>
          
          <template v-slot:body-cell-name="props">
            <q-td :props="props">
              <div class="user-name-cell">
                <q-avatar size="32px" color="primary" text-color="white" class="q-mr-sm">
                  {{ props.row.name ? props.row.name.charAt(0).toUpperCase() : 'U' }}
                </q-avatar>
                <span class="text-weight-medium">{{ props.row.name || 'N/A' }}</span>
              </div>
            </q-td>
          </template>
          
          <template v-slot:body-cell-email="props">
            <q-td :props="props">
              <div class="text-body2">{{ props.row.email || 'N/A' }}</div>
            </q-td>
          </template>
          
          <template v-slot:body-cell-phone="props">
            <q-td :props="props">
              <div class="text-body2">{{ props.row.phone || 'N/A' }}</div>
            </q-td>
          </template>
          
          <template v-slot:body-cell-status="props">
            <q-td :props="props" class="text-center">
              <q-badge 
                :color="(props.row.status||'').toLowerCase()==='active' ? 'positive' : 'negative'"
                class="status-badge"
              >
                <q-icon 
                  :name="(props.row.status||'').toLowerCase()==='active' ? 'check_circle' : 'cancel'"
                  class="q-mr-xs"
                />
                {{ props.row.status || 'Unknown' }}
              </q-badge>
            </q-td>
          </template>
          
          <template v-slot:body-cell-membership_tier="props">
            <q-td :props="props" class="text-center">
              <q-badge 
                :color="props.row.membership_tier==='PREMIUM' ? 'amber' : 'blue-grey'" 
                outline
                class="membership-badge"
              >
                <q-icon 
                  :name="props.row.membership_tier==='PREMIUM' ? 'star' : 'person'"
                  class="q-mr-xs"
                />
                {{ props.row.membership_tier || 'BASIC' }}
              </q-badge>
            </q-td>
          </template>
          
          <template v-slot:body-cell-actions="props">
            <q-td :props="props" class="text-center">
              <div class="action-buttons">
                <q-btn 
                  size="sm" 
                  color="primary" 
                  flat 
                  icon="edit"
                  @click="editUser(props.row)"
                  class="action-btn"
                >
                  <q-tooltip>Edit User</q-tooltip>
                </q-btn>
                <q-btn 
                  size="sm" 
                  color="orange" 
                  flat 
                  icon="logout"
                  @click="logoutUser(props.row.id)"
                  class="action-btn"
                >
                  <q-tooltip>Logout User</q-tooltip>
                </q-btn>
                <q-btn 
                  size="sm" 
                  color="negative" 
                  flat 
                  icon="delete"
                  @click="deleteUser(props.row.id)"
                  class="action-btn"
                >
                  <q-tooltip>Delete User</q-tooltip>
                </q-btn>
              </div>
            </q-td>
          </template>
        </q-table>
      </q-card>
    </div>

    <!-- Create/Edit User Modal -->
    <q-dialog v-model="showCreateUser">
      <q-card style="min-width: 500px">
        <q-card-section class="text-h6">Add New User</q-card-section>
        <q-card-section>
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
          <div class="row justify-end q-gutter-sm q-mt-md">
            <q-btn flat label="Cancel" v-close-popup />
            <q-btn color="primary" type="submit" :loading="userStore.loading" :label="userStore.loading ? 'Saving...' : 'Create User'" />
          </div>
          </form>
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showEditUser">
      <q-card style="min-width: 500px">
        <q-card-section class="text-h6">Edit User</q-card-section>
        <q-card-section>
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
              <input v-model="userForm.password" type="password" />
              <small>Leave empty to keep current password</small>
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
            <div class="row justify-end q-gutter-sm q-mt-md">
              <q-btn flat label="Cancel" v-close-popup />
              <q-btn color="primary" type="submit" :loading="userStore.loading" :label="userStore.loading ? 'Saving...' : 'Update User'" />
            </div>
          </form>
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
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

// KPI stat cards with enhanced styling
const statCards = computed(() => [
  { 
    label: 'Total Users', 
    value: userStore.stats?.totalUsers || 0,
    icon: 'people',
    iconColor: 'primary',
    color: 'stat-card-primary'
  },
  { 
    label: 'Active Users', 
    value: userStore.stats?.totalActiveUsers || 0,
    icon: 'check_circle',
    iconColor: 'positive',
    color: 'stat-card-success'
  },
  { 
    label: 'Inactive Users', 
    value: userStore.stats?.totalInactiveUsers || 0,
    icon: 'cancel',
    iconColor: 'negative',
    color: 'stat-card-danger'
  },
  { 
    label: 'Basic Members', 
    value: userStore.stats?.totalBasicMemberships || 0,
    icon: 'person',
    iconColor: 'info',
    color: 'stat-card-info'
  },
  { 
    label: 'Premium Members', 
    value: userStore.stats?.totalPremiumMemberships || 0,
    icon: 'star',
    iconColor: 'amber',
    color: 'stat-card-warning'
  }
])

// q-table columns mirroring previous table headers
const columns = [
  { name: 'id', label: 'User ID', field: 'id', align: 'left' },
  { name: 'name', label: 'Name', field: 'name', align: 'left' },
  { name: 'email', label: 'Email', field: 'email', align: 'left' },
  { name: 'phone', label: 'Phone', field: 'phone', align: 'left' },
  { name: 'status', label: 'Status', field: 'status', align: 'center' },
  { name: 'membership_tier', label: 'Membership', field: 'membership_tier', align: 'center' },
  { name: 'created_at', label: 'Created', field: row => new Date(row.created_at).toLocaleDateString(), align: 'left' },
  { name: 'actions', label: 'Actions', field: 'actions', align: 'right' }
]

// Filters / search
const searchQuery = ref('')
const statusFilter = ref(null)
const membershipFilter = ref(null)
const statusOptions = [
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Inactive', value: 'INACTIVE' }
]
const membershipOptions = [
  { label: 'Basic', value: 'BASIC' },
  { label: 'Premium', value: 'PREMIUM' }
]

const filteredRows = computed(() => {
  let rows = Array.isArray(userStore.users) ? [...userStore.users] : []
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    rows = rows.filter(u =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q)
    )
  }
  if (statusFilter.value) {
    rows = rows.filter(u => (u.status || '').toUpperCase() === statusFilter.value)
  }
  if (membershipFilter.value) {
    rows = rows.filter(u => (u.membership_tier || '').toUpperCase() === membershipFilter.value)
  }
  return rows
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
  padding: 24px;
  background: #f8f9fa;
  min-height: 100vh;
}

/* Header Card Styling */
.header-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(102, 126, 234, 0.3);
}

.header-card .q-card-section {
  background: transparent;
}

.header-content .text-h4 {
  color: white !important;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.header-content .text-subtitle1 {
  color: rgba(255, 255, 255, 0.9) !important;
}

.add-user-btn {
  background: rgba(255, 255, 255, 0.2) !important;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0.5px;
}

.add-user-btn:hover {
  background: rgba(255, 255, 255, 0.3) !important;
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

/* Statistics Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
}

.stat-card {
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--accent-color, #667eea), var(--accent-color-light, #764ba2));
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}

.stat-card-primary {
  --accent-color: #667eea;
  --accent-color-light: #764ba2;
}

.stat-card-success {
  --accent-color: #4caf50;
  --accent-color-light: #8bc34a;
}

.stat-card-danger {
  --accent-color: #f44336;
  --accent-color-light: #ff7043;
}

.stat-card-info {
  --accent-color: #2196f3;
  --accent-color-light: #03a9f4;
}

.stat-card-warning {
  --accent-color: #ff9800;
  --accent-color-light: #ffc107;
}

.stat-content .text-caption {
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.stat-content .text-h4 {
  margin-top: 8px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--accent-color), var(--accent-color-light));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Filters Card */
.filters-card {
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.search-input .q-field__control {
  border-radius: 12px;
  border: 2px solid #e0e0e0;
  transition: all 0.3s ease;
}

.search-input .q-field__control:hover {
  border-color: #667eea;
}

.search-input .q-field--focused .q-field__control {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.filter-select .q-field__control {
  border-radius: 12px;
  border: 2px solid #e0e0e0;
  transition: all 0.3s ease;
}

.filter-select .q-field__control:hover {
  border-color: #667eea;
}

.filter-select .q-field--focused .q-field__control {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

/* Table Card */
.table-card {
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.users-table {
  border-radius: 16px;
}

.users-table .q-table__top {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-bottom: 1px solid #dee2e6;
}

.users-table .q-table__bottom {
  background: #f8f9fa;
  border-top: 1px solid #dee2e6;
}

.users-table .q-table thead th {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-size: 0.85rem;
  border: none;
  padding: 16px 12px;
}

.users-table .q-table tbody tr {
  transition: all 0.2s ease;
}

.users-table .q-table tbody tr:hover {
  background: rgba(102, 126, 234, 0.05);
  transform: scale(1.01);
}

.users-table .q-table tbody td {
  padding: 16px 12px;
  border-bottom: 1px solid #f0f0f0;
  vertical-align: middle;
}

/* User Name Cell */
.user-name-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-name-cell .q-avatar {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

/* Badges */
.user-id-badge {
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
  font-weight: 700;
  letter-spacing: 0.5px;
  border-radius: 8px;
  padding: 6px 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.status-badge {
  border-radius: 20px;
  padding: 6px 12px;
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.membership-badge {
  border-radius: 20px;
  padding: 6px 12px;
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-width: 2px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* Action Buttons */
.action-buttons {
  display: flex;
  gap: 8px;
  justify-content: center;
  align-items: center;
}

.action-btn {
  border-radius: 8px;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* Empty State */
.empty-state-card {
  border-radius: 16px;
  border: 2px dashed #e0e0e0;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
}

.empty-state-card .q-icon {
  opacity: 0.6;
}

/* Responsive Design */
@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
  }
}

@media (max-width: 768px) {
  .user-management {
    padding: 16px;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  
  .stat-card .q-card-section {
    padding: 20px;
  }
  
  .header-card .q-card-section {
    padding: 20px;
  }
  
  .filters-card .q-card-section {
    padding: 20px;
  }
  
  .users-table .q-table thead th {
    padding: 12px 8px;
    font-size: 0.8rem;
  }
  
  .users-table .q-table tbody td {
    padding: 12px 8px;
  }
  
  .user-name-cell {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .action-buttons {
    flex-direction: column;
    gap: 4px;
  }
  
  .action-btn {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .user-management {
    padding: 12px;
  }
  
  .stats-grid {
    gap: 12px;
  }
  
  .stat-card .q-card-section {
    padding: 16px;
  }
  
  .header-card .q-card-section {
    padding: 16px;
  }
  
  .filters-card .q-card-section {
    padding: 16px;
  }
  
  .users-table .q-table thead th {
    padding: 10px 6px;
    font-size: 0.75rem;
  }
  
  .users-table .q-table tbody td {
    padding: 10px 6px;
  }
  
  .user-id-badge {
    font-size: 0.7rem;
    padding: 4px 8px;
  }
  
  .status-badge, .membership-badge {
    font-size: 0.7rem;
    padding: 4px 8px;
  }
}
</style>
