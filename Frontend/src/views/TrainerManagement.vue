<template>
  <div class="trainer-management-page">
    <q-card flat bordered class="q-pa-md q-mb-md">
      <div class="text-h5">Trainer Management</div>
      <div class="text-caption">Manage your gym trainers and their permissions</div>
    </q-card>

    <div class="page-content">
      <q-card flat bordered class="q-pa-md q-mb-md">
        <div class="row q-gutter-sm">
          <q-btn color="primary" label="Add New Trainer" @click="showCreateTrainer = true" unelevated />
          <q-btn color="secondary" label="Refresh" @click="fetchTrainers" flat />
        </div>
      </q-card>

      <div v-if="loading" class="loading">Loading trainers...</div>
      
      <div v-else-if="trainers.length === 0" class="no-trainers">
        <p>No trainers found. Add your first trainer!</p>
      </div>

      <div v-else>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-md-6 col-lg-4" v-for="trainer in trainers" :key="trainer.id">
            <q-card flat bordered class="q-pa-md">
              <div class="row items-center justify-between q-mb-sm">
                <div class="text-subtitle1">{{ trainer.name }}</div>
                <q-badge :color="(trainer.status||'').toLowerCase()==='active' ? 'positive' : 'negative'">
                  {{ trainer.status || 'Active' }}
                </q-badge>
              </div>
              <div class="q-mb-sm">
                <div class="text-caption">Email: {{ trainer.email }}</div>
                <div class="text-caption">Phone: {{ trainer.phone }}</div>
                <div class="text-caption">Gym ID: {{ trainer.gym_id }}</div>
              </div>
              <div class="q-mb-sm">
                <div class="text-caption q-mb-xs">Permissions:</div>
                <div class="row q-gutter-xs">
                  <q-badge v-for="p in trainer.permissions || []" :key="p" color="blue-grey" outline>{{ p }}</q-badge>
                  <span v-if="!trainer.permissions?.length" class="text-caption text-muted">No permissions assigned</span>
                </div>
              </div>
              <div class="row justify-end q-gutter-xs">
                <q-btn size="sm" color="primary" flat label="Edit" @click="editTrainer(trainer)" />
                <q-btn size="sm" color="negative" flat label="Delete" @click="deleteTrainer(trainer.id)" />
              </div>
            </q-card>
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
