<template>
  <div class="trainer-scheduler-page">
    <q-card class="header-card q-mb-lg" elevated>
      <q-card-section class="q-pa-lg">
        <div class="header-content">
          <div class="text-h4 text-weight-bold text-primary q-mb-xs">Trainer Scheduler</div>
          <div class="text-subtitle1 text-grey-6">Manage training plans and user assignments</div>
        </div>
      </q-card-section>
    </q-card>

    <q-card class="approval-section-card q-mb-lg" elevated>
      <q-card-section class="q-pa-lg">
        <div class="row items-center justify-between q-mb-lg">
      <div class="section-header">
            <div class="text-h6 text-weight-bold text-primary q-mb-sm">Approval Training</div>
            <div class="text-caption text-grey-6">Review and manage training approval requests</div>
          </div>
          <div class="search-container">
          <q-input
            v-model="approvalSearch"
            placeholder="Search training by name"
            outlined
              clearable
            class="search-input"
          >
            <template v-slot:prepend>
                <q-icon name="search" color="primary" />
            </template>
          </q-input>
        </div>
      </div>

      <div class="training-cards-grid">
        <q-card
          v-for="ap in paginatedApprovals"
          :key="ap.id"
          class="training-card"
          elevated
        >
            <q-card-section class="training-card-header">
              <div class="row items-center justify-between">
                <div class="plan-info">
                  <div class="text-h6 text-weight-bold text-primary">{{ ap.workout_name }}</div>
                  <div class="text-caption text-grey-6 q-mt-xs">
                    <q-icon name="person" size="14px" class="q-mr-xs" />
                    {{ ap.user_name }}
              </div>
            </div>
                <q-badge 
                  :color="ap.approval_status === 'APPROVED' ? 'positive' : (ap.approval_status === 'REJECTED' ? 'negative' : 'warning')" 
                  :label="ap.approval_status"
                  class="status-badge"
                >
                  <q-icon 
                    :name="ap.approval_status === 'APPROVED' ? 'check_circle' : (ap.approval_status === 'REJECTED' ? 'cancel' : 'schedule')"
                    class="q-mr-xs"
                  />
                </q-badge>
              </div>
            </q-card-section>

            <q-card-section class="training-card-content">
              <div class="plan-details">
                <div class="row q-col-gutter-sm">
                  <div class="col-12 col-sm-6">
                    <div class="detail-item">
                      <q-icon name="category" color="primary" size="16px" class="q-mr-xs" />
                      <span class="text-caption text-grey-6">Plan Category</span>
                      <div class="text-body2 text-weight-medium">{{ ap.plan_category_name || ap.category || 'N/A' }}</div>
              </div>
            </div>
                  <div class="col-12 col-sm-6">
                    <div class="detail-item">
                      <q-icon name="schedule" color="primary" size="16px" class="q-mr-xs" />
                      <span class="text-caption text-grey-6">Total Days</span>
                      <div class="text-body2 text-weight-medium">{{ ap.total_days || calculateDuration(ap.start_date, ap.end_date) }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </q-card-section>

            <q-card-actions class="training-card-actions">
              <q-btn 
                color="primary" 
                label="View Details" 
                icon="visibility"
                @click="viewApprovalDetails(ap.id)" 
                class="action-btn"
                unelevated
              />
              <q-btn 
                v-if="ap.approval_status === 'PENDING'"
                color="positive" 
                label="Approve" 
                icon="check"
                @click="approveRequest(ap.id)" 
                class="action-btn"
                unelevated
              />
              <q-btn 
                v-if="ap.approval_status === 'PENDING'"
                color="negative" 
                label="Reject" 
                icon="close"
                @click="rejectRequest(ap.id)" 
                class="action-btn"
                unelevated
              />
              <q-btn 
                color="negative" 
                icon="delete" 
                flat 
                @click="deleteTrainingApproval(ap.id)"
                class="action-btn"
              >
                <q-tooltip>Delete Approval</q-tooltip>
              </q-btn>
            </q-card-actions>
          </q-card>
            </div>

        <!-- Pagination for Approvals -->
        <div v-if="filteredApprovals.length > 0" class="approval-pagination q-mt-lg">
          <q-pagination
            v-model="currentApprovalPage"
            :max="totalApprovalPages"
            :max-pages="5"
            direction-links
            boundary-links
            color="primary"
            size="md"
            class="approval-pagination-controls"
          />
          <div class="approval-pagination-info">
            <span class="text-caption">
              Showing {{ (currentApprovalPage - 1) * approvalsPerPage + 1 }} to 
              {{ Math.min(currentApprovalPage * approvalsPerPage, filteredApprovals.length) }} 
              of {{ filteredApprovals.length }} approvals
            </span>
          </div>
        </div>

        <q-card v-if="filteredApprovals.length === 0" class="empty-state-card" elevated>
          <q-card-section class="text-center q-pa-xl">
            <q-icon name="assignment" size="64px" color="grey-5" class="q-mb-md" />
            <div class="text-h6 text-grey-7 q-mb-sm">No pending approvals</div>
            <div class="text-body2 text-grey-6">All training requests have been processed</div>
          </q-card-section>
        </q-card>
      </q-card-section>
    </q-card>

    <q-card class="user-list-card q-mb-lg" elevated>
      <q-card-section class="q-pa-lg">
        <div class="row items-center justify-between q-mb-lg">
      <div class="section-header">
            <div class="text-h6 text-weight-bold text-primary q-mb-sm">User List</div>
            <div class="text-caption text-grey-6">Manage gym members and their information</div>
          </div>
        <div class="search-container">
          <q-input
            v-model="userSearchQuery"
            placeholder="Search by name or phone..."
            outlined
              clearable
            class="search-input"
          >
            <template v-slot:prepend>
                <q-icon name="search" color="primary" />
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
          :rows-per-page-options="[5, 10, 20]"
          loading-label="Loading users..."
          no-data-label="No users found"
          rows-per-page-label="Records per page:"
        >
          <template v-slot:body-cell-id="props">
            <q-td :props="props">
              <q-badge color="primary" class="user-id-badge">
                #{{ props.value }}
              </q-badge>
            </q-td>
          </template>

          <template v-slot:body-cell-name="props">
            <q-td :props="props">
              <div class="user-name-cell">
                <q-avatar size="32px" color="primary" text-color="white" class="q-mr-sm">
                  {{ props.value.charAt(0).toUpperCase() }}
                </q-avatar>
                <div>
                  <div class="text-weight-medium">{{ props.value }}</div>
                </div>
              </div>
            </q-td>
          </template>

          <template v-slot:body-cell-email="props">
            <q-td :props="props">
              <div class="text-body2">{{ props.value }}</div>
            </q-td>
          </template>

          <template v-slot:body-cell-phone="props">
            <q-td :props="props">
              <div class="text-body2">
                <q-icon name="phone" size="14px" class="q-mr-xs text-grey-6" />
                {{ props.value }}
              </div>
            </q-td>
          </template>

        <template v-slot:body-cell-status="props">
          <q-td :props="props">
            <q-badge
                :color="props.value === 'ACTIVE' ? 'positive' : 'negative'"
              :label="props.value"
                class="status-badge"
              >
                <q-icon 
                  :name="props.value === 'ACTIVE' ? 'check_circle' : 'cancel'"
                  class="q-mr-xs"
            />
              </q-badge>
          </q-td>
        </template>

        <template v-slot:body-cell-payment_status="props">
          <q-td :props="props">
            <q-badge
                :color="props.value === 'Paid' ? 'positive' : 'negative'"
              :label="props.value || 'Unpaid'"
                class="payment-badge"
              >
                <q-icon 
                  :name="props.value === 'Paid' ? 'check_circle' : 'cancel'"
                  class="q-mr-xs"
            />
              </q-badge>
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
                  class="action-btn"
                >
                  <q-tooltip>Edit Plan</q-tooltip>
                </q-btn>
              <q-btn
                flat
                round
                color="secondary"
                icon="add"
                size="sm"
                @click="createUserPlan(props.row)"
                  class="action-btn"
                >
                  <q-tooltip>Create Plan</q-tooltip>
                </q-btn>
              <q-btn
                flat
                round
                color="orange"
                icon="visibility"
                size="sm"
                @click="viewUserTraining(props.row)"
                  class="action-btn"
                >
                  <q-tooltip>View Training</q-tooltip>
                </q-btn>
              <q-btn
                flat
                round
                color="info"
                icon="analytics"
                size="sm"
                @click="viewUserStats(props.row)"
                  class="action-btn"
                >
                  <q-tooltip>View Stats</q-tooltip>
                </q-btn>
            </div>
          </q-td>
        </template>
      </q-table>
      </q-card-section>
    </q-card>
          
    <!-- Planned Trainings Section -->
    <q-card class="planned-trainings-card q-mb-lg" elevated>
      <q-card-section class="q-pa-lg">
        <div class="row items-center justify-between q-mb-lg">
      <div class="section-header">
            <div class="text-h6 text-weight-bold text-primary q-mb-sm">Planned Trainings</div>
            <div class="text-caption text-grey-6">Create and manage training plans for gym members</div>
          </div>
        <q-btn
          color="primary"
          icon="add"
          label="Create New Plan"
          @click="showCreatePlanDialog = true"
            class="create-plan-btn"
            unelevated
            size="md"
        />
          </div>

        <q-card class="assign-training-card" flat bordered>
          <q-card-section class="q-pa-lg">
            <div class="text-h6 text-weight-bold text-primary q-mb-md">Assign Training to User</div>
        <div class="assign-form">
              <div class="form-row q-mb-md">
            <q-select
              v-model="selectedUser"
              :options="userOptions"
              option-label="label"
              option-value="value"
              emit-value
              map-options
              label="Search User by Name and Phone"
              outlined
                  clearable
              use-input
              input-debounce="300"
              @filter="filterUsers"
                  class="form-field"
            >
                  <template v-slot:prepend>
                    <q-icon name="person" color="primary" />
                  </template>
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
              :options="assignmentCategoryOptions"
              label="Select Training Plan Category"
              outlined
                  clearable
                  emit-value
                  map-options
                  class="form-field"
                  :disable="assignmentCategoryOptions.length === 0"
                >
                  <template v-slot:prepend>
                    <q-icon name="category" color="primary" />
                  </template>
                  <template v-slot:no-option>
                    <q-item>
                      <q-item-section class="text-grey">
                        No training plans created yet. Create a plan first.
                      </q-item-section>
                    </q-item>
                  </template>
                </q-select>

            <q-select
              v-model="selectedUserLevel"
              :options="assignmentUserLevelOptions"
              label="Select User Level"
              outlined
                  clearable
                  emit-value
                  map-options
                  class="form-field"
                  :disable="assignmentUserLevelOptions.length === 0"
                >
                  <template v-slot:prepend>
                    <q-icon name="fitness_center" color="primary" />
                  </template>
                  <template v-slot:no-option>
                    <q-item>
                      <q-item-section class="text-grey">
                        No training plans created yet. Create a plan first.
                      </q-item-section>
                    </q-item>
                  </template>
                </q-select>

            <!-- Show selected plan details -->
            <div v-if="selectedPlan" class="selected-plan-preview q-mb-md">
              <q-card flat bordered class="q-pa-md">
                <div class="text-subtitle2 text-weight-bold text-primary q-mb-sm">
                  <q-icon name="info" class="q-mr-xs" />
                  Plan to be assigned:
                </div>
                <div class="text-body2">
                  <div><strong>Plan:</strong> {{ selectedPlan.workout_name }}</div>
                  <div><strong>Duration:</strong> {{ calculateDuration(selectedPlan.start_date, selectedPlan.end_date) }} days</div>
                  <div><strong>Start Date:</strong> {{ formatDate(selectedPlan.start_date) }}</div>
                  <div><strong>End Date:</strong> {{ formatDate(selectedPlan.end_date) }}</div>
                  <div><strong>Exercises:</strong> {{ selectedPlan.total_exercises || 0 }}</div>
                </div>
              </q-card>
            </div>

            <q-btn
                  color="positive"
              label="Assign Training"
                  icon="assignment"
              @click="assignTraining"
              :disable="!selectedUser || !selectedCategory || !selectedUserLevel || assignmentCategoryOptions.length === 0 || assignmentUserLevelOptions.length === 0"
                  class="assign-btn"
                  unelevated
                  size="md"
            />
          </div>
          </div>
          </q-card-section>
        </q-card>
      </q-card-section>
    </q-card>

    <!-- Training Plans Section -->
    <q-card class="training-plans-card" elevated>
      <q-card-section class="q-pa-lg">
        <div class="row items-center justify-between q-mb-lg">
      <div class="section-header">
            <div class="text-h6 text-weight-bold text-primary q-mb-sm">Training Plans</div>
            <div class="text-caption text-grey-6">View and manage existing training plans</div>
          </div>
        <q-btn
          color="info"
          icon="refresh"
          label="Refresh"
          @click="refreshAllPlans"
            class="refresh-btn"
            unelevated
            size="md"
        />
      </div>

      <div class="training-cards-grid">
        <q-card
          v-for="plan in paginatedTrainingPlans"
          :key="plan.id"
            class="training-plan-card"
            elevated
          >
            <q-card-section class="training-plan-header">
              <div class="row items-center justify-between">
                <div class="plan-info">
                  <div class="text-h6 text-weight-bold text-primary">{{ plan.category }} Plan</div>
                  <div class="text-caption text-grey-6 q-mt-xs">
                    <q-icon name="fitness_center" size="14px" class="q-mr-xs" />
                    Training Plan
                  </div>
                </div>
                <div class="action-buttons">
                 <q-btn
                   flat
                   round
                   color="orange"
                   icon="visibility"
                   size="sm"
                   @click="viewTrainingPlanDetails(plan)"
                    class="action-btn"
                  >
                    <q-tooltip>View Workout Details</q-tooltip>
                  </q-btn>
                 <q-btn
                   flat
                   round
                   color="primary"
                   icon="edit"
                   size="sm"
                   @click="editTrainingPlan(plan)"
                    class="action-btn"
                  >
                    <q-tooltip>Edit Plan</q-tooltip>
                  </q-btn>
                 <q-btn
                   flat
                   round
                    color="negative"
                   icon="delete"
                   size="sm"
                   @click="deleteTrainingPlan(plan.id)"
                    class="action-btn"
                  >
                    <q-tooltip>Delete Plan</q-tooltip>
                  </q-btn>
               </div>
             </div>
            </q-card-section>

            <q-card-section class="training-plan-content">
              <div class="plan-details">
                <div class="row q-col-gutter-sm">
                  <div class="col-12 col-sm-6">
                    <div class="detail-item">
                      <q-icon name="schedule" color="primary" size="16px" class="q-mr-xs" />
                      <span class="text-caption text-grey-6">Duration</span>
                      <div class="text-body2 text-weight-medium">{{ calculateDuration(plan.start_date, plan.end_date) }} days</div>
          </div>
          </div>
                  <div class="col-12 col-sm-6">
                    <div class="detail-item">
                      <q-icon name="event" color="primary" size="16px" class="q-mr-xs" />
                      <span class="text-caption text-grey-6">Start Date</span>
                      <div class="text-body2 text-weight-medium">{{ formatDate(plan.start_date) }}</div>
        </div>
                 </div>
                  <div class="col-12 col-sm-6">
                    <div class="detail-item">
                      <q-icon name="event" color="primary" size="16px" class="q-mr-xs" />
                      <span class="text-caption text-grey-6">End Date</span>
                      <div class="text-body2 text-weight-medium">{{ formatDate(plan.end_date) }}</div>
                    </div>
                  </div>
                  <div class="col-12 col-sm-6">
                    <div class="detail-item">
                      <q-icon name="fitness_center" color="primary" size="16px" class="q-mr-xs" />
                      <span class="text-caption text-grey-6">User Level</span>
                      <div class="text-body2 text-weight-medium">{{ plan.user_level || 'N/A' }}</div>
                    </div>
                 </div>
                 <div class="col-12" v-if="getDistributionSummary(plan)">
                   <div class="detail-item">
                     <q-icon name="calendar_view_week" color="primary" size="16px" class="q-mr-xs" />
                     <span class="text-caption text-grey-6">Distribution</span>
                     <div class="text-body2 text-weight-medium">{{ getDistributionSummary(plan) }}</div>
                   </div>
                 </div>
               </div>
             </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Pagination for Training Plans -->
      <div v-if="allTrainingPlans.length > 0" class="training-plans-pagination q-mt-lg">
        <q-pagination
          v-model="currentTrainingPlansPage"
          :max="totalTrainingPlansPages"
          :max-pages="5"
          direction-links
          boundary-links
          color="primary"
          size="md"
          class="training-plans-pagination-controls"
        />
        <div class="training-plans-pagination-info">
          <span class="text-caption">
            Showing {{ (currentTrainingPlansPage - 1) * trainingPlansPerPage + 1 }} to 
            {{ Math.min(currentTrainingPlansPage * trainingPlansPerPage, allTrainingPlans.length) }} 
            of {{ allTrainingPlans.length }} training plans
          </span>
        </div>
      </div>

        <q-card v-if="allTrainingPlans.length === 0" class="empty-state-card" elevated>
          <q-card-section class="text-center q-pa-xl">
            <q-icon name="fitness_center" size="64px" color="grey-5" class="q-mb-md" />
            <div class="text-h6 text-grey-7 q-mb-sm">No training plans created yet</div>
            <div class="text-body2 text-grey-6">Create your first training plan to get started</div>
          </q-card-section>
        </q-card>
      </q-card-section>
    </q-card>

     <!-- My Assignments Section -->
    <q-card class="my-assignments-card q-mb-lg" elevated>
      <q-card-section class="q-pa-lg">
        <div class="row items-center justify-between q-mb-lg">
       <div class="section-header">
            <div class="text-h6 text-weight-bold text-primary q-mb-sm">My Assignments</div>
            <div class="text-caption text-grey-6">Training plans assigned to you</div>
          </div>
         <q-btn
           color="info"
           icon="refresh"
           label="Refresh"
           @click="loadMyAssignments"
            class="refresh-btn"
            unelevated
            size="md"
         />
          </div>

       <div class="training-cards-grid">
         <q-card
           v-for="plan in paginatedAssignments"
           :key="plan.id"
           class="training-card assignment-card"
           elevated
         >
            <q-card-section class="training-card-header">
              <div class="row items-center justify-between">
                <div class="plan-info">
                  <div class="text-h6 text-weight-bold text-primary">{{ plan.category }} Plan</div>
                  <div class="text-caption text-grey-6 q-mt-xs">
                    <q-icon name="assignment" size="14px" class="q-mr-xs" />
                    Assigned Training
                  </div>
                </div>
                 <q-badge
                   color="info"
                   label="Assigned"
                   class="assignment-badge"
                >
                  <q-icon name="assignment" class="q-mr-xs" />
                </q-badge>
              </div>
            </q-card-section>

            <q-card-section class="training-card-content">
              <div class="plan-details">
                <div class="row q-col-gutter-sm">
                  <div class="col-12 col-sm-6">
                    <div class="detail-item">
                      <q-icon name="schedule" color="primary" size="16px" class="q-mr-xs" />
                      <span class="text-caption text-grey-6">Duration</span>
                      <div class="text-body2 text-weight-medium">{{ calculateDuration(plan.start_date, plan.end_date) }} days</div>
                    </div>
                  </div>
                  <div class="col-12 col-sm-6">
                    <div class="detail-item">
                      <q-icon name="person" color="primary" size="16px" class="q-mr-xs" />
                      <span class="text-caption text-grey-6">User</span>
                      <div class="text-body2 text-weight-medium">{{ getUserName(plan.user_id) }}</div>
                    </div>
                  </div>
                  <div class="col-12 col-sm-6">
                    <div class="detail-item">
                      <q-icon name="event" color="primary" size="16px" class="q-mr-xs" />
                      <span class="text-caption text-grey-6">Start Date</span>
                      <div class="text-body2 text-weight-medium">{{ formatDate(plan.start_date) }}</div>
                    </div>
                  </div>
                  <div class="col-12 col-sm-6">
                    <div class="detail-item">
                      <q-icon name="event" color="primary" size="16px" class="q-mr-xs" />
                      <span class="text-caption text-grey-6">End Date</span>
                      <div class="text-body2 text-weight-medium">{{ formatDate(plan.end_date) }}</div>
                    </div>
                  </div>
                  <div class="col-12 col-sm-6" v-if="plan.assigned_by_trainer">
                    <div class="detail-item">
                      <q-icon name="person_add" color="primary" size="16px" class="q-mr-xs" />
                      <span class="text-caption text-grey-6">Assigned By</span>
                      <div class="text-body2 text-weight-medium">{{ plan.assigned_by_trainer.name }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </q-card-section>

            <q-card-actions class="training-card-actions">
                 <q-btn
                   flat
                   color="orange"
                   icon="visibility"
                   size="sm"
                   @click="viewTrainingPlanDetails(plan)"
                class="action-btn"
              >
                <q-tooltip>View Workout Details</q-tooltip>
              </q-btn>
                 <q-btn
                   flat
                   color="primary"
                   icon="edit"
                   size="sm"
                   @click="editTrainingPlan(plan)"
                class="action-btn"
              >
                <q-tooltip>Edit Plan</q-tooltip>
              </q-btn>
                 <q-btn
                   flat
                color="negative"
                   icon="delete"
                   size="sm"
                   @click="deleteTrainingPlan(plan.id, true)"
                class="action-btn"
              >
                <q-tooltip>Unassign Plan</q-tooltip>
              </q-btn>
            </q-card-actions>
          </q-card>
             </div>

        <!-- Pagination for Assignments -->
        <div v-if="myAssignments.length > 0" class="assignment-pagination q-mt-lg">
          <q-pagination
            v-model="currentAssignmentPage"
            :max="totalAssignmentPages"
            :max-pages="5"
            direction-links
            boundary-links
            color="primary"
            size="md"
            class="assignment-pagination-controls"
          />
          <div class="assignment-pagination-info">
            <span class="text-caption">
              Showing {{ (currentAssignmentPage - 1) * assignmentsPerPage + 1 }} to 
              {{ Math.min(currentAssignmentPage * assignmentsPerPage, myAssignments.length) }} 
              of {{ myAssignments.length }} assignments
            </span>
          </div>
        </div>

        <q-card v-if="myAssignments.length === 0" class="empty-state-card" elevated>
          <q-card-section class="text-center q-pa-xl">
            <q-icon name="assignment" size="64px" color="grey-5" class="q-mb-md" />
            <div class="text-h6 text-grey-7 q-mb-sm">No assignments yet</div>
            <div class="text-body2 text-grey-6">Training plans will appear here when assigned to you</div>
           </q-card-section>
         </q-card>
      </q-card-section>
    </q-card>

    <!-- Create New Plan Dialog -->
    <q-dialog v-model="showCreatePlanDialog" persistent>
      <q-card style="min-width: 600px; max-width: 800px">
        <q-card-section>
          <div class="text-h6">Create New Plan</div>
        </q-card-section>

        <q-banner class="bg-info text-white q-mx-md q-mb-md" rounded dense>
          <template v-slot:avatar>
            <q-icon name="info" color="white" />
          </template>
          <div class="text-caption">
            <strong>Note:</strong> Add exercises using the "Add Exercises" button below, then click "Create Plan" to save the plan with all exercises.
          </div>
        </q-banner>

        <q-card-section class="q-pt-none">
          <div class="form-section">
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
            <div class="exercise-form">
              <q-select
                v-model="newPlan.category"
                :options="categoryOptions"
                label="Exercise Plan Category"
                outlined
                dense
                class="form-field"
              />
              <q-select
                v-model="newPlan.user_level"
                :options="userLevelOptions"
                label="User Level"
                outlined
                dense
                class="form-field"
              />
            </div>
          </div>

          <div class="form-section">
            <q-banner v-if="(newPlan.exercises && newPlan.exercises.length > 0)" class="bg-positive text-white q-mb-md" rounded>
              <template v-slot:avatar>
                <q-icon name="check_circle" color="white" />
              </template>
              <div class="text-weight-bold">
                {{ newPlan.exercises.length }} exercise(s) added successfully!
              </div>
              <div class="text-caption">
                Click "Add Exercises" to add more, or click "Create Plan" below to save the plan with all exercises.
              </div>
            </q-banner>
            
            <div class="add-exercise-button-container">
              <q-btn
                color="primary"
                icon="add"
                label="Add Exercises"
                @click="toggleAddExerciseForm"
                class="add-more-exercises-btn"
                unelevated
                size="md"
              />
            </div>
          </div>

          <div class="form-section" v-if="showAddExerciseForm">
            <h4>Add Exercise</h4>
            <div class="add-exercise-form">
              <q-input
                v-model="newExercise.name"
                label="Exercise Name"
                outlined
                dense
                class="form-field"
              />
              <q-input
                v-model.number="newExercise.exercise_types"
                label="Exercise Types (number)"
                type="number"
                outlined
                dense
                class="form-field"
              />
              <q-input
                v-model.number="newExercise.sets"
                label="Sets"
                type="number"
                outlined
                dense
                class="form-field"
              />
              <q-input
                v-model.number="newExercise.reps"
                label="Reps"
                type="number"
                outlined
                dense
                class="form-field"
              />
              <q-input
                v-model="newExercise.weight_kg"
                label="Weight (kg)"
                type="text"
                outlined
                dense
                class="form-field"
              />
              <q-input
                v-model.number="newExercise.minutes"
                label="Minutes"
                type="number"
                outlined
                dense
                class="form-field"
              />
              <div class="add-exercise-actions">
                <q-btn
                  color="primary"
                  icon="add"
                  label="Add Exercise"
                  @click="addExercise"
                  class="add-exercise-btn"
                  unelevated
                  size="md"
                />
                <q-btn
                  flat
                  label="Cancel"
                  @click="cancelAddExercise"
                  class="cancel-exercise-btn"
                  size="md"
                />
              </div>
            </div>
          </div>

          <div class="exercises-list" v-if="newPlan.exercises && newPlan.exercises.length > 0">
            <h4>Exercises ({{ newPlan.exercises.length }})</h4>
            <div
              v-for="(exercise, index) in newPlan.exercises"
              :key="index"
              class="exercise-item"
            >
              <div class="exercise-header">
                <strong>{{ exercise.name }}</strong>
                <div class="exercise-actions">
                  <q-btn
                    flat
                    round
                    color="primary"
                    icon="edit"
                    size="sm"
                    @click="editExercise(index)"
                    class="q-mr-xs"
                  >
                    <q-tooltip>Edit Exercise</q-tooltip>
                  </q-btn>
                  <q-btn
                    flat
                    round
                    color="negative"
                    icon="delete"
                    size="sm"
                    @click="removeExercise(index)"
                  >
                    <q-tooltip>Delete Exercise</q-tooltip>
                  </q-btn>
                </div>
              </div>
              <div class="exercise-details">
                <span>Exercise Types: {{ exercise.exercise_types || 'N/A' }}</span>
                <span>Sets: {{ exercise.sets }}</span>
                <span>Reps: {{ exercise.reps }}</span>
                <span>Weight: {{ exercise.weight_kg }}kg</span>
                <span>Minutes: {{ exercise.minutes }}</span>
              </div>
            </div>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" @click="showCreatePlanDialog = false" />
          <q-btn
            color="primary"
            label="Create Plan"
            @click="createPlan"
            :loading="creatingPlan"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Edit Plan Dialog -->
     <q-dialog v-model="showEditPlanDialog" persistent>
       <q-card style="min-width: 600px; max-width: 800px">
         <q-card-section>
          <div class="text-h6">Edit Plan</div>
         </q-card-section>

         <q-card-section class="q-pt-none">
           <div class="form-section">
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
             <div class="exercise-form">
               <q-select
                 v-model="editingPlan.category"
                 :options="categoryOptions"
                label="Exercise Plan Category"
                 outlined
                 dense
                 class="form-field"
               />
              <q-select
                v-model="editingPlan.user_level"
                :options="userLevelOptions"
                label="User Level"
                outlined
                dense
                class="form-field"
              />
             </div>
           </div>

          <div class="form-section">
            <q-banner v-if="(editingPlan.exercises && editingPlan.exercises.length > 0)" class="bg-positive text-white q-mb-md" rounded>
              <template v-slot:avatar>
                <q-icon name="check_circle" color="white" />
              </template>
              <div class="text-weight-bold">
                {{ editingPlan.exercises.length }} exercise(s) in this plan
            </div>
              <div class="text-caption">
                Click "Add Exercises" to add more, or click "Update Plan" below to save changes.
              </div>
            </q-banner>
            
            <div class="add-exercise-button-container">
                <q-btn
                color="primary"
                icon="add"
                label="Add Exercises"
                @click="toggleAddExerciseForm"
                class="add-more-exercises-btn"
                unelevated
                size="md"
                />
              </div>
          </div>

          <div class="form-section" v-if="showAddExerciseForm">
            <h4>Add Exercise</h4>
            <div class="add-exercise-form">
                <q-input 
                v-model="newExercise.name"
                label="Exercise Name"
                 outlined
                 dense
                 class="form-field"
               />
               <q-input
                v-model.number="newExercise.exercise_types"
                label="Exercise Types (number)"
                type="number"
                outlined
                dense
                class="form-field"
              />
               <q-input
                v-model.number="newExercise.sets"
                  label="Sets" 
                 type="number"
                 outlined
                 dense
                 class="form-field"
               />
               <q-input
                v-model.number="newExercise.reps"
                  label="Reps" 
                 type="number"
                 outlined
                 dense
                 class="form-field"
               />
               <q-input
                v-model.number="newExercise.weight_kg"
                label="Weight (kg)"
                 type="number"
                  step="0.1"
                 outlined
                 dense
                 class="form-field"
               />
               <q-input
                v-model.number="newExercise.minutes"
                  label="Minutes" 
                type="number"
                 outlined
                 dense
                 class="form-field"
               />
              <div class="add-exercise-actions">
                <q-btn
                  color="primary"
                  icon="add"
                  label="Add Exercise"
                  @click="addExerciseToEdit"
                  class="add-exercise-btn"
                  unelevated
                  size="md"
                />
                <q-btn
                  flat
                  label="Cancel"
                  @click="cancelAddExercise"
                  class="cancel-exercise-btn"
                  size="md"
               />
              </div>
             </div>
           </div>

          <div class="exercises-list" v-if="editingPlan.exercises && editingPlan.exercises.length > 0">
            <h4>Exercises ({{ editingPlan.exercises.length }})</h4>
            <div
              v-for="(exercise, index) in editingPlan.exercises"
              :key="index"
              class="exercise-item"
            >
              <div class="exercise-header">
                <strong>{{ exercise.name }}</strong>
                <div class="exercise-actions">
                  <q-btn
                    flat
                    round
                    color="primary"
                    icon="edit"
                    size="sm"
                    @click="editExercise(index)"
                    class="q-mr-xs"
                  >
                    <q-tooltip>Edit Exercise</q-tooltip>
                  </q-btn>
                  <q-btn
                    flat
                    round
                    color="negative"
                    icon="delete"
                    size="sm"
                    @click="removeExerciseFromEdit(index)"
                  >
                    <q-tooltip>Delete Exercise</q-tooltip>
                  </q-btn>
                </div>
              </div>
              <div class="exercise-details">
                <span>Exercise Types: {{ exercise.exercise_types || 'N/A' }}</span>
                <span>Sets: {{ exercise.sets }}</span>
                <span>Reps: {{ exercise.reps }}</span>
                <span>Weight: {{ exercise.weight_kg }}kg</span>
                <span>Minutes: {{ exercise.minutes }}</span>
              </div>
             </div>
           </div>
         </q-card-section>

         <q-card-actions align="right">
          <q-btn flat label="Cancel" @click="showEditPlanDialog = false" />
           <q-btn
             color="primary"
             label="Update Plan"
             @click="updatePlan"
             :loading="updatingPlan"
           />
         </q-card-actions>
       </q-card>
     </q-dialog>

    <!-- Edit Exercise Dialog -->
    <q-dialog v-model="showEditExerciseDialog" persistent>
      <q-card style="min-width: 500px; max-width: 600px">
        <q-card-section>
          <div class="text-h6">Edit Exercise</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <div class="form-section">
            <div class="add-exercise-form">
              <q-input 
                v-model="newExercise.name"
                label="Exercise Name"
                outlined
                dense
                class="form-field"
              />
              <q-input
                v-model.number="newExercise.exercise_types"
                label="Exercise Types (number)"
                type="number"
                outlined
                dense
                class="form-field"
              />
              <q-input
                v-model.number="newExercise.sets"
                label="Sets"
                type="number"
                outlined
                dense
                class="form-field"
              />
              <q-input
                v-model.number="newExercise.reps"
                label="Reps"
                type="number"
                outlined
                dense
                class="form-field"
              />
              <q-input
                v-model="newExercise.weight_kg"
                label="Weight (kg)"
                outlined
                dense
                class="form-field"
              />
              <q-input
                v-model.number="newExercise.minutes"
                label="Minutes"
                type="number"
                outlined
                dense
                class="form-field"
              />
            </div>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" @click="cancelEditExercise" />
          <q-btn
            color="primary"
            label="Save Changes"
            @click="saveEditedExercise"
          />
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

    <!-- Add Exercise Dialog -->
    <q-dialog v-model="showAddExerciseDialog" persistent>
      <q-card style="min-width: 500px; max-width: 600px">
        <q-card-section>
          <div class="text-h6">Add Exercise</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <div class="add-exercise-form">
            <q-input
              v-model="newExercise.name"
              label="Exercise Name"
              outlined
              dense
              class="form-field"
            />
            <q-input
              v-model.number="newExercise.sets"
              label="Sets"
              type="number"
              outlined
              dense
              class="form-field"
            />
            <q-input
              v-model.number="newExercise.reps"
              label="Reps"
              type="number"
              outlined
              dense
              class="form-field"
            />
            <q-input
              v-model="newExercise.weight_kg"
              label="Weight (kg)"
              type="text"
              outlined
              dense
              class="form-field"
            />
            <q-input
              v-model.number="newExercise.minutes"
              label="Minutes"
              type="number"
              outlined
              dense
              class="form-field"
                     />
                   </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" @click="closeAddExerciseDialog" />
          <q-btn 
            color="primary" 
            label="Add Exercise" 
            @click="addExerciseFromDialog"
            icon="add"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Training Approval Details Dialog -->
    <q-dialog v-model="showApprovalDetails" persistent>
      <q-card style="min-width: 600px; max-width: 800px">
        <q-card-section>
          <div class="text-h6">Training Approval Details</div>
        </q-card-section>

        <q-card-section class="q-pt-none" v-if="approvalDetails">
          <div class="approval-details">
            <div class="detail-section">
              <h4>Plan Information</h4>
              <div class="detail-grid">
                <div class="detail-item">
                  <span class="detail-label">Workout Name:</span>
                  <span class="detail-value">{{ approvalDetails.workout_name }}</span>
                         </div>
                <div class="detail-item">
                  <span class="detail-label">Category:</span>
                  <span class="detail-value">{{ approvalDetails.plan_category_name || approvalDetails.category }}</span>
                             </div>
                <div class="detail-item">
                  <span class="detail-label">User Level:</span>
                  <span class="detail-value">{{ approvalDetails.user_level }}</span>
                           </div>
                <div class="detail-item">
                  <span class="detail-label">Duration:</span>
                  <span class="detail-value">{{ approvalDetails.total_days }} days</span>
                         </div>
                <div class="detail-item">
                  <span class="detail-label">Start Date:</span>
                  <span class="detail-value">{{ formatDate(approvalDetails.start_date) }}</span>
                         </div>
                <div class="detail-item">
                  <span class="detail-label">End Date:</span>
                  <span class="detail-value">{{ formatDate(approvalDetails.end_date) }}</span>
                       </div>
                     </div>
                   </div>

            <div class="detail-section" v-if="approvalDetails.exercises_details">
              <h4>Exercise Details</h4>
              <div class="exercise-list">
                <div 
                  v-for="(exercise, index) in JSON.parse(approvalDetails.exercises_details)" 
                         :key="index"
                  class="exercise-item"
                       >
                           <div class="exercise-name">{{ exercise.name }}</div>
                  <div class="exercise-details">
                    <span>Sets: {{ exercise.sets }}</span>
                    <span>Reps: {{ exercise.reps }}</span>
                    <span>Weight: {{ exercise.weight_kg }}kg</span>
                    <span>Minutes: {{ exercise.minutes }}</span>
                         </div>
                          </div>
                           </div>
                           </div>
                           </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Close" @click="showApprovalDetails = false" />
                     <q-btn
            v-if="approvalDetails?.approval_status === 'PENDING'"
            color="positive" 
            label="Approve" 
            @click="approveRequest(approvalDetails.id)"
            icon="check"
                     />
                     <q-btn
            v-if="approvalDetails?.approval_status === 'PENDING'"
            color="negative" 
            label="Reject" 
            @click="rejectRequest(approvalDetails.id)"
            icon="close"
          />
        </q-card-actions>
      </q-card>
     </q-dialog>

    <!-- View Training Plan Details Dialog -->
    <q-dialog v-model="showViewPlanDialog" persistent>
      <q-card style="min-width: 800px; max-width: 1000px; max-height: 80vh">
      <q-card-section>
          <div class="text-h6">Training Plan Details</div>
      </q-card-section>

      <q-card-section class="q-pt-none">
          <div class="plan-overview">
                   <div class="plan-header">
              <h3 class="plan-title">{{ viewingPlan.workout_name || 'Training Plan' }}</h3>
              <div class="plan-meta">
                <q-badge color="primary" :label="viewingPlan.category" />
                <q-badge color="secondary" :label="viewingPlan.user_level" />
                <q-badge color="info" :label="`${calculateDuration(viewingPlan.start_date, viewingPlan.end_date)} days`" />
                </div>
                </div>

            <div class="plan-stats">
              <div class="stat-item">
                <q-icon name="schedule" color="primary" size="24px" />
                <div class="stat-content">
                  <div class="stat-value">{{ viewingPlan.training_minutes || 0 }}</div>
                  <div class="stat-label">Total Minutes</div>
                </div>
              </div>
              <div class="stat-item">
                <q-icon name="fitness_center" color="primary" size="24px" />
                <div class="stat-content">
                  <div class="stat-value">{{ viewingPlan.total_exercises || 0 }}</div>
                  <div class="stat-label">Total Exercises</div>
                </div>
                </div>
              <div class="stat-item">
                <q-icon name="repeat" color="primary" size="24px" />
                <div class="stat-content">
                  <div class="stat-value">{{ viewingPlan.sets || 0 }}</div>
                  <div class="stat-label">Total Sets</div>
                </div>
              </div>
              <div class="stat-item">
                <q-icon name="trending_up" color="primary" size="24px" />
                <div class="stat-content">
                  <div class="stat-value">{{ viewingPlan.reps || 0 }}</div>
                  <div class="stat-label">Total Reps</div>
                         </div>
                       </div>
          </div>
        </div>

          <div class="daily-distribution" v-if="parsedDailyPlans && parsedDailyPlans.length > 0">
            <h4>Daily Distribution</h4>
            <div class="distribution-container">
              <q-card 
                v-for="(dayPlan, index) in parsedDailyPlans" 
                :key="index"
                class="day-plan-card q-mb-sm"
                flat
                bordered
              >
                <q-card-section class="day-plan-header">
                  <div class="row items-center justify-between">
                    <div>
                      <div class="text-subtitle2 text-weight-bold">Day {{ dayPlan.day || index + 1 }}</div>
                      <div class="text-caption text-grey-6">{{ formatDate(dayPlan.date) }}</div>
                    </div>
                    <div class="day-stats">
                      <q-badge color="primary" :label="`${dayPlan.total_workouts || 0} workouts`" />
                      <q-badge color="secondary" class="q-ml-xs" :label="`${dayPlan.total_minutes || 0} min`" />
                    </div>
                  </div>
                </q-card-section>
                <q-card-section class="q-pt-none" v-if="dayPlan.workouts && dayPlan.workouts.length > 0">
                  <div class="workouts-list">
                    <div 
                      v-for="(workout, wIndex) in dayPlan.workouts" 
                      :key="wIndex"
                      class="workout-item q-mb-xs"
                    >
                      <div class="row items-center justify-between">
                        <div class="workout-name">
                          <q-icon name="fitness_center" size="14px" class="q-mr-xs" />
                          <span class="text-body2">{{ workout.workout_name || workout.name || `Workout ${wIndex + 1}` }}</span>
                        </div>
                        <div class="workout-details">
                          <span class="text-caption text-grey-6 q-mr-sm">{{ workout.sets || 0 }} sets × {{ workout.reps || 0 }} reps</span>
                          <span class="text-caption text-grey-6" v-if="workout.weight_kg || workout.weight">{{ workout.weight_kg || workout.weight || 0 }} kg</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </q-card-section>
              </q-card>
            </div>
          </div>

          <div class="exercise-distribution" v-if="viewingPlan.exercises && viewingPlan.exercises.length > 0">
            <h4>Exercise Distribution</h4>
            <div class="distribution-grid">
              <div 
                v-for="(exercise, index) in viewingPlan.exercises" 
                         :key="index"
                class="exercise-card"
                       >
                <div class="exercise-header">
                  <h5>{{ exercise.name || exercise.workout_name || `Exercise ${index + 1}` }}</h5>
                  <q-badge color="accent" :label="exercise.exercise_plan_category || viewingPlan.category" />
                </div>
                <div class="exercise-details">
                  <div class="detail-row">
                             <span class="detail-label">Sets:</span>
                    <span class="detail-value">{{ exercise.sets || 0 }}</span>
                </div>
                  <div class="detail-row">
                             <span class="detail-label">Reps:</span>
                    <span class="detail-value">{{ exercise.reps || 0 }}</span>
              </div>
                  <div class="detail-row">
                             <span class="detail-label">Weight:</span>
                    <span class="detail-value">{{ exercise.weight_kg || exercise.weight || 0 }} kg</span>
                </div>
                  <div class="detail-row">
                    <span class="detail-label">Duration:</span>
                    <span class="detail-value">{{ exercise.minutes || exercise.training_minutes || 0 }} min</span>
                </div>
                  <div class="detail-row" v-if="exercise.exercise_types">
                    <span class="detail-label">Type:</span>
                    <span class="detail-value">{{ exercise.exercise_types }}</span>
              </div>
              </div>
                     </div>
                   </div>
        </div>

          <div class="plan-timeline" v-if="viewingPlan.start_date && viewingPlan.end_date">
            <h4>Plan Timeline</h4>
            <div class="timeline-container">
              <div class="timeline-item">
                <div class="timeline-marker start"></div>
                <div class="timeline-content">
                  <div class="timeline-date">{{ formatDate(viewingPlan.start_date) }}</div>
                  <div class="timeline-label">Start Date</div>
              </div>
              </div>
              <div class="timeline-line"></div>
              <div class="timeline-item">
                <div class="timeline-marker end"></div>
                <div class="timeline-content">
                  <div class="timeline-date">{{ formatDate(viewingPlan.end_date) }}</div>
                  <div class="timeline-label">End Date</div>
              </div>
              </div>
            </div>
              </div>

          <div class="plan-summary" v-if="viewingPlan.exercises && viewingPlan.exercises.length > 0">
            <h4>Plan Summary</h4>
            <div class="summary-grid">
              <div class="summary-item">
                <q-icon name="calendar_today" color="primary" size="20px" />
                <span>Duration: {{ calculateDuration(viewingPlan.start_date, viewingPlan.end_date) }} days</span>
              </div>
              <div class="summary-item">
                <q-icon name="fitness_center" color="primary" size="20px" />
                <span>Exercises: {{ viewingPlan.exercises.length }}</span>
              </div>
              <div class="summary-item">
                <q-icon name="schedule" color="primary" size="20px" />
                <span>Total Time: {{ getTotalMinutes(viewingPlan.exercises) }} minutes</span>
              </div>
              <div class="summary-item">
                <q-icon name="trending_up" color="primary" size="20px" />
                <span>Total Sets: {{ getTotalSets(viewingPlan.exercises) }}</span>
            </div>
              </div>
            </div>
          </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Close" @click="showViewPlanDialog = false" />
          <q-btn 
            color="primary" 
            label="Edit Plan" 
            @click="editFromView"
            icon="edit"
          />
        </q-card-actions>
       </q-card>
     </q-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUserManagementStore } from '../stores/userManagement'
import { useAuthStore } from '../stores/auth'
import api from '../config/axios'

// Router
const router = useRouter()

// Stores
const userManagementStore = useUserManagementStore()
const authStore = useAuthStore()

// Reactive data
const userSearchQuery = ref('')
const approvalSearch = ref('')
const approvals = ref([])
const filteredApprovals = ref([])
const selectedUser = ref(null)
const selectedCategory = ref(null)
const selectedUserLevel = ref(null)
const showApprovalDetails = ref(false)
const approvalDetails = ref(null)
const showCreatePlanDialog = ref(false)
const showEditPlanDialog = ref(false)
const showViewPlanDialog = ref(false)
const showAssignmentDialog = ref(false)
const showAddExerciseDialog = ref(false)
const showAddExerciseForm = ref(false)
const assignedUserName = ref('')
const creatingPlan = ref(false)
const updatingPlan = ref(false)
const allTrainingPlans = ref([])
const myAssignments = ref([])
const editingPlan = ref({})
const viewingPlan = ref({})

// New plan form
const newPlan = ref({
  start_date: '',
  end_date: '',
  category: '',
  user_level: 'Beginner',
  exercises: []
})

// New exercise form for editing
const newExercise = ref({
  name: '',
  exercise_types: 0,
  sets: 0,
  reps: 0,
  weight_kg: '',
  minutes: 0
})

// Pagination variables
const currentApprovalPage = ref(1)
const approvalsPerPage = ref(6)
const currentAssignmentPage = ref(1)
const assignmentsPerPage = ref(6)
const currentTrainingPlansPage = ref(1)
const trainingPlansPerPage = ref(6)

// Pagination computed properties
const totalApprovalPages = computed(() => {
  return Math.ceil(filteredApprovals.value.length / approvalsPerPage.value)
})

const paginatedApprovals = computed(() => {
  const start = (currentApprovalPage.value - 1) * approvalsPerPage.value
  const end = start + approvalsPerPage.value
  return filteredApprovals.value.slice(start, end)
})

const totalAssignmentPages = computed(() => {
  return Math.ceil(myAssignments.value.length / assignmentsPerPage.value)
})

const paginatedAssignments = computed(() => {
  const start = (currentAssignmentPage.value - 1) * assignmentsPerPage.value
  const end = start + assignmentsPerPage.value
  return myAssignments.value.slice(start, end)
})

const totalTrainingPlansPages = computed(() => {
  return Math.ceil(allTrainingPlans.value.length / trainingPlansPerPage.value)
})

const paginatedTrainingPlans = computed(() => {
  const start = (currentTrainingPlansPage.value - 1) * trainingPlansPerPage.value
  const end = start + trainingPlansPerPage.value
  return allTrainingPlans.value.slice(start, end)
})

// Computed properties
const filteredUsers = computed(() => {
  if (!userSearchQuery.value) {
    return userManagementStore.users || []
  }
  return (userManagementStore.users || []).filter(user => 
    user.name?.toLowerCase().includes(userSearchQuery.value.toLowerCase()) ||
    user.phone?.includes(userSearchQuery.value)
  )
})

const userColumns = [
  { name: 'id', label: 'User ID', field: 'id', align: 'left' },
  { name: 'name', label: 'Name', field: 'name', align: 'left' },
  { name: 'email', label: 'Email', field: 'email', align: 'left' },
  { name: 'phone', label: 'Phone', field: 'phone', align: 'left' },
  { name: 'status', label: 'Status', field: 'status', align: 'center' },
  { name: 'payment_status', label: 'Payment', field: 'payment_status', align: 'center' },
  { name: 'actions', label: 'Actions', field: 'actions', align: 'center' }
]

const userOptions = computed(() => {
  return (userManagementStore.users || []).map(user => ({
    label: `${user.name} - ${user.phone}`,
    value: user.id
  }))
})

// Get unique categories from existing training plans
const assignmentCategoryOptions = computed(() => {
  const categories = new Set()
  allTrainingPlans.value.forEach(plan => {
    if (plan.category) {
      categories.add(plan.category)
    }
  })
  return Array.from(categories).map(category => ({
    label: category,
    value: category
  }))
})

// Get unique user levels from existing training plans - filtered by selected category
const assignmentUserLevelOptions = computed(() => {
  // If no category is selected, return empty array
  if (!selectedCategory.value) {
    return []
  }
  
  // Filter plans by selected category and get unique user levels
  const userLevels = new Set()
  allTrainingPlans.value.forEach(plan => {
    // Only include user levels from plans that match the selected category
    if (plan.category === selectedCategory.value && plan.user_level) {
      userLevels.add(plan.user_level)
    }
  })
  
  return Array.from(userLevels).map(level => ({
    label: level,
    value: level
  }))
})

// Get the selected plan for assignment
const selectedPlan = computed(() => {
  if (!selectedCategory.value || !selectedUserLevel.value) {
    return null
  }
  
  return allTrainingPlans.value.find(plan => 
    plan.category === selectedCategory.value && 
    plan.user_level === selectedUserLevel.value
  )
})

const categoryOptions = [
  'Muscle Gain',
  'Weight Loss',
  'Strength Training',
  'Cardio',
  'Flexibility',
  'Endurance',
  'Power',
  'Balance'
]

const userLevelOptions = [
  'Beginner',
  'Intermediate',
  'Advanced',
  'Expert'
]

// Methods

const editUserPlan = (user) => {
  console.log('Edit user plan:', user)
}

const createUserPlan = (user) => {
  console.log('Create user plan:', user)
}

const viewUserTraining = (user) => {
  console.log('View user training:', user)
}

const viewUserStats = (user) => {
  console.log('View user stats:', user)
}

const filterUsers = (val, update) => {
  update(() => {
    // Filter logic is handled by the computed property
  })
}

const assignTraining = async () => {
  try {
    if (!selectedPlan.value) {
      alert('No plan selected. Please select a category and user level.')
      return
    }
    
    console.log('Assigning existing plan:', selectedPlan.value)
    
    // Assign the existing plan to the user
    const assignResponse = await api.patch(`/trainingPlans/${selectedPlan.value.id}/assign`, {
      user_id: selectedUser.value
    })
      
      if (assignResponse.data.data) {
        // Show success dialog
        const user = userManagementStore.users?.find(u => u.id === selectedUser.value)
        assignedUserName.value = user ? user.name : 'Unknown User'
        showAssignmentDialog.value = true
        
        // Reset form
        selectedUser.value = null
        selectedCategory.value = null
        selectedUserLevel.value = null
        
        // Refresh data
        await refreshAllPlans()
        await loadMyAssignments()
        
        // Auto-close dialog after 3 seconds
        setTimeout(() => {
          showAssignmentDialog.value = false
        }, 3000)
      }
  } catch (error) {
    console.error('Error assigning training:', error)
  }
}

const refreshAllPlans = async () => {
  try {
    // Fetch training plans from API
    const response = await api.get('/trainingPlans')
    allTrainingPlans.value = response.data.data || []
  } catch (error) {
    console.error('Error fetching training plans:', error)
  }
}

const viewTrainingPlanDetails = async (plan) => {
  try {
    let response;
    
    // Check if this is an assignment (has assignment-specific properties)
    if (plan.user_id && plan.web_plan_id) {
      // This is an assignment, fetch from assignments endpoint
      response = await api.get(`/trainingPlans/assignments/${plan.id}`)
    } else {
      // This is a regular plan, fetch from plans endpoint
      response = await api.get(`/trainingPlans/${plan.id}`)
    }
    
    if (response.data.data) {
      const planData = response.data.data
      
      // Parse exercises from exercises_details if it exists
      let exercises = []
      console.log('Plan data received:', planData)
      console.log('Exercises details from API:', planData.exercises_details)
      if (planData.exercises_details) {
        try {
          exercises = JSON.parse(planData.exercises_details)
          console.log('Parsed exercises:', exercises)
        } catch (e) {
          console.error('Error parsing exercises:', e)
        }
      }
      
      // Parse daily_plans if it exists
      let dailyPlans = []
      if (planData.daily_plans) {
        try {
          dailyPlans = typeof planData.daily_plans === 'string' 
            ? JSON.parse(planData.daily_plans) 
            : planData.daily_plans
          console.log('Parsed daily plans:', dailyPlans)
        } catch (e) {
          console.error('Error parsing daily plans:', e)
        }
      }
      
      viewingPlan.value = {
        ...planData,
        exercises: exercises,
        daily_plans: dailyPlans
      }
      showViewPlanDialog.value = true
    }
  } catch (error) {
    console.error('Error fetching plan details:', error)
    // Fallback to local data
    viewingPlan.value = {
      ...plan,
      exercises: plan.exercises || [],
      daily_plans: plan.daily_plans || []
    }
    showViewPlanDialog.value = true
  }
}

// Computed property to parse daily plans for display
const parsedDailyPlans = computed(() => {
  if (!viewingPlan.value.daily_plans) return []
  try {
    return typeof viewingPlan.value.daily_plans === 'string' 
      ? JSON.parse(viewingPlan.value.daily_plans) 
      : viewingPlan.value.daily_plans
  } catch (e) {
    return []
  }
})

// Helper function to get distribution summary for cards
const getDistributionSummary = (plan) => {
  if (!plan.daily_plans) return null
  try {
    const dailyPlans = typeof plan.daily_plans === 'string' 
      ? JSON.parse(plan.daily_plans) 
      : plan.daily_plans
    
    if (!Array.isArray(dailyPlans) || dailyPlans.length === 0) return null
    
    const totalDays = dailyPlans.length
    const avgWorkouts = dailyPlans.reduce((sum, day) => sum + (day.total_workouts || 0), 0) / totalDays
    const workoutsPerDay = Math.round(avgWorkouts * 10) / 10
    
    return `${totalDays} days, ${workoutsPerDay} workouts/day`
  } catch (e) {
    return null
  }
}

const editTrainingPlan = (plan) => {
  // Parse exercises from exercises_details if it exists
  let exercises = []
  if (plan.exercises_details) {
    try {
      exercises = JSON.parse(plan.exercises_details)
    } catch (e) {
      console.error('Error parsing exercises:', e)
    }
  }
  
  editingPlan.value = { 
    id: plan.id,
    start_date: formatDateForInput(plan.start_date),
    end_date: formatDateForInput(plan.end_date),
    workout_name: plan.workout_name || '',
    category: plan.category || '',
    user_level: plan.user_level || 'Beginner',
    training_minutes: plan.training_minutes || 0,
    sets: plan.sets || 0,
    reps: plan.reps || 0,
    weight_kg: plan.weight_kg || 0,
    total_workouts: plan.total_workouts || 0,
    total_exercises: plan.total_exercises || 0,
    status: plan.status || 'PLANNED',
    exercises: exercises,
    isAssignment: plan.web_plan_id ? true : false // Check if this is an assignment
  }
  showEditPlanDialog.value = true
}

const deleteTrainingPlan = async (planId, isUnassign = false) => {
  try {
    console.log('Deleting training plan:', { planId, isUnassign })
    
    let endpoint, params = {}
    
    if (isUnassign) {
      // For assignments, use the assignments endpoint
      endpoint = `/trainingPlans/assignments/${planId}`
    } else {
      // For regular plans, use the training plans endpoint
      endpoint = `/trainingPlans/${planId}`
    }
    
    console.log('API call:', { endpoint, params })
    const response = await api.delete(endpoint, { params })
    console.log('Delete response:', response.data)
    
    // Refresh data
    await refreshAllPlans()
    await loadMyAssignments()
    
    if (isUnassign) {
      alert('Plan unassigned successfully!')
    } else {
      alert('Plan deleted successfully!')
    }
  } catch (error) {
    console.error('Error deleting training plan:', error)
    alert('Failed to delete/unassign plan. Please try again.')
  }
}

const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString()
}

