<template>
  <div class="trainer-scheduler-page">
    <div class="page-header">
      <h1>Trainer Scheduler</h1>
      <p>Manage training sessions and schedules</p>
    </div>

    <div class="page-content">
      <div class="content-header">
        <button @click="showCreateSession = true" class="btn-primary">Schedule New Session</button>
        <div class="date-filter">
          <label>Filter by Date:</label>
          <input v-model="selectedDate" type="date" @change="filterSessions" />
        </div>
      </div>

      <div class="sessions-grid">
        <div v-for="session in filteredSessions" :key="session.id" class="session-card">
          <div class="session-header">
            <h3>{{ session.title }}</h3>
            <span class="session-status" :class="session.status?.toLowerCase()">
              {{ session.status || 'Scheduled' }}
            </span>
          </div>
          
          <div class="session-info">
            <p><strong>Trainer:</strong> {{ session.trainerName }}</p>
            <p><strong>Client:</strong> {{ session.clientName }}</p>
            <p><strong>Date:</strong> {{ formatDate(session.date) }}</p>
            <p><strong>Time:</strong> {{ session.startTime }} - {{ session.endTime }}</p>
            <p><strong>Duration:</strong> {{ session.duration }} minutes</p>
          </div>

          <div class="session-actions">
            <button @click="editSession(session)" class="btn-small">Edit</button>
            <button @click="cancelSession(session.id)" class="btn-small warning">Cancel</button>
            <button @click="deleteSession(session.id)" class="btn-small danger">Delete</button>
          </div>
        </div>
      </div>

      <div v-if="filteredSessions.length === 0" class="no-sessions">
        <p>No training sessions found for the selected date.</p>
      </div>
    </div>

    <!-- Create/Edit Session Modal -->
    <div v-if="showCreateSession || showEditSession" class="modal">
      <div class="modal-content">
        <h3>{{ showCreateSession ? 'Schedule New Session' : 'Edit Session' }}</h3>
        <form @submit.prevent="handleSubmit">
          <div class="form-group">
            <label>Session Title:</label>
            <input v-model="sessionForm.title" type="text" required />
          </div>
          <div class="form-group">
            <label>Trainer:</label>
            <select v-model="sessionForm.trainerId" required>
              <option value="">Select Trainer</option>
              <option v-for="trainer in trainers" :key="trainer.id" :value="trainer.id">
                {{ trainer.name }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>Client:</label>
            <select v-model="sessionForm.clientId" required>
              <option value="">Select Client</option>
              <option v-for="client in clients" :key="client.id" :value="client.id">
                {{ client.name }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>Date:</label>
            <input v-model="sessionForm.date" type="date" required />
          </div>
          <div class="form-group">
            <label>Start Time:</label>
            <input v-model="sessionForm.startTime" type="time" required />
          </div>
          <div class="form-group">
            <label>Duration (minutes):</label>
            <input v-model="sessionForm.duration" type="number" min="30" max="180" step="30" required />
          </div>
          <div class="form-group">
            <label>Notes:</label>
            <textarea v-model="sessionForm.notes" rows="3"></textarea>
          </div>
          <div class="form-actions">
            <button type="submit" :disabled="loading">
              {{ loading ? 'Saving...' : (showCreateSession ? 'Schedule Session' : 'Update Session') }}
            </button>
            <button type="button" @click="closeModal">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const loading = ref(false)
const showCreateSession = ref(false)
const showEditSession = ref(false)
const selectedDate = ref('')
const sessions = ref([])
const trainers = ref([])
const clients = ref([])
const editingSession = ref(null)

const sessionForm = ref({
  title: '',
  trainerId: '',
  clientId: '',
  date: '',
  startTime: '',
  duration: 60,
  notes: ''
})

const filteredSessions = computed(() => {
  if (!selectedDate.value) return sessions.value
  return sessions.value.filter(session => session.date === selectedDate.value)
})

onMounted(() => {
  loadSessions()
  loadTrainers()
  loadClients()
})

const loadSessions = () => {
  // Mock data - replace with actual API call
  sessions.value = [
    {
      id: 1,
      title: 'Personal Training',
      trainerName: 'John Trainer',
      clientName: 'Jane Client',
      date: '2024-01-15',
      startTime: '10:00',
      endTime: '11:00',
      duration: 60,
      status: 'Scheduled',
      notes: 'Focus on strength training'
    },
    {
      id: 2,
      title: 'Cardio Session',
      trainerName: 'Mike Trainer',
      clientName: 'Bob Client',
      date: '2024-01-15',
      startTime: '14:00',
      endTime: '15:00',
      duration: 60,
      status: 'Completed',
      notes: 'High intensity cardio'
    }
  ]
}

const loadTrainers = () => {
  // Mock data - replace with actual API call
  trainers.value = [
    { id: 1, name: 'John Trainer' },
    { id: 2, name: 'Mike Trainer' }
  ]
}

const loadClients = () => {
  // Mock data - replace with actual API call
  clients.value = [
    { id: 1, name: 'Jane Client' },
    { id: 2, name: 'Bob Client' }
  ]
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString()
}

const editSession = (session) => {
  editingSession.value = session
  sessionForm.value = { ...session }
  showEditSession.value = true
}

const closeModal = () => {
  showCreateSession.value = false
  showEditSession.value = false
  editingSession.value = null
  sessionForm.value = {
    title: '',
    trainerId: '',
    clientId: '',
    date: '',
    startTime: '',
    duration: 60,
    notes: ''
  }
}

const handleSubmit = async () => {
  loading.value = true
  
  try {
    // TODO: Implement API call
    console.log('Saving session:', sessionForm.value)
    
    // Mock success
    setTimeout(() => {
      closeModal()
      loadSessions()
      loading.value = false
    }, 1000)
  } catch (error) {
    console.error('Error saving session:', error)
    loading.value = false
  }
}

const cancelSession = async (id) => {
  if (confirm('Are you sure you want to cancel this session?')) {
    // TODO: Implement API call
    console.log('Cancelling session:', id)
  }
}

const deleteSession = async (id) => {
  if (confirm('Are you sure you want to delete this session?')) {
    // TODO: Implement API call
    console.log('Deleting session:', id)
  }
}

const filterSessions = () => {
  // Filtering is handled by computed property
}
</script>

<style scoped>
.trainer-scheduler-page {
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
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.date-filter {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.date-filter label {
  font-weight: 500;
  color: #333;
}

.date-filter input {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 5px;
}

.sessions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}

.session-card {
  background: white;
  padding: 1.5rem;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.session-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.session-header h3 {
  margin: 0;
  color: #333;
}

.session-status {
  padding: 0.25rem 0.75rem;
  border-radius: 15px;
  font-size: 0.8rem;
  font-weight: 500;
  text-transform: uppercase;
}

.session-status.scheduled {
  background: #fff3cd;
  color: #856404;
}

.session-status.completed {
  background: #d4edda;
  color: #155724;
}

.session-status.cancelled {
  background: #f8d7da;
  color: #721c24;
}

.session-info {
  margin-bottom: 1.5rem;
}

.session-info p {
  margin: 0.5rem 0;
  color: #666;
}

.session-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-primary, .btn-small {
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

.btn-small {
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
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

.form-group input, .form-group select, .form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 1rem;
}

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
}

.no-sessions {
  text-align: center;
  padding: 2rem;
  color: #666;
}

@media (max-width: 768px) {
  .trainer-scheduler-page {
    padding: 1rem;
  }
  
  .sessions-grid {
    grid-template-columns: 1fr;
  }
  
  .content-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
}
</style>
