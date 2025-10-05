<template>
  <div class="training-approval-view">
    <div class="page-header">
      <q-btn 
        flat 
        icon="arrow_back" 
        @click="$router.go(-1)" 
        class="q-mb-md"
      >
        <q-tooltip>Go Back</q-tooltip>
      </q-btn>
      <h1>Training Approval Details</h1>
    </div>

    <div v-if="loading" class="text-center q-pa-lg">
      <q-spinner size="40px" color="primary" />
      <p class="q-mt-md">Loading approval details...</p>
    </div>

    <div v-else-if="error" class="error-message q-pa-lg">
      <q-icon name="error" size="40px" color="negative" />
      <p class="q-mt-md">{{ error }}</p>
      <q-btn color="primary" @click="loadApprovalDetails" class="q-mt-md">
        Try Again
      </q-btn>
    </div>

    <div v-else-if="approvalDetails" class="approval-details">
      <!-- Card 1: User Information -->
      <q-card class="q-mb-md user-info-card">
        <q-card-section>
          <div class="text-h6 q-mb-md">User Information</div>
          <div class="row q-gutter-md">
            <div class="col-12 col-md-3">
              <div class="text-caption">User ID</div>
              <div class="text-subtitle1">{{ approvalDetails.user_id }}</div>
            </div>
            <div class="col-12 col-md-3">
              <div class="text-caption">User Name</div>
              <div class="text-subtitle1">{{ approvalDetails.user_name }}</div>
            </div>
            <div class="col-12 col-md-3">
              <div class="text-caption">Phone</div>
              <div class="text-subtitle1">{{ approvalDetails.user_phone }}</div>
            </div>
            <div class="col-12 col-md-3">
              <div class="text-caption">Total Days</div>
              <div class="text-subtitle1">{{ approvalDetails.total_days || calculateDuration(approvalDetails.start_date, approvalDetails.end_date) }}</div>
            </div>
          </div>
          <div class="row q-gutter-md q-mt-md">
            <div class="col-12 col-md-4">
              <div class="text-caption">User Level</div>
              <div class="text-subtitle1">{{ approvalDetails.user_level || 'Beginner' }}</div>
            </div>
            <div class="col-12 col-md-4">
              <div class="text-caption">Status</div>
              <q-badge 
                :color="getStatusColor(approvalDetails.approval_status)" 
                :label="approvalDetails.approval_status"
              />
            </div>
            <div class="col-12 col-md-4">
              <div class="text-caption">Created</div>
              <div class="text-subtitle1">{{ formatDate(approvalDetails.created_at) }}</div>
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- Training Plan Information -->
      <q-card class="q-mb-md">
        <q-card-section>
          <div class="text-h6 q-mb-md">Training Plan Information</div>
          <div class="row q-gutter-md">
            <div class="col-12 col-md-6">
              <div class="text-caption">Workout Name</div>
              <div class="text-subtitle1">{{ approvalDetails.workout_name }}</div>
            </div>
            <div class="col-12 col-md-6">
              <div class="text-caption">Plan Category</div>
              <div class="text-subtitle1">{{ approvalDetails.plan_category_name || approvalDetails.category || 'N/A' }}</div>
            </div>
          </div>
          <div class="row q-gutter-md q-mt-md">
            <div class="col-12 col-md-4">
              <div class="text-caption">Start Date</div>
              <div class="text-subtitle1">{{ formatDate(approvalDetails.start_date) }}</div>
            </div>
            <div class="col-12 col-md-4">
              <div class="text-caption">End Date</div>
              <div class="text-subtitle1">{{ formatDate(approvalDetails.end_date) }}</div>
            </div>
            <div class="col-12 col-md-4">
              <div class="text-caption">Total Days</div>
              <div class="text-subtitle1">{{ approvalDetails.total_days || calculateDuration(approvalDetails.start_date, approvalDetails.end_date) }}</div>
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- Card 2: All Exercises -->
      <q-card class="q-mb-md exercises-card" v-if="(approvalDetails.items && approvalDetails.items.length > 0) || (approvalDetails.workout_plan && approvalDetails.workout_plan.length > 0)">
        <q-card-section>
          <div class="text-h6 q-mb-md">All Exercises</div>
          <div class="exercises-grid">
            <q-card 
              v-for="(exercise, index) in (approvalDetails.items || approvalDetails.workout_plan || [])" 
              :key="index" 
              flat 
              bordered 
              class="exercise-box"
            >
              <q-card-section class="exercise-content">
                <div class="exercise-header">
                  <div class="text-subtitle1 exercise-title">
                    {{ exercise.name || exercise.workout_name || `Exercise ${index + 1}` }}
                  </div>
                </div>
                
                <div class="exercise-details">
                  <div class="detail-row">
                    <div class="detail-item">
                      <div class="text-caption">Sets</div>
                      <div class="text-body1">{{ exercise.sets || 0 }}</div>
                    </div>
                    <div class="detail-item">
                      <div class="text-caption">Reps</div>
                      <div class="text-body1">{{ exercise.reps || 0 }}</div>
                    </div>
                  </div>
                  
                  <div class="detail-row">
                    <div class="detail-item">
                      <div class="text-caption">Weight (kg)</div>
                      <div class="text-body1">{{ exercise.weight || exercise.weight_kg || 0 }}</div>
                    </div>
                    <div class="detail-item">
                      <div class="text-caption">Training Minutes</div>
                      <div class="text-body1">{{ exercise.training_minutes || exercise.minutes || 0 }}</div>
                    </div>
                  </div>
                  
                  <div v-if="exercise.exercise_types" class="detail-row">
                    <div class="detail-item full-width">
                      <div class="text-caption">Exercise Types</div>
                      <div class="text-body2">
                        {{ Array.isArray(exercise.exercise_types) ? exercise.exercise_types.join(', ') : exercise.exercise_types }}
                      </div>
                    </div>
                  </div>
                </div>
              </q-card-section>
            </q-card>
          </div>
        </q-card-section>
      </q-card>

      <!-- Card 3: Daily Plans -->
      <q-card class="q-mb-md daily-plans-card">
        <q-card-section>
          <div class="text-h6 q-mb-md">Daily Plans</div>
          <div class="days-grid">
            <q-card 
              v-for="(day, dayIndex) in getDailyPlans()" 
              :key="dayIndex" 
              flat 
              bordered 
              class="day-plan-box"
            >
              <q-card-section class="day-content">
                <div class="day-header">
                  <div class="text-subtitle1 day-title">Day {{ dayIndex + 1 }}</div>
                  <div class="text-caption day-date">{{ formatDate(day.date) }}</div>
                </div>
                
                <div class="day-exercises">
                  <q-card 
                    v-for="(exercise, exerciseIndex) in day.exercises" 
                    :key="exerciseIndex" 
                    flat 
                    class="day-exercise-box"
                  >
                    <q-card-section class="day-exercise-content">
                      <div class="day-exercise-header">
                        <div class="text-subtitle2 day-exercise-title">
                          {{ exercise.name || exercise.workout_name || `Exercise ${exerciseIndex + 1}` }}
                        </div>
                      </div>
                      
                      <div class="day-exercise-details">
                        <div class="day-detail-row">
                          <div class="day-detail-item">
                            <div class="text-caption">Sets</div>
                            <div class="text-body1">{{ exercise.sets || 0 }}</div>
                          </div>
                          <div class="day-detail-item">
                            <div class="text-caption">Reps</div>
                            <div class="text-body1">{{ exercise.reps || 0 }}</div>
                          </div>
                        </div>
                        
                        <div class="day-detail-row">
                          <div class="day-detail-item">
                            <div class="text-caption">Weight</div>
                            <div class="text-body1">{{ exercise.weight || exercise.weight_kg || 0 }}</div>
                          </div>
                          <div class="day-detail-item">
                            <div class="text-caption">Minutes</div>
                            <div class="text-body1">{{ exercise.training_minutes || exercise.minutes || 0 }}</div>
                          </div>
                        </div>
                        
                        <div v-if="exercise.exercise_types" class="day-detail-row">
                          <div class="day-detail-item full-width">
                            <div class="text-caption">Exercise Types</div>
                            <div class="text-body2">
                              {{ Array.isArray(exercise.exercise_types) ? exercise.exercise_types.join(', ') : exercise.exercise_types }}
                            </div>
                          </div>
                        </div>
                      </div>
                    </q-card-section>
                  </q-card>
                </div>
              </q-card-section>
            </q-card>
          </div>
        </q-card-section>
      </q-card>

      <!-- Action Buttons -->
      <div class="action-buttons q-mt-lg" v-if="approvalDetails.approval_status === 'PENDING'">
        <div class="text-h6 q-mb-md">Actions</div>
        <div class="row q-gutter-sm">
          <q-btn 
            color="negative" 
            label="Reject" 
            icon="close"
            @click="rejectApproval"
            :loading="actionLoading"
            class="q-px-lg"
          />
          <q-btn 
            color="positive" 
            label="Approve" 
            icon="check"
            @click="approveApproval"
            :loading="actionLoading"
            class="q-px-lg"
          />
        </div>
      </div>

      <!-- Status Message for Non-Pending -->
      <div v-else class="status-message q-mt-lg">
        <q-banner 
          :class="getStatusBannerClass(approvalDetails.approval_status)"
          rounded
        >
          <template v-slot:avatar>
            <q-icon :name="getStatusIcon(approvalDetails.approval_status)" />
          </template>
          This training plan has been {{ approvalDetails.approval_status.toLowerCase() }}.
        </q-banner>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../config/axios'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const error = ref(null)
