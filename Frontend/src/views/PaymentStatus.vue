<template>
  <div class="payment-status-page">
    <!-- Header -->
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">Payment Status</h1>
      </div>
      <div class="header-actions">
        <q-input
          v-model="searchQuery"
          placeholder="Search by ID, Name, Email, Phone..."
          outlined
          dense
          clearable
          @input="handleSearch"
          class="search-input"
        >
          <template v-slot:prepend>
            <q-icon name="search" />
          </template>
        </q-input>
      </div>
    </div>

    <!-- Overview Cards -->
    <div class="overview-section q-mb-lg">
      <div class="row q-gutter-md">
        <!-- Total Users Card -->
        <div class="col-6 col-sm-4 col-md-2 col-lg-2">
          <q-card class="overview-card total-users">
            <q-card-section class="text-center">
              <q-avatar size="40px" color="primary" class="q-mb-sm">
                <q-icon name="people" size="20px" color="white" />
              </q-avatar>
              <div class="text-h6 text-weight-bold">{{ computedOverviewData.totalMembers || 0 }}</div>
              <div class="text-caption text-grey-6">Total Users</div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Active Users Card -->
        <div class="col-6 col-sm-4 col-md-2 col-lg-2">
          <q-card class="overview-card active-users">
            <q-card-section class="text-center">
              <q-avatar size="40px" color="positive" class="q-mb-sm">
                <q-icon name="person_check" size="20px" color="white" />
              </q-avatar>
              <div class="text-h6 text-weight-bold">{{ computedOverviewData.activeMembers || 0 }}</div>
              <div class="text-caption text-grey-6">Active Users</div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Paid Users Card -->
        <div class="col-6 col-sm-4 col-md-2 col-lg-2">
          <q-card class="overview-card paid-users">
            <q-card-section class="text-center">
              <q-avatar size="40px" color="green" class="q-mb-sm">
                <q-icon name="attach_money" size="20px" color="white" />
              </q-avatar>
              <div class="text-h6 text-weight-bold">{{ computedOverviewData.paidMembers || 0 }}</div>
              <div class="text-caption text-grey-6">Paid Users</div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Unpaid Users Card -->
        <div class="col-6 col-sm-4 col-md-2 col-lg-2">
          <q-card class="overview-card unpaid-users">
            <q-card-section class="text-center">
              <q-avatar size="40px" color="warning" class="q-mb-sm">
                <q-icon name="money_off" size="20px" color="white" />
              </q-avatar>
              <div class="text-h6 text-weight-bold">{{ computedOverviewData.unpaidMembers || 0 }}</div>
              <div class="text-caption text-grey-6">Unpaid Users</div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Inactive Users Card -->
        <div class="col-6 col-sm-4 col-md-2 col-lg-2">
          <q-card class="overview-card inactive-users">
            <q-card-section class="text-center">
              <q-avatar size="40px" color="negative" class="q-mb-sm">
                <q-icon name="person_off" size="20px" color="white" />
              </q-avatar>
              <div class="text-h6 text-weight-bold">{{ (computedOverviewData.totalMembers || 0) - (computedOverviewData.activeMembers || 0) }}</div>
              <div class="text-caption text-grey-6">Inactive Users</div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Total Amount Card -->
        <div class="col-6 col-sm-4 col-md-2 col-lg-2">
          <q-card class="overview-card  total-amount">
            <q-card-section class="text-center">
              <q-avatar size="40px" color="purple" class="q-mb-sm">
                <q-icon name="account_balance_wallet" size="20px" color="white" />
              </q-avatar>
              <div class="text-h6 text-weight-bold">PKR{{ totalAmount || 0 }}</div>
              <div class="text-caption text-grey-6">Total Amount</div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters-section q-mb-lg">
      <div class="row q-gutter-md items-center">
        <div class="col-12 col-sm-6 col-md-3">
          <q-select
            v-model="statusFilter"
            :options="statusOptions"
            placeholder="Filter by Status"
            outlined
            dense
            clearable
            @update:model-value="handleFilter"
            class="filter-select"
          />
        </div>
        <div class="col-12 col-sm-6 col-md-3">
          <q-select
            v-model="paymentFilter"
            :options="paymentOptions"
            placeholder="Filter by Payment"
            outlined
            dense
            clearable
            @update:model-value="handlePaymentFilter"
            class="filter-select"
          />
        </div>
        <div class="col-12 col-sm-12 col-md-3">
          <q-btn 
            @click="refreshData" 
            color="primary" 
            icon="refresh" 
            label="Refresh Data" 
            unelevated
            :loading="loading"
            class="full-width"
            size="md"
          />
        </div>
        
      </div>
    </div>

    <!-- User Cards -->
    <div class="user-cards-section">
      <div v-if="loading" class="text-center q-pa-lg">
        <q-spinner-dots size="50px" color="primary" />
        <p>Loading payment records...</p>
      </div>
      <div v-else-if="!filteredUserCards || filteredUserCards.length === 0" class="text-center q-pa-lg">
        <q-icon name="inbox" size="64px" color="grey-5" />
        <p>No payment records found.</p>
        <p class="text-caption">Debug: filteredUserCards length = {{ filteredUserCards?.length || 0 }}</p>
        <p class="text-caption">Debug: userCards length = {{ userCards?.length || 0 }}</p>
      </div>
      <div v-else>
        <!-- Debug Info -->
        <div class="q-mb-md text-caption text-grey-6">
          Showing Users {{ filteredUserCards.length }}
        </div>
        
        <!-- Responsive Grid Layout -->
        <div class="row q-gutter-md">
          <template v-for="(card, index) in filteredUserCards" :key="card?.id || index">
            <div 
              v-if="card && card.id"
              class="col-12 col-sm-6 col-md-6 col-lg-4"
            >
              <q-card class="user-card full-height">
                <q-card-section class="user-card-header">
                  <div class="text-h6 text-primary">#{{ card.id || 'N/A' }}</div>
                  <div class="text-subtitle1 text-weight-medium">{{ card.name || 'N/A' }}</div>
                  <div class="text-caption text-grey-6">Email: {{ card.email || 'N/A' }}</div>
                  <div class="text-caption text-grey-6">Contact: {{ card.phone || 'N/A' }}</div>
                  
                </q-card-section>
                
                <q-card-section class="user-card-body">
                  <div class="row items-center q-mb-sm">
                    <span class="text-h6 text-weight-bold">Total Received: PKR{{ card.totalAmount || 0 }}</span>
                  </div>
                  
                  <!-- Last Payment Information -->
                  <div v-if="card.lastPayment" class="q-mb-sm">
                    <div class="text-caption text-grey-6">Last Payment:</div>
                    <div class="row items-center">
                      <q-icon name="payment" size="16px" color="blue" class="q-mr-xs" />
                      <span class="text-subtitle2 text-weight-medium">PKR{{ card.lastPaymentAmount || 0 }}/month</span>
                    </div>
                    <div class="text-caption" :class="isOverdue(card.lastPaymentDueDate) ? 'text-red-6' : 'text-grey-6'">
                      Due: {{ formatDate(card.lastPaymentDueDate) }}
                    </div>
                  </div>
                  
                  <div class="row q-gutter-xs">
                    <q-badge 
                      :color="(card.status || '').toLowerCase() === 'active' ? 'positive' : 'negative'"
                      :label="card.status || 'Unknown'"
                      class="col-auto"
                    />
                    <q-badge 
                      :color="card.paymentStatus === 'Paid' ? 'positive' : 'warning'"
                      :label="card.paymentStatus || 'Unpaid'"
                      class="col-auto"
                    />
                    
                    <q-badge 
                      :color="card.membership_tier === 'PREMIUM' ? 'green' : 'blue-grey'"
                      :label="card.membership_tier || 'BASIC'"
                      class="membership-badge"
                    />
                  
                  </div>
                </q-card-section>
                
                <q-card-actions class="user-card-actions">
                  <q-btn 
                    @click="openPaymentHistoryDialog(card)"
                    color="blue" 
                    label="History"
                    icon="history"
                    size="sm"
                    class="col"
                  />
                  <q-btn 
                    @click="sendIndividualReminder(card)"
                    color="green" 
                    label="WhatsApp"
                    icon="message"
                    size="sm"
                    class="col"
                    :disable="card.paymentStatus === 'Paid'"
                  />
                  <q-btn 
                    @click="openAddPaymentDialog(card)"
                    color="light-green" 
                    icon="add"
                    label="Add"
                    size="sm"
                    class="col"
                  />
                </q-card-actions>
              </q-card>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- Add/Edit Payment Dialog -->
    <q-dialog v-model="showAddPaymentDialog" persistent>
      <q-card class="payment-dialog">
        <q-card-section class="row items-center">
          <div class="text-h6">{{ editingPayment ? 'Edit Payment' : 'Add Payment' }}</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section>
          <div class="row q-gutter-md">
            <div class="col-12">
              <q-select
                v-model="paymentForm.user_id"
                :options="userOptions"
                option-value="id"
                option-label="name"
                emit-value
                map-options
                label="Select User"
                outlined
                :rules="[val => !!val || 'User is required']"
              />
            </div>
            <div class="col-12 col-md-6">
              <q-input
                v-model.number="paymentForm.amount"
                label="Amount"
                type="number"
                step="0.01"
                outlined
                :rules="[val => val > 0 || 'Amount must be greater than 0']"
              />
            </div>
            <div class="col-12 col-md-6">
              <q-select
                v-model="paymentForm.payment_status"
                :options="['Paid', 'Unpaid']"
                label="Payment Status"
                outlined
                :rules="[val => !!val || 'Payment status is required']"
              />
            </div>
            <div class="col-12">
              <q-input
                v-model="paymentForm.due_date"
                label="Due Date"
                type="date"
                outlined
                :rules="[val => !!val || 'Due date is required']"
                required
              />
            </div>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn 
            @click="savePayment" 
            :label="editingPayment ? 'Update' : 'Add'" 
            color="primary" 
            :loading="saving"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Payment History Dialog -->
    <q-dialog v-model="showPaymentHistoryDialog" persistent>
      <q-card class="payment-history-dialog" style="min-width: 600px; max-width: 800px;">
        <q-card-section class="row items-center">
          <div class="text-h6">Payment History - {{ selectedUser?.name || 'User' }}</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section>
          <!-- Last Payment Info -->
          <div v-if="lastPaymentInfo" class="q-mb-md">
            <q-card flat bordered class="bg-blue-1">
              <q-card-section>
                <div class="text-h6 text-blue-8">Last Payment Information</div>
                <div class="row q-gutter-md q-mt-sm">
                  <div class="col-12 col-md-6">
                    <div class="text-subtitle2">Amount:</div>
                    <div class="text-h6 text-green-8">${{ lastPaymentInfo.amount }}</div>
                  </div>
                  <div class="col-12 col-md-6">
                    <div class="text-subtitle2">Due Date:</div>
                    <div class="text-h6" :class="isOverdue(lastPaymentInfo.due_date) ? 'text-red-8' : 'text-blue-8'">
                      {{ formatDate(lastPaymentInfo.due_date) }}
                    </div>
                  </div>
                  <div class="col-12 col-md-6">
                    <div class="text-subtitle2">Status:</div>
                    <q-badge 
                      :color="lastPaymentInfo.payment_status === 'Paid' ? 'green' : 'orange'"
                      :label="lastPaymentInfo.payment_status"
                    />
                  </div>
                  <div class="col-12 col-md-6">
                    <div class="text-subtitle2">Payment Date:</div>
                    <div class="text-body1">
                      {{ lastPaymentInfo.payment_date ? formatDate(lastPaymentInfo.payment_date) : 'Not paid yet' }}
                    </div>
                  </div>
                </div>
              </q-card-section>
            </q-card>
          </div>

          <!-- Payment Summary -->
          <div v-if="paymentHistorySummary && Object.keys(paymentHistorySummary).length > 0" class="q-mb-md">
            <q-card flat bordered class="bg-grey-1">
              <q-card-section>
                <div class="text-h6 text-grey-8">Payment Summary</div>
                <div class="row q-gutter-md q-mt-sm">
                  <div class="col-12 col-md-3">
                    <div class="text-subtitle2">Total Payments:</div>
                    <div class="text-h6 text-blue-8">{{ paymentHistorySummary.totalPayments || 0 }}</div>
                  </div>
                  <div class="col-12 col-md-3">
                    <div class="text-subtitle2">Total Paid:</div>
                    <div class="text-h6 text-green-8">${{ paymentHistorySummary.totalPaid || 0 }}</div>
                  </div>
                  <div class="col-12 col-md-3">
                    <div class="text-subtitle2">Total Unpaid:</div>
                    <div class="text-h6 text-orange-8">${{ paymentHistorySummary.totalUnpaid || 0 }}</div>
                  </div>
                  <div class="col-12 col-md-3">
                    <div class="text-subtitle2">Total Amount:</div>
                    <div class="text-h6 text-primary">${{ paymentHistorySummary.totalAmount || 0 }}</div>
                  </div>
                </div>
              </q-card-section>
            </q-card>
          </div>

          <!-- Payment History Table -->
          <div class="text-h6 q-mb-md">All Payments</div>
          <q-table
            :rows="userPaymentHistory"
            :columns="paymentHistoryColumns"
            row-key="id"
            flat
            bordered
            :loading="paymentHistoryLoading"
            :rows-per-page-options="[5, 10, 20]"
            rows-per-page-label="Payments per page"
          >
            <template v-slot:body-cell-amount="props">
              <q-td :props="props">
                <span class="text-green-8 text-weight-bold">${{ props.value }}</span>
              </q-td>
            </template>
            
            <template v-slot:body-cell-payment_status="props">
              <q-td :props="props">
                <q-badge 
                  :color="props.value === 'Paid' ? 'green' : 'orange'"
                  :label="props.value"
                />
              </q-td>
            </template>
            
            <template v-slot:body-cell-due_date="props">
              <q-td :props="props">
                <span :class="isOverdue(props.value) ? 'text-red-8 text-weight-bold' : ''">
                  {{ formatDate(props.value) }}
                </span>
              </q-td>
            </template>
            
            <template v-slot:body-cell-payment_date="props">
              <q-td :props="props">
                {{ props.value ? formatDate(props.value) : '-' }}
              </q-td>
            </template>
          </q-table>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Close" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from '../stores/auth'
