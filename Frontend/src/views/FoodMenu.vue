<template>
  <div class="food-menu-page">
    <!-- Header Section -->
    <q-card class="header-card q-mb-lg" elevated>
      <q-card-section class="q-pa-lg">
        <div class="header-content">
          <div class="text-h4 text-weight-bold text-primary q-mb-xs">Food Menu Management</div>
          <div class="text-subtitle1 text-grey-6">Manage nutrition plans and food menus for your gym members</div>
        </div>
      </q-card-section>
    </q-card>

    <!-- User List Section -->
    <q-card class="user-list-card q-mb-lg" elevated>
      <q-card-section class="q-pa-lg">
        <div class="row items-center justify-between q-mb-lg">
          <div class="section-header">
            <div class="text-h6 text-weight-bold text-primary q-mb-sm">User List</div>
            <div class="text-caption text-grey-6">Select users to create or manage their food menus</div>
          </div>
          <div class="search-container">
            <q-input
              v-model="userSearchQuery"
              placeholder="Search users by name, email, or contact"
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
          row-key="id"
          flat
          bordered
          :loading="loadingUsers"
          class="user-table"
          :rows-per-page-options="[5,10,20,50]"
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
          
          <template v-slot:body-cell-contact="props">
            <q-td :props="props">
              <div class="text-body2">{{ props.row.phone || 'N/A' }}</div>
            </q-td>
          </template>

          <template v-slot:body-cell-status="props">
            <q-td :props="props" class="text-center">
              <q-badge
                :color="props.value === 'Active' ? 'positive' : 'negative'"
                :label="props.value"
                class="status-badge"
              >
                <q-icon 
                  :name="props.value === 'Active' ? 'check_circle' : 'cancel'"
                  class="q-mr-xs"
                />
              </q-badge>
            </q-td>
          </template>

          <template v-slot:body-cell-actions="props">
            <q-td :props="props" class="text-center">
              <div class="action-buttons">
                <q-btn
                  flat
                  color="primary"
                  icon="restaurant_menu"
                  size="sm"
                  @click="createFoodMenuForUser(props.row)"
                  class="action-btn"
                >
                  <q-tooltip>Create Food Menu</q-tooltip>
                </q-btn>
                <q-btn
                  flat
                  color="teal"
                  icon="visibility"
                  size="sm"
                  @click="viewUserAssignments(props.row)"
                  class="action-btn"
                >
                  <q-tooltip>View Assigned Plans</q-tooltip>
                </q-btn>
                <q-btn
                  flat
                  color="orange"
                  icon="edit"
                  size="sm"
                  @click="editUserFoodMenu(props.row)"
                  class="action-btn"
                >
                  <q-tooltip>Edit Food Menu</q-tooltip>
                </q-btn>
              </div>
            </q-td>
          </template>
        </q-table>
      </q-card-section>
    </q-card>
          
    <!-- Planned Nutrition Section -->
    <q-card class="nutrition-section-card q-mb-lg" elevated>
      <q-card-section class="q-pa-lg">
        <div class="row items-center justify-between q-mb-lg">
          <div class="section-header">
            <div class="text-h6 text-weight-bold text-primary q-mb-sm">Planned Nutrition</div>
            <div class="text-caption text-grey-6">Create and manage nutrition plans for your members</div>
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

        <!-- Assign Plan to User -->
        <q-card class="assign-plan-card q-mb-lg" flat bordered>
          <q-card-section class="q-pa-lg">
            <div class="text-h6 text-weight-bold text-primary q-mb-md">Assign Nutrition Plan to User</div>
            <div class="assign-form">
              <div class="row q-col-gutter-md q-mb-md">
                <div class="col-12 col-md-6">
                  <q-select
                    v-model="assignForm.selectedUser"
                    :options="userOptions"
                    use-input
                    fill-input
                    input-debounce="200"
                    label="Search user by name, email, or contact"
                    outlined
                    clearable
                    class="form-field"
                    emit-value
                    map-options
                    @filter="filterUsers"
                  >
                    <template v-slot:prepend>
                      <q-icon name="person_search" color="primary" />
                    </template>
                  </q-select>
                </div>
                <div class="col-12 col-md-6">
                  <q-select
                    v-model="assignForm.selectedPlan"
                    :options="nutritionPlanOptions"
                    label="Select Nutrition Plan"
                    placeholder="Select a plan"
                    outlined
                    clearable
                    class="form-field"
                    emit-value
                    map-options
                  >
                    <template v-slot:prepend>
                      <q-icon name="restaurant_menu" color="primary" />
                    </template>
                  </q-select>
                </div>
              </div>
              <div class="text-center">
                <q-btn
                  color="positive"
                  label="Assign Plan"
                  icon="assignment"
                  @click="assignPlanToUser"
                  :loading="assigningPlan"
                  class="assign-btn"
                  unelevated
                  size="md"
                />
              </div>
            </div>
          </q-card-section>
        </q-card>

        <!-- Search Planned Nutrition -->
        <div class="search-planned-nutrition q-mb-lg">
          <q-input
            v-model="nutritionSearchQuery"
            placeholder="Search planned nutrition by name or user"
            outlined
            clearable
            class="search-input"
          >
            <template v-slot:prepend>
              <q-icon name="search" color="primary" />
            </template>
          </q-input>
        </div>

        <!-- Current Planned Nutrition Cards -->
        <div class="nutrition-cards-grid">
          <q-card 
            v-for="plan in filteredNutritionPlans" 
            :key="plan.id" 
            class="nutrition-card"
            elevated
          >
            <q-card-section class="nutrition-card-header">
              <div class="row items-center justify-between">
                <div class="plan-title">
                  <div class="text-h6 text-weight-bold text-primary">{{ plan.menu_plan_category }} Plan</div>
                  <div class="text-caption text-grey-6">Nutrition Plan</div>
                </div>
                <q-badge 
                  :color="plan.status === 'ACTIVE' ? 'positive' : 'warning'" 
                  :label="plan.status" 
                  class="status-badge"
                >
                  <q-icon 
                    :name="plan.status === 'ACTIVE' ? 'check_circle' : 'schedule'"
                    class="q-mr-xs"
                  />
                </q-badge>
              </div>
            </q-card-section>
            
            <q-card-section class="nutrition-card-content">
              <div class="plan-details q-mb-md">
                <div class="row q-col-gutter-sm">
                  <div class="col-12 col-sm-4">
                    <div class="detail-item">
                      <q-icon name="event" color="primary" size="16px" class="q-mr-xs" />
                      <span class="text-caption text-grey-6">Start Date</span>
                      <div class="text-body2 text-weight-medium">{{ formatDate(plan.start_date) }}</div>
                    </div>
                  </div>
                  <div class="col-12 col-sm-4">
                    <div class="detail-item">
                      <q-icon name="event_available" color="primary" size="16px" class="q-mr-xs" />
                      <span class="text-caption text-grey-6">End Date</span>
                      <div class="text-body2 text-weight-medium">{{ formatDate(plan.end_date) }}</div>
                    </div>
                  </div>
                  <div class="col-12 col-sm-4">
                    <div class="detail-item">
                      <q-icon name="schedule" color="primary" size="16px" class="q-mr-xs" />
                      <span class="text-caption text-grey-6">Duration</span>
                      <div class="text-body2 text-weight-medium">{{ calculateDuration(plan.start_date, plan.end_date) }} days</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="nutrition-summary">
                <div class="text-subtitle2 text-weight-bold text-primary q-mb-md">Nutrition Summary</div>
                <div class="nutrition-grid">
                  <div class="nutrition-item">
                    <div class="nutrition-icon">
                      <q-icon name="local_fire_department" color="orange" size="24px" />
                    </div>
                    <div class="nutrition-content">
                      <div class="nutrition-label">Calories</div>
                      <div class="nutrition-value text-orange">
                        <span class="nutrition-number">{{ Number(plan.total_daily_calories || 0).toFixed(0) }}</span>
                        <span class="nutrition-unit">kcal</span>
                      </div>
                    </div>
                  </div>
                  <div class="nutrition-item">
                    <div class="nutrition-icon">
                      <q-icon name="fitness_center" color="green" size="24px" />
                    </div>
                    <div class="nutrition-content">
                      <div class="nutrition-label">Protein</div>
                      <div class="nutrition-value text-green">
                        <span class="nutrition-number">{{ Number(plan.total_daily_protein || 0).toFixed(0) }}</span>
                        <span class="nutrition-unit">g</span>
                      </div>
                    </div>
                  </div>
                  <div class="nutrition-item">
                    <div class="nutrition-icon">
                      <q-icon name="grain" color="amber" size="24px" />
                    </div>
                    <div class="nutrition-content">
                      <div class="nutrition-label">Carbs</div>
                      <div class="nutrition-value text-amber">
                        <span class="nutrition-number">{{ Number(plan.total_daily_carbs || 0).toFixed(0) }}</span>
                        <span class="nutrition-unit">g</span>
                      </div>
                    </div>
                  </div>
                  <div class="nutrition-item">
                    <div class="nutrition-icon">
                      <q-icon name="opacity" color="purple" size="24px" />
                    </div>
                    <div class="nutrition-content">
                      <div class="nutrition-label">Fats</div>
                      <div class="nutrition-value text-purple">
                        <span class="nutrition-number">{{ Number(plan.total_daily_fats || 0).toFixed(0) }}</span>
                        <span class="nutrition-unit">g</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </q-card-section>
            
            <q-card-actions class="nutrition-card-actions">
              <div class="action-buttons-row">
                <q-btn 
                  flat 
                  color="primary" 
                  icon="visibility" 
                  size="sm" 
                  @click="viewNutritionPlan(plan)" 
                  class="action-btn"
                >
                  <q-tooltip>View Details</q-tooltip>
                </q-btn>
                <q-btn 
                  flat 
                  color="orange" 
                  icon="edit" 
                  size="sm" 
                  @click="editNutritionPlan(plan)" 
                  class="action-btn"
                >
                  <q-tooltip>Edit Plan</q-tooltip>
                </q-btn>
                <q-btn 
                  flat 
                  color="negative" 
                  icon="delete" 
                  size="sm" 
                  @click="deleteNutritionPlan(plan.id)" 
                  class="action-btn"
                >
                  <q-tooltip>Delete Plan</q-tooltip>
                </q-btn>
              </div>
            </q-card-actions>
          </q-card>
        </div>
      </q-card-section>
    </q-card>

    <!-- My Assignments Section -->
    <div class="section">
      <div class="section-header">
        <h2>My Assignments</h2>
        <div class="search-container">
          <q-input
            v-model="assignmentSearchQuery"
            placeholder="Search assignments by user name or phone"
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
      <div v-if="loadingAssignments" class="q-pa-md">Loading assignments...</div>
      <div v-else>
        <div v-if="filteredAssignments && filteredAssignments.length" class="nutrition-cards-grid">
          <div v-for="a in filteredAssignments" :key="a.id" class="nutrition-card">
            <div class="card-header">
              <div class="plan-title-section">
                <h4>{{ a.menu_plan_category }} Plan</h4>
                <div class="user-info">
                  <div class="user-name">
                    <q-icon name="person" size="16px" class="q-mr-xs" />
                    {{ a.user_name || 'Unknown User' }}
                  </div>
                  <div class="user-phone">
                    <q-icon name="phone" size="16px" class="q-mr-xs" />
                    {{ a.user_phone || 'No phone' }}
                  </div>
                </div>
              </div>
              <q-badge :color="(a.status || 'ASSIGNED') === 'ASSIGNED' ? 'teal' : 'orange'" :label="a.status || 'ASSIGNED'" class="status-badge" />
            </div>
            <div class="card-content">
              <div class="plan-details">
                <p><strong>Start Date:</strong> {{ formatDate(a.start_date || a.menu_start_date) }}</p>
                <p><strong>End Date:</strong> {{ formatDate(a.end_date || a.menu_end_date) }}</p>
              </div>
              <div class="nutrition-summary">
                <div class="nutrition-item">
                  <span class="label">Total Calories:</span>
                  <span class="value">{{ Number(a.total_daily_calories || 0).toFixed(2) }} kcal</span>
                </div>
                <div class="nutrition-item">
                  <span class="label">Total Protein:</span>
                  <span class="value">{{ Number(a.total_daily_protein || 0).toFixed(2) }}g</span>
                </div>
                <div class="nutrition-item">
                  <span class="label">Total Carbs:</span>
                  <span class="value">{{ Number(a.total_daily_carbs || 0).toFixed(2) }}g</span>
                </div>
                <div class="nutrition-item">
                  <span class="label">Total Fats:</span>
                  <span class="value">{{ Number(a.total_daily_fats || 0).toFixed(2) }}g</span>
                </div>
              </div>
            </div>
            <div class="card-actions">
              <q-btn flat round color="primary" icon="visibility" size="sm" @click="viewAssignmentPlan(a)" title="View Details" />
              <q-btn flat round color="orange" icon="edit" size="sm" @click="editAssignmentPlan(a)" title="Edit Assignment" />
              <q-btn flat round color="red" icon="delete" size="sm" @click="deleteAssignmentPlan(a.id)" title="Delete Assignment" />
            </div>
          </div>
        </div>
        <div v-else class="q-pa-md">No assignments yet.</div>
      </div>
    </div>

    <!-- Approval Nutritions Section -->
    <div class="section">
      <div class="section-header">
        <h2>Approval Nutritions</h2>
      </div>
      <div v-if="loadingApprovals" class="q-pa-md">Loading...</div>
      <div v-else class="nutrition-cards-grid">
        <div v-for="req in approvalRequests" :key="req.id" class="nutrition-card">
          <div class="card-header">
            <h4>{{ req.menu_plan_category }} Plan</h4>
            <q-badge color="orange" :label="req.approval_status || 'PENDING'" class="status-badge" />
          </div>
          <div class="card-content">
            <p class="q-mb-sm">{{ req.description || '—' }}</p>
            <div class="nutrition-summary">
              <div class="nutrition-item">
                <span class="label">Total Days:</span>
                <span class="value">{{ req.total_days }}</span>
              </div>
            </div>
          </div>
          <div class="card-actions">
            <q-btn color="primary" label="View Details" @click="openApprovalDetails(req)" />
          </div>
        </div>
      </div>
    </div>

    <!-- Approval Details Dialog -->
    <q-dialog v-model="showApprovalDialog" persistent max-width="1000px">
      <q-card class="view-plan-dialog">
        <q-card-section class="dialog-header">
          <div class="text-h6">{{ currentApproval?.menu_plan_category }} Plan</div>
          <q-btn flat round icon="close" @click="showApprovalDialog = false" />
        </q-card-section>
        <q-card-section class="dialog-content">
          <div class="plan-overview">
            <h4>Client</h4>
            <p><strong>User Id:</strong> {{ currentApproval?.user_id || '—' }}</p>
            <p><strong>User Name:</strong> {{ currentApproval?.name || '—' }}</p>
            <p><strong>User phone:</strong> {{ currentApproval?.contact || '—' }}</p>
            <p><strong>Total Days:</strong> {{ currentApproval?.total_days }}</p>
            <p><strong>Total Calories/day:</strong> {{ Number(currentApproval?.total_calories || 0).toFixed(0) }}</p>
          </div>

          <div class="plan-overview q-mt-md">
            <h4>Dates</h4>
            <p><strong>Start:</strong> {{ formatDate(currentApproval?.start_date) }}</p>
            <p><strong>End:</strong> {{ formatDate(currentApproval?.end_date) }}</p>
          </div>

          <div class="plan-overview q-mt-md">
            <h4>Meals</h4>
            <div class="nutrition-cards-grid">
              <div class="nutrition-card">
                <div class="card-header"><h4>Breakfast</h4></div>
                <div class="card-content">
                  <div v-if="mealItems.breakfast.length" class="meal-items-grid">
                    <div v-for="(it, idx) in mealItems.breakfast" :key="'b'+idx" class="meal-item-card">
                      <div class="item-name">{{ it.food_item_name }}</div>
                      <div class="item-grams">{{ it.grams }}g</div>
                      <div class="item-macros">P {{ it.protein }}g · C {{ it.carbs }}g · F {{ it.fats }}g · {{ it.calories }} kcal</div>
                    </div>
                  </div>
                  <div v-else>No items</div>
                </div>
              </div>
              <div class="nutrition-card">
                <div class="card-header"><h4>Lunch</h4></div>
                <div class="card-content">
                  <div v-if="mealItems.lunch.length" class="meal-items-grid">
                    <div v-for="(it, idx) in mealItems.lunch" :key="'l'+idx" class="meal-item-card">
                      <div class="item-name">{{ it.food_item_name }}</div>
                      <div class="item-grams">{{ it.grams }}g</div>
                      <div class="item-macros">P {{ it.protein }}g · C {{ it.carbs }}g · F {{ it.fats }}g · {{ it.calories }} kcal</div>
                    </div>
                  </div>
                  <div v-else>No items</div>
                </div>
              </div>
              <div class="nutrition-card">
                <div class="card-header"><h4>Dinner</h4></div>
                <div class="card-content">
                  <div v-if="mealItems.dinner.length" class="meal-items-grid">
                    <div v-for="(it, idx) in mealItems.dinner" :key="'d'+idx" class="meal-item-card">
                      <div class="item-name">{{ it.food_item_name }}</div>
                      <div class="item-grams">{{ it.grams }}g</div>
                      <div class="item-macros">P {{ it.protein }}g · C {{ it.carbs }}g · F {{ it.fats }}g · {{ it.calories }} kcal</div>
                    </div>
                  </div>
                  <div v-else>No items</div>
                </div>
              </div>
            </div>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat color="red" label="Reject" @click="updateApproval('REJECTED')" />
          <q-btn color="green" label="Approve Plan" @click="updateApproval('APPROVED')" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Create New Plan Dialog -->
    <q-dialog v-model="showCreatePlanDialog" persistent max-width="1200px">
      <q-card class="create-plan-dialog">
        <q-card-section class="dialog-header">
          <div class="text-h6">Create Nutrition Plan</div>
          <q-btn
            flat
            round
            icon="close"
            @click="showCreatePlanDialog = false"
          />
        </q-card-section>

        <q-card-section class="dialog-content">
          <div class="plan-form">
            <!-- Date Range -->
            <div class="form-section">
              <h4>Date Range</h4>
              <div class="date-range">
                <q-input
                  v-model="newPlan.start_date"
                  label="Start Date"
                  type="date"
                  outlined
                  dense
                  class="form-field"
                />
                <q-input
                  v-model="newPlan.end_date"
                  label="End Date"
                  type="date"
                  outlined
                  dense
                  class="form-field"
                />
              </div>
            </div>

            <!-- Menu Plan Category -->
            <div class="form-section">
              <h4>Menu Plan Category</h4>
              <q-select
                v-model="newPlan.menu_plan_category"
                :options="menuCategories"
                label="Select Category"
                outlined
                dense
                class="form-field"
              />
            </div>

            <!-- Daily Plans -->
            <div class="form-section">
              <div class="section-header">
                <h4>Daily Plans</h4>
                <q-btn
                  color="green"
                  icon="add"
                  label="Add New Plan"
                  @click="addNewDailyPlan"
                  size="sm"
                />
              </div>

              <div class="daily-plans">
                <div
                  v-for="(dailyPlan, planIndex) in newPlan.daily_plans"
                  :key="planIndex"
                  class="daily-plan-card"
                >
                  <div class="plan-header">
                    <h5>Plan {{ planIndex + 1 }}</h5>
                    <q-btn
                      flat
                      round
                      color="red"
                      icon="delete"
                      size="sm"
                      @click="removeDailyPlan(planIndex)"
                    />
                  </div>

                  <div class="meals-section">
                    <!-- Breakfast -->
                    <div class="meal-section">
                      <h6>Breakfast</h6>
                      <div class="meal-items">
                        <div
                          v-for="(item, itemIndex) in dailyPlan.breakfast"
                          :key="itemIndex"
                          class="meal-item"
                        >
                          <q-input
                            v-model="item.food_item_name"
                            label="Food Item Name"
                            outlined
                            dense
                            class="form-field"
                            @update:model-value="() => calculateNutrition(item)"
                          />
                          <q-input
                            v-model="item.grams"
                            label="Grams"
                            type="number"
                            outlined
                            dense
                            class="form-field"
                            @update:model-value="val => { item.grams = Number(val) || 0; calculateNutrition(item) }"
                          />
                          <q-input
                            v-model="item.protein"
                            label="Protein (g)"
                            type="number"
                            outlined
                            dense
                            class="form-field"
                            readonly
                          />
                          <q-input
                            v-model="item.fats"
                            label="Fats (g)"
                            type="number"
                            outlined
                            dense
                            class="form-field"
                            readonly
                          />
                          <q-input
                            v-model="item.carbs"
                            label="Carbs (g)"
                            type="number"
                            outlined
                            dense
                            class="form-field"
                            readonly
                          />
                          <q-input
                            v-model="item.calories"
                            label="Calories"
                            type="number"
                            outlined
                            dense
                            class="form-field"
                            readonly
                          />
                          <q-btn
                            flat
                            round
                            color="red"
                            icon="delete"
                            size="sm"
                            @click="removeMealItem('breakfast', planIndex, itemIndex)"
                          />
                        </div>
                        <q-btn
                          color="green"
                          icon="add"
                          label="Add Item"
                          @click="addMealItem('breakfast', planIndex)"
                          size="sm"
                        />
                      </div>
                    </div>

                    <!-- Lunch -->
                    <div class="meal-section">
                      <h6>Lunch</h6>
                      <div class="meal-items">
                        <div
                          v-for="(item, itemIndex) in dailyPlan.lunch"
                          :key="itemIndex"
                          class="meal-item"
                        >
                          <q-input
                            v-model="item.food_item_name"
                            label="Food Item Name"
                            outlined
                            dense
                            class="form-field"
                            @update:model-value="() => calculateNutrition(item)"
                          />
                          <q-input
                            v-model="item.grams"
                            label="Grams"
                            type="number"
                            outlined
                            dense
                            class="form-field"
                            @update:model-value="val => { item.grams = Number(val) || 0; calculateNutrition(item) }"
                          />
                          <q-input
                            v-model="item.protein"
                            label="Protein (g)"
                            type="number"
                            outlined
                            dense
                            class="form-field"
                            readonly
                          />
                          <q-input
                            v-model="item.fats"
                            label="Fats (g)"
                            type="number"
                            outlined
                            dense
                            class="form-field"
                            readonly
                          />
                          <q-input
                            v-model="item.carbs"
                            label="Carbs (g)"
                            type="number"
                            outlined
                            dense
                            class="form-field"
                            readonly
                          />
                          <q-input
                            v-model="item.calories"
                            label="Calories"
                            type="number"
                            outlined
                            dense
                            class="form-field"
                            readonly
                          />
                          <q-btn
                            flat
                            round
                            color="red"
                            icon="delete"
                            size="sm"
                            @click="removeMealItem('lunch', planIndex, itemIndex)"
                          />
                        </div>
                        <q-btn
                          color="green"
                          icon="add"
                          label="Add Item"
                          @click="addMealItem('lunch', planIndex)"
                          size="sm"
                        />
                      </div>
                    </div>

                    <!-- Dinner -->
                    <div class="meal-section">
                      <h6>Dinner</h6>
                      <div class="meal-items">
                        <div
                          v-for="(item, itemIndex) in dailyPlan.dinner"
                          :key="itemIndex"
                          class="meal-item"
                        >
                          <q-input
                            v-model="item.food_item_name"
                            label="Food Item Name"
                            outlined
                            dense
                            class="form-field"
                            @update:model-value="() => calculateNutrition(item)"
                          />
                          <q-input
                            v-model="item.grams"
                            label="Grams"
                            type="number"
                            outlined
                            dense
                            class="form-field"
                            @update:model-value="val => { item.grams = Number(val) || 0; calculateNutrition(item) }"
                          />
                          <q-input
                            v-model="item.protein"
                            label="Protein (g)"
                            type="number"
                            outlined
                            dense
                            class="form-field"
                            readonly
                          />
                          <q-input
                            v-model="item.fats"
                            label="Fats (g)"
                            type="number"
                            outlined
                            dense
                            class="form-field"
                            readonly
                          />
                          <q-input
                            v-model="item.carbs"
                            label="Carbs (g)"
                            type="number"
                            outlined
                            dense
                            class="form-field"
                            readonly
                          />
                          <q-input
                            v-model="item.calories"
                            label="Calories"
                            type="number"
                            outlined
                            dense
                            class="form-field"
                            readonly
                          />
                          <q-btn
                            flat
                            round
                            color="red"
                            icon="delete"
                            size="sm"
                            @click="removeMealItem('dinner', planIndex, itemIndex)"
                          />
                        </div>
                        <q-btn
                          color="green"
                          icon="add"
                          label="Add Item"
                          @click="addMealItem('dinner', planIndex)"
                          size="sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </q-card-section>

        <q-card-actions align="right" class="dialog-actions">
          <q-btn flat label="Cancel" @click="showCreatePlanDialog = false" />
          <q-btn
            color="primary"
            label="Save Plan"
            @click="saveNutritionPlan"
            :loading="savingPlan"
            icon="save"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Assigned Plans Dialog -->
    <q-dialog v-model="showAssignmentsDialog" max-width="900px">
      <q-card class="view-plan-dialog">
        <q-card-section class="dialog-header">
          <div class="text-h6">Assigned Nutrition Plans - {{ assignmentsUserName }}</div>
          <q-btn flat round icon="close" @click="showAssignmentsDialog = false" />
        </q-card-section>
        <q-card-section class="dialog-content">
          <div v-if="userAssignments && userAssignments.length > 0">
            <div class="nutrition-cards-grid">
              <div v-for="a in userAssignments" :key="a.id" class="nutrition-card">
                <div class="card-header">
                  <h4>{{ a.menu_plan_category }} Plan</h4>
                  <q-badge :label="a.status" :color="a.status === 'ASSIGNED' ? 'green' : 'orange'" />
                </div>
                <div class="card-content">
                  <div class="plan-details">
                    <p><strong>Assigned On:</strong> {{ formatDate(a.created_at) }}</p>
                    <p><strong>Start Date:</strong> {{ formatDate(a.start_date || a.menu_start_date) }}</p>
                    <p><strong>End Date:</strong> {{ formatDate(a.end_date || a.menu_end_date) }}</p>
                  </div>
                  <div class="nutrition-summary">
                    <div class="nutrition-item"><span class="label">Calories:</span><span class="value">{{ Number(a.total_daily_calories || 0).toFixed(2) }} kcal</span></div>
                    <div class="nutrition-item"><span class="label">Protein:</span><span class="value">{{ Number(a.total_daily_protein || 0).toFixed(2) }}g</span></div>
                    <div class="nutrition-item"><span class="label">Carbs:</span><span class="value">{{ Number(a.total_daily_carbs || 0).toFixed(2) }}g</span></div>
                    <div class="nutrition-item"><span class="label">Fats:</span><span class="value">{{ Number(a.total_daily_fats || 0).toFixed(2) }}g</span></div>
                  </div>
                </div>
                <div class="card-actions">
                  <q-btn flat round color="primary" icon="visibility" size="sm" @click="viewNutritionPlan(a)" title="View Details" />
                </div>
              </div>
            </div>
          </div>
          <div v-else>No assignments found.</div>
        </q-card-section>
      </q-card>
    </q-dialog>
    <!-- Assignment Success Dialog -->
    <q-dialog v-model="showAssignmentDialog" persistent transition-show="fade" transition-hide="fade">
      <q-card style="min-width: 360px">
        <q-card-section class="row items-center q-gutter-sm">
          <q-icon name="check_circle" color="green" size="32px" />
          <div class="text-h6">Nutrition Plan Assigned</div>
        </q-card-section>
        <q-card-section>
          Plan successfully assigned to <strong>{{ assignedUserName }}</strong>.
        </q-card-section>
        <q-linear-progress color="green" indeterminate />
      </q-card>
    </q-dialog>

    <!-- View Nutrition Plan Dialog -->
    <q-dialog v-model="showViewDialog" max-width="800px">
      <q-card class="view-plan-dialog">
        <q-card-section class="dialog-header">
          <div class="text-h6">Nutrition Plan Details</div>
          <q-btn
            flat
            round
            icon="close"
            @click="showViewDialog = false"
          />
        </q-card-section>

        <q-card-section class="dialog-content">
          <div v-if="selectedPlan" class="plan-details">
            <div class="plan-overview">
              <h4>{{ selectedPlan.menu_plan_category }} Plan</h4>
              <p><strong>Start Date:</strong> {{ formatDate(selectedPlan.start_date) }}</p>
              <p><strong>End Date:</strong> {{ formatDate(selectedPlan.end_date) }}</p>
              <p><strong>Duration:</strong> {{ calculateDuration(selectedPlan.start_date, selectedPlan.end_date) }} days</p>
              <p><strong>Status:</strong> {{ selectedPlan.status }}</p>
            </div>

            <div class="nutrition-summary">
              <h5>Daily Nutrition Summary</h5>
          <div class="nutrition-grid">
                <div class="nutrition-item">
                  <span class="label">Total Calories:</span>
                  <span class="value">{{ selectedPlan.total_daily_calories }} kcal</span>
            </div>
                <div class="nutrition-item">
                  <span class="label">Total Protein:</span>
                  <span class="value">{{ selectedPlan.total_daily_protein }}g</span>
            </div>
                <div class="nutrition-item">
                  <span class="label">Total Carbs:</span>
                  <span class="value">{{ selectedPlan.total_daily_carbs }}g</span>
            </div>
                <div class="nutrition-item">
                  <span class="label">Total Fats:</span>
                  <span class="value">{{ selectedPlan.total_daily_fats }}g</span>
            </div>
          </div>
          </div>

            <div class="meal-details">
              <h5>Meal Details</h5>
              <div class="days-list">
                <div
                  v-for="day in (selectedPlan.total_days || 1)"
                  :key="day"
                  class="day-section"
                >
                  <h5>Day {{ day }}</h5>

                  <!-- Breakfast -->
                  <div class="meal-section">
                    <h6>Breakfast</h6>
                    <div class="meal-items-grid">
                      <div v-if="getMealsForDay('breakfast', day).length > 0">
                        <div
                          v-for="(item, index) in getMealsForDay('breakfast', day)"
                          :key="index"
                          class="meal-item-card"
                        >
                          <div class="meal-item-title">{{ item.food_item_name }}</div>
                          <div class="item-details">
                            <span>Grams: {{ item.grams }}g</span>
                            <span>Protein: {{ item.protein }}g</span>
                            <span>Fats: {{ item.fats }}g</span>
                            <span>Carbs: {{ item.carbs }}g</span>
                            <span>Calories: {{ item.calories }} kcal</span>
      </div>
    </div>
                      </div>
                      <div v-else class="empty-meal">No breakfast defined for this plan. Using Day 1 items.</div>
                    </div>
                  </div>

                  <!-- Lunch -->
                  <div class="meal-section">
                    <h6>Lunch</h6>
                    <div class="meal-items-grid">
                      <div v-if="getMealsForDay('lunch', day).length > 0">
                        <div
                          v-for="(item, index) in getMealsForDay('lunch', day)"
                          :key="index"
                          class="meal-item-card"
                        >
                          <div class="meal-item-title">{{ item.food_item_name }}</div>
                          <div class="item-details">
                            <span>Grams: {{ item.grams }}g</span>
                            <span>Protein: {{ item.protein }}g</span>
                            <span>Fats: {{ item.fats }}g</span>
                            <span>Carbs: {{ item.carbs }}g</span>
                            <span>Calories: {{ item.calories }} kcal</span>
                          </div>
                        </div>
                      </div>
                      <div v-else class="empty-meal">No lunch defined for this plan. Using Day 1 items.</div>
                    </div>
                  </div>

                  <!-- Dinner -->
                  <div class="meal-section">
                    <h6>Dinner</h6>
                    <div class="meal-items-grid">
                      <div v-if="getMealsForDay('dinner', day).length > 0">
                        <div
                          v-for="(item, index) in getMealsForDay('dinner', day)"
                          :key="index"
                          class="meal-item-card"
                        >
                          <div class="meal-item-title">{{ item.food_item_name }}</div>
                          <div class="item-details">
                            <span>Grams: {{ item.grams }}g</span>
                            <span>Protein: {{ item.protein }}g</span>
                            <span>Fats: {{ item.fats }}g</span>
                            <span>Carbs: {{ item.carbs }}g</span>
                            <span>Calories: {{ item.calories }} kcal</span>
                          </div>
                        </div>
                      </div>
                      <div v-else class="empty-meal">No dinner defined for this plan. Using Day 1 items.</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Close" @click="showViewDialog = false" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useUserManagementStore } from '../stores/userManagement'