const actionLoading = ref(false)
const approvalDetails = ref(null)

const loadApprovalDetails = async () => {
  try {
    loading.value = true
    error.value = null
    const { data } = await api.get(`/trainingApprovals/${route.params.id}/detailed`)
    approvalDetails.value = data.data
  } catch (e) {
    console.error('Failed to load approval details', e)
    error.value = e.response?.data?.message || 'Failed to load approval details'
  } finally {
    loading.value = false
  }
}

const approveApproval = async () => {
  if (confirm('Are you sure you want to approve this training plan?')) {
    try {
      actionLoading.value = true
      await api.patch(`/trainingApprovals/${route.params.id}/status`, { 
        approval_status: 'APPROVED' 
      })
      await loadApprovalDetails()
      // Show success message
      // You can add a notification here
    } catch (e) {
      console.error('Failed to approve request', e)
      alert('Failed to approve request. Please try again.')
    } finally {
      actionLoading.value = false
    }
  }
}

const rejectApproval = async () => {
  if (confirm('Are you sure you want to reject this training plan?')) {
    try {
      actionLoading.value = true
      await api.patch(`/trainingApprovals/${route.params.id}/status`, { 
        approval_status: 'REJECTED' 
      })
      await loadApprovalDetails()
      // Show success message
      // You can add a notification here
    } catch (e) {
      console.error('Failed to reject request', e)
      alert('Failed to reject request. Please try again.')
    } finally {
      actionLoading.value = false
    }
  }
}