import { useUserManagementStore } from '../stores/userManagement'
import { usePaymentStatusStore } from '../stores/paymentStatus'

const $q = useQuasar()
const authStore = useAuthStore()
const userManagementStore = useUserManagementStore()
const paymentStatusStore = usePaymentStatusStore()

// Reactive data
const loading = ref(false)
const reminderLoading = ref(false)
const saving = ref(false)
const showAddPaymentDialog = ref(false)
const showPaymentHistoryDialog = ref(false)
const editingPayment = ref(null)
const selectedUser = ref(null)
const userPaymentHistory = ref([])
const lastPaymentInfo = ref(null)
const paymentHistoryLoading = ref(false)
const paymentHistorySummary = ref({})
const searchQuery = ref('')
const statusFilter = ref(null)
const paymentFilter = ref(null)
const paymentRecords = ref([])
const users = ref([])
const userCards = ref([])

// Overview data
const overviewData = ref({
  totalMembers: 0,
  activeMembers: 0,
  paidMembers: 0,
  unpaidMembers: 0
})

// Payment form
const paymentForm = ref({
  user_id: null,
  amount: null,
  payment_status: 'Unpaid',
  due_date: null
})

// Table configuration
const columns = [
  { name: 'user_name', label: 'Name', field: 'user_name', align: 'left' },
  { name: 'user_email', label: 'Email', field: 'user_email', align: 'left' },
  { name: 'user_phone', label: 'Phone', field: 'user_phone', align: 'left' },
  { name: 'amount', label: 'Amount', field: 'amount', align: 'right' },
  { name: 'payment_status', label: 'Status', field: 'payment_status', align: 'center' },
  { name: 'due_date', label: 'Due Date', field: 'due_date', align: 'center' },
  { name: 'payment_date', label: 'Payment Date', field: 'payment_date', align: 'center' }
]