const formatDateForInput = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toISOString().split('T')[0] // Returns YYYY-MM-DD format
}

const loadMyAssignments = async () => {
  try {
    // Fetch assignments from API
    const response = await api.get('/trainingPlans/my-assignments')
    myAssignments.value = response.data.data || []
  } catch (error) {
    console.error('Error fetching assignments:', error)
  }
}

const createPlan = async () => {
    // Validate required fields
  if (!newPlan.value.start_date || !newPlan.value.end_date) {
    alert('Please fill in both Start Date and End Date')
      return
    }
    

  if (!newPlan.value.category) {
    alert('Please select Exercise Plan Category')
      return
    }
    
  if (!newPlan.value.user_level) {
    alert('Please select User Level')
      return
    }

  // Debug: Check if we have exercises before creating plan
  console.log('=== CREATING PLAN ===')
  console.log('Plan workout name:', newPlan.value.workout_name)
  console.log('Plan category:', newPlan.value.category)
  console.log('Plan exercises array:', newPlan.value.exercises)
  console.log('Plan exercises length:', newPlan.value.exercises ? newPlan.value.exercises.length : 0)

  creatingPlan.value = true
  try {
    // Generate workout name from category and exercises
    console.log('=== WORKOUT NAME GENERATION ===')
    console.log('Category:', newPlan.value.category)
    console.log('Exercises:', newPlan.value.exercises)
    console.log('Exercise names:', newPlan.value.exercises ? newPlan.value.exercises.map(ex => ex.name) : 'No exercises')
    
    const exerciseNames = newPlan.value.exercises && newPlan.value.exercises.length > 0 
      ? newPlan.value.exercises.map(ex => ex.name).join(', ')
      : 'Training Plan'
    const workoutName = `${newPlan.value.category} - ${exerciseNames}`
    
    console.log('Generated workout name:', workoutName)

    // Prepare items array for distribution (backend will generate daily_plans)
    const items = newPlan.value.exercises && newPlan.value.exercises.length > 0
      ? newPlan.value.exercises.map(ex => ({
          workout_name: ex.name,
          sets: ex.sets || 0,
          reps: ex.reps || 0,
          weight_kg: ex.weight_kg || 0,
          minutes: ex.minutes || 0,
          exercise_types: ex.exercise_types || 0
        }))
      : []

    // Ensure all numeric fields are properly converted
    const planData = {
      start_date: newPlan.value.start_date,
      end_date: newPlan.value.end_date,
      workout_name: workoutName,
      category: newPlan.value.category,
      user_level: newPlan.value.user_level,
      exercise_types: newPlan.value.exercise_types || '',
      training_minutes: 0, // Will be calculated from exercises
      sets: 0, // Will be calculated from exercises
      reps: 0, // Will be calculated from exercises
      weight_kg: '', // Will be calculated from exercises
      total_workouts: newPlan.value.total_workouts ? parseInt(newPlan.value.total_workouts) : 0,
      total_exercises: newPlan.value.total_exercises ? parseInt(newPlan.value.total_exercises) : 0,
      status: newPlan.value.status || 'PLANNED',
      items: items, // Send items array to trigger distribution logic
      exercises_details: newPlan.value.exercises && newPlan.value.exercises.length > 0 
        ? JSON.stringify(newPlan.value.exercises) 
        : null
    }
    
    console.log('Creating plan with data:', planData)
    console.log('Workout name being sent:', planData.workout_name)
    console.log('Exercises array being sent:', newPlan.value.exercises)
    console.log('Exercises details JSON being sent:', planData.exercises_details)
    
    const response = await api.post('/trainingPlans', planData)
    if (response.data.data) {
      allTrainingPlans.value.push(response.data.data)
      showCreatePlanDialog.value = false
      resetNewPlan()
    }
  } catch (error) {
    console.error('Error creating plan:', error)
    alert('Failed to create plan. Please check all required fields and try again.')
  } finally {
    creatingPlan.value = false
  }
}