const getStatusColor = (status) => {
  switch (status) {
    case 'APPROVED': return 'green'
    case 'REJECTED': return 'red'
    case 'PENDING': return 'orange'
    default: return 'grey'
  }
}

const getStatusIcon = (status) => {
  switch (status) {
    case 'APPROVED': return 'check_circle'
    case 'REJECTED': return 'cancel'
    case 'PENDING': return 'schedule'
    default: return 'help'
  }
}

const getStatusBannerClass = (status) => {
  switch (status) {
    case 'APPROVED': return 'bg-green-1 text-green-8'
    case 'REJECTED': return 'bg-red-1 text-red-8'
    case 'PENDING': return 'bg-orange-1 text-orange-8'
    default: return 'bg-grey-1 text-grey-8'
  }
}

const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString()
}

const calculateDuration = (startDate, endDate) => {
  if (!startDate || !endDate) return 'N/A'
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffTime = Math.abs(end - start)
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
  return diffDays
}

const getDailyPlans = () => {
  if (!approvalDetails.value) return []
  
  // If we have daily_plans from the API, use them directly
  if (approvalDetails.value.daily_plans && approvalDetails.value.daily_plans.length > 0) {
    return approvalDetails.value.daily_plans.map(day => ({
      date: new Date(day.date),
      exercises: day.workouts || [],
      total_workouts: day.total_workouts || 0,
      total_minutes: day.total_minutes || 0
    }))
  }
  
  // Fallback: create daily plans from start/end dates and exercises
  const startDate = new Date(approvalDetails.value.start_date)
  const endDate = new Date(approvalDetails.value.end_date)
  const totalDays = approvalDetails.value.total_days || calculateDuration(approvalDetails.value.start_date, approvalDetails.value.end_date)
  const exercises = approvalDetails.value.workout_plan || approvalDetails.value.items || []
  
  const dailyPlans = []
  
  for (let i = 0; i < totalDays; i++) {
    const currentDate = new Date(startDate)
    currentDate.setDate(startDate.getDate() + i)
    
    // For fallback, show all exercises for each day
    dailyPlans.push({
      date: currentDate,
      exercises: exercises,
      total_workouts: exercises.length,
      total_minutes: exercises.reduce((sum, ex) => sum + (ex.training_minutes || ex.minutes || 0), 0)
    })
  }
  
  return dailyPlans
}