// Payment History table columns
const paymentHistoryColumns = [
  { name: 'amount', label: 'Amount', field: 'amount', align: 'left' },
  { name: 'payment_status', label: 'Status', field: 'payment_status', align: 'center' },
  { name: 'due_date', label: 'Due Date', field: 'due_date', align: 'center' },
  { name: 'payment_date', label: 'Payment Date', field: 'payment_date', align: 'center' },
  { name: 'created_at', label: 'Created', field: 'created_at', align: 'center' }
]

// Pagination
const pagination = ref({
  sortBy: 'created_at',
  descending: true,
  page: 1,
  rowsPerPage: 10,
  rowsNumber: 0
})

// Options
const statusOptions = [
  { label: 'Active', value: 'Active' },
  { label: 'Inactive', value: 'Inactive' }
]

const paymentOptions = [
  { label: 'Paid', value: 'Paid' },
  { label: 'Unpaid', value: 'Unpaid' }
]

// Computed
const userOptions = computed(() => {
  return users.value.map(user => ({
    id: user.id,
    name: `${user.name} (${user.email})`
  }))
})

const totalAmount = computed(() => {
  if (!userCards.value || userCards.value.length === 0) return 0
  return userCards.value.reduce((total, card) => {
    return total + (card.totalAmount || 0)
  }, 0)
})