const updatePlan = async () => {
  // Validate required fields
  if (!editingPlan.value.start_date || !editingPlan.value.end_date) {
    alert('Please fill in both Start Date and End Date')
    return
  }
  
  
  if (!editingPlan.value.category) {
    alert('Please select Exercise Plan Category')
    return
  }
  
  if (!editingPlan.value.user_level) {
    alert('Please select User Level')
    return
  }

  // Debug: Check if we have exercises before updating plan
  console.log('=== UPDATING PLAN ===')
  console.log('Plan ID:', editingPlan.value.id)
  console.log('Plan workout name:', editingPlan.value.workout_name)
  console.log('Plan category:', editingPlan.value.category)
  console.log('Plan exercises array:', editingPlan.value.exercises)
  console.log('Plan exercises length:', editingPlan.value.exercises ? editingPlan.value.exercises.length : 0)

  updatingPlan.value = true
  try {
    // Generate workout name from category and exercises
    const exerciseNames = editingPlan.value.exercises && editingPlan.value.exercises.length > 0 
      ? editingPlan.value.exercises.map(ex => ex.name).join(', ')
      : 'Training Plan'
    const workoutName = `${editingPlan.value.category} - ${exerciseNames}`

    // Ensure all numeric fields are properly converted
    const planData = {
      id: editingPlan.value.id,
      start_date: editingPlan.value.start_date,
      end_date: editingPlan.value.end_date,
      workout_name: workoutName,
      category: editingPlan.value.category,
      user_level: editingPlan.value.user_level,
      training_minutes: 0, // Will be calculated from exercises
      sets: 0, // Will be calculated from exercises
      reps: 0, // Will be calculated from exercises
      weight_kg: '', // Will be calculated from exercises
      total_workouts: editingPlan.value.total_workouts ? parseInt(editingPlan.value.total_workouts) : 0,
      total_exercises: editingPlan.value.total_exercises ? parseInt(editingPlan.value.total_exercises) : 0,
      status: editingPlan.value.status || 'PLANNED',
      exercises_details: editingPlan.value.exercises && editingPlan.value.exercises.length > 0 
        ? JSON.stringify(editingPlan.value.exercises) 
        : null
    }
    
    console.log('Updating plan with data:', planData)
    console.log('Is assignment:', editingPlan.value.isAssignment)
    console.log('Exercises array being sent:', editingPlan.value.exercises)
    console.log('Exercises details JSON being sent:', planData.exercises_details)
    
    let endpoint
    if (editingPlan.value.isAssignment) {
      endpoint = `/trainingPlans/assignments/${editingPlan.value.id}`
        } else {
      endpoint = `/trainingPlans/${editingPlan.value.id}`
    }
    
    console.log('API endpoint:', endpoint)
    console.log('Exercises array:', editingPlan.value.exercises)
    console.log('Exercises details JSON:', planData.exercises_details)
    
    const response = await api.put(endpoint, planData)
    if (response.data.data) {
      if (editingPlan.value.isAssignment) {
        // Update assignment in myAssignments
        const index = myAssignments.value.findIndex(p => p.id === editingPlan.value.id)
        if (index !== -1) {
          myAssignments.value[index] = response.data.data
        }
      } else {
        // Update plan in allTrainingPlans
        const index = allTrainingPlans.value.findIndex(p => p.id === editingPlan.value.id)
        if (index !== -1) {
          allTrainingPlans.value[index] = response.data.data
        }
      }
      showEditPlanDialog.value = false
    }
  } catch (error) {
    console.error('Error updating plan:', error)
    alert('Failed to update plan. Please check all required fields and try again.')
  } finally {
    updatingPlan.value = false
  }
}

