<template>
  <div class="trainer-scheduler-page">
    <div class="page-header">
      <h1>Trainer Scheduler</h1>
      <p>Manage training plans and user assignments</p>
    </div>

    <!-- User List Table Section -->
    <div class="section">
      <div class="section-header">
        <h2>User List</h2>
        <div class="search-container">
          <q-input
            v-model="userSearchQuery"
            placeholder="Search by name or phone..."
            outlined
            dense
            class="search-input"
          >
            <template v-slot:prepend>
              <q-icon name="search" />
            </template>
          </q-input>
        </div>
      </div>

      <q-table
        :rows="filteredUsers"
        :columns="userColumns"
        :loading="userManagementStore.loading"
        row-key="id"
        flat
        bordered
        class="user-table"
      >
        <template v-slot:body-cell-status="props">
          <q-td :props="props">
            <q-badge
              :color="props.value === 'ACTIVE' ? 'green' : 'red'"
              :label="props.value"
            />
          </q-td>
        </template>

        <template v-slot:body-cell-payment_status="props">
          <q-td :props="props">
            <q-badge
              :color="props.value === 'Paid' ? 'green' : 'red'"
              :label="props.value || 'Unpaid'"
            />
          </q-td>
        </template>

        <template v-slot:body-cell-actions="props">
          <q-td :props="props">
            <div class="action-buttons">
              <q-btn
                flat
                round
                color="primary"
                icon="edit"
                size="sm"
                @click="editUserPlan(props.row)"
                title="Edit Plan"
              />
              <q-btn
                flat
                round
                color="secondary"
                icon="add"
                size="sm"
                @click="createUserPlan(props.row)"
                title="Create Plan"
              />
              <q-btn
                flat
                round
                color="orange"
                icon="visibility"
                size="sm"
                @click="viewUserTraining(props.row)"
                title="View Training"
              />
              <q-btn
                flat
                round
                color="info"
                icon="analytics"
                size="sm"
                @click="viewUserStats(props.row)"
                title="View Stats"
              />
            </div>
          </q-td>
        </template>
      </q-table>
          </div>
          
    <!-- Planned Trainings Section -->
    <div class="section">
      <div class="section-header">
        <h2>Planned Trainings</h2>
        <q-btn
          color="primary"
          icon="add"
          label="Create New Plan"
          @click="showCreatePlanDialog = true"
        />
          </div>

      <div class="assign-training-card">
        <h3>Assign Training to User</h3>
        <div class="assign-form">
          <div class="form-row">
            <q-select
              v-model="selectedUser"
              :options="userOptions"
              option-label="label"
              option-value="value"
              emit-value
              map-options
              label="Search User by Name and Phone"
              outlined
              dense
              use-input
              input-debounce="300"
              @filter="filterUsers"
              class="user-select"
            >
              <template v-slot:no-option>
                <q-item>
                  <q-item-section class="text-grey">
                    No users found
                  </q-item-section>
                </q-item>
              </template>
            </q-select>

            <q-select
              v-model="selectedCategory"
              :options="categoryOptions"
              label="Select Training Plan Category"
              outlined
              dense
              class="category-select"
            />

            <q-btn
              color="secondary"
              label="Assign Training"
              @click="assignTraining"
              :disable="!selectedUser || !selectedCategory"
            />
          </div>
          </div>
        </div>
      </div>

    <!-- Training Plans Section -->
    <div class="section">
      <div class="section-header">
        <h2>Training Plans</h2>
        <q-btn
          color="info"
          icon="refresh"
          label="Refresh"
          @click="refreshAllPlans"
        />
      </div>

      <div class="training-cards-grid">
        <q-card
          v-for="plan in allTrainingPlans"
          :key="plan.id"
          class="training-card"
          :class="{ 'assignment-card': plan.assign_to }"
          flat
          bordered
        >
          <q-card-section>
             <div class="card-header">
               <h4>{{ plan.category }} Plan</h4>
               <div class="card-actions">
                 <q-badge
                   v-if="plan.assign_to"
                   color="info"
                   label="Assigned"
                   class="assignment-badge"
                 />
                 <q-btn
                   flat
                   round
                   color="orange"
                   icon="visibility"
                   size="sm"
                   @click="viewTrainingPlanDetails(plan)"
                   title="View Workout Details"
                 />
                 <q-btn
                   flat
                   round
                   color="primary"
                   icon="edit"
                   size="sm"
                   @click="editTrainingPlan(plan)"
                   title="Edit Plan"
                 />
                 <q-btn
                   flat
                   round
                   color="red"
                   icon="delete"
                   size="sm"
                   @click="deleteTrainingPlan(plan.id)"
                   title="Delete Plan"
                 />
               </div>
             </div>

             <div class="card-content">
               <!-- Workout Names Section -->
               <div class="workout-names-section">
                 <h5>Workouts:</h5>
                 <div class="workout-names-list">
                   <span 
                     v-for="(workout, index) in getWorkoutNames(plan)" 
                     :key="index"
                     class="workout-name-tag"
                   >
                     {{ workout }}
            </span>
                 </div>
          </div>
          
               <!-- Duration Section -->
               <div class="duration-section">
                 <q-icon name="schedule" color="info" size="sm" />
                 <span><strong>Duration:</strong> {{ calculateDuration(plan.start_date, plan.end_date) }} days</span>
          </div>

               <!-- Other Details Section -->
               <div class="other-details-section">
                 <div class="detail-row">
                   <span><strong>Start Date:</strong> {{ plan.start_date }}</span>
                   <span><strong>End Date:</strong> {{ plan.end_date }}</span>
          </div>
                 <div class="detail-row">
                   <span><strong>Total Training Minutes:</strong> {{ plan.training_minutes }} min</span>
        </div>
                 <div class="detail-row">
                   <span><strong>Total Sets:</strong> {{ plan.sets }}</span>
                   <span><strong>Total Reps:</strong> {{ plan.reps }}</span>
                   <span><strong>Total Weight:</strong> {{ plan.weight_kg }}kg</span>
                 </div>
                 <div v-if="plan.assign_to" class="detail-row">
                   <span><strong>Assigned To:</strong> {{ getTrainerName(plan.assign_to) }}</span>
                 </div>
                 <div class="detail-row">
                   <span><strong>Status:</strong> 
                     <q-badge
                       :color="getStatusColor(plan.status)"
                       :label="plan.status"
                     />
                   </span>
                 </div>
               </div>
             </div>
          </q-card-section>
        </q-card>
      </div>

       <div v-if="allTrainingPlans.length === 0" class="no-plans">
         <q-icon name="fitness_center" size="48px" color="grey-5" />
         <p>No training plans created yet</p>
      </div>
    </div>

     <!-- My Assignments Section -->
     <div class="section">
       <div class="section-header">
         <h2>My Assignments</h2>
         <q-btn
           color="info"
           icon="refresh"
           label="Refresh"
           @click="loadMyAssignments"
         />
          </div>

       <div class="training-cards-grid">
         <q-card
           v-for="plan in myAssignments"
           :key="plan.id"
           class="training-card assignment-card"
           flat
           bordered
         >
           <q-card-section>
             <div class="card-header">
               <h4>{{ plan.category }} Plan</h4>
               <div class="card-actions">
                 <q-badge
                   color="info"
                   label="Assigned"
                   class="assignment-badge"
                 />
                 <q-btn
                   flat
                   round
                   color="orange"
                   icon="visibility"
                   size="sm"
                   @click="viewTrainingPlanDetails(plan)"
                   title="View Workout Details"
                 />
                 <q-btn
                   flat
                   round
                   color="primary"
                   icon="edit"
                   size="sm"
                   @click="editTrainingPlan(plan)"
                   title="Edit Plan"
                 />
                 <q-btn
                   flat
                   round
                   color="red"
                   icon="delete"
                   size="sm"
                   @click="deleteTrainingPlan(plan.id)"
                   title="Delete Plan"
                 />
          </div>
          </div>

             <div class="card-content">
               <!-- Workout Names Section -->
               <div class="workout-names-section">
                 <h5>Workouts:</h5>
                 <div class="workout-names-list">
                   <span 
                     v-for="(workout, index) in getWorkoutNames(plan)" 
                     :key="index"
                     class="workout-name-tag"
                   >
                     {{ workout }}
                   </span>
          </div>
          </div>

               <!-- Duration Section -->
               <div class="duration-section">
                 <q-icon name="schedule" color="info" size="sm" />
                 <span><strong>Duration:</strong> {{ calculateDuration(plan.start_date, plan.end_date) }} days</span>
          </div>

               <!-- Other Details Section -->
               <div class="other-details-section">
                 <div class="detail-row">
                   <span><strong>Start Date:</strong> {{ plan.start_date }}</span>
                   <span><strong>End Date:</strong> {{ plan.end_date }}</span>
          </div>
                 <div class="detail-row">
                   <span><strong>Total Training Minutes:</strong> {{ plan.training_minutes }} min</span>
          </div>
                 <div class="detail-row">
                   <span><strong>Total Sets:</strong> {{ plan.sets }}</span>
                   <span><strong>Total Reps:</strong> {{ plan.reps }}</span>
                   <span><strong>Total Weight:</strong> {{ plan.weight_kg }}kg</span>
      </div>
                 <div class="detail-row">
                   <span><strong>Assigned To:</strong> {{ getTrainerName(plan.assign_to) }}</span>
    </div>
                 <div class="detail-row">
                   <span><strong>Status:</strong> 
                     <q-badge
                       :color="getStatusColor(plan.status)"
                       :label="plan.status"
                     />
                   </span>
                 </div>
               </div>
             </div>
           </q-card-section>
         </q-card>
       </div>

       <div v-if="myAssignments.length === 0" class="no-plans">
         <q-icon name="assignment" size="48px" color="grey-5" />
         <p>No assignments yet</p>
       </div>
     </div>

    <!-- Create New Plan Dialog -->
    <q-dialog v-model="showCreatePlanDialog" persistent>
      <q-card style="min-width: 600px; max-width: 800px">
        <q-card-section>
          <div class="text-h6">Create New Plan</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <div class="form-section">
            <h4>Plan Duration</h4>
            <div class="date-range">
              <q-input
                v-model="newPlan.start_date"
                label="Start Date"
                type="date"
                outlined
                dense
                class="date-input"
              />
              <q-input
                v-model="newPlan.end_date"
                label="End Date"
                type="date"
                outlined
                dense
                class="date-input"
              />
            </div>
          </div>

          <div class="form-section">
            <h4>Exercise Details</h4>
            <div class="exercise-form">
              <q-input
                v-model="newPlan.workout_name"
                label="Workout Name"
                outlined
                dense
                class="form-field"
              />
              <q-select
                v-model="newPlan.category"
                :options="categoryOptions"
                label="Exercise Plan Category"
                outlined
                dense
                class="form-field"
              />
              <q-input
                v-model="newPlan.total_workouts"
                label="Total Workouts"
                type="number"
                outlined
                dense
                class="form-field"
              />
              <q-input
                v-model="newPlan.training_minutes"
                label="Training Minutes"
                type="number"
                outlined
                dense
                class="form-field"
              />
              <q-input
                v-model="newPlan.sets"
                label="Sets"
                type="number"
                outlined
                dense
                class="form-field"
              />
              <q-input
                v-model="newPlan.reps"
                label="Reps"
                type="number"
                outlined
                dense
                class="form-field"
              />
              <q-input
                v-model="newPlan.weight_kg"
                label="Weight (kg)"
                type="number"
                step="0.1"
                outlined
                dense
                class="form-field"
              />
            </div>
          </div>

          <div class="exercises-list" v-if="newPlan.exercises && newPlan.exercises.length > 0">
            <h4>Added Exercises</h4>
            <div
              v-for="(exercise, index) in newPlan.exercises"
              :key="index"
              class="exercise-item"
            >
              <span>{{ exercise.name }} - {{ exercise.sets }} sets, {{ exercise.reps }} reps, {{ exercise.weight }}kg, {{ exercise.training_minutes }}min</span>
              <q-btn
                flat
                round
                color="red"
                icon="delete"
                size="sm"
                @click="removeExercise(index)"
              />
            </div>
          </div>

          <q-btn
            color="secondary"
            icon="add"
            label="Add More Exercises"
            @click="addExercise"
            class="add-exercise-btn"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" @click="closeCreatePlanDialog" />
          <q-btn
            color="primary"
            label="Create Plan"
            @click="createPlan"
            :loading="creatingPlan"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

     <!-- Edit Training Plan Dialog -->
     <q-dialog v-model="showEditPlanDialog" persistent>
       <q-card style="min-width: 600px; max-width: 800px">
         <q-card-section>
           <div class="text-h6">Edit Training Plan</div>
         </q-card-section>

         <q-card-section class="q-pt-none">
           <div class="form-section">
             <h4>Plan Duration</h4>
             <div class="date-range">
               <q-input
                 v-model="editingPlan.start_date"
                 label="Start Date"
                 type="date"
                 outlined
                 dense
                 class="date-input"
               />
               <q-input
                 v-model="editingPlan.end_date"
                 label="End Date"
                 type="date"
                 outlined
                 dense
                 class="date-input"
               />
             </div>
           </div>

           <div class="form-section">
             <h4>Exercise Details</h4>
             <div class="exercise-form">
               <q-input
                 v-model="editingPlan.workout_name"
                 label="Workout Name"
                 outlined
                 dense
                 class="form-field"
               />
               <q-select
                 v-model="editingPlan.category"
                 :options="categoryOptions"
                 label="Exercise Plan Category"
                 outlined
                 dense
                 class="form-field"
               />
               <q-select
                 v-model="editingPlan.assign_to"
                 :options="trainerOptions"
                 option-label="label"
                 option-value="value"
                 emit-value
                 map-options
                 label="Assign To Trainer"
                 outlined
                 dense
                 class="form-field"
                 clearable
               />
               <q-input
                 v-model="editingPlan.total_workouts"
                 label="Total Workouts"
                 type="number"
                 outlined
                 dense
                 class="form-field"
               />
               <q-input
                 v-model="editingPlan.training_minutes"
                 label="Training Minutes"
                 type="number"
                 outlined
                 dense
                 class="form-field"
               />
               <q-input
                 v-model="editingPlan.sets"
                 label="Sets"
                 type="number"
                 outlined
                 dense
                 class="form-field"
               />
               <q-input
                 v-model="editingPlan.reps"
                 label="Reps"
                 type="number"
                 outlined
                 dense
                 class="form-field"
               />
               <q-input
                 v-model="editingPlan.weight_kg"
                 label="Weight (kg)"
                 type="number"
                 step="0.1"
                 outlined
                 dense
                 class="form-field"
               />
             </div>
           </div>

           <!-- Existing Exercises List -->
           <div class="exercises-list" v-if="editingPlan.exercises && editingPlan.exercises.length > 0">
             <h4>Current Exercises</h4>
             <div
               v-for="(exercise, index) in editingPlan.exercises"
               :key="index"
               class="exercise-item"
             >
               <span>{{ exercise.name }} - {{ exercise.sets }} sets, {{ exercise.reps }} reps, {{ exercise.weight }}kg, {{ exercise.training_minutes }}min</span>
               <q-btn
                 flat
                 round
                 color="red"
                 icon="delete"
                 size="sm"
                 @click="removeEditExercise(index)"
               />
             </div>
           </div>

           <q-btn
             color="secondary"
             icon="add"
             label="Add More Exercises"
             @click="addEditExercise"
             class="add-exercise-btn"
           />
         </q-card-section>

         <q-card-actions align="right">
           <q-btn flat label="Cancel" @click="closeEditPlanDialog" />
           <q-btn
             color="primary"
             label="Update Plan"
             @click="updatePlan"
             :loading="updatingPlan"
           />
         </q-card-actions>
       </q-card>
     </q-dialog>

    <!-- View Stats/Training Dialog -->
    <q-dialog v-model="showStatsDialog">
      <q-card style="min-width: 600px; max-width: 800px">
        <q-card-section>
          <div class="text-h6">
            {{ userStats?.trainingPlans?.length === 1 ? 'Training Plan Details' : (userStats?.trainingPlans ? 'Training Plans' : 'User Statistics') }} - {{ selectedUserForStats?.name }}
          </div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <div v-if="userStats" class="stats-content">
             <!-- Training Plans Section (when viewing training) -->
             <div v-if="userStats.trainingPlans" class="stats-section">
               <h4>Training Plan Details</h4>
               <div v-if="userStats.trainingPlans.length > 0">
                 <div
                   v-for="plan in userStats.trainingPlans"
                   :key="plan.id"
                   class="training-plan-item"
                 >
                   <div class="plan-header">
                     <h5>{{ plan.workout_name }}</h5>
                     <q-badge
                       :color="getStatusColor(plan.status)"
                       :label="plan.status"
                     />
                   </div>
                   
                   <!-- Plan Overview -->
                   <div class="plan-overview">
                     <p><strong>Category:</strong> {{ plan.category }}</p>
                     <p><strong>Duration:</strong> {{ calculateDuration(plan.start_date, plan.end_date) }} days</p>
                     <p><strong>Total Training Minutes:</strong> {{ plan.training_minutes }}</p>
                     <p><strong>Total Sets:</strong> {{ plan.sets }} | <strong>Total Reps:</strong> {{ plan.reps }} | <strong>Total Weight:</strong> {{ plan.weight_kg }}kg</p>
                     <p><strong>Assigned To:</strong> {{ getTrainerName(plan.assign_to) }}</p>
                     <p><strong>Start Date:</strong> {{ plan.start_date }} | <strong>End Date:</strong> {{ plan.end_date }}</p>
                   </div>

                   <!-- Individual Workout Cards -->
                   <div v-if="plan.exercisesDetails && plan.exercisesDetails.length > 0" class="workout-cards-section">
                     <h6>Individual Workout Details:</h6>
                     <div class="workout-cards-grid">
                       <div
                         v-for="(exercise, index) in plan.exercisesDetails"
                         :key="index"
                         class="workout-detail-card"
                       >
                         <div class="workout-card-header">
                           <div class="exercise-name">{{ exercise.name }}</div>
                         </div>
                         <div class="workout-card-content">
                           <div class="workout-detail-row">
                             <span class="detail-label">Total Workouts:</span>
                             <span class="detail-value">{{ exercise.total_workouts || 1 }}</span>
                           </div>
                           <div class="workout-detail-row">
                             <span class="detail-label">Sets:</span>
                             <span class="detail-value">{{ exercise.sets }}</span>
                           </div>
                           <div class="workout-detail-row">
                             <span class="detail-label">Reps:</span>
                             <span class="detail-value">{{ exercise.reps }}</span>
                           </div>
                           <div class="workout-detail-row">
                             <span class="detail-label">Weight:</span>
                             <span class="detail-value">{{ exercise.weight }}</span>
                           </div>
                           <div class="workout-detail-row">
                             <span class="detail-label">Training Minutes:</span>
                             <span class="detail-value">{{ exercise.training_minutes }}</span>
                           </div>
                         </div>
                       </div>
                     </div>
                   </div>
                   
                   <!-- Fallback message if no exercises details -->
                   <div v-else class="no-exercises-message">
                     <p>No individual workout details available. This plan contains: {{ plan.workout_name }}</p>
                   </div>
                   
                   <div class="plan-actions">
                     <q-btn
                       flat
                       round
                       color="primary"
                       icon="edit"
                       size="sm"
                       @click="editTrainingPlan(plan); showStatsDialog = false"
                       title="Edit Plan"
                     />
                     <q-btn
                       flat
                       round
                       color="red"
                       icon="delete"
                       size="sm"
                       @click="deleteTrainingPlan(plan.id); showStatsDialog = false"
                       title="Delete Plan"
                     />
                   </div>
                 </div>
               </div>
               <p v-else class="text-grey">No training plans found for this user</p>
             </div>

            <!-- Stats Section (when viewing stats) -->
            <div v-if="!userStats.trainingPlans">
              <div class="stats-section">
                <h4>Ongoing Workouts</h4>
                <div v-if="userStats.ongoing.length > 0">
                  <div
                    v-for="workout in userStats.ongoing"
                    :key="workout.id"
                    class="workout-item"
                  >
                    <p><strong>{{ workout.workout_name }}</strong> - {{ workout.category }}</p>
                    <p>Status: {{ workout.status }}</p>
                    <p>Duration: {{ workout.start_date }} to {{ workout.end_date }}</p>
                  </div>
                </div>
                <p v-else class="text-grey">No ongoing workouts</p>
              </div>

              <div class="stats-section">
                <h4>Completed Workouts</h4>
                <div v-if="userStats.completed.length > 0">
                  <div
                    v-for="workout in userStats.completed"
                    :key="workout.id"
                    class="workout-item"
                  >
                    <p><strong>{{ workout.workout_name }}</strong> - {{ workout.category }}</p>
                    <p>Date: {{ workout.date }}</p>
                    <p>Duration: {{ workout.duration_minutes }} minutes</p>
                    <p>Results: {{ workout.results.sets }} sets, {{ workout.results.reps }} reps, {{ workout.results.weight_kg }}kg</p>
                  </div>
                </div>
                <p v-else class="text-grey">No completed workouts</p>
              </div>
            </div>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Close" @click="showStatsDialog = false" />
        </q-card-actions>
      </q-card>
     </q-dialog>

     <!-- Training Plan Assignment Success Dialog -->
     <q-dialog v-model="showAssignmentDialog" persistent>
       <q-card style="min-width: 400px; max-width: 500px">
         <q-card-section class="text-center">
           <div class="assignment-success">
             <q-icon name="check_circle" color="green" size="64px" />
             <h4 class="success-title">Training Plan Assigned Successfully!</h4>
             <p class="user-name">Assigned to: <strong>{{ assignedUserName }}</strong></p>
             <div class="loading-bar">
               <q-linear-progress 
                 color="green" 
                 :value="1" 
                 animation-speed="2000"
                 class="progress-bar"
               />
             </div>
           </div>
         </q-card-section>
       </q-card>
     </q-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUserManagementStore } from '../stores/userManagement'
