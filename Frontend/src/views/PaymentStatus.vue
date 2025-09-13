<template>
  <div class="payment-status-page">
    <div class="page-header">
      <h1>Payment Status</h1>
      <p>Manage payments and billing information</p>
    </div>

    <div class="page-content">
      <div class="content-header">
        <div class="payment-stats">
          <div class="stat-card">
            <h3>Total Revenue</h3>
            <p class="stat-number">${{ totalRevenue }}</p>
          </div>
          <div class="stat-card">
            <h3>Pending Payments</h3>
            <p class="stat-number">${{ pendingPayments }}</p>
          </div>
          <div class="stat-card">
            <h3>Overdue Payments</h3>
            <p class="stat-number">${{ overduePayments }}</p>
          </div>
        </div>
      </div>

      <div class="filters">
        <div class="filter-group">
          <label>Filter by Status:</label>
          <select v-model="selectedStatus" @change="filterPayments">
            <option value="">All Statuses</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="overdue">Overdue</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Filter by Date:</label>
          <input v-model="selectedDate" type="month" @change="filterPayments" />
        </div>
      </div>

      <div class="payments-table">
        <table>
          <thead>
            <tr>
              <th>Payment ID</th>
              <th>Member</th>
              <th>Amount</th>
              <th>Due Date</th>
              <th>Status</th>
              <th>Payment Method</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="payment in filteredPayments" :key="payment.id">
              <td>{{ payment.id }}</td>
              <td>{{ payment.memberName }}</td>
              <td>${{ payment.amount }}</td>
              <td>{{ formatDate(payment.dueDate) }}</td>
              <td>
                <span class="status-badge" :class="payment.status">
                  {{ payment.status }}
                </span>
              </td>
              <td>{{ payment.paymentMethod }}</td>
              <td class="actions">
                <button @click="viewPayment(payment)" class="btn-small">View</button>
                <button v-if="payment.status === 'pending'" @click="markAsPaid(payment.id)" class="btn-small success">Mark Paid</button>
                <button @click="sendReminder(payment.id)" class="btn-small warning">Remind</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="filteredPayments.length === 0" class="no-payments">
        <p>No payments found for the selected filters.</p>
      </div>
    </div>

    <!-- Payment Details Modal -->
    <div v-if="showPaymentDetails" class="modal">
      <div class="modal-content">
        <h3>Payment Details</h3>
        <div v-if="selectedPayment" class="payment-details">
          <div class="detail-group">
            <label>Payment ID:</label>
            <span>{{ selectedPayment.id }}</span>
          </div>
          <div class="detail-group">
            <label>Member:</label>
            <span>{{ selectedPayment.memberName }}</span>
          </div>
          <div class="detail-group">
            <label>Amount:</label>
            <span>${{ selectedPayment.amount }}</span>
          </div>
          <div class="detail-group">
            <label>Due Date:</label>
            <span>{{ formatDate(selectedPayment.dueDate) }}</span>
          </div>
          <div class="detail-group">
            <label>Status:</label>
            <span class="status-badge" :class="selectedPayment.status">
              {{ selectedPayment.status }}
            </span>
          </div>
          <div class="detail-group">
            <label>Payment Method:</label>
            <span>{{ selectedPayment.paymentMethod }}</span>
          </div>
          <div class="detail-group">
            <label>Notes:</label>
            <span>{{ selectedPayment.notes || 'No notes' }}</span>
          </div>
        </div>
        <div class="form-actions">
          <button @click="closePaymentDetails" class="btn-primary">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const selectedStatus = ref('')
const selectedDate = ref('')
const showPaymentDetails = ref(false)
const selectedPayment = ref(null)

const payments = ref([])

const totalRevenue = ref(12500)
const pendingPayments = ref(2500)
const overduePayments = ref(800)

const filteredPayments = computed(() => {
  let filtered = payments.value

  if (selectedStatus.value) {
    filtered = filtered.filter(payment => payment.status === selectedStatus.value)
  }

  if (selectedDate.value) {
    const [year, month] = selectedDate.value.split('-')
    filtered = filtered.filter(payment => {
      const paymentDate = new Date(payment.dueDate)
      return paymentDate.getFullYear() == year && paymentDate.getMonth() + 1 == month
    })
  }

  return filtered
})