import { useAuthStore } from '../stores/auth'
import { useFoodMenuStore } from '../stores/foodMenu'
import api from '../config/axios'

// Stores
const userManagementStore = useUserManagementStore()
const authStore = useAuthStore()
const foodMenuStore = useFoodMenuStore()

// Debug: Check if store methods are available
console.log('FoodMenuStore loaded:', foodMenuStore)
console.log('Available methods:', Object.getOwnPropertyNames(foodMenuStore))
console.log('deleteAssignment method:', typeof foodMenuStore.deleteAssignment)
console.log('updateAssignment method:', typeof foodMenuStore.updateAssignment)

// Reactive data
const userSearchQuery = ref('')
const nutritionSearchQuery = ref('')
const assignmentSearchQuery = ref('')
const loadingUsers = ref(false)
const savingPlan = ref(false)
const assigningPlan = ref(false)
const showAssignmentDialog = ref(false)
const assignedUserName = ref('')

// Dialog states
const showCreatePlanDialog = ref(false)
const showViewDialog = ref(false)
const selectedPlan = ref(null)
const editingPlanId = ref(null)

// User list data
const users = ref([])

// Nutrition plans data
const nutritionPlans = ref([])

// Assign form
const assignForm = ref({
  selectedUser: null,
  selectedPlan: null
})