import { useAuthStore } from '../stores/auth'
import api from '../config/axios'

// Stores
const userManagementStore = useUserManagementStore()
const authStore = useAuthStore()

// Reactive data
const userSearchQuery = ref('')
const selectedUser = ref(null)
const selectedCategory = ref(null)
const showCreatePlanDialog = ref(false)
const showEditPlanDialog = ref(false)
const showStatsDialog = ref(false)
const showAssignmentDialog = ref(false)
const assignedUserName = ref('')
const creatingPlan = ref(false)
const updatingPlan = ref(false)
const trainingPlans = ref([])
const myAssignments = ref([])
const userStats = ref(null)
const selectedUserForStats = ref(null)
const editingPlan = ref({})

// New plan form
const newPlan = ref({
  start_date: '',
  end_date: '',
  workout_name: '',
  category: '',
  total_workouts: 0,
  training_minutes: 0,
  sets: 0,
  reps: 0,
  weight_kg: 0,
  exercises: []
})

// Table columns
const userColumns = [
  {
    name: 'id',
    required: true,
    label: 'User ID',
    align: 'left',
    field: 'id',
    sortable: true
  },
  {
    name: 'name',
    required: true,
    label: 'Name',
    align: 'left',
    field: 'name',
    sortable: true
  },
  {
    name: 'email',
    required: true,
    label: 'Email',
    align: 'left',
    field: 'email',
    sortable: true
  },
  {
    name: 'phone',
    required: true,
    label: 'Phone',
    align: 'left',
    field: 'phone',
    sortable: true
  },
  {
    name: 'status',
    required: true,
    label: 'Status',
    align: 'left',
    field: 'status',
    sortable: true
  },
  {
    name: 'payment_status',
    required: true,
    label: 'Payment Status',
    align: 'left',
    field: 'payment_status',
    sortable: true
  },
  {
    name: 'actions',
    required: true,
    label: 'Actions',
    align: 'center',
    field: 'actions'
  }
]