const computedOverviewData = computed(() => {
  if (!userCards.value || userCards.value.length === 0) {
    return {
      totalMembers: 0,
      activeMembers: 0,
      paidMembers: 0,
      unpaidMembers: 0
    }
  }
  
  const totalMembers = userCards.value.length
  const activeMembers = userCards.value.filter(card => (card.status || '').toLowerCase() === 'active').length
  const paidMembers = userCards.value.filter(card => card.paymentStatus === 'Paid').length
  const unpaidMembers = userCards.value.filter(card => card.paymentStatus === 'Unpaid').length
  
  return {
    totalMembers,
    activeMembers,
    paidMembers,
    unpaidMembers
  }
})

const filteredUserCards = computed(() => {
  try {
    console.log('=== FILTERING USER CARDS ===')
    console.log('userCards.value:', userCards.value)
    console.log('userCards.value type:', typeof userCards.value)
    console.log('userCards.value is array:', Array.isArray(userCards.value))
    console.log('userCards.value length:', userCards.value?.length)
    
    // Ensure userCards.value is an array
    if (!Array.isArray(userCards.value)) {
      console.log('userCards.value is not an array, returning empty array')
      return []
    }
    
    if (userCards.value.length === 0) {
      console.log('userCards.value is empty array')
      return []
    }
    
    let filtered = userCards.value.filter(card => card && card.id) // Filter out invalid cards
    console.log('Starting with valid cards:', filtered.length)

    // Search filter
    if (searchQuery.value && typeof searchQuery.value === 'string') {
      const query = searchQuery.value.toLowerCase()
      const digitQuery = searchQuery.value.replace(/\D/g, '')
      console.log('Applying search filter:', query)
      filtered = filtered.filter(card => 
        card && (
          card.id?.toString().includes(query) ||
          card.name?.toLowerCase().includes(query) ||
          card.email?.toLowerCase().includes(query) ||
          card.phone?.toLowerCase().includes(query) ||
          (digitQuery && card.phone && card.phone.replace(/\D/g, '').includes(digitQuery))
        )
      )
      console.log('After search filter:', filtered.length)
    }

    // Status filter
    if (statusFilter.value) {
      console.log('Applying status filter:', statusFilter.value)
      filtered = filtered.filter(card => card && card.status === statusFilter.value)
      console.log('After status filter:', filtered.length)
    }

    // Payment filter
    if (paymentFilter.value) {
      console.log('Applying payment filter:', paymentFilter.value)
      filtered = filtered.filter(card => card && card.paymentStatus === paymentFilter.value)
      console.log('After payment filter:', filtered.length)
    }

    console.log('Final filtered cards:', filtered)
    console.log('Final filtered cards length:', filtered.length)
    return filtered
  } catch (error) {
    console.error('Error filtering user cards:', error)
    return []
  }
})

// Methods
const fetchOverviewData = async () => {
  try {
    // Fetch user management stats
    const userStats = await userManagementStore.fetchUserStats()
    if (userStats.success) {
      overviewData.value.totalMembers = userStats.data.totalUsers
      overviewData.value.activeMembers = userStats.data.totalActiveUsers
    }

    // Fetch payment status overview
    const paymentOverview = await paymentStatusStore.getOverview()
    if (paymentOverview.success) {
      overviewData.value.paidMembers = paymentOverview.data.paid_members
      overviewData.value.unpaidMembers = paymentOverview.data.unpaid_members
    }
  } catch (error) {
    console.error('Error fetching overview data:', error)
  }
}

const fetchUsers = async () => {
  try {
    const response = await userManagementStore.fetchUsers()
    if (response.success) {
      users.value = response.data
    }
  } catch (error) {
    console.error('Error fetching users:', error)
  }
}