const resetNewPlan = () => {
  newPlan.value = {
    start_date: '',
    end_date: '',
    category: '',
    user_level: 'Beginner',
    exercises: []
  }
}

const removeExercise = (index) => {
  newPlan.value.exercises.splice(index, 1)
  // Update total_exercises count
  newPlan.value.total_exercises = newPlan.value.exercises.length
}

const removeExerciseFromEdit = (index) => {
  editingPlan.value.exercises.splice(index, 1)
  // Update total_exercises count
  editingPlan.value.total_exercises = editingPlan.value.exercises.length
}

// Edit exercise functionality
const editingExerciseIndex = ref(-1)
const showEditExerciseDialog = ref(false)

const editExercise = (index) => {
  editingExerciseIndex.value = index
  const exercise = showCreatePlanDialog.value ? newPlan.value.exercises[index] : editingPlan.value.exercises[index]
  
  // Pre-fill the form with existing exercise data
  newExercise.value = {
    name: exercise.name,
    exercise_types: exercise.exercise_types || 0,
    sets: exercise.sets || 0,
    reps: exercise.reps || 0,
    weight_kg: exercise.weight_kg || '',
    minutes: exercise.minutes || 0
  }
  
  showEditExerciseDialog.value = true
}

const saveEditedExercise = () => {
  if (!newExercise.value.name) {
    return
  }
  
  const targetPlan = showCreatePlanDialog.value ? newPlan.value : editingPlan.value
  const index = editingExerciseIndex.value
  
  // Update the exercise at the specified index
  targetPlan.exercises[index] = {
    name: newExercise.value.name,
    exercise_types: newExercise.value.exercise_types || 0,
    sets: newExercise.value.sets || 0,
    reps: newExercise.value.reps || 0,
    weight_kg: newExercise.value.weight_kg || '',
    minutes: newExercise.value.minutes || 0
  }
  
  // Reset form and close dialog
  resetNewExercise()
  showEditExerciseDialog.value = false
  editingExerciseIndex.value = -1
}