// New plan form
const newPlan = ref({
  start_date: '',
  end_date: '',
  menu_plan_category: '',
  daily_plans: [
    {
      breakfast: [],
      lunch: [],
      dinner: []
    }
  ]
})

// Options
const menuCategories = ['Weight Gain', 'Weight Lose', 'Muscle building']
const nutritionPlanOptions = ref([])
const userOptions = ref([])

// User table columns
const userColumns = [
  {
    name: 'id',
    required: true,
    label: 'ID',
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
    name: 'contact',
    required: true,
    label: 'Contact',
    align: 'left',
    field: 'contact',
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
    name: 'actions',
    required: true,
    label: 'Actions',
    align: 'center',
    field: 'actions'
  }
]

// Computed properties
const filteredUsers = computed(() => {
  if (!userSearchQuery.value) return users.value
  
  const query = userSearchQuery.value.toLowerCase()
  return users.value.filter(user => 
    user.name.toLowerCase().includes(query) ||
    user.email.toLowerCase().includes(query) ||
    user.contact.toLowerCase().includes(query)
  )
})

const filteredNutritionPlans = computed(() => {
  if (!nutritionSearchQuery.value) return nutritionPlans.value
  
  const query = nutritionSearchQuery.value.toLowerCase()
  return nutritionPlans.value.filter(plan => 
    plan.menu_plan_category.toLowerCase().includes(query) ||
    plan.start_date.toLowerCase().includes(query) ||
    plan.end_date.toLowerCase().includes(query)
  )
})