// Category options
const categoryOptions = [
  'Muscle Gain',
  'Muscle Lose',
  'Strength'
]

// Trainer options (you can fetch this from an API or store)
const trainerOptions = ref([
  { label: 'John Trainer', value: 1 },
  { label: 'Mike Trainer', value: 2 },
  { label: 'Sarah Trainer', value: 3 }
])

// Computed properties
const filteredUsers = computed(() => {
  if (!userSearchQuery.value) return userManagementStore.users
  const query = userSearchQuery.value.toLowerCase()
  return userManagementStore.users.filter(user => 
    user.name?.toLowerCase().includes(query) ||
    user.phone?.toLowerCase().includes(query) ||
    user.email?.toLowerCase().includes(query)
  )
})

const allTrainingPlans = computed(() => {
  // Only show unassigned training plans in the main section
  // Assigned plans should only appear in "My Assignments"
  const unassignedPlans = trainingPlans.value.filter(plan => !plan.assign_to)
  return unassignedPlans
})

const userOptions = computed(() => {
  return userManagementStore.users.map(user => ({
    label: `${user.name} (${user.phone})`,
    value: user.id
  }))
})

// Methods
const filterUsers = (val, update) => {
  update(() => {
    // Filter logic is handled by computed property
  })
}

const calculateDuration = (startDate, endDate) => {
  if (!startDate || !endDate) return 0
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffTime = Math.abs(end - start)
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

const getStatusColor = (status) => {
  switch (status) {
    case 'ACTIVE': return 'green'
    case 'PLANNED': return 'orange'
    case 'COMPLETED': return 'blue'
    case 'CANCELLED': return 'red'
    default: return 'grey'
  }
}

const editUserPlan = (user) => {
  // Find existing plan for user
  const userPlan = trainingPlans.value.find(plan => plan.user_id === user.id)
  if (userPlan) {
    editTrainingPlan(userPlan)
  } else {
    // If no plan exists, create a new one
    selectedUser.value = user.id
    showCreatePlanDialog.value = true
  }
}

const createUserPlan = (user) => {
  selectedUser.value = user.id
  showCreatePlanDialog.value = true
}

const viewUserStats = async (user) => {
  selectedUserForStats.value = user
  try {
    const response = await api.get(`/stats/view?user_id=${user.id}`)
    userStats.value = response.data.data
    showStatsDialog.value = true
  } catch (error) {
    console.error('Error fetching user stats:', error)
    userStats.value = { ongoing: [], completed: [] }
    showStatsDialog.value = true
  }
}

const viewUserTraining = (user) => {
  selectedUserForStats.value = user
  // Get all training plans for this user (both assigned and unassigned)
  const userTrainingPlans = [...trainingPlans.value, ...myAssignments.value].filter(plan => plan.user_id === user.id)
  
  // Parse exercises details for each plan
  const plansWithDetails = userTrainingPlans.map(plan => {
    let exercisesDetails = []
    if (plan.exercises_details) {
      try {
        exercisesDetails = JSON.parse(plan.exercises_details)
      } catch (e) {
        console.error('Error parsing exercises details:', e)
      }
    }
    return {
      ...plan,
      exercisesDetails
    }
  })
  
  userStats.value = { 
    trainingPlans: plansWithDetails,
    ongoing: plansWithDetails.filter(plan => plan.status === 'ACTIVE' || plan.status === 'PLANNED'),
    completed: plansWithDetails.filter(plan => plan.status === 'COMPLETED')
  }
  showStatsDialog.value = true
}

const viewTrainingPlanDetails = (plan) => {
  selectedUserForStats.value = { name: 'Training Plan Details' }
  
  // Parse exercises details if available
  let exercisesDetails = []
  if (plan.exercises_details) {
    try {
      exercisesDetails = JSON.parse(plan.exercises_details)
      console.log('Parsed exercises details:', exercisesDetails)
    } catch (e) {
      console.error('Error parsing exercises details:', e)
    }
  }
  
  // Create plan with exercises details
  const planWithDetails = {
    ...plan,
    exercisesDetails: exercisesDetails
  }
  
  userStats.value = { 
    trainingPlans: [planWithDetails],
    exercisesDetails: exercisesDetails,
    ongoing: [],
    completed: []
  }
  showStatsDialog.value = true
}

const assignTraining = async () => {
  if (selectedUser.value && selectedCategory.value) {
    try {
      // Get user name for the dialog
      const selectedUserData = userManagementStore.users.find(user => user.id === selectedUser.value)
      const userName = selectedUserData ? selectedUserData.name : 'Unknown User'
      
      // Create a detailed training plan for the user with default exercises
      const defaultExercises = getDefaultExercisesForCategory(selectedCategory.value)
      const totalWorkouts = defaultExercises.length
      const totalTrainingMinutes = defaultExercises.reduce((sum, ex) => sum + ex.training_minutes, 0)
      const totalSets = defaultExercises.reduce((sum, ex) => sum + ex.sets, 0)
      const totalReps = defaultExercises.reduce((sum, ex) => sum + ex.reps, 0)
      const totalWeight = defaultExercises.reduce((sum, ex) => sum + ex.weight, 0)
      
      const planData = {
        user_id: selectedUser.value,
        gym_id: authStore.user?.gym_id,
        trainer_id: authStore.user?.id,
        start_date: new Date().toISOString().split('T')[0], // Today's date
        end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
        category: selectedCategory.value,
        workout_name: defaultExercises.map(ex => ex.name).join(', '),
        total_workouts: totalWorkouts,
        training_minutes: totalTrainingMinutes,
        sets: totalSets,
        reps: totalReps,
        weight_kg: totalWeight,
        assign_to: authStore.user?.id, // Assign to current trainer
        status: 'PLANNED',
        exercises_details: JSON.stringify(defaultExercises)
      }
      
      const response = await api.post('/trainingPlans/', planData)
      trainingPlans.value.push(response.data.data)
      
      // Show success dialog
      assignedUserName.value = userName
      showAssignmentDialog.value = true
      
      // Auto-close dialog after 2 seconds
    setTimeout(() => {
        showAssignmentDialog.value = false
      }, 2000)
      
      // Reset form
      selectedUser.value = null
      selectedCategory.value = null
      
      // Refresh the training plans list
      await loadTrainingPlans()
  } catch (error) {
      console.error('Error assigning training plan:', error)
    }
  }
}

const addExercise = () => {
  if (newPlan.value.workout_name && newPlan.value.sets && newPlan.value.reps) {
    newPlan.value.exercises.push({
      name: newPlan.value.workout_name,
      sets: newPlan.value.sets,
      reps: newPlan.value.reps,
      weight: newPlan.value.weight_kg,
      training_minutes: newPlan.value.training_minutes,
      total_workouts: newPlan.value.total_workouts || 1
    })
    
    // Reset only exercise-specific fields, keep date range and category
    newPlan.value.workout_name = ''
    newPlan.value.total_workouts = 0
    newPlan.value.training_minutes = 0
    newPlan.value.sets = 0
    newPlan.value.reps = 0
    newPlan.value.weight_kg = 0
  }
}

const removeExercise = (index) => {
  newPlan.value.exercises.splice(index, 1)
}

const addEditExercise = () => {
  if (editingPlan.value.workout_name && editingPlan.value.sets && editingPlan.value.reps) {
    // Initialize exercises array if it doesn't exist
    if (!editingPlan.value.exercises) {
      editingPlan.value.exercises = []
    }
    
    editingPlan.value.exercises.push({
      name: editingPlan.value.workout_name,
      sets: editingPlan.value.sets,
      reps: editingPlan.value.reps,
      weight: editingPlan.value.weight_kg,
      training_minutes: editingPlan.value.training_minutes,
      total_workouts: editingPlan.value.total_workouts || 1
    })
    
    // Reset only exercise-specific fields, keep date range and category
    editingPlan.value.workout_name = ''
    editingPlan.value.total_workouts = 0
    editingPlan.value.training_minutes = 0
    editingPlan.value.sets = 0
    editingPlan.value.reps = 0
    editingPlan.value.weight_kg = 0
  }
}

const removeEditExercise = (index) => {
  editingPlan.value.exercises.splice(index, 1)
}

const createPlan = async () => {
  creatingPlan.value = true
  try {
    console.log('Creating plan with data:', newPlan.value)
    
    // Validate required fields
    if (!newPlan.value.start_date || !newPlan.value.end_date || !newPlan.value.category) {
      alert('Please fill in all required fields (Start Date, End Date, Category)')
      return
    }
    
    if (!newPlan.value.workout_name && (!newPlan.value.exercises || newPlan.value.exercises.length === 0)) {
      alert('Please add at least one workout or exercise')
      return
    }

    // Create a single plan with all exercises combined
    let workoutName = newPlan.value.workout_name
    let totalTrainingMinutes = newPlan.value.training_minutes
    let totalSets = newPlan.value.sets
    let totalReps = newPlan.value.reps
    let totalWeight = newPlan.value.weight_kg
    let allExercises = []

    // If there are exercises in the list, combine them
    if (newPlan.value.exercises && newPlan.value.exercises.length > 0) {
      // Create a combined workout name from all exercises
      const exerciseNames = newPlan.value.exercises.map(ex => ex.name).join(', ')
      workoutName = `${newPlan.value.category} Plan: ${exerciseNames}`
      
      // Sum up all the training details
      totalTrainingMinutes = newPlan.value.exercises.reduce((sum, ex) => sum + (ex.training_minutes || 0), 0)
      totalSets = newPlan.value.exercises.reduce((sum, ex) => sum + (ex.sets || 0), 0)
      totalReps = newPlan.value.exercises.reduce((sum, ex) => sum + (ex.reps || 0), 0)
      totalWeight = newPlan.value.exercises.reduce((sum, ex) => sum + (ex.weight || 0), 0)
      
      // Store all exercises details for viewing
      allExercises = newPlan.value.exercises
    } else {
      // If no exercises added, use the current form data as a single exercise
      allExercises = [{
        name: newPlan.value.workout_name,
        sets: newPlan.value.sets,
        reps: newPlan.value.reps,
        weight: newPlan.value.weight_kg,
        training_minutes: newPlan.value.training_minutes,
        total_workouts: newPlan.value.total_workouts || 1
      }]
    }

    const planData = {
      user_id: selectedUser.value,
      gym_id: authStore.user?.gym_id,
      trainer_id: authStore.user?.id,
      start_date: newPlan.value.start_date,
      end_date: newPlan.value.end_date,
      category: newPlan.value.category,
      workout_name: workoutName,
      total_workouts: allExercises.length,
      training_minutes: totalTrainingMinutes,
      sets: totalSets,
      reps: totalReps,
      weight_kg: totalWeight,
      status: 'PLANNED',
      exercises_details: JSON.stringify(allExercises) // Store exercises as JSON string
    }
    
    console.log('Sending plan data:', planData)
    const response = await api.post('/trainingPlans/', planData)
    console.log('Plan created successfully:', response.data)
    
    trainingPlans.value.push(response.data.data)
    
    closeCreatePlanDialog()
    // Refresh the training plans list
    await loadTrainingPlans()
    
    alert('Training plan created successfully!')
  } catch (error) {
    console.error('Error creating plan:', error)
    alert('Error creating plan: ' + (error.response?.data?.message || error.message))
  } finally {
    creatingPlan.value = false
  }
}

const editTrainingPlan = (plan) => {
  // Parse existing exercises details if available
  let existingExercises = []
  if (plan.exercises_details) {
    try {
      existingExercises = JSON.parse(plan.exercises_details)
    } catch (e) {
      console.error('Error parsing exercises details:', e)
    }
  }
  
  editingPlan.value = { 
    ...plan,
    exercises: existingExercises
  }
  showEditPlanDialog.value = true
}

const updatePlan = async () => {
  updatingPlan.value = true
  try {
    // Prepare update data with exercises details
    const updateData = { ...editingPlan.value }
    
    // If there are exercises, update the exercises_details field
    if (updateData.exercises && updateData.exercises.length > 0) {
      updateData.exercises_details = JSON.stringify(updateData.exercises)
      
      // Update workout name to include all exercises
      const exerciseNames = updateData.exercises.map(ex => ex.name).join(', ')
      updateData.workout_name = `${updateData.category} Plan: ${exerciseNames}`
      
      // Recalculate totals
      updateData.total_workouts = updateData.exercises.length
      updateData.training_minutes = updateData.exercises.reduce((sum, ex) => sum + (ex.training_minutes || 0), 0)
      updateData.sets = updateData.exercises.reduce((sum, ex) => sum + (ex.sets || 0), 0)
      updateData.reps = updateData.exercises.reduce((sum, ex) => sum + (ex.reps || 0), 0)
      updateData.weight_kg = updateData.exercises.reduce((sum, ex) => sum + (ex.weight || 0), 0)
    }
    
    // Remove the exercises array from the update data (it's stored in exercises_details)
    delete updateData.exercises
    
    console.log('Updating plan with data:', updateData)
    const response = await api.put(`/trainingPlans/${editingPlan.value.id}`, updateData)
    console.log('Plan updated successfully:', response.data)
    
    const index = trainingPlans.value.findIndex(plan => plan.id === editingPlan.value.id)
    if (index !== -1) {
      trainingPlans.value[index] = response.data.data
    }
    const assignmentIndex = myAssignments.value.findIndex(plan => plan.id === editingPlan.value.id)
    if (assignmentIndex !== -1) {
      myAssignments.value[assignmentIndex] = response.data.data
    }
    
    closeEditPlanDialog()
    alert('Training plan updated successfully!')
  } catch (error) {
    console.error('Error updating plan:', error)
    alert('Error updating plan: ' + (error.response?.data?.message || error.message))
  } finally {
    updatingPlan.value = false
  }
}

const deleteTrainingPlan = async (planId) => {
  if (confirm('Are you sure you want to delete this training plan?')) {
    try {
      await api.delete(`/trainingPlans/${planId}`)
      trainingPlans.value = trainingPlans.value.filter(plan => plan.id !== planId)
      myAssignments.value = myAssignments.value.filter(plan => plan.id !== planId)
    } catch (error) {
      console.error('Error deleting plan:', error)
    }
  }
}

const closeCreatePlanDialog = () => {
  showCreatePlanDialog.value = false
  newPlan.value = {
    start_date: '',
    end_date: '',
    workout_name: '',
    category: '',
    total_workouts: 0,
    training_minutes: 0,
    sets: 0,
    reps: 0,
    weight_kg: 0,
    exercises: []
  }
  selectedUser.value = null
}

const closeEditPlanDialog = () => {
  showEditPlanDialog.value = false
  editingPlan.value = {}
}

const loadTrainingPlans = async () => {
  try {
    const response = await api.get('/trainingPlans/')
    trainingPlans.value = response.data.data
  } catch (error) {
    console.error('Error loading training plans:', error)
  }
}

const loadMyAssignments = async () => {
  try {
    const response = await api.get('/trainingPlans/my-assignments')
    myAssignments.value = response.data.data
  } catch (error) {
    console.error('Error loading my assignments:', error)
  }
}

const getTrainerName = (trainerId) => {
  const trainer = trainerOptions.value.find(t => t.value === trainerId)
  return trainer ? trainer.label : 'Unknown Trainer'
}

const getDefaultExercisesForCategory = (category) => {
  const exerciseTemplates = {
    'Muscle Gain': [
      { name: 'Chest Press', sets: 3, reps: 12, weight: 40, training_minutes: 30, total_workouts: 8 },
      { name: 'Bicep Curls', sets: 3, reps: 10, weight: 30, training_minutes: 25, total_workouts: 5 },
      { name: 'Tricep Dips', sets: 3, reps: 15, weight: 35, training_minutes: 35, total_workouts: 6 },
      { name: 'Shoulder Press', sets: 3, reps: 12, weight: 25, training_minutes: 20, total_workouts: 4 }
    ],
    'Muscle Lose': [
      { name: 'Cardio Running', sets: 1, reps: 1, weight: 0, training_minutes: 45, total_workouts: 10 },
      { name: 'Burpees', sets: 3, reps: 20, weight: 0, training_minutes: 30, total_workouts: 8 },
      { name: 'Mountain Climbers', sets: 3, reps: 30, weight: 0, training_minutes: 25, total_workouts: 6 },
      { name: 'Jumping Jacks', sets: 3, reps: 50, weight: 0, training_minutes: 20, total_workouts: 5 }
    ],
    'Strength': [
      { name: 'Deadlifts', sets: 4, reps: 6, weight: 80, training_minutes: 40, total_workouts: 6 },
      { name: 'Squats', sets: 4, reps: 8, weight: 60, training_minutes: 35, total_workouts: 8 },
      { name: 'Bench Press', sets: 4, reps: 6, weight: 70, training_minutes: 30, total_workouts: 5 },
      { name: 'Pull-ups', sets: 3, reps: 8, weight: 0, training_minutes: 25, total_workouts: 4 }
    ]
  }
  
  return exerciseTemplates[category] || [
    { name: 'General Exercise', sets: 3, reps: 10, weight: 20, training_minutes: 30, total_workouts: 5 }
  ]
}

const getWorkoutNames = (plan) => {
  // If there are exercises details, extract workout names from there
  if (plan.exercises_details) {
    try {
      const exercises = JSON.parse(plan.exercises_details)
      return exercises.map(ex => ex.name)
    } catch (e) {
      console.error('Error parsing exercises details:', e)
    }
  }
  
  // Fallback: extract from workout_name if it contains multiple workouts
  if (plan.workout_name && plan.workout_name.includes(':')) {
    const workoutPart = plan.workout_name.split(':')[1]
    if (workoutPart) {
      return workoutPart.split(',').map(name => name.trim())
    }
  }
  
  // Single workout name
  return [plan.workout_name || 'Unknown Workout']
}

const refreshAllPlans = async () => {
  await loadTrainingPlans()
  await loadMyAssignments()
}

// Lifecycle
onMounted(async () => {
  await userManagementStore.fetchUsers()
  await loadTrainingPlans()
  await loadMyAssignments()
})
</script>

<style scoped>
.trainer-scheduler-page {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 2rem;
}

.page-header h1 {
  color: #333;
  margin-bottom: 0.5rem;
  font-size: 2rem;
}

.page-header p {
  color: #666;
  font-size: 1.1rem;
}

.section {
  margin-bottom: 3rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.section-header h2 {
  color: #333;
  margin: 0;
  font-size: 1.5rem;
}

.search-container {
  width: 300px;
}

.user-table {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.assign-training-card {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  margin-bottom: 2rem;
}

.assign-training-card h3 {
  margin: 0 0 1rem 0;
  color: #333;
}

.assign-form {
  width: 100%;
}

.form-row {
  display: flex;
  gap: 1rem;
  align-items: end;
}

.user-select {
  flex: 2;
}

.category-select {
  flex: 1;
}

.training-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}

.training-card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  transition: transform 0.2s;
}

.training-card:hover {
  transform: translateY(-2px);
}

.assignment-card {
  border-left: 4px solid #2196f3;
}

.assignment-badge {
  font-size: 0.75rem;
}

.training-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}