onMounted(() => {
  loadPayments()
})

const loadPayments = () => {
  // Mock data - replace with actual API call
  payments.value = [
    {
      id: 'PAY001',
      memberName: 'John Doe',
      amount: 150,
      dueDate: '2024-01-15',
      status: 'paid',
      paymentMethod: 'Credit Card',
      notes: 'Monthly membership fee'
    },
    {
      id: 'PAY002',
      memberName: 'Jane Smith',
      amount: 200,
      dueDate: '2024-01-20',
      status: 'pending',
      paymentMethod: 'Bank Transfer',
      notes: 'Personal training package'
    },
    {
      id: 'PAY003',
      memberName: 'Bob Johnson',
      amount: 100,
      dueDate: '2024-01-10',
      status: 'overdue',
      paymentMethod: 'Cash',
      notes: 'Monthly membership fee'
    },
    {
      id: 'PAY004',
      memberName: 'Alice Brown',
      amount: 300,
      dueDate: '2024-01-25',
      status: 'pending',
      paymentMethod: 'Credit Card',
      notes: 'Premium membership upgrade'
    }
  ]
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString()
}

const viewPayment = (payment) => {
  selectedPayment.value = payment
  showPaymentDetails.value = true
}

const closePaymentDetails = () => {
  showPaymentDetails.value = false
  selectedPayment.value = null
}

const markAsPaid = async (paymentId) => {
  if (confirm('Mark this payment as paid?')) {
    // TODO: Implement API call
    console.log('Marking payment as paid:', paymentId)
    // Update local data
    const payment = payments.value.find(p => p.id === paymentId)
    if (payment) {
      payment.status = 'paid'
    }
  }
}

const sendReminder = async (paymentId) => {
  if (confirm('Send payment reminder to member?')) {
    // TODO: Implement API call
    console.log('Sending reminder for payment:', paymentId)
  }
}

const filterPayments = () => {
  // Filtering is handled by computed property
}
</script>

<style scoped>
.payment-status-page {
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

.payment-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  padding: 1.5rem;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  text-align: center;
}

.stat-card h3 {
  margin: 0 0 0.5rem 0;
  color: #666;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-number {
  margin: 0;
  font-size: 2rem;
  font-weight: bold;
  color: #333;
}

.filters {
  display: flex;
  gap: 2rem;
  margin-bottom: 2rem;
  align-items: center;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-group label {
  font-weight: 500;
  color: #333;
}

.filter-group select, .filter-group input {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 5px;
}

.payments-table {
  background: white;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  overflow: hidden;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid #eee;
}

th {
  background: #f8f9fa;
  font-weight: 600;
  color: #333;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 15px;
  font-size: 0.8rem;
  font-weight: 500;
  text-transform: uppercase;
}

.status-badge.paid {
  background: #d4edda;
  color: #155724;
}

.status-badge.pending {
  background: #fff3cd;
  color: #856404;
}

.status-badge.overdue {
  background: #f8d7da;
  color: #721c24;
}

.status-badge.cancelled {
  background: #e2e3e5;
  color: #383d41;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.btn-small {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-small.success {
  background: #28a745;
  color: white;
}

.btn-small.success:hover {
  background: #218838;
}

.btn-small.warning {
  background: #ffc107;
  color: #212529;
}

.btn-small.warning:hover {
  background: #e0a800;
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

.payment-details {
  margin-bottom: 1.5rem;
}

.detail-group {
  display: flex;
  justify-content: space-between;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #eee;
}

.detail-group label {
  font-weight: 500;
  color: #333;
}

.detail-group span {
  color: #666;
}

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.btn-primary {
  padding: 0.75rem 1.5rem;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary:hover {
  background: #0056b3;
}

.no-payments {
  text-align: center;
  padding: 2rem;
  color: #666;
}

@media (max-width: 768px) {
  .payment-status-page {
    padding: 1rem;
  }
  
  .payment-stats {
    grid-template-columns: 1fr;
  }
  
  .filters {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }
  
  .payments-table {
    overflow-x: auto;
  }
  
  table {
    min-width: 600px;
  }
}
</style>
