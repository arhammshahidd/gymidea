<template>
  <div class="food-menu-page">
    <div class="page-header">
      <h1>Food Menu</h1>
      <p>Manage nutrition plans and meal recommendations</p>
    </div>

    <div class="page-content">
      <div class="content-header">
        <button @click="showCreateMeal = true" class="btn-primary">Add New Meal</button>
        <div class="category-filter">
          <label>Filter by Category:</label>
          <select v-model="selectedCategory" @change="filterMeals">
            <option value="">All Categories</option>
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="snack">Snack</option>
          </select>
        </div>
      </div>

      <div class="meals-grid">
        <div v-for="meal in filteredMeals" :key="meal.id" class="meal-card">
          <div class="meal-header">
            <h3>{{ meal.name }}</h3>
            <span class="meal-category">{{ meal.category }}</span>
          </div>
          
          <div class="meal-info">
            <p><strong>Calories:</strong> {{ meal.calories }} kcal</p>
            <p><strong>Protein:</strong> {{ meal.protein }}g</p>
            <p><strong>Carbs:</strong> {{ meal.carbs }}g</p>
            <p><strong>Fat:</strong> {{ meal.fat }}g</p>
          </div>

          <div class="meal-description">
            <p>{{ meal.description }}</p>
          </div>

          <div class="meal-actions">
            <button @click="editMeal(meal)" class="btn-small">Edit</button>
            <button @click="deleteMeal(meal.id)" class="btn-small danger">Delete</button>
          </div>
        </div>
      </div>

      <div v-if="filteredMeals.length === 0" class="no-meals">
        <p>No meals found for the selected category.</p>
      </div>
    </div>

    <!-- Create/Edit Meal Modal -->
    <div v-if="showCreateMeal || showEditMeal" class="modal">
      <div class="modal-content">
        <h3>{{ showCreateMeal ? 'Add New Meal' : 'Edit Meal' }}</h3>
        <form @submit.prevent="handleSubmit">
          <div class="form-group">
            <label>Meal Name:</label>
            <input v-model="mealForm.name" type="text" required />
          </div>
          <div class="form-group">
            <label>Category:</label>
            <select v-model="mealForm.category" required>
              <option value="">Select Category</option>
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </select>
          </div>
          <div class="form-group">
            <label>Description:</label>
            <textarea v-model="mealForm.description" rows="3" required></textarea>
          </div>
          <div class="nutrition-grid">
            <div class="form-group">
              <label>Calories (kcal):</label>
              <input v-model="mealForm.calories" type="number" min="0" required />
            </div>
            <div class="form-group">
              <label>Protein (g):</label>
              <input v-model="mealForm.protein" type="number" min="0" step="0.1" required />
            </div>
            <div class="form-group">
              <label>Carbs (g):</label>
              <input v-model="mealForm.carbs" type="number" min="0" step="0.1" required />
            </div>
            <div class="form-group">
              <label>Fat (g):</label>
              <input v-model="mealForm.fat" type="number" min="0" step="0.1" required />
            </div>
          </div>
          <div class="form-actions">
            <button type="submit" :disabled="loading">
              {{ loading ? 'Saving...' : (showCreateMeal ? 'Add Meal' : 'Update Meal') }}
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
const showCreateMeal = ref(false)
const showEditMeal = ref(false)
const selectedCategory = ref('')
const meals = ref([])
const editingMeal = ref(null)

const mealForm = ref({
  name: '',
  category: '',
  description: '',
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0
})

const filteredMeals = computed(() => {
  if (!selectedCategory.value) return meals.value
  return meals.value.filter(meal => meal.category === selectedCategory.value)
})

onMounted(() => {
  loadMeals()
})

const loadMeals = () => {
  // Mock data - replace with actual API call
  meals.value = [
    {
      id: 1,
      name: 'Protein Pancakes',
      category: 'breakfast',
      description: 'High protein pancakes with berries and Greek yogurt',
      calories: 350,
      protein: 25,
      carbs: 30,
      fat: 12
    },
    {
      id: 2,
      name: 'Grilled Chicken Salad',
      category: 'lunch',
      description: 'Mixed greens with grilled chicken breast and olive oil dressing',
      calories: 280,
      protein: 35,
      carbs: 15,
      fat: 8
    },
    {
      id: 3,
      name: 'Salmon with Quinoa',
      category: 'dinner',
      description: 'Baked salmon fillet with quinoa and steamed vegetables',
      calories: 420,
      protein: 40,
      carbs: 35,
      fat: 15
    }
  ]
}

const editMeal = (meal) => {
  editingMeal.value = meal
  mealForm.value = { ...meal }
  showEditMeal.value = true
}

const closeModal = () => {
  showCreateMeal.value = false
  showEditMeal.value = false
  editingMeal.value = null
  mealForm.value = {
    name: '',
    category: '',
    description: '',
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0
  }
}

const handleSubmit = async () => {
  loading.value = true
  
  try {
    // TODO: Implement API call
    console.log('Saving meal:', mealForm.value)
    
    // Mock success
    setTimeout(() => {
      closeModal()
      loadMeals()
      loading.value = false
    }, 1000)
  } catch (error) {
    console.error('Error saving meal:', error)
    loading.value = false
  }
}

const deleteMeal = async (id) => {
  if (confirm('Are you sure you want to delete this meal?')) {
    // TODO: Implement API call
    console.log('Deleting meal:', id)
  }
}

const filterMeals = () => {
  // Filtering is handled by computed property
}
</script>

<style scoped>
.food-menu-page {
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

.category-filter {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.category-filter label {
  font-weight: 500;
  color: #333;
}

.category-filter select {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 5px;
}

.meals-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}

.meal-card {
  background: white;
  padding: 1.5rem;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.meal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.meal-header h3 {
  margin: 0;
  color: #333;
}

.meal-category {
  padding: 0.25rem 0.75rem;
  border-radius: 15px;
  font-size: 0.8rem;
  font-weight: 500;
  text-transform: capitalize;
  background: #e9ecef;
  color: #495057;
}

.meal-info {
  margin-bottom: 1rem;
}

.meal-info p {
  margin: 0.5rem 0;
  color: #666;
}

.meal-description {
  margin-bottom: 1.5rem;
}

.meal-description p {
  color: #666;
  font-style: italic;
}

.meal-actions {
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
  max-width: 600px;
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

.nutrition-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
}

.no-meals {
  text-align: center;
  padding: 2rem;
  color: #666;
}

@media (max-width: 768px) {
  .food-menu-page {
    padding: 1rem;
  }
  
  .meals-grid {
    grid-template-columns: 1fr;
  }
  
  .content-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .nutrition-grid {
    grid-template-columns: 1fr;
  }
}
</style>