.training-card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  transition: transform 0.2s;
}

.training-card:hover {
  transform: translateY(-2px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.card-header h4 {
  margin: 0;
  color: #333;
  font-size: 1.2rem;
}

.card-actions {
  display: flex;
  gap: 0.5rem;
}

.plan-details p {
  margin: 0.5rem 0;
  color: #666;
}

.plan-main-info {
  margin-bottom: 1rem;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  padding: 0.5rem;
  background: #f8f9fa;
  border-radius: 4px;
}

.info-item span {
  color: #333;
  font-size: 0.9rem;
}

.plan-status {
  border-top: 1px solid #e9ecef;
  padding-top: 0.5rem;
  margin-top: 0.5rem;
}

.no-plans {
  text-align: center;
  padding: 3rem;
  color: #999;
}

.no-plans p {
  margin-top: 1rem;
  font-size: 1.1rem;
}

.form-section {
  margin-bottom: 2rem;
}

.form-section h4 {
  margin: 0 0 1rem 0;
  color: #333;
  font-size: 1.1rem;
}

.date-range {
  display: flex;
  gap: 1rem;
}

.date-input {
  flex: 1;
}

.exercise-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.form-field {
  width: 100%;
}

.exercises-list {
  margin: 1rem 0;
}

.exercise-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background: #f5f5f5;
  border-radius: 4px;
  margin-bottom: 0.5rem;
}

.add-exercise-btn {
  margin-top: 1rem;
}

.stats-content {
  max-height: 400px;
  overflow-y: auto;
}

.stats-section {
  margin-bottom: 2rem;
}

.stats-section h4 {
  margin: 0 0 1rem 0;
  color: #333;
  font-size: 1.1rem;
}

.workout-item {
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 4px;
  margin-bottom: 0.5rem;
}

.workout-item p {
  margin: 0.25rem 0;
  color: #666;
}

.training-plan-item {
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 1rem;
  border: 1px solid #e9ecef;
}

.plan-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.plan-header h5 {
  margin: 0;
  color: #333;
  font-size: 1.1rem;
}

.plan-details p {
  margin: 0.25rem 0;
  color: #666;
  font-size: 0.9rem;
}

.plan-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
  justify-content: flex-end;
}