const cancelEditExercise = () => {
  resetNewExercise()
  showEditExerciseDialog.value = false
  editingExerciseIndex.value = -1
}

const addExercise = () => {
  if (!newExercise.value.name) {
    alert('Please enter an exercise name')
    return
  }
  
  if (!newPlan.value.exercises) {
    newPlan.value.exercises = []
  }
  
  newPlan.value.exercises.push({
    name: newExercise.value.name,
    exercise_types: newExercise.value.exercise_types || 0,
    sets: newExercise.value.sets || 0,
    reps: newExercise.value.reps || 0,
    weight_kg: newExercise.value.weight_kg || '',
    minutes: newExercise.value.minutes || 0
  })
  
  // Update total_exercises count
  newPlan.value.total_exercises = newPlan.value.exercises.length
  
  // Debug logging
  console.log('Exercise added successfully!')
  console.log('Current exercises array:', newPlan.value.exercises)
  console.log('Total exercises count:', newPlan.value.total_exercises)
  
  // Reset form and hide it
  resetNewExercise()
  showAddExerciseForm.value = false
}

const addExerciseToEdit = () => {
  if (!newExercise.value.name) {
    alert('Please enter an exercise name')
    return
  }
  
  if (!editingPlan.value.exercises) {
    editingPlan.value.exercises = []
  }
  
  editingPlan.value.exercises.push({
    name: newExercise.value.name,
    exercise_types: newExercise.value.exercise_types || 0,
    sets: newExercise.value.sets || 0,
    reps: newExercise.value.reps || 0,
    weight_kg: newExercise.value.weight_kg || '',
    minutes: newExercise.value.minutes || 0
  })
  
  // Update total_exercises count
  editingPlan.value.total_exercises = editingPlan.value.exercises.length
  
  // Debug logging
  console.log('Exercise added successfully!')
  console.log('Current exercises array:', editingPlan.value.exercises)
  console.log('Total exercises count:', editingPlan.value.total_exercises)
  
  // Reset form and hide it
  resetNewExercise()
  showAddExerciseForm.value = false
}

