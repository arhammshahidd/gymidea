<template>
  <div class="trainer-management-page">
    <!-- Header Section with Gradient -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-text">
          <h1 class="page-title">
            <q-icon name="fitness_center" class="title-icon" />
            Trainer Management
          </h1>
          <p class="page-subtitle">Manage your gym trainers and their permissions</p>
        </div>
        <div class="header-stats">
          <div class="stat-card">
            <div class="stat-number">{{ trainers.length }}</div>
            <div class="stat-label">Total Trainers</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">{{ activeTrainers }}</div>
            <div class="stat-label">Active</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Action Bar -->
    <div class="action-bar">
      <div class="action-content">
        <div class="search-section">
          <q-input
            v-model="searchQuery"
            placeholder="Search trainers..."
            outlined
            dense
            class="search-input"
          >
            <template v-slot:prepend>
              <q-icon name="search" color="primary" />
            </template>
          </q-input>
        </div>
        <div class="action-buttons">
          <q-btn
            color="primary"
            label="Add New Trainer"
            icon="person_add"
            @click="showCreateTrainer = true"
            class="add-btn"
            unelevated
          />
          <q-btn
            color="secondary"
            label="Refresh"
            icon="refresh"
            @click="fetchTrainers"
            flat
            class="refresh-btn"
          />
        </div>
      </div>
    </div>

    <!-- Content Area -->
    <div class="content-area">
      <div v-if="loading" class="loading-state">
        <q-spinner-dots size="50px" color="primary" />
        <p>Loading trainers...</p>
      </div>
      
      <div v-else-if="filteredTrainers.length === 0" class="empty-state">
        <q-icon name="person_off" size="80px" color="grey-5" />
        <h3>No trainers found</h3>
        <p>{{ searchQuery ? 'No trainers match your search criteria.' : 'Add your first trainer to get started!' }}</p>
        <q-btn
          v-if="!searchQuery"
          color="primary"
          label="Add First Trainer"
          icon="person_add"
          @click="showCreateTrainer = true"
          unelevated
        />
      </div>

      <div v-else class="trainers-grid">
        <div
          v-for="trainer in filteredTrainers"
          :key="trainer.id"
          class="trainer-card"
        >
          <div class="trainer-card-header">
            <div class="trainer-avatar">
              <q-avatar size="50px" color="primary" text-color="white">
                {{ trainer.name.charAt(0).toUpperCase() }}
              </q-avatar>
            </div>
            <div class="trainer-info">
              <h3 class="trainer-name">{{ trainer.name }}</h3>
              <p class="trainer-email">{{ trainer.email }}</p>
            </div>
            <div class="trainer-status">
              <q-badge
                :color="(trainer.status||'').toLowerCase()==='active' ? 'positive' : 'negative'"
                class="status-badge"
              >
                {{ trainer.status || 'Active' }}
              </q-badge>
            </div>
          </div>

          <div class="trainer-details">
            <div class="detail-item">
              <q-icon name="phone" color="grey-6" size="16px" />
              <span>{{ trainer.phone }}</span>
            </div>
            <div class="detail-item">
              <q-icon name="business" color="grey-6" size="16px" />
              <span>Gym ID: {{ trainer.gym_id }}</span>
            </div>
          </div>

          <div class="permissions-section">
            <h4 class="permissions-title">Permissions</h4>
            <div class="permissions-list">
              <q-chip
                v-for="permission in trainer.permissions || []"
                :key="permission"
                color="blue-grey-1"
                text-color="blue-grey-8"
                size="sm"
                class="permission-chip"
              >
                {{ permission }}
              </q-chip>
              <div v-if="!trainer.permissions?.length" class="no-permissions">
                <q-icon name="lock" color="grey-5" size="16px" />
                <span>No permissions assigned</span>
              </div>
            </div>
          </div>

          <div class="trainer-actions">
            <q-btn
              color="primary"
              icon="edit"
              size="sm"
              flat
              @click="editTrainer(trainer)"
              class="action-btn"
            >
              <q-tooltip>Edit Trainer</q-tooltip>
            </q-btn>
            <q-btn
              color="negative"
              icon="delete"
              size="sm"
              flat
              @click="deleteTrainer(trainer.id)"
              class="action-btn"
            >
              <q-tooltip>Delete Trainer</q-tooltip>
            </q-btn>
          </div>
        </div>
      </div>
    </div>

    <!-- Create/Edit Trainer Modal -->
    <q-dialog v-model="showCreateTrainer">
      <q-card style="min-width: 500px">
        <q-card-section class="text-h6">Add New Trainer</q-card-section>
        <q-card-section>
          <form @submit.prevent="handleSubmit">
          <div class="form-group">
            <label>Trainer Name:</label>
            <input v-model="trainerForm.name" type="text" required />
          </div>
          <div class="form-group">
            <label>Phone:</label>
            <input v-model="trainerForm.phone" type="text" required />
          </div>
          <div class="form-group">
            <label>Email:</label>
            <input v-model="trainerForm.email" type="email" required />
          </div>
          <div class="form-group">
            <label>Password:</label>
            <input v-model="trainerForm.password" type="password" :required="showCreateTrainer" />
            <small v-if="showEditTrainer">Leave empty to keep current password</small>
          </div>
          <div class="form-group">
            <label>Permissions (from your available modules):</label>
            <div class="permissions">
              <label v-for="permission in authStore.user?.permissions || []" :key="permission">
                <input 
                  type="checkbox" 
                  :value="permission" 
                  v-model="trainerForm.permissions"
                />
                {{ permission }}
              </label>
            </div>
          </div>
          <div class="row justify-end q-gutter-sm q-mt-md">
            <q-btn flat label="Cancel" v-close-popup />
            <q-btn color="primary" type="submit" :loading="loading" :label="loading ? 'Saving...' : 'Create Trainer'" />
          </div>
          </form>
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showEditTrainer">
      <q-card style="min-width: 500px">
        <q-card-section class="text-h6">Edit Trainer</q-card-section>
        <q-card-section>
          <form @submit.prevent="handleSubmit">
            <div class="form-group">
              <label>Trainer Name:</label>
              <input v-model="trainerForm.name" type="text" required />
            </div>
            <div class="form-group">
              <label>Phone:</label>
              <input v-model="trainerForm.phone" type="text" required />
            </div>
            <div class="form-group">
              <label>Email:</label>
              <input v-model="trainerForm.email" type="email" required />
            </div>
            <div class="form-group">
              <label>Password:</label>
              <input v-model="trainerForm.password" type="password" />
              <small>Leave empty to keep current password</small>
            </div>
            <div class="form-group">
              <label>Permissions (from your available modules):</label>
              <div class="permissions">
                <label v-for="permission in authStore.user?.permissions || []" :key="permission">
                  <input type="checkbox" :value="permission" v-model="trainerForm.permissions" />
                  {{ permission }}
                </label>
              </div>
            </div>
            <div class="row justify-end q-gutter-sm q-mt-md">
              <q-btn flat label="Cancel" v-close-popup />
              <q-btn color="primary" type="submit" :loading="loading" :label="loading ? 'Saving...' : 'Update Trainer'" />
            </div>
          </form>
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useGymStore } from '../stores/gym'