const fetchPaymentRecords = async (props = {}) => {
  loading.value = true
  try {
    const { page, rowsPerPage, sortBy, descending } = props.pagination || pagination.value
    const params = {
      page,
      limit: rowsPerPage
    }

    if (searchQuery.value) {
      params.search = searchQuery.value
    }

    if (statusFilter.value) {
      params.status = statusFilter.value
    }

    const response = await paymentStatusStore.getPayments(params)
    
    if (response.success) {
      console.log('Payment records fetched successfully:', response.data)
      paymentRecords.value = response.data
      pagination.value.rowsNumber = response.pagination.total_records
      pagination.value.page = response.pagination.current_page
      
      console.log('Payment records updated successfully')
    } else {
      console.error('Failed to fetch payment records:', response.message)
    }
  } catch (error) {
    console.error('Error fetching payment records:', error)
  } finally {
    loading.value = false
  }
}

const createUserCards = async () => {
  try {
    console.log('=== CREATING USER CARDS ===')
    const cardMap = new Map()
    
    // First, get all users from User Management
    console.log('Fetching users from User Management store...')
    const userResponse = await userManagementStore.fetchUsers()
    console.log('User response:', userResponse)
    
    if (!userResponse.success || !userResponse.data) {
      console.warn('Failed to fetch users:', userResponse)
      userCards.value = []
      return
    }
    
    const allUsers = userResponse.data
    console.log('All users from User Management:', allUsers)
    console.log('Number of users found:', allUsers.length)
    
    if (!Array.isArray(allUsers) || allUsers.length === 0) {
      console.warn('No users found or users is not an array')
      userCards.value = []
      return
    }
    
    // Helper to normalize user status values
    const normalizeUserStatus = (status) => {
      const s = (status || '').toString().toLowerCase()
      if (s === 'active') return 'Active'
      if (s === 'inactive') return 'Inactive'
      return 'Inactive'
    }

    // Create cards for all users first
    allUsers.forEach((user, index) => {
      console.log(`Processing user ${index + 1}:`, user)
      cardMap.set(user.id, {
        id: user.id,
        name: user.name || 'N/A',
        email: user.email || 'N/A',
        phone: user.phone || 'N/A',
        membership_tier: user.membership_tier || 'BASIC',
        totalAmount: 0,
        status: normalizeUserStatus(user.status),
        paymentStatus: 'Unpaid', // Default, will be updated based on payments
        payments: []
      })
    })
    
    console.log('Cards created for users:', cardMap.size)
    
    // Fetch ALL payment records (not paginated) for user cards
    console.log('Fetching ALL payment records for user cards...')
    const allPaymentsResponse = await paymentStatusStore.getPayments({ limit: 1000 }) // Get all records
    
    if (allPaymentsResponse.success && allPaymentsResponse.data) {
      const allPayments = allPaymentsResponse.data
      console.log('All payment records fetched:', allPayments)
      console.log('Number of payment records:', allPayments.length)
      
      if (Array.isArray(allPayments) && allPayments.length > 0) {
        console.log('Processing payment records...')
        allPayments.forEach((payment, index) => {
          console.log(`Processing payment ${index + 1}:`, payment)
          if (!payment || !payment.user_id) {
            console.warn('Invalid payment record:', payment)
            return
          }
          
          const userId = payment.user_id
          const card = cardMap.get(userId)
          
          if (card) {
            console.log(`Adding payment to user ${userId}:`, payment)
            card.payments.push(payment)
            card.totalAmount += parseFloat(payment.amount || 0)
            
            console.log(`Updated card for user ${userId}:`, card)
          } else {
            console.warn(`No card found for user ID: ${userId}`)
          }
        })
      } else {
        console.log('No payment records to process')
      }
    } else {
      console.warn('Failed to fetch all payment records:', allPaymentsResponse)
    }
    
    // After processing all payments, determine payment status and last payment for each user
    cardMap.forEach((card, userId) => {
      if (card.payments.length > 0) {
        // Check if user has at least one paid payment (not all payments need to be paid)
        const hasPaidPayment = card.payments.some(payment => payment.payment_status === 'Paid')
        card.paymentStatus = hasPaidPayment ? 'Paid' : 'Unpaid'
        
        // Get the last payment (most recent by created_at)
        const sortedPayments = [...card.payments].sort((a, b) => 
          new Date(b.created_at) - new Date(a.created_at)
        )
        card.lastPayment = sortedPayments[0]
        card.lastPaymentAmount = parseFloat(card.lastPayment.amount || 0)
        card.lastPaymentDueDate = card.lastPayment.due_date
        
        console.log(`User ${userId} payment status: ${card.paymentStatus} (${card.payments.length} payments, total: $${card.totalAmount}, last payment: $${card.lastPaymentAmount})`)
      } else {
        card.paymentStatus = 'Unpaid'
        card.lastPayment = null
        card.lastPaymentAmount = 0
        card.lastPaymentDueDate = null
        console.log(`User ${userId} has no payments, status: Unpaid`)
      }
    })
    
    userCards.value = Array.from(cardMap.values())
    console.log('Final user cards created:', userCards.value)
    console.log('Number of user cards:', userCards.value.length)
  } catch (error) {
    console.error('Error creating user cards:', error)
    userCards.value = []
  }
}

const onRequest = (props) => {
  fetchPaymentRecords(props)
}

const handleSearch = () => {
  pagination.value.page = 1
  fetchPaymentRecords()
}

const handleFilter = () => {
  pagination.value.page = 1
  fetchPaymentRecords()
}

const handlePaymentFilter = () => {
  console.log('Payment filter changed:', paymentFilter.value)
  // This will be handled by the computed property filteredUserCards
}