const addExerciseFromDialog = () => {
  if (!newExercise.value.name) {
    return
  }
  
  // Determine which plan we're adding to (create or edit)
  const targetPlan = showCreatePlanDialog.value ? newPlan.value : editingPlan.value
  
  if (!targetPlan.exercises) {
    targetPlan.exercises = []
  }
  
  targetPlan.exercises.push({
    name: newExercise.value.name,
    exercise_types: newExercise.value.exercise_types || 0,
    sets: newExercise.value.sets || 0,
    reps: newExercise.value.reps || 0,
    weight_kg: newExercise.value.weight_kg || '',
    minutes: newExercise.value.minutes || 0
  })
  
  // Reset form and close dialog
  resetNewExercise()
  showAddExerciseDialog.value = false
}

const closeAddExerciseDialog = () => {
  resetNewExercise()
  showAddExerciseDialog.value = false
}

const resetNewExercise = () => {
  newExercise.value = {
    name: '',
    exercise_types: 0,
    sets: 0,
    reps: 0,
    weight_kg: '',
    minutes: 0
  }
}

const toggleAddExerciseForm = () => {
  showAddExerciseForm.value = !showAddExerciseForm.value
  
  if (showAddExerciseForm.value) {
    // Reset the exercise form to empty state
    resetNewExercise()
  }
}