onMounted(() => {
  loadApprovalDetails()
})
</script>

<style scoped>
.training-approval-view {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header h1 {
  color: #333;
  margin-bottom: 1rem;
  font-size: 2rem;
}

.approval-details {
  max-width: 100%;
}

/* Card 1: User Information */
.user-info-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.user-info-card .text-caption {
  color: rgba(255, 255, 255, 0.8);
}

.user-info-card .text-subtitle1 {
  color: white;
  font-weight: 600;
}

/* Card 2: Exercises Grid */
.exercises-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1rem;
}

.exercise-box {
  border: 2px solid #e3f2fd;
  border-radius: 12px;
  background: #f8f9fa;
  transition: all 0.3s ease;
}

.exercise-box:hover {
  border-color: #2196f3;
  box-shadow: 0 4px 12px rgba(33, 150, 243, 0.15);
}

.exercise-content {
  padding: 1rem;
}

.exercise-header {
  margin-bottom: 1rem;
}

.exercise-title {
  color: #1976d2;
  font-weight: 600;
  text-align: center;
}

.exercise-details {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.detail-row {
  display: flex;
  gap: 1rem;
}

.detail-item {
  flex: 1;
  text-align: center;
  padding: 0.5rem;
  background: white;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.detail-item.full-width {
  flex: 1 1 100%;
}

.detail-item .text-caption {
  color: #666;
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.detail-item .text-body1 {
  color: #333;
  font-weight: 600;
}

/* Card 3: Daily Plans */
.days-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 1.5rem;
}

.day-plan-box {
  border: 2px solid #e8f5e8;
  border-radius: 12px;
  background: #f1f8e9;
  transition: all 0.3s ease;
}

.day-plan-box:hover {
  border-color: #4caf50;
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.15);
}

.day-content {
  padding: 1rem;
}

.day-header {
  text-align: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #4caf50;
}

.day-title {
  color: #2e7d32;
  font-weight: 700;
  font-size: 1.2rem;
}

.day-date {
  color: #4caf50;
  font-weight: 500;
}

.day-exercises {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.day-exercise-box {
  border: 1px solid #c8e6c9;
  border-radius: 8px;
  background: white;
}

.day-exercise-content {
  padding: 0.75rem;
}

.day-exercise-header {
  margin-bottom: 0.75rem;
}

.day-exercise-title {
  color: #2e7d32;
  font-weight: 600;
  text-align: center;
}

.day-exercise-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.day-detail-row {
  display: flex;
  gap: 0.75rem;
}

.day-detail-item {
  flex: 1;
  text-align: center;
  padding: 0.5rem;
  background: #f1f8e9;
  border-radius: 6px;
  border: 1px solid #c8e6c9;
}

.day-detail-item.full-width {
  flex: 1 1 100%;
}

.day-detail-item .text-caption {
  color: #4caf50;
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.day-detail-item .text-body1 {
  color: #2e7d32;
  font-weight: 600;
}

.action-buttons {
  text-align: center;
  padding: 2rem;
  background: #f5f5f5;
  border-radius: 8px;
}

.error-message {
  text-align: center;
  color: #d32f2f;
}

.status-message {
  text-align: center;
}

@media (max-width: 768px) {
  .training-approval-view {
    padding: 1rem;
  }
  
  .training-cards-grid {
    grid-template-columns: 1fr;
  }
}
</style>