const openAddPaymentDialog = (userCard = null) => {
  console.log('=== OPENING ADD PAYMENT DIALOG ===')
  console.log('User card provided:', userCard)
  
  editingPayment.value = null
  resetForm()
  
  // If userCard is provided, pre-fill the user
  if (userCard) {
    console.log('Pre-filling user ID:', userCard.id)
    paymentForm.value.user_id = userCard.id
  }
  
  // Set default due date to 30 days from now
  const defaultDueDate = new Date()
  defaultDueDate.setDate(defaultDueDate.getDate() + 30)
  paymentForm.value.due_date = defaultDueDate.toISOString().split('T')[0]
  
  console.log('Payment form after setup:', paymentForm.value)
  showAddPaymentDialog.value = true
}

const editPayment = (payment) => {
  editingPayment.value = payment
  paymentForm.value = {
    user_id: payment.user_id,
    amount: parseFloat(payment.amount),
    payment_status: payment.payment_status,
    due_date: payment.due_date
  }
  showAddPaymentDialog.value = true
}

const openPaymentHistoryDialog = async (userCard) => {
  console.log('=== OPENING PAYMENT HISTORY DIALOG ===')
  console.log('User card provided:', userCard)
  
  selectedUser.value = userCard
  showPaymentHistoryDialog.value = true
  
  // Fetch payment history for this user
  await fetchUserPaymentHistory(userCard.id)
}

const fetchUserPaymentHistory = async (userId) => {
  try {
    paymentHistoryLoading.value = true
    console.log('Fetching payment history for user:', userId)
    
    const response = await paymentStatusStore.getPaymentHistory(userId)
    
    if (response.success) {
      userPaymentHistory.value = response.data.payments || []
      lastPaymentInfo.value = response.data.lastPayment || null
      paymentHistorySummary.value = response.data.summary || {}
      
      console.log('Payment history fetched:', userPaymentHistory.value)
      console.log('Last payment info:', lastPaymentInfo.value)
      console.log('Payment summary:', paymentHistorySummary.value)
    } else {
      console.error('Failed to fetch payment history:', response.message)
      if ($q && $q.notify) {
        $q.notify({
          type: 'negative',
          message: 'Failed to fetch payment history',
          position: 'top'
        })
      } else {
        alert('Failed to fetch payment history')
      }
    }
  } catch (error) {
    console.error('Error fetching payment history:', error)
    if ($q && $q.notify) {
      $q.notify({
        type: 'negative',
        message: 'Error fetching payment history',
        position: 'top'
      })
    } else {
      alert('Error fetching payment history')
    }
  } finally {
    paymentHistoryLoading.value = false
  }
}

const formatDate = (dateString) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const isOverdue = (dueDate) => {
  if (!dueDate) return false
  const today = new Date()
  const due = new Date(dueDate)
  return due < today
}

const refreshData = async () => {
  console.log('=== REFRESHING ALL DATA ===')
  await fetchOverviewData()
  await fetchPaymentRecords()
  
  // Small delay to ensure data is properly updated
  await new Promise(resolve => setTimeout(resolve, 100))
  
  console.log('Recreating user cards after refresh...')
  await createUserCards()
}



const savePayment = async () => {
  saving.value = true
  try {
    console.log('=== SAVING PAYMENT ===')
    console.log('Payment form data:', paymentForm.value)
    console.log('Editing payment:', editingPayment.value)
    
    // Validate required fields
    if (!paymentForm.value.user_id) {
      console.error('Validation failed: No user selected')
      if ($q && $q.notify) {
        $q.notify({
          type: 'negative',
          message: 'Please select a user',
          position: 'top'
        })
      } else {
        alert('Please select a user')
      }
      saving.value = false
      return
    }
    
    if (!paymentForm.value.amount || paymentForm.value.amount <= 0) {
      console.error('Validation failed: Invalid amount')
      if ($q && $q.notify) {
        $q.notify({
          type: 'negative',
          message: 'Please enter a valid amount',
          position: 'top'
        })
      } else {
        alert('Please enter a valid amount')
      }
      saving.value = false
      return
    }
    
    if (!paymentForm.value.payment_status) {
      console.error('Validation failed: No payment status selected')
      if ($q && $q.notify) {
        $q.notify({
          type: 'negative',
          message: 'Please select payment status',
          position: 'top'
        })
      } else {
        alert('Please select payment status')
      }
      saving.value = false
      return
    }
    
    if (!paymentForm.value.due_date) {
      console.error('Validation failed: No due date selected')
      if ($q && $q.notify) {
        $q.notify({
          type: 'negative',
          message: 'Please select a due date',
          position: 'top'
        })
      } else {
        alert('Please select a due date')
      }
      saving.value = false
      return
    }
    
    const payload = {
      user_id: paymentForm.value.user_id,
      amount: parseFloat(paymentForm.value.amount),
      payment_status: paymentForm.value.payment_status,
      due_date: paymentForm.value.due_date
    }
    
    console.log('Payload to send:', payload)

    let response
    if (editingPayment.value) {
      console.log('Updating existing payment...')
      response = await paymentStatusStore.updatePayment(editingPayment.value.id, payload)
    } else {
      console.log('Creating new payment...')
      response = await paymentStatusStore.createPayment(payload)
    }
    
    console.log('API Response:', response)

    if (response.success) {
      console.log('Payment saved successfully!')
      showAddPaymentDialog.value = false
      resetForm()
      
      // Refresh data
      console.log('Refreshing payment records...')
      await fetchPaymentRecords()
      console.log('Refreshing overview data...')
      await fetchOverviewData()
      
      // Small delay to ensure data is properly updated
      await new Promise(resolve => setTimeout(resolve, 100))
      
      console.log('Recreating user cards with new payment data...')
      await createUserCards()
      
      if ($q && $q.notify) {
        $q.notify({
          type: 'positive',
          message: editingPayment.value ? 'Payment updated successfully!' : 'Payment added successfully!',
          position: 'top'
        })
      } else {
        alert(editingPayment.value ? 'Payment updated successfully!' : 'Payment added successfully!')
      }
    } else {
      console.error('Payment save failed:', response.message)
      if ($q && $q.notify) {
        $q.notify({
          type: 'negative',
          message: response.message || 'Failed to save payment',
          position: 'top'
        })
      } else {
        alert(response.message || 'Failed to save payment')
      }
    }
  } catch (error) {
    console.error('Error saving payment:', error)
    if ($q && $q.notify) {
      $q.notify({
        type: 'negative',
        message: 'An error occurred while saving payment',
        position: 'top'
      })
    } else {
      alert('An error occurred while saving payment')
    }
  } finally {
    saving.value = false
  }
}