const authStore = useAuthStore()
const gymStore = useGymStore()

const loading = ref(false)
const showCreateTrainer = ref(false)
const showEditTrainer = ref(false)
const trainers = ref([])
const editingTrainer = ref(null)
const searchQuery = ref('')

const trainerForm = ref({
  name: '',
  phone: '',
  email: '',
  password: '',
  permissions: []
})

// Computed properties
const activeTrainers = computed(() => {
  return trainers.value.filter(trainer => 
    (trainer.status || '').toLowerCase() === 'active'
  ).length
})

const filteredTrainers = computed(() => {
  if (!searchQuery.value) return trainers.value
  
  const query = searchQuery.value.toLowerCase()
  return trainers.value.filter(trainer => 
    trainer.name.toLowerCase().includes(query) ||
    trainer.email.toLowerCase().includes(query) ||
    trainer.phone.toLowerCase().includes(query) ||
    (trainer.permissions || []).some(p => p.toLowerCase().includes(query))
  )
})

onMounted(() => {
  fetchTrainers()
})

const fetchTrainers = async () => {
  loading.value = true
  const result = await gymStore.fetchTrainers()
  if (result.success) {
    trainers.value = result.data
  }
  loading.value = false
}

const editTrainer = (trainer) => {
  editingTrainer.value = trainer
  trainerForm.value = {
    name: trainer.name,
    phone: trainer.phone,
    email: trainer.email,
    password: '',
    permissions: trainer.permissions || []
  }
  showEditTrainer.value = true
}