.plan-overview {
  margin-bottom: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 6px;
}

.exercises-details {
  margin-top: 1rem;
  padding: 1rem;
  background: #e3f2fd;
  border-radius: 6px;
  border-left: 4px solid #2196f3;
}

.exercises-details h6 {
  margin: 0 0 1rem 0;
  color: #1976d2;
  font-size: 1rem;
}

.exercises-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.exercise-detail-item {
  padding: 0.75rem;
  background: white;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}

.exercise-info .exercise-name {
  display: block;
  margin: 0 0 0.25rem 0;
  color: #333;
  font-size: 0.95rem;
}

.exercise-info p {
  margin: 0;
  color: #666;
  font-size: 0.85rem;
}

.workout-names-section {
  margin-bottom: 1rem;
}

.workout-names-section h5 {
  margin: 0 0 0.5rem 0;
  color: #333;
  font-size: 1rem;
}

.workout-names-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.workout-name-tag {
  background: #e3f2fd;
  color: #1976d2;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 500;
  border: 1px solid #bbdefb;
}

.duration-section {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding: 0.5rem;
  background: #f8f9fa;
  border-radius: 6px;
}

.duration-section span {
  color: #333;
  font-size: 0.9rem;
}

.other-details-section {
  border-top: 1px solid #e9ecef;
  padding-top: 1rem;
}

