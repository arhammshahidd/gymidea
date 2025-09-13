<template>
  <div class="trainer-management-page">
    <div class="page-header">
      <h1>Trainer Management</h1>
      <p>Manage your gym trainers and their permissions</p>
    </div>

    <div class="page-content">
      <div class="content-header">
        <button @click="showCreateTrainer = true" class="btn-primary">Add New Trainer</button>
        <button @click="fetchTrainers" class="btn-secondary">Refresh</button>
      </div>

      <div v-if="loading" class="loading">Loading trainers...</div>
      
      <div v-else-if="trainers.length === 0" class="no-trainers">
        <p>No trainers found. Add your first trainer!</p>
      </div>

      <div v-else class="trainers-grid">
        <div v-for="trainer in trainers" :key="trainer.id" class="trainer-card">
          <div class="trainer-header">
            <h3>{{ trainer.name }}</h3>
            <span class="trainer-status" :class="trainer.status?.toLowerCase()">
              {{ trainer.status || 'Active' }}
            </span>
          </div>
          
          <div class="trainer-info">
            <p><strong>Email:</strong> {{ trainer.email }}</p>
            <p><strong>Phone:</strong> {{ trainer.phone }}</p>
            <p><strong>Gym ID:</strong> {{ trainer.gym_id }}</p>
          </div>

          <div class="trainer-permissions">
            <h4>Permissions:</h4>
            <div class="permissions-list">
              <span 
                v-for="permission in trainer.permissions || []" 
                :key="permission" 
                class="permission-tag"
              >
                {{ permission }}
              </span>
              <span v-if="!trainer.permissions?.length" class="no-permissions">
                No permissions assigned
              </span>
            </div>
          </div>

          <div class="trainer-actions">
            <button @click="editTrainer(trainer)" class="btn-small">Edit</button>
            <button @click="deleteTrainer(trainer.id)" class="btn-small danger">Delete</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Create/Edit Trainer Modal -->
    <div v-if="showCreateTrainer || showEditTrainer" class="modal">
      <div class="modal-content">
        <h3>{{ showCreateTrainer ? 'Add New Trainer' : 'Edit Trainer' }}</h3>
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
          <div class="form-actions">
            <button type="submit" :disabled="loading">
              {{ loading ? 'Saving...' : (showCreateTrainer ? 'Create Trainer' : 'Update Trainer') }}
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
import { useAuthStore } from '../stores/auth'
import { useGymStore } from '../stores/gym'

const authStore = useAuthStore()
const gymStore = useGymStore()

const loading = ref(false)
const showCreateTrainer = ref(false)
const showEditTrainer = ref(false)
const trainers = ref([])
const editingTrainer = ref(null)

const trainerForm = ref({
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
.trainer-management-page {
  padding: 2rem;
  max-width: 1200px;
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

.content-header {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
}

.btn-primary, .btn-secondary, .btn-small {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover {
  background: #0056b3;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #545b62;
}

.btn-small {
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
}

.btn-small.danger {
  background: #dc3545;
  color: white;
}

.btn-small.danger:hover {
  background: #c82333;
}

.trainers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}

.trainer-card {
  background: white;
  padding: 1.5rem;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.trainer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.trainer-header h3 {
  margin: 0;
  color: #333;
}

.trainer-status {
  padding: 0.25rem 0.75rem;
  border-radius: 15px;
  font-size: 0.8rem;
  font-weight: 500;
  text-transform: uppercase;
}

.trainer-status.active {
  background: #d4edda;
  color: #155724;
}

.trainer-info {
  margin-bottom: 1rem;
}

.trainer-info p {
  margin: 0.5rem 0;
  color: #666;
}

.trainer-permissions {
  margin-bottom: 1.5rem;
}

.trainer-permissions h4 {
  margin: 0 0 0.5rem 0;
  color: #333;
  font-size: 0.9rem;
}

.permissions-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.permission-tag {
  background: #e9ecef;
  color: #495057;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
}

.no-permissions {
  color: #6c757d;
  font-style: italic;
  font-size: 0.8rem;
}

.trainer-actions {
  display: flex;
  gap: 0.5rem;
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

.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 1rem;
}

.permissions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
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
  justify-content: flex-end;
  margin-top: 1.5rem;
}

.loading, .no-trainers {
  text-align: center;
  padding: 2rem;
  color: #666;
}

@media (max-width: 768px) {
  .trainer-management-page {
    padding: 1rem;
  }
  
  .trainers-grid {
    grid-template-columns: 1fr;
  }
  
  .content-header {
    flex-direction: column;
  }
}
</style>