const cancelAddExercise = () => {
  showAddExerciseForm.value = false
  resetNewExercise()
}

// Training Approval Methods
const loadApprovals = async () => {
  try {
    const response = await api.get('/trainingApprovals')
    approvals.value = response.data.data || []
    filteredApprovals.value = approvals.value
  } catch (error) {
    console.error('Error loading approvals:', error)
  }
}

const openApprovalDetails = async (id) => {
  try {
    const { data } = await api.get(`/trainingApprovals/${id}/detailed`)
    approvalDetails.value = data.data
    showApprovalDetails.value = true
  } catch (e) {
    console.error('Failed to load approval details', e)
  }
}

const viewApprovalDetails = (id) => {
  // Navigate to the dedicated view page
  const routeName = authStore.role === 'GYM_ADMIN' ? 'GymAdminTrainingApprovalView' : 'TrainerTrainingApprovalView'
  router.push({ name: routeName, params: { id } })
}

const approveRequest = async (id) => {
  try {
    await api.patch(`/trainingApprovals/${id}/status`, { approval_status: 'APPROVED' })
    await loadApprovals()
    showApprovalDetails.value = false
  } catch (e) {
    console.error('Failed to approve request', e)
  }
}

const rejectRequest = async (id) => {
  try {
    await api.patch(`/trainingApprovals/${id}/status`, { approval_status: 'REJECTED' })
    await loadApprovals()
    showApprovalDetails.value = false
  } catch (e) {
    console.error('Failed to reject request', e)
  }
}

const deleteTrainingApproval = async (id) => {
  if (confirm('Are you sure you want to delete this training approval? This action cannot be undone.')) {
    try {
      await api.delete(`/trainingApprovals/${id}`)
      // Remove from the local list immediately for better UX
      approvals.value = approvals.value.filter(ap => ap.id !== id)
      // Also refresh the list to ensure consistency
      await loadApprovals()
    } catch (e) {
      console.error('Failed to delete training approval', e)
      alert('Failed to delete training approval. Please try again.')
    }
  }
}

const calculateDuration = (startDate, endDate) => {
  if (!startDate || !endDate) return 0
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffTime = Math.abs(end - start)
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

const getUserName = (userId) => {
  const user = userManagementStore.users?.find(u => u.id === userId)
  return user ? user.name : 'Unknown User'
}

const editFromView = () => {
  showViewPlanDialog.value = false
  editingPlan.value = { 
    id: viewingPlan.value.id,
    start_date: formatDateForInput(viewingPlan.value.start_date),
    end_date: formatDateForInput(viewingPlan.value.end_date),
    workout_name: viewingPlan.value.workout_name || '',
    category: viewingPlan.value.category || '',
    user_level: viewingPlan.value.user_level || 'Beginner',
    exercise_types: viewingPlan.value.exercise_types || null,
    training_minutes: viewingPlan.value.training_minutes || 0,
    sets: viewingPlan.value.sets || 0,
    reps: viewingPlan.value.reps || 0,
    weight_kg: viewingPlan.value.weight_kg || 0,
    total_workouts: viewingPlan.value.total_workouts || 0,
    total_exercises: viewingPlan.value.total_exercises || 0,
    status: viewingPlan.value.status || 'PLANNED',
    exercises: viewingPlan.value.exercises || []
  }
  showEditPlanDialog.value = true
}

const getTotalMinutes = (exercises) => {
  if (!exercises || !Array.isArray(exercises)) return 0
  return exercises.reduce((total, exercise) => {
    return total + (exercise.minutes || exercise.training_minutes || 0)
  }, 0)
}

const getTotalSets = (exercises) => {
  if (!exercises || !Array.isArray(exercises)) return 0
  return exercises.reduce((total, exercise) => {
    return total + (exercise.sets || 0)
  }, 0)
}

// Watchers
watch(approvalSearch, (newValue) => {
  if (!newValue) {
    filteredApprovals.value = approvals.value
  } else {
    filteredApprovals.value = approvals.value.filter(ap => 
      ap.workout_name?.toLowerCase().includes(newValue.toLowerCase()) ||
      ap.user_name?.toLowerCase().includes(newValue.toLowerCase())
    )
  }
})

// Reset user level when category changes
watch(selectedCategory, () => {
  selectedUserLevel.value = null
})

// Lifecycle
onMounted(async () => {
  try {
  await userManagementStore.fetchUsers()
  await loadApprovals()
    await refreshAllPlans()
    await loadMyAssignments()
  } catch (error) {
    console.error('Error fetching data:', error)
  }
})
</script>

<style scoped>
.trainer-scheduler-page {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
  background: #f8f9fa;
  min-height: 100vh;
}

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

.approval-section-card,
.user-list-card,
.planned-trainings-card,
.training-plans-card,
.my-assignments-card {
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.approval-section-card::before,
.user-list-card::before,
.planned-trainings-card::before,
.training-plans-card::before,
.my-assignments-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #667eea, #764ba2);
}

.approval-section-card:hover,
.user-list-card:hover,
.planned-trainings-card:hover,
.training-plans-card:hover,
.my-assignments-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}

.search-input .q-field__control {
  border-radius: 12px;
  border: 2px solid rgba(102, 126, 234, 0.2);
  background: white;
  transition: all 0.3s ease;
}

.search-input .q-field__control:hover {
  border-color: rgba(102, 126, 234, 0.4);
}

.search-input .q-field--focused .q-field__control {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.training-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 24px;
  margin-bottom: 24px;
}

.training-card,
.training-plan-card {
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
  overflow: hidden;
  position: relative;
}

.training-card::before,
.training-plan-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #667eea, #764ba2);
}