.detail-row {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
}

.detail-row span {
  color: #666;
  font-size: 0.85rem;
  min-width: fit-content;
}

.workout-cards-section {
  margin-top: 1.5rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.workout-cards-section h6 {
  margin: 0 0 1rem 0;
  color: #333;
  font-size: 1.1rem;
  text-align: center;
}

.workout-cards-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.workout-detail-card {
  background: #4caf50;
  border-radius: 8px;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  transition: transform 0.2s, box-shadow 0.2s;
}

.workout-detail-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.workout-card-header {
  background: transparent;
  color: white;
  padding: 0.75rem 1rem;
  border-radius: 8px 8px 0 0;
  text-align: left;
}

.workout-card-header .exercise-name {
  margin: 0;
  font-size: 1.1rem;
  font-weight: bold;
  color: white;
}

.workout-card-content {
  padding: 0 1rem 1rem 1rem;
}

.workout-detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  padding: 0.25rem 0;
}

.workout-detail-row:last-child {
  margin-bottom: 0;
}

.detail-label {
  color: white;
  font-size: 0.9rem;
  font-weight: 500;
}

.detail-value {
  color: white;
  font-size: 0.9rem;
  font-weight: bold;
}

.no-exercises-message {
  margin-top: 1.5rem;
  padding: 1rem;
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 6px;
  text-align: center;
}

.no-exercises-message p {
  margin: 0;
  color: #856404;
  font-size: 0.9rem;
}

.assignment-success {
  padding: 2rem;
}

.success-title {
  margin: 1rem 0;
  color: #333;
  font-size: 1.3rem;
  font-weight: 600;
}

.user-name {
  margin: 1rem 0 2rem 0;
  color: #666;
  font-size: 1.1rem;
}

.loading-bar {
  margin-top: 1rem;
}

.progress-bar {
  height: 4px;
  border-radius: 2px;
}

@media (max-width: 768px) {
  .trainer-scheduler-page {
    padding: 1rem;
  }
  
  .section-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .search-container {
    width: 100%;
  }
  
  .form-row {
    flex-direction: column;
  }
  
  .training-cards-grid {
    grid-template-columns: 1fr;
  }
  
  .exercise-form {
    grid-template-columns: 1fr;
  }
  
  .date-range {
    flex-direction: column;
  }
  
  .training-cards-grid {
    grid-template-columns: 1fr;
  }
  
  .workout-cards-grid {
    grid-template-columns: 1fr;
  }
  
  .detail-row {
    flex-direction: column;
    gap: 0.5rem;
  }
}
</style>