const filteredAssignments = computed(() => {
  if (!assignmentSearchQuery.value) return allAssignments.value
  
  const query = assignmentSearchQuery.value.toLowerCase()
  return allAssignments.value.filter(assignment => 
    (assignment.user_name && assignment.user_name.toLowerCase().includes(query)) ||
    (assignment.user_phone && assignment.user_phone.toLowerCase().includes(query)) ||
    (assignment.menu_plan_category && assignment.menu_plan_category.toLowerCase().includes(query))
  )
})

// Methods
const loadUsers = async () => {
  try {
    loadingUsers.value = true
    await userManagementStore.fetchUsers()
    // Normalize contact field so it appears in the table
    users.value = (userManagementStore.users || []).map(u => ({
      ...u,
      contact: u.contact || u.phone || u.mobile || u.phone_number || u.user_phone || ''
    }))
  } catch (error) {
    console.error('Error loading users:', error)
  } finally {
    loadingUsers.value = false
  }
}

const loadNutritionPlans = async () => {
  try {
    await foodMenuStore.fetchFoodMenus()
    // Dedupe by id to avoid duplicate cards after create/save
    const byId = new Map()
    for (const plan of foodMenuStore.foodMenus) {
      if (plan && plan.id != null) {
        byId.set(plan.id, plan)
      }
    }
    // Normalize and enrich plans with computed daily totals for card display
    const plansArr = Array.from(byId.values()).map(p => {
      const parseMeals = (val) => {
        if (!val) return []
        if (Array.isArray(val)) return val
        try { const j = JSON.parse(val); return Array.isArray(j) ? j : [] } catch { return [] }
      }
      const breakfast = parseMeals(p.breakfast || p.BREAKFAST)
      const lunch = parseMeals(p.lunch || p.LUNCH)
      const dinner = parseMeals(p.dinner || p.DINNER)
      const all = [...breakfast, ...lunch, ...dinner]
      const sum = (k) => all.reduce((s, it) => s + (Number(it[k]) || 0), 0)
      const totals = {
        total_daily_calories: sum('calories'),
        total_daily_protein: sum('protein'),
        total_daily_carbs: sum('carbs'),
        total_daily_fats: sum('fats')
      }
      return {
        ...p,
        total_daily_calories: Number(p.total_daily_calories || 0) || totals.total_daily_calories,
        total_daily_protein: Number(p.total_daily_protein || 0) || totals.total_daily_protein,
        total_daily_carbs: Number(p.total_daily_carbs || 0) || totals.total_daily_carbs,
        total_daily_fats: Number(p.total_daily_fats || 0) || totals.total_daily_fats
      }
    })
    nutritionPlans.value = plansArr
    nutritionPlanOptions.value = nutritionPlans.value.map(plan => ({
      label: `${plan.menu_plan_category} (${formatDate(plan.start_date)} - ${formatDate(plan.end_date)})`,
      value: Number(plan.id)
    }))
  } catch (error) {
    console.error('Error loading nutrition plans:', error)
  }
}

