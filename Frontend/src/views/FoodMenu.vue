<template>
  <div class="food-menu-page">
    <div class="page-header">
      <h1>Food Menu Management</h1>
      <p>Manage nutrition plans and food menus for your gym members</p>
    </div>

    <!-- User List Section -->
    <div class="section">
      <div class="section-header">
        <h2>User List</h2>
        <div class="search-container">
          <q-input
            v-model="userSearchQuery"
            placeholder="Search users by name, email, or contact"
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

      <div class="user-table-container">
        <q-table
          :rows="filteredUsers"
          :columns="userColumns"
          row-key="id"
          flat
          bordered
          :loading="loadingUsers"
          class="user-table"
        >
          <template v-slot:body-cell-status="props">
            <q-td :props="props">
              <q-badge
                :color="props.value === 'Active' ? 'green' : 'red'"
                :label="props.value"
                class="status-badge"
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
                  icon="restaurant_menu"
                  size="sm"
                  @click="createFoodMenuForUser(props.row)"
                  title="Create Food Menu"
                />
                <q-btn
                  flat
                  round
                  color="orange"
                  icon="edit"
                  size="sm"
                  @click="editUserFoodMenu(props.row)"
                  title="Edit Food Menu"
                />
              </div>
            </q-td>
          </template>
        </q-table>
      </div>
    </div>

    <!-- Planned Nutrition Section -->
    <div class="section">
      <div class="section-header">
        <h2>Planned Nutrition</h2>
        <q-btn
          color="primary"
          icon="add"
          label="Create New Plan"
          @click="showCreatePlanDialog = true"
          class="create-plan-btn"
        />
      </div>

      <!-- Assign Plan to User -->
      <div class="assign-plan-card">
        <h3>Assign Nutrition Plan to User</h3>
        <div class="assign-form">
          <q-input
            v-model="assignForm.userContact"
            label="User Contact Number or ID"
            placeholder="Enter user's contact or ID"
            outlined
            dense
            class="form-field"
          />
          <q-select
            v-model="assignForm.selectedPlan"
            :options="nutritionPlanOptions"
            label="Select Nutrition Plan"
            placeholder="Select a plan"
            outlined
            dense
            class="form-field"
          />
          <q-btn
            color="green"
            label="Assign Plan"
            @click="assignPlanToUser"
            :loading="assigningPlan"
            class="assign-btn"
          />
        </div>
      </div>

      <!-- Search Planned Nutrition -->
      <div class="search-planned-nutrition">
        <q-input
          v-model="nutritionSearchQuery"
          placeholder="Search planned nutrition by name or user"
          outlined
          dense
          class="search-input"
        >
          <template v-slot:prepend>
            <q-icon name="search" />
          </template>
        </q-input>
      </div>

      <!-- Current Planned Nutrition Cards -->
      <div class="nutrition-cards-grid">
        <div
          v-for="plan in filteredNutritionPlans"
          :key="plan.id"
          class="nutrition-card"
        >
          <div class="card-header">
            <h4>{{ plan.menu_plan_category }} Plan</h4>
            <q-badge
              :color="plan.status === 'ACTIVE' ? 'green' : 'orange'"
              :label="plan.status"
              class="status-badge"
            />
          </div>
          
          <div class="card-content">
            <div class="plan-details">
              <p><strong>Start Date:</strong> {{ formatDate(plan.start_date) }}</p>
              <p><strong>End Date:</strong> {{ formatDate(plan.end_date) }}</p>
              <p><strong>Duration:</strong> {{ calculateDuration(plan.start_date, plan.end_date) }} days</p>
            </div>
            
            <div class="nutrition-summary">
              <div class="nutrition-item">
                <span class="label">Calories:</span>
                <span class="value">{{ plan.total_daily_calories }} kcal</span>
              </div>
              <div class="nutrition-item">
                <span class="label">Protein:</span>
                <span class="value">{{ plan.total_daily_protein }}g</span>
              </div>
              <div class="nutrition-item">
                <span class="label">Carbs:</span>
                <span class="value">{{ plan.total_daily_carbs }}g</span>
              </div>
              <div class="nutrition-item">
                <span class="label">Fats:</span>
                <span class="value">{{ plan.total_daily_fats }}g</span>
              </div>
            </div>
          </div>
          
          <div class="card-actions">
            <q-btn
              flat
              round
              color="primary"
              icon="visibility"
              size="sm"
              @click="viewNutritionPlan(plan)"
              title="View Details"
            />
            <q-btn
              flat
              round
              color="orange"
              icon="edit"
              size="sm"
              @click="editNutritionPlan(plan)"
              title="Edit Plan"
            />
            <q-btn
              flat
              round
              color="red"
              icon="delete"
              size="sm"
              @click="deleteNutritionPlan(plan.id)"
              title="Delete Plan"
            />
          </div>
        </div>
      </div>
    </div>

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
                          />
                          <q-input
                            v-model="item.grams"
                            label="Grams"
                            type="number"
                            outlined
                            dense
                            class="form-field"
                            @input="calculateNutrition(item)"
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
                          />
                          <q-input
                            v-model="item.grams"
                            label="Grams"
                            type="number"
                            outlined
                            dense
                            class="form-field"
                            @input="calculateNutrition(item)"
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
                          />
                          <q-input
                            v-model="item.grams"
                            label="Grams"
                            type="number"
                            outlined
                            dense
                            class="form-field"
                            @input="calculateNutrition(item)"
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
              
              <!-- Breakfast -->
              <div v-if="selectedPlan.breakfast && selectedPlan.breakfast.length > 0" class="meal-section">
                <h6>Breakfast</h6>
                <div class="meal-items-grid">
                  <div
                    v-for="(item, index) in selectedPlan.breakfast"
                    :key="index"
                    class="meal-item-card"
                  >
                    <h7>{{ item.food_item_name }}</h7>
                    <div class="item-details">
                      <span>Grams: {{ item.grams }}g</span>
                      <span>Protein: {{ item.protein }}g</span>
                      <span>Fats: {{ item.fats }}g</span>
                      <span>Carbs: {{ item.carbs }}g</span>
                      <span>Calories: {{ item.calories }} kcal</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Lunch -->
              <div v-if="selectedPlan.lunch && selectedPlan.lunch.length > 0" class="meal-section">
                <h6>Lunch</h6>
                <div class="meal-items-grid">
                  <div
                    v-for="(item, index) in selectedPlan.lunch"
                    :key="index"
                    class="meal-item-card"
                  >
                    <h7>{{ item.food_item_name }}</h7>
                    <div class="item-details">
                      <span>Grams: {{ item.grams }}g</span>
                      <span>Protein: {{ item.protein }}g</span>
                      <span>Fats: {{ item.fats }}g</span>
                      <span>Carbs: {{ item.carbs }}g</span>
                      <span>Calories: {{ item.calories }} kcal</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Dinner -->
              <div v-if="selectedPlan.dinner && selectedPlan.dinner.length > 0" class="meal-section">
                <h6>Dinner</h6>
                <div class="meal-items-grid">
                  <div
                    v-for="(item, index) in selectedPlan.dinner"
                    :key="index"
                    class="meal-item-card"
                  >
                    <h7>{{ item.food_item_name }}</h7>
                    <div class="item-details">
                      <span>Grams: {{ item.grams }}g</span>
                      <span>Protein: {{ item.protein }}g</span>
                      <span>Fats: {{ item.fats }}g</span>
                      <span>Carbs: {{ item.carbs }}g</span>
                      <span>Calories: {{ item.calories }} kcal</span>
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
import { ref, computed, onMounted } from 'vue'
import { useUserManagementStore } from '../stores/userManagement'
import { useAuthStore } from '../stores/auth'
import { useFoodMenuStore } from '../stores/foodMenu'
import api from '../config/axios'