const closeModal = () => {
  showCreateTrainer.value = false
  showEditTrainer.value = false
  editingTrainer.value = null
  trainerForm.value = {
    name: '',
    phone: '',
    email: '',
    password: '',
    permissions: []
  }
}

const handleSubmit = async () => {
  loading.value = true
  
  try {
    let result
    if (showCreateTrainer.value) {
      result = await gymStore.createTrainer(trainerForm.value)
    } else {
      const updateData = { ...trainerForm.value }
      if (!updateData.password) {
        delete updateData.password
      }
      result = await gymStore.updateTrainer(editingTrainer.value.id, updateData)
    }

    if (result.success) {
      closeModal()
      await fetchTrainers()
    }
  } catch (error) {
    console.error('Error saving trainer:', error)
  } finally {
    loading.value = false
  }
}

const deleteTrainer = async (id) => {
  if (confirm('Are you sure you want to delete this trainer?')) {
    const result = await gymStore.deleteTrainer(id)
    if (result.success) {
      await fetchTrainers()
    }
  }
}
</script>

<style scoped>
/* Main Container */
.trainer-management-page {
  min-height: 100vh;
  background: #f8f9fa;
  padding: 0;
}

/* Header Section */
.page-header {
  background: #ffffff;
  padding: 2rem 0;
  color: #2c3e50;
  position: relative;
  border-bottom: 1px solid #e9ecef;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
  z-index: 1;
}

.header-text {
  flex: 1;
}

.page-title {
  font-size: 2.5rem;
  font-weight: 700;
  margin: 0 0 0.5rem 0;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.title-icon {
  font-size: 2.5rem;
  color: #DF8A35;
}

.page-subtitle {
  font-size: 1.1rem;
  color: #6c757d;
  margin: 0;
  font-weight: 400;
}

.header-stats {
  display: flex;
  gap: 1.5rem;
}

.stat-card {
  background: #ffffff;
  border: 1px solid #e9ecef;
  border-radius: 15px;
  padding: 1.5rem;
  text-align: center;
  min-width: 120px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.stat-number {
  font-size: 2rem;
  font-weight: 700;
  color: #DF8A35;
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.9rem;
  color: #6c757d;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Action Bar */
.action-bar {
  background: white;
  padding: 1.5rem 0;
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
}

.action-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 2rem;
}

.search-section {
  flex: 1;
  max-width: 400px;
}

.search-input {
  border-radius: 25px;
}

.action-buttons {
  display: flex;
  gap: 1rem;
}

.add-btn {
  background: #DF8A35;
  border-radius: 25px;
  padding: 0.75rem 2rem;
  font-weight: 600;
  text-transform: none;
  box-shadow: 0 4px 15px rgba(223, 138, 53, 0.3);
  transition: all 0.3s ease;
}

.add-btn:hover {
  background: #c77a2e;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(223, 138, 53, 0.4);
}

.refresh-btn {
  border-radius: 25px;
  padding: 0.75rem 1.5rem;
  font-weight: 600;
  text-transform: none;
}

/* Content Area */
.content-area {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: #666;
}

.loading-state p {
  margin-top: 1rem;
  font-size: 1.1rem;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  background: white;
  border-radius: 20px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}

.empty-state h3 {
  color: #333;
  margin: 1rem 0 0.5rem 0;
  font-size: 1.5rem;
}

.empty-state p {
  color: #666;
  margin-bottom: 2rem;
  font-size: 1.1rem;
}

/* Trainers Grid */
.trainers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 2rem;
}

/* Trainer Card */
.trainer-card {
  background: white;
  border-radius: 20px;
  padding: 2rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
  border: 1px solid #e9ecef;
  position: relative;
  overflow: hidden;
}

.trainer-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: #DF8A35;
}