const createFoodMenuForUser = (user) => {
  // Set user context and open create dialog
  newPlan.value.user_id = user.id
  editingPlanId.value = null
  showCreatePlanDialog.value = true
}

const editUserFoodMenu = (user) => {
  // Open dialog in create mode for this user
  newPlan.value.user_id = user.id
  editingPlanId.value = null
  showCreatePlanDialog.value = true
}

const assignPlanToUser = async () => {
  // Validate
  if (!assignForm.value.selectedUser || !assignForm.value.selectedPlan) {
    alert('Please select a user and a nutrition plan to assign')
    return
  }

  try {
    assigningPlan.value = true
    const user = users.value.find(u => u.id === assignForm.value.selectedUser)
    if (!user) { alert('User not found'); return }

    // Get selected plan details
    const planId = assignForm.value.selectedPlan
    // Fetch full plan details to ensure meals are included
    let plan = nutritionPlans.value.find(p => p.id === planId)
    try {
      const full = await foodMenuStore.getFoodMenu(planId)
      if (full) plan = { ...plan, ...full }
    } catch (e) {
      // ignore and use existing summary
    }
    if (!plan) {
      alert('Selected plan not found')
      return
    }

    console.log('Frontend: Plan data for assignment:', {
      id: plan.id,
      menu_plan_category: plan.menu_plan_category,
      breakfast: plan.breakfast,
      lunch: plan.lunch,
      dinner: plan.dinner,
      total_daily_calories: plan.total_daily_calories
    })

    // Ensure meals are JSON objects
    const parseMeals = (val) => {
      if (!val) return []
      if (Array.isArray(val)) return val
      try { const p = JSON.parse(val); return Array.isArray(p) ? p : [] } catch { return [] }
    }
    // Normalize user fields required by backend
    const userName = user.name || user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim()
    const userEmail = user.email || user.email_id || user.user_email || ''
    const userContact = user.contact || user.phone || user.mobile || user.phone_number || ''
    if (!userName || !userEmail || !userContact) {
      alert('Selected user is missing name/email/contact. Please complete user profile before assigning.')
      return
    }

    const mealsObj = {
      breakfast: parseMeals(plan.breakfast || plan.BREAKFAST),
      lunch: parseMeals(plan.lunch || plan.LUNCH),
      dinner: parseMeals(plan.dinner || plan.DINNER)
    }
    // Flatten to array of items as backend expects an array
    const normalizeItem = (it, meal_type) => ({
      meal_type,
      food_item_name: it.food_item_name || it.name || it.item_name || '',
      grams: Number(it.grams || 0),
      protein: Number(it.protein || 0),
      fats: Number(it.fats || 0),
      carbs: Number(it.carbs || 0),
      calories: Number(it.calories || 0),
      day: Number(it.day || 1)
    })
    const foodItems = [
      ...mealsObj.breakfast.map(it => normalizeItem(it, 'breakfast')),
      ...mealsObj.lunch.map(it => normalizeItem(it, 'lunch')),
      ...mealsObj.dinner.map(it => normalizeItem(it, 'dinner'))
    ].filter(it => it.food_item_name || it.grams > 0 || it.protein > 0 || it.carbs > 0 || it.fats > 0 || it.calories > 0)
    console.debug('Assign payload meals:', { planId, foodItemsCount: foodItems.length, sample: foodItems[0] })
    if (foodItems.length === 0) {
      alert('Selected plan has no meals to assign. Please add items first or reopen the plan and save at least one meal item.')
      return
    }

    const approvalPayload = {
      user_id: user.id,
      name: userName,
      email: userEmail,
      contact: userContact,
      menu_plan_category: plan.menu_plan_category || plan.category || 'General',
      total_days: calculateDuration(plan.start_date, plan.end_date),
      description: `Assigned food menu (${plan.menu_plan_category || plan.category}) from ${formatDate(plan.start_date)} to ${formatDate(plan.end_date)}`,
      // Backend expects a non-empty array
      food_items: foodItems,
      total_protein: Number(plan.total_daily_protein || 0),
      total_fats: Number(plan.total_daily_fats || 0),
      total_carbs: Number(plan.total_daily_carbs || 0),
      total_calories: Number(plan.total_daily_calories || 0),
      approval_status: 'ASSIGNED',
      start_date: plan.start_date,
      end_date: plan.end_date
    }

    // Call lightweight assignment endpoint
    await foodMenuStore.assignFoodMenuToUser({
      user_id: user.id,
      food_menu_id: planId,
      start_date: plan.start_date,
      end_date: plan.end_date,
      notes: `Assigned ${plan.menu_plan_category} plan`
    })

    // Immediately refresh and show user's assignments so the new card appears
    try {
      assignmentsUserName.value = user.name
      userAssignments.value = await foodMenuStore.fetchUserAssignments(user.id)
      showAssignmentsDialog.value = true
      
      // Also refresh the main "My Assignments" list
      await loadAllAssignments()
    } catch (e) {
      console.warn('Assignments refresh failed, will still show success toast', e)
    }

    // Reset form
    assignForm.value = { selectedUser: null, selectedPlan: null }
    assignedUserName.value = user.name
    showAssignmentDialog.value = true
    setTimeout(() => { showAssignmentDialog.value = false }, 2000)
  } catch (error) {
    console.error('Error assigning plan:', error)
    alert('Failed to assign plan: ' + (error.response?.data?.message || error.message))
  } finally {
    assigningPlan.value = false
  }
}

const addNewDailyPlan = () => {
  newPlan.value.daily_plans.push({
    breakfast: [],
    lunch: [],
    dinner: []
  })
}

const removeDailyPlan = (index) => {
  if (newPlan.value.daily_plans.length > 1) {
    newPlan.value.daily_plans.splice(index, 1)
  }
}

const addMealItem = (mealType, planIndex) => {
  newPlan.value.daily_plans[planIndex][mealType].push({
    food_item_name: '',
    grams: 0,
    protein: 0,
    fats: 0,
    carbs: 0,
    calories: 0
  })
}

const removeMealItem = (mealType, planIndex, itemIndex) => {
  newPlan.value.daily_plans[planIndex][mealType].splice(itemIndex, 1)
}

const calculateNutrition = async (item) => {
  if (!item.food_item_name || !item.grams) return
  
  try {
    // Use the store's nutrition calculation method
    const nutrition = foodMenuStore.getMockNutrition(item.food_item_name, item.grams)
    
    item.protein = nutrition.protein
    item.fats = nutrition.fats
    item.carbs = nutrition.carbs
    item.calories = nutrition.calories
  } catch (error) {
    console.error('Error calculating nutrition:', error)
  }
}