const deletePayment = async (paymentId) => {
  $q.dialog({
    title: 'Confirm Delete',
    message: 'Are you sure you want to delete this payment record?',
    cancel: true,
    persistent: true
  }).onOk(async () => {
    try {
      const response = await paymentStatusStore.deletePayment(paymentId)
      if (response.success) {
        await fetchPaymentRecords()
        await fetchOverviewData()
        await createUserCards()
        if ($q && $q.notify) {
          $q.notify({
            type: 'positive',
            message: 'Payment deleted successfully!',
            position: 'top'
          })
        } else {
          alert('Payment deleted successfully!')
        }
      } else {
        if ($q && $q.notify) {
          $q.notify({
            type: 'negative',
            message: response.message || 'Failed to delete payment',
            position: 'top'
          })
        } else {
          alert(response.message || 'Failed to delete payment')
        }
      }
    } catch (error) {
      console.error('Error deleting payment:', error)
      if ($q && $q.notify) {
        $q.notify({
          type: 'negative',
          message: 'Failed to delete payment',
          position: 'top'
        })
      } else {
        alert('Failed to delete payment')
      }
    }
  })
}

const sendWhatsAppReminders = async () => {
  if (computedOverviewData.value.unpaidMembers === 0) {
    if ($q && $q.notify) {
      $q.notify({
        type: 'info',
        message: 'No unpaid members to send reminders to',
        position: 'top'
      })
    } else {
      alert('No unpaid members to send reminders to')
    }
    return
  }

  $q.dialog({
    title: 'Send WhatsApp Reminders',
    message: `Send payment reminders to ${computedOverviewData.value.unpaidMembers} unpaid members?`,
    cancel: true,
    persistent: true
  }).onOk(async () => {
    reminderLoading.value = true
    try {
      const response = await paymentStatusStore.sendWhatsAppReminders()
      if (response.success) {
        if ($q && $q.notify) {
          $q.notify({
            type: 'positive',
            message: response.data.message || 'WhatsApp reminders sent successfully!',
            position: 'top'
          })
        } else {
          alert(response.data.message || 'WhatsApp reminders sent successfully!')
        }
      } else {
        if ($q && $q.notify) {
          $q.notify({
            type: 'negative',
            message: response.message || 'Failed to send WhatsApp reminders',
            position: 'top'
          })
        } else {
          alert(response.message || 'Failed to send WhatsApp reminders')
        }
      }
    } catch (error) {
      console.error('Error sending WhatsApp reminders:', error)
      if ($q && $q.notify) {
        $q.notify({
          type: 'negative',
          message: 'Failed to send WhatsApp reminders',
          position: 'top'
        })
      } else {
        alert('Failed to send WhatsApp reminders')
      }
    } finally {
      reminderLoading.value = false
    }
  })
}

const sendIndividualReminder = async (payment) => {
  $q.dialog({
    title: 'Send WhatsApp Reminder',
    message: `Send payment reminder to ${payment.user_name}?`,
    cancel: true,
    persistent: true
  }).onOk(async () => {
    try {
      const response = await paymentStatusStore.sendIndividualReminder(payment.id)
      if (response.success) {
        if ($q && $q.notify) {
          $q.notify({
            type: 'positive',
            message: response.data.message || 'WhatsApp reminder sent successfully!',
            position: 'top'
          })
        } else {
          alert(response.data.message || 'WhatsApp reminder sent successfully!')
        }
      } else {
        if ($q && $q.notify) {
          $q.notify({
            type: 'negative',
            message: response.message || 'Failed to send WhatsApp reminder',
            position: 'top'
          })
        } else {
          alert(response.message || 'Failed to send WhatsApp reminder')
        }
      }
    } catch (error) {
      console.error('Error sending individual reminder:', error)
      if ($q && $q.notify) {
        $q.notify({
          type: 'negative',
          message: 'Failed to send WhatsApp reminder',
          position: 'top'
        })
      } else {
        alert('Failed to send WhatsApp reminder')
      }
    }
  })
}

const resetForm = () => {
  paymentForm.value = {
    user_id: null,
    amount: null,
    payment_status: 'Unpaid',
    due_date: null
  }
  editingPayment.value = null
}