// Stores
const userManagementStore = useUserManagementStore()
const authStore = useAuthStore()
const foodMenuStore = useFoodMenuStore()

// Reactive data
const userSearchQuery = ref('')
const nutritionSearchQuery = ref('')
const loadingUsers = ref(false)
const savingPlan = ref(false)
const assigningPlan = ref(false)

// Dialog states
const showCreatePlanDialog = ref(false)
const showViewDialog = ref(false)
const selectedPlan = ref(null)

// User list data
const users = ref([])

// Nutrition plans data
const nutritionPlans = ref([])

// Assign form
const assignForm = ref({
  userContact: '',
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

// Methods
const loadUsers = async () => {
  try {
    loadingUsers.value = true
    await userManagementStore.fetchUsers()
    users.value = userManagementStore.users
  } catch (error) {
    console.error('Error loading users:', error)
  } finally {
    loadingUsers.value = false
  }
}

const loadNutritionPlans = async () => {
  try {
    await foodMenuStore.fetchFoodMenus()
    nutritionPlans.value = foodMenuStore.foodMenus
    nutritionPlanOptions.value = nutritionPlans.value.map(plan => ({
      label: `${plan.menu_plan_category} (${formatDate(plan.start_date)} - ${formatDate(plan.end_date)})`,
      value: plan.id
    }))
  } catch (error) {
    console.error('Error loading nutrition plans:', error)
  }
}

const createFoodMenuForUser = (user) => {
  // Set user context and open create dialog
  newPlan.value.user_id = user.id
  showCreatePlanDialog.value = true
}

const editUserFoodMenu = (user) => {
  // Find existing food menu for user and edit
  console.log('Edit food menu for user:', user)
}

const assignPlanToUser = async () => {
  if (!assignForm.value.userContact || !assignForm.value.selectedPlan) {
    return
  }
  
  try {
    assigningPlan.value = true
    // Implementation for assigning plan to user
    console.log('Assigning plan:', assignForm.value)
  } catch (error) {
    console.error('Error assigning plan:', error)
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
    
    // Calculate totals from all daily plans
    const allMeals = []
    newPlan.value.daily_plans.forEach(plan => {
      allMeals.push(...plan.breakfast, ...plan.lunch, ...plan.dinner)
    })
    
    const totalProtein = allMeals.reduce((sum, item) => sum + (item.protein || 0), 0)
    const totalFats = allMeals.reduce((sum, item) => sum + (item.fats || 0), 0)
    const totalCarbs = allMeals.reduce((sum, item) => sum + (item.carbs || 0), 0)
    const totalCalories = allMeals.reduce((sum, item) => sum + (item.calories || 0), 0)
    
    const planData = {
      menu_plan_category: newPlan.value.menu_plan_category,
      start_date: newPlan.value.start_date,
      end_date: newPlan.value.end_date,
      breakfast: newPlan.value.daily_plans[0].breakfast,
      lunch: newPlan.value.daily_plans[0].lunch,
      dinner: newPlan.value.daily_plans[0].dinner,
      total_daily_protein: totalProtein,
      total_daily_fats: totalFats,
      total_daily_carbs: totalCarbs,
      total_daily_calories: totalCalories
    }
    
    await foodMenuStore.createFoodMenu(planData)
    
    // Reset form
    resetNewPlanForm()
    showCreatePlanDialog.value = false
    
    // Reload plans
    await loadNutritionPlans()
    
    console.log('Nutrition plan saved successfully')
  } catch (error) {
    console.error('Error saving nutrition plan:', error)
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
  selectedPlan.value = plan
  showViewDialog.value = true
}

const editNutritionPlan = (plan) => {
  // Implementation for editing nutrition plan
  console.log('Edit nutrition plan:', plan)
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
  await loadNutritionPlans()
})
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
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e9ecef;
}

.card-header h4 {
  margin: 0;
  color: #333;
  font-size: 1.1rem;
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

.meal-item-card h7 {
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
}
</style>