const saveNutritionPlan = async () => {
  try {
    savingPlan.value = true
    
    // Basic validations
    if (!newPlan.value.start_date || !newPlan.value.end_date || !newPlan.value.menu_plan_category) {
      alert('Please fill Start Date, End Date and Menu Plan Category')
      return
    }
    const hasAnyItem = (newPlan.value.daily_plans || []).some(dp =>
      (dp.breakfast && dp.breakfast.length) ||
      (dp.lunch && dp.lunch.length) ||
      (dp.dinner && dp.dinner.length)
    )
    if (!hasAnyItem) {
      alert('Please add at least one food item in Breakfast, Lunch or Dinner')
      return
    }
    // Ensure grams are numbers and nutrition is calculated
    const ensureNutrition = (items) => {
      items.forEach((it) => {
        it.grams = Number(it.grams) || 0
        if (it.food_item_name && it.grams > 0) {
          const n = foodMenuStore.getMockNutrition(it.food_item_name, it.grams)
          it.protein = n.protein
          it.fats = n.fats
          it.carbs = n.carbs
          it.calories = n.calories
        }
      })
    }
    newPlan.value.daily_plans.forEach(dp => {
      ensureNutrition(dp.breakfast || [])
      ensureNutrition(dp.lunch || [])
      ensureNutrition(dp.dinner || [])
    })
    
    // Calculate totals from all daily plans (sum once across all days)
    const allMeals = []
    newPlan.value.daily_plans.forEach(plan => {
      allMeals.push(...(plan.breakfast || []), ...(plan.lunch || []), ...(plan.dinner || []))
    })
    const totalProtein = allMeals.reduce((sum, item) => sum + (Number(item.protein) || 0), 0)
    const totalFats = allMeals.reduce((sum, item) => sum + (Number(item.fats) || 0), 0)
    const totalCarbs = allMeals.reduce((sum, item) => sum + (Number(item.carbs) || 0), 0)
    const totalCalories = allMeals.reduce((sum, item) => sum + (Number(item.calories) || 0), 0)
    
    // Combine daily plans into flat arrays with day indicator
    const combined = { breakfast: [], lunch: [], dinner: [] }
    newPlan.value.daily_plans.forEach((planDay, idx) => {
      const day = idx + 1
      ;(planDay.breakfast || []).forEach(it => combined.breakfast.push({ ...it, day }))
      ;(planDay.lunch || []).forEach(it => combined.lunch.push({ ...it, day }))
      ;(planDay.dinner || []).forEach(it => combined.dinner.push({ ...it, day }))
    })

    const planData = {
      menu_plan_category: newPlan.value.menu_plan_category,
      start_date: newPlan.value.start_date,
      end_date: newPlan.value.end_date,
      // Stringify meals to satisfy back-end JSON.parse expectations
      breakfast: JSON.stringify(combined.breakfast),
      lunch: JSON.stringify(combined.lunch),
      dinner: JSON.stringify(combined.dinner),
      total_daily_protein: totalProtein,
      total_daily_fats: totalFats,
      total_daily_carbs: totalCarbs,
      total_daily_calories: totalCalories
    }
    
    if (editingPlanId.value) {
      // Check if we're editing an assignment or a regular food menu
      console.log('Editing plan ID:', editingPlanId.value)
      console.log('Available assignments:', allAssignments.value.map(a => ({ id: a.id, type: typeof a.id })))
      const isEditingAssignment = allAssignments.value.some(a => a.id == editingPlanId.value) // Use == for type coercion
      console.log('Is editing assignment:', isEditingAssignment)
      
      if (isEditingAssignment) {
        console.log('Updating assignment with ID:', editingPlanId.value)
        console.log('updateAssignment method exists:', typeof foodMenuStore.updateAssignment)
        await foodMenuStore.updateAssignment(editingPlanId.value, planData)
        await loadAllAssignments() // Refresh assignments list
      } else {
        console.log('Updating food menu with ID:', editingPlanId.value)
        await foodMenuStore.updateFoodMenu(editingPlanId.value, planData)
        await loadNutritionPlans() // Refresh nutrition plans list
      }
    } else {
      console.log('Creating new food menu')
      await foodMenuStore.createFoodMenu(planData)
      await loadNutritionPlans() // Refresh nutrition plans list
    }
    
    // Reset form
    resetNewPlanForm()
    showCreatePlanDialog.value = false
    
    console.log('Nutrition plan saved successfully')
  } catch (error) {
    console.error('Error saving nutrition plan:', error)
    alert('Failed to save plan: ' + (error.response?.data?.message || error.message))
  } finally {
    savingPlan.value = false
  }
}

const resetNewPlanForm = () => {
  newPlan.value = {
    start_date: '',
    end_date: '',
    menu_plan_category: '',
    daily_plans: [
      {
        breakfast: [],
        lunch: [],
        dinner: []
      }
    ]
  }
}