.training-card:hover,
.training-plan-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.15);
}

.training-card-header,
.training-plan-header {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.plan-info .text-h6 {
  color: #667eea;
  font-weight: 700;
}

.training-card-content,
.training-plan-content {
  padding: 20px;
}

.plan-details {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.02) 0%, rgba(118, 75, 162, 0.02) 100%);
  border-radius: 12px;
  padding: 16px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.detail-item .text-caption {
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-item .text-body2 {
  color: #2c3e50;
  font-weight: 600;
}

.status-badge,
.payment-badge {
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-radius: 8px;
  padding: 6px 12px;
}

.training-card-actions,
.training-plan-actions {
  padding: 16px 20px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-top: 1px solid #e0e0e0;
  gap: 12px;
}

.action-btn {
  border-radius: 8px;
  transition: all 0.3s ease;
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.user-table {
  border-radius: 16px;
  overflow: hidden;
}

.user-table .q-table thead th {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-size: 0.85rem;
  border: none;
  padding: 16px 12px;
}

.user-table .q-table tbody tr:hover {
  background: rgba(102, 126, 234, 0.05);
  transform: scale(1.01);
}

.user-id-badge {
  font-weight: 600;
  border-radius: 8px;
  padding: 6px 12px;
}

.user-name-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.action-buttons {
  display: flex;
  gap: 8px;
  align-items: center;
}

.empty-state-card {
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.02) 0%, rgba(118, 75, 162, 0.02) 100%);
}

.assign-training-card {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
}

.form-field .q-field__control {
  border-radius: 12px;
  border: 2px solid rgba(102, 126, 234, 0.2);
  transition: all 0.3s ease;
}

.form-field .q-field__control:hover {
  border-color: rgba(102, 126, 234, 0.4);
}

.form-field .q-field--focused .q-field__control {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.assign-btn,
.create-plan-btn,
.refresh-btn {
  border-radius: 12px;
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0.5px;
  padding: 12px 24px;
}

.selected-plan-preview {
  margin-top: 16px;
}

.selected-plan-preview .q-card {
  background: linear-gradient(135deg, #f8f9fa, #e9ecef);
  border: 2px solid #e3f2fd;
  border-radius: 12px;
  transition: all 0.3s ease;
}

.selected-plan-preview .q-card:hover {
  border-color: #2196f3;
  box-shadow: 0 4px 12px rgba(33, 150, 243, 0.15);
}

.assignment-card {
  border-left: 4px solid #2196F3;
}

.assignment-badge {
  border-radius: 8px;
  padding: 4px 8px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.form-section {
  margin-bottom: 24px;
}

.form-section h4 {
  color: #667eea;
  font-weight: 600;
  margin-bottom: 16px;
  font-size: 1.1rem;
}

.date-range {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.date-input {
  width: 100%;
}

.exercise-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.add-exercise-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  align-items: end;
}

.add-exercise-btn {
  border-radius: 12px;
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0.5px;
  padding: 12px 24px;
  height: 40px;
}

.add-exercise-button-container {
  display: flex;
  justify-content: center;
  margin: 20px 0;
}

.add-more-exercises-btn {
  border-radius: 12px;
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0.5px;
  padding: 12px 32px;
  min-width: 200px;
}

.add-exercise-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 20px;
}

.cancel-exercise-btn {
  border-radius: 12px;
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0.5px;
  padding: 12px 24px;
}

/* Approval Details Dialog Styles */
.approval-details {
  padding: 16px 0;
}

.detail-section {
  margin-bottom: 24px;
}

.detail-section h4 {
  color: #1976d2;
  font-weight: 600;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 2px solid #e3f2fd;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-label {
  font-weight: 600;
  color: #666;
  font-size: 14px;
}

.detail-value {
  color: #333;
  font-size: 16px;
}

.exercise-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.exercise-item {
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #1976d2;
}

.exercise-name {
  font-weight: 600;
  color: #1976d2;
  margin-bottom: 8px;
}

.exercise-details {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.exercise-details span {
  background: #e3f2fd;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 14px;
  color: #1976d2;
}

.exercises-list {
  margin-top: 24px;
  padding: 16px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
  border-radius: 12px;
  border: 1px solid rgba(102, 126, 234, 0.1);
}

.exercise-item {
  background: white;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.exercise-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.exercise-details {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.exercise-details span {
  background: rgba(102, 126, 234, 0.1);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.85rem;
  color: #667eea;
  font-weight: 500;
}

.assignment-success {
  padding: 24px;
}

.success-title {
  color: #4CAF50;
  margin: 16px 0;
  font-weight: 600;
}

.user-name {
  color: #666;
  margin-bottom: 24px;
}

.loading-bar {
  margin-top: 16px;
}

.progress-bar {
  height: 4px;
  border-radius: 2px;
}

/* View Plan Dialog Styles */
.plan-overview {
  margin-bottom: 24px;
}

.plan-header {
  text-align: center;
  margin-bottom: 24px;
}

.plan-title {
  color: #667eea;
  font-weight: 700;
  margin-bottom: 12px;
  font-size: 1.5rem;
}

.plan-meta {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}

.plan-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
  border-radius: 12px;
  border: 1px solid rgba(102, 126, 234, 0.1);
}

.stat-content {
  display: flex;
    flex-direction: column;
  }
  
.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #667eea;
  line-height: 1;
}

.stat-label {
  font-size: 0.85rem;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.exercise-distribution {
  margin-bottom: 24px;
}

.exercise-distribution h4 {
  color: #667eea;
  font-weight: 600;
  margin-bottom: 16px;
  font-size: 1.1rem;
}

.distribution-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
}

.exercise-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.exercise-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.exercise-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.exercise-actions {
  display: flex;
  gap: 4px;
}

.exercise-header h5 {
  color: #333;
  font-weight: 600;
  margin: 0;
  font-size: 1rem;
}

.exercise-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-label {
  font-weight: 500;
  color: #666;
  font-size: 0.9rem;
}

.detail-value {
  font-weight: 600;
  color: #333;
  font-size: 0.9rem;
}

.plan-timeline {
  margin-bottom: 24px;
}

.plan-timeline h4 {
  color: #667eea;
  font-weight: 600;
  margin-bottom: 16px;
  font-size: 1.1rem;
}

.timeline-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 20px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
  border-radius: 12px;
  border: 1px solid rgba(102, 126, 234, 0.1);
}

.timeline-item {
  display: flex;
    flex-direction: column;
  align-items: center;
  gap: 8px;
}

.timeline-marker {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 3px solid #667eea;
}

.timeline-marker.start {
  background: #4CAF50;
}

.timeline-marker.end {
  background: #FF9800;
}

.timeline-line {
  flex: 1;
  height: 2px;
  background: linear-gradient(90deg, #667eea, #764ba2);
  min-width: 100px;
}

.timeline-content {
  text-align: center;
}

.timeline-date {
  font-weight: 600;
  color: #333;
  font-size: 0.9rem;
}

.timeline-label {
  font-size: 0.8rem;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.plan-summary {
  margin-bottom: 24px;
}

.plan-summary h4 {
  color: #667eea;
  font-weight: 600;
  margin-bottom: 16px;
  font-size: 1.1rem;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 12px;
}

.summary-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(102, 126, 234, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(102, 126, 234, 0.1);
  font-size: 0.9rem;
  color: #333;
}

/* Daily Distribution Styles */
.daily-distribution {
  margin-top: 24px;
  margin-bottom: 24px;
  padding: 20px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.03) 0%, rgba(118, 75, 162, 0.03) 100%);
  border-radius: 12px;
  border: 1px solid rgba(102, 126, 234, 0.1);
}

.daily-distribution h4 {
  margin: 0 0 16px 0;
  color: #667eea;
  font-weight: 600;
  font-size: 1.1rem;
}

.distribution-container {
  max-height: 400px;
  overflow-y: auto;
  padding-right: 8px;
}

.distribution-container::-webkit-scrollbar {
  width: 6px;
}

.distribution-container::-webkit-scrollbar-track {
  background: rgba(102, 126, 234, 0.05);
  border-radius: 3px;
}

.distribution-container::-webkit-scrollbar-thumb {
  background: rgba(102, 126, 234, 0.3);
  border-radius: 3px;
}

.distribution-container::-webkit-scrollbar-thumb:hover {
  background: rgba(102, 126, 234, 0.5);
}

.day-plan-card {
  background: white;
  border-radius: 8px;
  transition: all 0.3s ease;
  margin-bottom: 12px;
}

.day-plan-card:hover {
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
  transform: translateY(-2px);
}

.day-plan-header {
  padding: 12px 16px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  border-bottom: 1px solid rgba(102, 126, 234, 0.1);
}

.day-stats {
  display: flex;
  align-items: center;
  gap: 8px;
}

.workouts-list {
  padding: 8px 0;
}

.workout-item {
  padding: 8px 12px;
  background: rgba(102, 126, 234, 0.03);
  border-radius: 6px;
  border-left: 3px solid #667eea;
  transition: all 0.2s ease;
  margin-bottom: 8px;
}

.workout-item:hover {
  background: rgba(102, 126, 234, 0.08);
  transform: translateX(4px);
}

.workout-name {
  display: flex;
  align-items: center;
  flex: 1;
}

.workout-details {
  display: flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 768px) {
  .trainer-scheduler-page {
    padding: 16px;
  }
  
  .training-cards-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  
  .search-input {
    min-width: 100%;
  }
  
  .header-card .q-card-section {
    padding: 20px;
  }
  
  .approval-section-card .q-card-section,
  .user-list-card .q-card-section {
    padding: 20px;
  }
  
  .user-table .q-table thead th {
    padding: 12px 8px;
    font-size: 0.8rem;
  }
  
  .user-table .q-table tbody td {
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

/* Pagination Styles */
.approval-pagination,
.assignment-pagination,
.training-plans-pagination {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  margin-top: 24px;
}

.approval-pagination-controls,
.assignment-pagination-controls,
.training-plans-pagination-controls {
  display: flex;
  justify-content: center;
}

.approval-pagination-info,
.assignment-pagination-info,
.training-plans-pagination-info {
  text-align: center;
  color: #6c757d;
  font-weight: 500;
}

/* Responsive Pagination */
@media (max-width: 768px) {
  .approval-pagination,
  .assignment-pagination,
  .training-plans-pagination {
    padding: 16px;
    gap: 12px;
  }
  
  .approval-pagination-controls,
  .assignment-pagination-controls,
  .training-plans-pagination-controls {
    flex-wrap: wrap;
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .approval-pagination,
  .assignment-pagination,
  .training-plans-pagination {
    padding: 12px;
    gap: 8px;
  }
  
  .approval-pagination-info,
  .assignment-pagination-info,
  .training-plans-pagination-info {
    font-size: 0.8rem;
  }
}
</style>