.trainer-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
}

.trainer-card-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.trainer-avatar {
  flex-shrink: 0;
}

.trainer-info {
  flex: 1;
}

.trainer-name {
  font-size: 1.3rem;
  font-weight: 600;
  color: #2c3e50;
  margin: 0 0 0.25rem 0;
}

.trainer-email {
  color: #6c757d;
  margin: 0;
  font-size: 0.9rem;
}

.trainer-status {
  flex-shrink: 0;
}

.status-badge {
  border-radius: 20px;
  padding: 0.5rem 1rem;
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.8rem;
  letter-spacing: 0.5px;
}

/* Trainer Details */
.trainer-details {
  margin-bottom: 1.5rem;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
  color: #6c757d;
  font-size: 0.9rem;
}

/* Permissions Section */
.permissions-section {
  margin-bottom: 2rem;
}

.permissions-title {
  font-size: 1rem;
  font-weight: 600;
  color: #2c3e50;
  margin: 0 0 1rem 0;
}

.permissions-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.permission-chip {
  border-radius: 15px;
  font-weight: 500;
}

.no-permissions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #999;
  font-style: italic;
  font-size: 0.9rem;
}

/* Trainer Actions */
.trainer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding-top: 1rem;
  border-top: 1px solid #f0f0f0;
}

.action-btn {
  border-radius: 10px;
  transition: all 0.3s ease;
}

.action-btn:hover {
  transform: scale(1.1);
}

/* Modal Styles */
.q-card {
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.q-card-section {
  padding: 2rem;
}

.text-h6 {
  font-weight: 600;
  color: #333;
  margin-bottom: 1rem;
}

/* Form Styles */
.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #333;
}

.form-group input {
  width: 100%;
  padding: 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  font-size: 1rem;
  transition: all 0.3s ease;
}

.form-group input:focus {
  outline: none;
  border-color: #DF8A35;
  box-shadow: 0 0 0 3px rgba(223, 138, 53, 0.1);
}

.permissions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: 200px;
  overflow-y: auto;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 10px;
}

.permissions label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-weight: normal;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 8px;
  transition: background-color 0.3s ease;
}

.permissions label:hover {
  background: rgba(223, 138, 53, 0.1);
}

/* Responsive Design */
@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    gap: 2rem;
    text-align: center;
  }
  
  .header-stats {
    justify-content: center;
  }
  
  .action-content {
    flex-direction: column;
    gap: 1rem;
  }
  
  .search-section {
    max-width: none;
  }
  
  .action-buttons {
    width: 100%;
    justify-content: center;
  }
  
  .trainers-grid {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  
  .trainer-card {
    padding: 1.5rem;
  }
  
  .content-area {
    padding: 1rem;
  }
  
  .page-title {
    font-size: 2rem;
  }
  
  .title-icon {
    font-size: 2rem;
  }
}

@media (max-width: 480px) {
  .page-header {
    padding: 1.5rem 0;
  }
  
  .header-content {
    padding: 0 1rem;
  }
  
  .page-title {
    font-size: 1.8rem;
  }
  
  .stat-card {
    padding: 1rem;
    min-width: 100px;
  }
  
  .stat-number {
    font-size: 1.5rem;
  }
  
  .trainer-card-header {
    flex-direction: column;
    text-align: center;
    gap: 1rem;
  }
  
  .trainer-actions {
    justify-content: center;
  }
}
</style>