const viewNutritionPlan = (plan) => {
  // Parse meal JSON strings (backend stores as JSON text)
  const parseMeals = (val) => {
    if (!val) return []
    if (Array.isArray(val)) return val
    try {
      const parsed = JSON.parse(val)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  const normalized = { ...plan }
  normalized.breakfast = parseMeals(plan.breakfast)
  normalized.lunch = parseMeals(plan.lunch)
  normalized.dinner = parseMeals(plan.dinner)
  // Ensure option values are numbers when building options
  // Derive total_days for Day 1..N rendering from meals.day or date range, whichever is larger
  const mealMax = Math.max(
    1,
    ...normalized.breakfast.map(m => Number(m.day || 1)),
    ...normalized.lunch.map(m => Number(m.day || 1)),
    ...normalized.dinner.map(m => Number(m.day || 1))
  )
  const rangeDays = calculateDuration(plan.start_date, plan.end_date)
  normalized.total_days = Math.max(mealMax, rangeDays)
  normalized.max_defined_day = mealMax
  // Compute totals from parsed meals if not present or zero
  const allMealsForTotals = [
    ...normalized.breakfast,
    ...normalized.lunch,
    ...normalized.dinner
  ]
  const sum = (arr, key) => arr.reduce((s, it) => s + (Number(it[key]) || 0), 0)
  const totals = {
    total_daily_calories: sum(allMealsForTotals, 'calories'),
    total_daily_protein: sum(allMealsForTotals, 'protein'),
    total_daily_carbs: sum(allMealsForTotals, 'carbs'),
    total_daily_fats: sum(allMealsForTotals, 'fats')
  }
  normalized.total_daily_calories = Number(plan.total_daily_calories || 0) || totals.total_daily_calories
  normalized.total_daily_protein = Number(plan.total_daily_protein || 0) || totals.total_daily_protein
  normalized.total_daily_carbs = Number(plan.total_daily_carbs || 0) || totals.total_daily_carbs
  normalized.total_daily_fats = Number(plan.total_daily_fats || 0) || totals.total_daily_fats
  selectedPlan.value = normalized
  showViewDialog.value = true
}

// View a user's assigned nutrition plans
const userAssignments = ref([])
const showAssignmentsDialog = ref(false)
const assignmentsUserName = ref('')
const allAssignments = ref([])
const loadingAssignments = ref(false)
const viewUserAssignments = async (user) => {
  try {
    assignmentsUserName.value = user.name
    userAssignments.value = await foodMenuStore.fetchUserAssignments(user.id)
    showAssignmentsDialog.value = true
  } catch (e) {
    alert('Failed to load user assignments: ' + (e.response?.data?.message || e.message))
  }
}
// Load all assignments for the gym (no user filter)
const loadAllAssignments = async () => {
  try {
    loadingAssignments.value = true
    const assignments = await foodMenuStore.fetchUserAssignments(undefined)
    console.log('Frontend: Loaded assignments:', assignments.map(a => ({
      id: a.id,
      menu_plan_category: a.menu_plan_category,
      breakfast: a.breakfast ? 'Has breakfast data' : 'No breakfast data',
      lunch: a.lunch ? 'Has lunch data' : 'No lunch data',
      dinner: a.dinner ? 'Has dinner data' : 'No dinner data',
      total_daily_calories: a.total_daily_calories
    })))
    allAssignments.value = assignments
  } catch (e) {
    console.warn('Failed to load assignments', e)
    allAssignments.value = []
  } finally {
    loadingAssignments.value = false
  }
}
// Helper to get meals for a given day with fallback to Day 1 items
const getMealsForDay = (type, day) => {
  if (!selectedPlan.value) return []
  const list = (selectedPlan.value[type] || [])
  const exact = list.filter(it => Number(it.day || 1) === Number(day))
  if (exact.length > 0) return exact
  // Fallback: if day > defined max, reuse Day 1 items to avoid empty sections
  const day1 = list.filter(it => Number(it.day || 1) === 1)
  return day1
}

const editNutritionPlan = (plan) => {
  editingPlanId.value = plan.id
  const parseMeals = (val) => {
    if (!val) return []
    if (Array.isArray(val)) return val
    try { const p = JSON.parse(val); return Array.isArray(p) ? p : [] } catch { return [] }
  }
  const b = parseMeals(plan.breakfast)
  const l = parseMeals(plan.lunch)
  const d = parseMeals(plan.dinner)
  const maxDay = Math.max(1, ...b.map(x => x.day || 1), ...l.map(x => x.day || 1), ...d.map(x => x.day || 1))
  const daily = Array.from({ length: maxDay }, () => ({ breakfast: [], lunch: [], dinner: [] }))
  b.forEach(it => daily[(it.day || 1) - 1].breakfast.push({ ...it }))
  l.forEach(it => daily[(it.day || 1) - 1].lunch.push({ ...it }))
  d.forEach(it => daily[(it.day || 1) - 1].dinner.push({ ...it }))
  newPlan.value = {
    start_date: plan.start_date,
    end_date: plan.end_date,
    menu_plan_category: plan.menu_plan_category,
    daily_plans: daily
  }
  showCreatePlanDialog.value = true
}

const deleteNutritionPlan = async (planId) => {
  try {
    await foodMenuStore.deleteFoodMenu(planId)
    await loadNutritionPlans()
    console.log('Nutrition plan deleted successfully')
  } catch (error) {
    console.error('Error deleting nutrition plan:', error)
  }
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString()
}

const calculateDuration = (startDate, endDate) => {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffTime = Math.abs(end - start)
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

// Lifecycle
onMounted(async () => {
  await loadUsers()
  // Prime user options for the select
  userOptions.value = users.value.map(u => ({ label: `${u.name} (${u.contact})`, value: u.id }))
  await loadNutritionPlans()
  await loadAllAssignments()
  await loadApprovalRequests()
})

// Dynamic filter for user select
const filterUsers = (val, update, abort) => {
  const needle = (val || '').toLowerCase()
  update(() => {
    const source = users.value
    const items = !needle
      ? source
      : source.filter(u =>
          u.name?.toLowerCase().includes(needle) ||
          u.email?.toLowerCase().includes(needle) ||
          String(u.contact || u.phone || u.mobile || u.phone_number || '').toLowerCase().includes(needle) ||
          String(u.id).includes(needle)
        )
    userOptions.value = items.map(u => ({ label: `${u.name} (${u.contact || u.phone || u.mobile || ''})`, value: u.id }))
  })
}

// Approval section state/actions
const approvalRequests = computed(() => foodMenuStore.approvalRequests || [])
const loadingApprovals = computed(() => foodMenuStore.loadingApprovalRequests || false)
const showApprovalDialog = ref(false)
const currentApproval = ref(null)
const mealItems = reactive({ breakfast: [], lunch: [], dinner: [] })

const parseArray = (v) => {
  if (!v) return []
  if (Array.isArray(v)) return v
  try { const j = JSON.parse(v); return Array.isArray(j) ? j : [] } catch { return [] }
}

const loadApprovalRequests = async () => {
  try {
    await foodMenuStore.fetchApprovalRequests()
  } catch (e) {
    console.warn('Failed to load approvals', e)
  }
}

const openApprovalDetails = async (req) => {
  try {
    const full = await foodMenuStore.getApprovalRequest(req.id)
    currentApproval.value = full || req
    // Normalize meals by day 1 for view; backend stores as array on food_items
    const items = currentApproval.value.food_items || []
    mealItems.breakfast = items.filter(i => (i.meal_type || '').toLowerCase() === 'breakfast')
    mealItems.lunch = items.filter(i => (i.meal_type || '').toLowerCase() === 'lunch')
    mealItems.dinner = items.filter(i => (i.meal_type || '').toLowerCase() === 'dinner')
    showApprovalDialog.value = true
  } catch (e) {
    console.error('Failed to load approval details', e)
  }
}

const updateApproval = async (status) => {
  if (!currentApproval.value) return
  try {
    await foodMenuStore.updateApprovalStatus(currentApproval.value.id, status)
    showApprovalDialog.value = false
    await loadApprovalRequests()
  } catch (e) {
    console.error('Failed to update approval status', e)
  }
}

// Assignment management functions
const viewAssignmentPlan = (assignment) => {
  // Parse meal JSON strings (backend stores as JSON text)
  const parseMeals = (val) => {
    if (!val) return []
    if (Array.isArray(val)) return val
    try {
      const parsed = JSON.parse(val)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  const normalized = { ...assignment }
  normalized.breakfast = parseMeals(assignment.breakfast)
  normalized.lunch = parseMeals(assignment.lunch)
  normalized.dinner = parseMeals(assignment.dinner)
  
  // Derive total_days for Day 1..N rendering from meals.day or date range
  const mealMax = Math.max(
    1,
    ...normalized.breakfast.map(m => Number(m.day || 1)),
    ...normalized.lunch.map(m => Number(m.day || 1)),
    ...normalized.dinner.map(m => Number(m.day || 1))
  )
  const rangeDays = calculateDuration(assignment.start_date, assignment.end_date)
  normalized.total_days = Math.max(mealMax, rangeDays)
  normalized.max_defined_day = mealMax
  
  // Compute totals from parsed meals if not present or zero
  const allMealsForTotals = [
    ...normalized.breakfast,
    ...normalized.lunch,
    ...normalized.dinner
  ]
  const sum = (arr, key) => arr.reduce((s, it) => s + (Number(it[key]) || 0), 0)
  const totals = {
    total_daily_calories: sum(allMealsForTotals, 'calories'),
    total_daily_protein: sum(allMealsForTotals, 'protein'),
    total_daily_carbs: sum(allMealsForTotals, 'carbs'),
    total_daily_fats: sum(allMealsForTotals, 'fats')
  }
  normalized.total_daily_calories = Number(assignment.total_daily_calories || 0) || totals.total_daily_calories
  normalized.total_daily_protein = Number(assignment.total_daily_protein || 0) || totals.total_daily_protein
  normalized.total_daily_carbs = Number(assignment.total_daily_carbs || 0) || totals.total_daily_carbs
  normalized.total_daily_fats = Number(assignment.total_daily_fats || 0) || totals.total_daily_fats
  
  selectedPlan.value = normalized
  showViewDialog.value = true
}

const editAssignmentPlan = (assignment) => {
  editingPlanId.value = assignment.id
  const parseMeals = (val) => {
    if (!val) return []
    if (Array.isArray(val)) return val
    try { const p = JSON.parse(val); return Array.isArray(p) ? p : [] } catch { return [] }
  }
  const b = parseMeals(assignment.breakfast)
  const l = parseMeals(assignment.lunch)
  const d = parseMeals(assignment.dinner)
  const maxDay = Math.max(1, ...b.map(x => x.day || 1), ...l.map(x => x.day || 1), ...d.map(x => x.day || 1))
  const daily = Array.from({ length: maxDay }, () => ({ breakfast: [], lunch: [], dinner: [] }))
  b.forEach(it => daily[(it.day || 1) - 1].breakfast.push({ ...it }))
  l.forEach(it => daily[(it.day || 1) - 1].lunch.push({ ...it }))
  d.forEach(it => daily[(it.day || 1) - 1].dinner.push({ ...it }))
  newPlan.value = {
    start_date: assignment.start_date,
    end_date: assignment.end_date,
    menu_plan_category: assignment.menu_plan_category,
    daily_plans: daily
  }
  showCreatePlanDialog.value = true
}

const deleteAssignmentPlan = async (assignmentId) => {
  console.log('Attempting to delete assignment with ID:', assignmentId)
  console.log('FoodMenuStore methods available:', Object.getOwnPropertyNames(foodMenuStore))
  console.log('deleteAssignment method exists:', typeof foodMenuStore.deleteAssignment)
  
  if (!confirm('Are you sure you want to delete this assignment? This action cannot be undone.')) {
    return
  }
  
  try {
    console.log('Calling deleteAssignment with ID:', assignmentId)
    await foodMenuStore.deleteAssignment(assignmentId)
    console.log('Assignment deleted successfully, refreshing list...')
    await loadAllAssignments() // Refresh the assignments list
    console.log('Assignment deleted successfully')
  } catch (error) {
    console.error('Error deleting assignment:', error)
    alert('Failed to delete assignment: ' + (error.response?.data?.message || error.message))
  }
}
</script>

<style scoped>
.food-menu-page {
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
}

.page-header p {
  color: #666;
  margin: 0;
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
}

.search-container {
  width: 300px;
}

.search-input {
  width: 100%;
}

.user-table-container {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.user-table {
  width: 100%;
}

.status-badge {
  font-size: 0.8rem;
  padding: 4px 8px;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.create-plan-btn {
  font-weight: 600;
}

.assign-plan-card {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.assign-plan-card h3 {
  margin: 0 0 1rem 0;
  color: #333;
}

.assign-form {
  display: flex;
  gap: 1rem;
  align-items: end;
}

.form-field {
  min-width: 200px;
}

.assign-btn {
  height: 40px;
  min-width: 120px;
}

.search-planned-nutrition {
  margin-bottom: 2rem;
}

.search-planned-nutrition .search-input {
  max-width: 400px;
}

.nutrition-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}

.nutrition-card {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s, box-shadow 0.2s;
}

.nutrition-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e9ecef;
}

.plan-title-section {
  flex: 1;
}

.card-header h4 {
  margin: 0 0 0.5rem 0;
  color: #333;
  font-size: 1.1rem;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.user-name, .user-phone {
  display: flex;
  align-items: center;
  font-size: 0.85rem;
  color: #666;
}

.user-name {
  font-weight: 500;
  color: #333;
}

.card-content {
  margin-bottom: 1rem;
}

.plan-details p {
  margin: 0.5rem 0;
  color: #666;
  font-size: 0.9rem;
}

.nutrition-summary {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1rem;
  margin-top: 1rem;
}

.nutrition-item {
  display: flex;
  justify-content: space-between;
  margin: 0.25rem 0;
  font-size: 0.9rem;
}

.nutrition-item .label {
  color: #666;
}

.nutrition-item .value {
  font-weight: 600;
  color: #333;
}

.card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding-top: 1rem;
  border-top: 1px solid #e9ecef;
}

/* Dialog Styles */
.create-plan-dialog {
  width: 100%;
  max-width: 1200px;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e9ecef;
}

.dialog-content {
  max-height: 70vh;
  overflow-y: auto;
}

.plan-form {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.form-section {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1.5rem;
}

.form-section h4 {
  margin: 0 0 1rem 0;
  color: #333;
}

.date-range {
  display: flex;
  gap: 1rem;
}

.daily-plans {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.daily-plan-card {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 1.5rem;
}

.plan-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e9ecef;
}

.plan-header h5 {
  margin: 0;
  color: #333;
}

.meals-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.meal-section h6 {
  margin: 0 0 1rem 0;
  color: #333;
  font-size: 1rem;
}

.meal-items {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.meal-item {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr auto;
  gap: 1rem;
  align-items: end;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
}

.dialog-actions {
  padding-top: 1rem;
  border-top: 1px solid #e9ecef;
}

/* View Dialog Styles */
.view-plan-dialog {
  width: 100%;
  max-width: 800px;
}

.plan-details {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.plan-overview {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1.5rem;
}

.plan-overview h4 {
  margin: 0 0 1rem 0;
  color: #333;
}

.plan-overview p {
  margin: 0.5rem 0;
  color: #666;
}

.nutrition-summary h5 {
  margin: 0 0 1rem 0;
  color: #333;
}

.nutrition-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.meal-details h5 {
  margin: 0 0 1rem 0;
  color: #333;
}

.meal-section {
  margin-bottom: 1.5rem;
}

.meal-section h6 {
  margin: 0 0 1rem 0;
  color: #333;
  font-size: 1rem;
}

.meal-items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
}

.meal-item-card {
  background: #e8f5e8;
  border: 1px solid #c3e6c3;
  border-radius: 8px;
  padding: 1rem;
}

.meal-item-title {
  display: block;
  font-weight: 600;
  color: #2d5a2d;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.item-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.item-details span {
  font-size: 0.8rem;
  color: #4a6741;
}

/* Responsive Design */
@media (max-width: 768px) {
  .food-menu-page {
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
  
  .assign-form {
    flex-direction: column;
    align-items: stretch;
  }
  
  .nutrition-cards-grid {
    grid-template-columns: 1fr;
  }
  
  .meal-item {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
  
  .nutrition-grid {
    grid-template-columns: 1fr;
  }
  
  .meal-items-grid {
    grid-template-columns: 1fr;
  }
  
  .user-table-container {
    overflow-x: auto;
  }
  
  .action-buttons {
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .create-plan-dialog {
    margin: 0;
    max-width: 100vw;
    max-height: 100vh;
  }
  
  .view-plan-dialog {
    margin: 0;
    max-width: 100vw;
    max-height: 100vh;
  }
}

@media (max-width: 480px) {
  .food-menu-page {
    padding: 0.5rem;
  }
  
  .page-header h1 {
    font-size: 1.5rem;
  }
  
  .section-header h2 {
    font-size: 1.2rem;
  }
  
  .nutrition-card {
    padding: 1rem;
  }
  
  .card-header h4 {
    font-size: 1rem;
  }
  
  .assign-plan-card {
    padding: 1rem;
  }
  
  .form-field {
    min-width: auto;
  }
  
  .assign-btn {
    min-width: auto;
    width: 100%;
  }
}

/* Enhanced Modern Styling */
.food-menu-page {
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

/* User List Card */
.user-list-card {
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

/* User Table Styling */
.user-table {
  border-radius: 16px;
  overflow: hidden;
}

.user-table .q-table__top {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-bottom: 1px solid #dee2e6;
}

.user-table .q-table__bottom {
  background: #f8f9fa;
  border-top: 1px solid #dee2e6;
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

.user-table .q-table tbody tr {
  transition: all 0.2s ease;
}

.user-table .q-table tbody tr:hover {
  background: rgba(102, 126, 234, 0.05);
  transform: scale(1.01);
}

.user-table .q-table tbody td {
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

/* Nutrition Section Card */
.nutrition-section-card {
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.create-plan-btn {
  border-radius: 12px;
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0.5px;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.create-plan-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

/* Assign Plan Card */
.assign-plan-card {
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
}

.form-field .q-field__control {
  border-radius: 12px;
  border: 2px solid #e0e0e0;
  transition: all 0.3s ease;
}

.form-field .q-field__control:hover {
  border-color: #667eea;
}

.form-field .q-field--focused .q-field__control {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.assign-btn {
  border-radius: 12px;
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0.5px;
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
}

.assign-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(76, 175, 80, 0.4);
}

/* Nutrition Cards Grid */
.nutrition-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 24px;
}

.nutrition-card {
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
  overflow: hidden;
  position: relative;
}

.nutrition-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #667eea, #764ba2);
}

.nutrition-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.15);
}

.nutrition-card-header {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-bottom: 1px solid #e0e0e0;
  padding: 20px;
}

.nutrition-card-content {
  padding: 20px;
}

.detail-item {
  text-align: center;
  padding: 12px;
  background: rgba(102, 126, 234, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(102, 126, 234, 0.1);
}

.nutrition-summary {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
  border-radius: 12px;
  padding: 20px;
  border: 1px solid rgba(102, 126, 234, 0.1);
}

.nutrition-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  align-items: stretch;
}

.nutrition-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 16px 12px;
  background: white;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
  min-height: 120px;
}

.nutrition-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.nutrition-icon {
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nutrition-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  width: 100%;
}

.nutrition-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #6c757d;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.nutrition-value {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 2px;
}

.nutrition-number {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1;
}

.nutrition-unit {
  font-size: 0.875rem;
  font-weight: 500;
  opacity: 0.8;
  line-height: 1;
}

.nutrition-card-actions {
  padding: 16px 20px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-top: 1px solid #e0e0e0;
}

.action-buttons-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  width: 100%;
  flex-wrap: nowrap;
}

/* Enhanced Responsive Design */
@media (max-width: 1024px) {
  .nutrition-cards-grid {
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 20px;
  }
  
  .nutrition-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  
  .nutrition-item {
    min-height: 100px;
    padding: 12px 8px;
  }
  
  .nutrition-number {
    font-size: 1.25rem;
  }
  
  .nutrition-unit {
    font-size: 0.8rem;
  }
}

@media (max-width: 768px) {
  .food-menu-page {
    padding: 16px;
  }
  
  .nutrition-cards-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  
  .nutrition-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  
  .nutrition-item {
    min-height: 90px;
    padding: 12px 8px;
  }
  
  .nutrition-number {
    font-size: 1.125rem;
  }
  
  .nutrition-unit {
    font-size: 0.75rem;
  }
  
  .header-card .q-card-section {
    padding: 20px;
  }
  
  .user-list-card .q-card-section {
    padding: 20px;
  }
  
  .nutrition-section-card .q-card-section {
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
  
  .action-buttons-row {
    gap: 8px;
  }
}

@media (max-width: 480px) {
  .food-menu-page {
    padding: 12px;
  }
  
  .nutrition-cards-grid {
    gap: 12px;
  }
  
  .nutrition-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  
  .nutrition-item {
    min-height: 80px;
    padding: 10px 8px;
    flex-direction: row;
    text-align: left;
  }
  
  .nutrition-icon {
    margin-bottom: 0;
    margin-right: 12px;
    flex-shrink: 0;
  }
  
  .nutrition-content {
    align-items: flex-start;
    text-align: left;
    flex: 1;
  }
  
  .nutrition-value {
    justify-content: flex-start;
  }
  
  .nutrition-number {
    font-size: 1rem;
  }
  
  .nutrition-unit {
    font-size: 0.7rem;
  }
  
  .header-card .q-card-section {
    padding: 16px;
  }
  
  .user-list-card .q-card-section {
    padding: 16px;
  }
  
  .nutrition-section-card .q-card-section {
    padding: 16px;
  }
  
  .user-table .q-table thead th {
    padding: 10px 6px;
    font-size: 0.75rem;
  }
  
  .user-table .q-table tbody td {
    padding: 10px 6px;
  }
  
  .user-id-badge {
    font-size: 0.7rem;
    padding: 4px 8px;
  }
  
  .status-badge {
    font-size: 0.7rem;
    padding: 4px 8px;
  }
  
  .nutrition-card-header,
  .nutrition-card-content {
    padding: 16px;
  }
  
  .nutrition-card-actions {
    padding: 12px 16px;
  }
  
  .action-buttons-row {
    gap: 6px;
  }
  
  .action-btn {
    min-width: 40px;
    height: 40px;
  }
}
</style>