// Lifecycle
onMounted(async () => {
  try {
    console.log('=== PAYMENT STATUS PAGE MOUNTED ===')
    
    // Initialize data
    userCards.value = []
    paymentRecords.value = []
    console.log('Initialized empty arrays')
    
    // Add a test user card to see if display works
    console.log('Adding test user card...')
    userCards.value = [{
      id: 999,
      name: 'Test User',
      email: 'test@example.com',
      phone: '123-456-7890',
      membership_tier: 'PREMIUM',
      totalAmount: 100,
      status: 'Active',
      paymentStatus: 'Paid',
      payments: []
    }]
    console.log('Test user card added:', userCards.value)
    
    // Fetch data
    console.log('Fetching overview data...')
    await fetchOverviewData()
    console.log('Overview data fetched')
    
    console.log('Fetching users...')
    await fetchUsers()
    console.log('Users fetched')
    
    console.log('Fetching payment records...')
    await fetchPaymentRecords()
    console.log('Payment records fetched')
    
    // Ensure user cards are created even if no payment records exist
    console.log('Checking if user cards need to be created...')
    console.log('Current userCards.value.length:', userCards.value.length)
    if (userCards.value.length === 1) { // Only test card exists
      console.log('Only test card exists, creating real user cards...')
      await createUserCards()
    } else {
      console.log('User cards already exist:', userCards.value.length)
    }
    
    console.log('Payment Status page initialization complete')
    console.log('Final userCards.value:', userCards.value)
  } catch (error) {
    console.error('Error initializing Payment Status page:', error)
  }
})
</script>

<style scoped>
.payment-status-page {
  background: #f8f9fa;
  min-height: 100vh;
  padding: 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  padding: 0 8px;
}

.header-content {
  flex: 1;
}

.page-title {
  font-size: 32px;
  font-weight: 700;
  color: #2c3e50;
  margin: 0 0 8px 0;
  line-height: 1.2;
}

.page-subtitle {
  font-size: 16px;
  color: #6c757d;
  margin: 0;
  font-weight: 500;
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.search-input {
  min-width: 300px;
}

.search-input .q-field__control {
  border-radius: 8px;
}

.overview-section {
  margin-bottom: 32px;
}


.overview-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid #e9ecef;
  transition: all 0.3s ease;
  overflow: hidden;
  
}

.overview-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.card-content {
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.card-avatar {
  background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
  box-shadow: 0 4px 12px rgba(39, 174, 96, 0.3);
}

.total-users .card-avatar {
  background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
}

.active-users .card-avatar {
  background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
}

.paid-users .card-avatar {
  background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
}

.unpaid-users .card-avatar {
  background: linear-gradient(135deg, #e74c3c 0%, #ec7063 100%);
}

.total-amount .card-avatar {
  background: linear-gradient(135deg, #8e44ad 0%, #9b59b6 100%);
}

/* Center content within the Total Amount card */
.overview-card.total-amount .q-card__section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 120px;
}

.card-info {
  flex: 1;
}

.card-label {
  font-size: 12px;
  color: #6c757d;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.card-value {
  font-size: 28px;
  font-weight: 700;
  color: #2c3e50;
  line-height: 1.2;
}

.filters-section {
  margin-bottom: 24px;
  padding: 0 8px;
}

.filters-section .q-btn {
  border-radius: 8px;
  font-weight: 600;
  text-transform: none;
}

.filters-section .q-input,
.filters-section .q-select {
  border-radius: 8px;
}

.user-cards-section {
  margin-bottom: 32px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #6c757d;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #6c757d;
}

.user-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 24px;
}

.user-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid #e9ecef;
  transition: all 0.3s ease;
  overflow: hidden;
}

.user-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.user-card-header {
  padding: 20px 20px 0 20px;
}

.user-id {
  font-size: 12px;
  color: #6c757d;
  font-weight: 500;
  margin-bottom: 4px;
}

.user-name {
  font-size: 18px;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 4px;
}

.user-email {
  font-size: 14px;
  color: #6c757d;
  margin-bottom: 4px;
}

.user-phone {
  font-size: 14px;
  color: #6c757d;
  margin-bottom: 16px;
}

.user-card-body {
  padding: 0 20px 16px 20px;
}

.total-amount {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.amount-text {
  font-size: 16px;
  font-weight: 600;
  color: #2c3e50;
}

.status-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.status-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 20px;
}

.user-card-actions {
  padding: 16px 20px 20px 20px;
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.whatsapp-btn {
  flex: 1;
  border-radius: 8px;
  font-weight: 600;
  text-transform: none;
}

.add-amount-btn {
  border-radius: 8px;
  font-weight: 600;
  text-transform: none;
  min-width: 120px;
}

.amount-text {
  font-weight: 600;
  color: #2c3e50;
}

.payment-dialog {
  min-width: 500px;
  border-radius: 12px;
}

.payment-dialog .q-btn {
  border-radius: 8px;
  font-weight: 600;
  text-transform: none;
}

.payment-dialog .q-input,
.payment-dialog .q-select {
  border-radius: 8px;
}

@media (max-width: 768px) {
  .payment-status-page {
    padding: 16px;
  }
  
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
  
  .search-input {
    min-width: 100%;
  }
  
  .user-cards-grid {
    grid-template-columns: 1fr;
  }
  
  .user-card-actions {
    flex-direction: column;
    gap: 8px;
  }
  
  .whatsapp-btn {
    width: 100%;
  }
  
  .add-amount-btn {
    width: 100%;
  }
  
  .payment-dialog {
    min-width: 90vw;
  }
}

.membership-badge {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
</style>