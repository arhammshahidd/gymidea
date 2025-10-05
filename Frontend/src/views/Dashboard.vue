<template>
  <div class="dashboard-page">
    <!-- Header -->
    <div class="dashboard-header">
      <div class="header-content">
        <h1 class="dashboard-title">Dashboard Overview</h1>
        <p class="dashboard-subtitle">Welcome back, let's get you up to speed!</p>
      </div>
    </div>

    <!-- KPI Cards Grid -->
    <div class="kpi-section">
      <div class="kpi-grid">
        <!-- Total Users -->
        <q-card class="kpi-card">
          <div class="kpi-content">
            <div class="kpi-icon">
              <q-icon name="people" size="24px" :style="{ color: '#DF8A35' }" />
            </div>
            <div class="kpi-info">
              <div class="kpi-label">Total Users</div>
              <div class="kpi-value">{{ userManagementStore.stats.totalUsers || 0 }}</div>
            </div>
          </div>
        </q-card>

        <!-- Total Payment -->
        <q-card class="kpi-card">
          <div class="kpi-content">
            <div class="kpi-icon">
              <q-icon name="account_balance_wallet" size="24px" :style="{ color: '#DF8A35' }" />
            </div>
            <div class="kpi-info">
              <div class="kpi-label">Total Payment</div>
              <div class="kpi-value">PKR{{ paymentStatusStore.overview.total_amount || 0 }}</div>
            </div>
          </div>
        </q-card>

        <!-- Paid Users -->
        <q-card class="kpi-card">
          <div class="kpi-content">
            <div class="kpi-icon">
              <q-icon name="check_circle" size="24px" :style="{ color: '#DF8A35' }" />
            </div>
            <div class="kpi-info">
              <div class="kpi-label">Paid Users</div>
              <div class="kpi-value">{{ paidUsersCard }}</div>
            </div>
          </div>
        </q-card>

        <!-- Unpaid Users -->
        <q-card class="kpi-card">
          <div class="kpi-content">
            <div class="kpi-icon">
              <q-icon name="pending" size="24px" :style="{ color: '#DF8A35' }" />
            </div>
            <div class="kpi-info">
              <div class="kpi-label">Unpaid Users</div>
              <div class="kpi-value">{{ unpaidUsersCard }}</div>
            </div>
          </div>
        </q-card>

        <!-- Active Users -->
        <q-card class="kpi-card">
          <div class="kpi-content">
            <div class="kpi-icon">
              <q-icon name="people" size="24px" :style="{ color: '#DF8A35' }" />
            </div>
            <div class="kpi-info">
              <div class="kpi-label">Active Users</div>
              <div class="kpi-value">{{ userManagementStore.stats.totalActiveUsers || 0 }}</div>
            </div>
          </div>
        </q-card>

        <!-- Inactive Users -->
        <q-card class="kpi-card">
          <div class="kpi-content">
            <div class="kpi-icon">
              <q-icon name="person_off" size="24px" :style="{ color: '#DF8A35' }" />
            </div>
            <div class="kpi-info">
              <div class="kpi-label">Inactive Users</div>
              <div class="kpi-value">{{ userManagementStore.stats.totalInactiveUsers || 0 }}</div>
            </div>
          </div>
        </q-card>

        <!-- Basic Memberships -->
        <q-card class="kpi-card">
          <div class="kpi-content">
            <div class="kpi-icon">
              <q-icon name="star_border" size="24px" :style="{ color: '#DF8A35' }" />
            </div>
            <div class="kpi-info">
              <div class="kpi-label">Basic Memberships</div>
              <div class="kpi-value">{{ userManagementStore.stats.totalBasicMemberships || 0 }}</div>
            </div>
          </div>
        </q-card>

        <!-- Premium Memberships -->
        <q-card class="kpi-card">
          <div class="kpi-content">
            <div class="kpi-icon">
              <q-icon name="star" size="24px" :style="{ color: '#DF8A35' }" />
            </div>
            <div class="kpi-info">
              <div class="kpi-label">Premium Memberships</div>
              <div class="kpi-value">{{ userManagementStore.stats.totalPremiumMemberships || 0 }}</div>
            </div>
          </div>
        </q-card>
      </div>
    </div>

    <!-- Charts Section -->
    <div class="charts-section">
      <!-- Membership Tiers Chart -->
      <q-card class="chart-card membership-chart">
        <div class="chart-header">
          <h3 class="chart-title">Membership Tiers</h3>
        </div>
        <div class="donut-chart">
          <div class="donut-ring" :style="donutStyle"></div>
          <div class="donut-center">
            <span class="donut-total">{{ totalMembersForDonut }}</span>
            <span class="donut-label">Total</span>
          </div>
        </div>
        <div class="chart-legend">
          <div class="legend-item">
            <div class="legend-color basic"></div>
            <span>Basic ({{ totalBasic }})</span>
          </div>
          <div class="legend-item">
            <div class="legend-color premium"></div>
            <span>Premium ({{ totalPremium }})</span>
          </div>
        </div>
      </q-card>

      <!-- User Growth Chart -->
      <q-card class="chart-card growth-chart">
        <div class="chart-header">
          <h3 class="chart-title">User Growth Trend</h3>
          <div class="chart-subtitle">Monthly user registration overview</div>
        </div>
        <div class="chart-container">
          <div class="growth-chart-wrapper">
            <svg class="svg-chart" :viewBox="`0 0 ${chartWidth} ${chartHeight}`" preserveAspectRatio="none">
              <defs>
                <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style="stop-color:#4CAF50;stop-opacity:0.3" />
                  <stop offset="100%" style="stop-color:#4CAF50;stop-opacity:0.05" />
                </linearGradient>
                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" style="stop-color:#2E7D32" />
                  <stop offset="50%" style="stop-color:#4CAF50" />
                  <stop offset="100%" style="stop-color:#66BB6A" />
                </linearGradient>
              </defs>
              <g :transform="`translate(${margin.left}, ${margin.top})`">
                <!-- Grid lines -->
                <g class="y-grid">
                  <line v-for="(y, idx) in yGridLines" :key="`yg${idx}`" 
                        :x1="0" :x2="innerWidth" :y1="y" :y2="y" 
                        stroke="#E0E0E0" stroke-width="1" opacity="0.5" />
                </g>
                <g class="x-grid">
                  <line v-for="(x, idx) in xGridLines" :key="`xg${idx}`" 
                        :x1="x" :x2="x" :y1="0" :y2="innerHeight" 
                        stroke="#E0E0E0" stroke-width="1" opacity="0.3" />
                </g>
                
                <!-- Area fill -->
                <path class="area" :d="areaPath" fill="url(#areaGradient)" />
                
                <!-- Main line -->
                <g class="lines">
                  <line v-for="(s, i) in lineSegments" :key="`seg${i}`"
                        :x1="s.x1" :y1="s.y1" :x2="s.x2" :y2="s.y2"
                        stroke="url(#lineGradient)" stroke-width="3" fill="none" 
                        stroke-linecap="round" stroke-linejoin="round" />
                </g>
                
                <!-- Data points -->
                <g class="data-points">
                  <circle v-for="(point, i) in svgPoints" :key="`point${i}`"
                          :cx="point.x" :cy="point.y" r="4" 
                          fill="#4CAF50" stroke="#ffffff" stroke-width="2" />
                </g>
                
                <!-- X-axis labels -->
                <g class="x-axis">
                  <text v-for="(label, i) in growthLabels" :key="`xl${i}`" 
                        :x="xPosition(i)" :y="innerHeight + 20" 
                        text-anchor="middle" fill="#666" font-size="12" font-weight="500">{{ label }}</text>
                </g>
                
                <!-- Y-axis labels -->
                <g class="y-axis">
                  <text v-for="(tick, i) in yTicks" :key="`yl${i}`" 
                        :x="-12" :y="yPosition(tick) + 4" 
                        text-anchor="end" fill="#666" font-size="12" font-weight="500">{{ tick }}</text>
                </g>
              </g>
            </svg>
          </div>
          
          <!-- Growth summary -->
          <div class="growth-summary">
            <div class="summary-item">
              <div class="summary-label">Total Growth</div>
              <div class="summary-value positive">+{{ totalGrowth }} users</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Peak Month</div>
              <div class="summary-value">{{ peakMonth }}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Average</div>
              <div class="summary-value">{{ averageGrowth }} users/month</div>
            </div>
          </div>
        </div>
      </q-card>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useUserManagementStore } from '../stores/userManagement'
import { usePaymentStatusStore } from '../stores/paymentStatus'

const router = useRouter()
const authStore = useAuthStore()
const userManagementStore = useUserManagementStore()
const paymentStatusStore = usePaymentStatusStore()

// Reactive data for charts
const growthLabels = ref(['Jan','Feb','Mar','Apr','May','Jun','Jul'])
const growthData = ref([0, 0, 0, 0, 0, 0, 0])

// SVG chart layout
const chartWidth = 700
const chartHeight = 260
const margin = { top: 10, right: 16, bottom: 28, left: 30 }
const innerWidth = computed(() => chartWidth - margin.left - margin.right)
const innerHeight = computed(() => chartHeight - margin.top - margin.bottom)

const maxGrowthValue = computed(() => Math.max(...growthData.value, 1))

const xPosition = (i) => {
  const n = Math.max(growthLabels.value.length - 1, 1)
  return (i / n) * innerWidth.value
}

const yPosition = (val) => {
  const max = maxGrowthValue.value
  const y = innerHeight.value - (val / max) * innerHeight.value
  return y
}

const svgPoints = computed(() => growthData.value.map((v, i) => ({ x: xPosition(i), y: yPosition(v) })))

const lineSegments = computed(() => {
  const segs = []
  for (let i = 1; i < svgPoints.value.length; i += 1) {
    const prev = svgPoints.value[i - 1]
    const curr = svgPoints.value[i]
    const prevVal = growthData.value[i - 1]
    const currVal = growthData.value[i]
    const color = currVal >= prevVal ? '#27ae60' : '#e74c3c'
    segs.push({ x1: prev.x, y1: prev.y, x2: curr.x, y2: curr.y, color })
  }
  return segs
})

const areaPath = computed(() => {
  if (svgPoints.value.length === 0) return ''
  const start = `M 0 ${innerHeight.value}`
  const line = svgPoints.value.map((p, i) => `${i === 0 ? 'L' : 'L'} ${p.x} ${p.y}`).join(' ')
  const end = `L ${innerWidth.value} ${innerHeight.value} Z`
  return `${start} ${line} ${end}`
})

const yTicks = computed(() => {
  const max = maxGrowthValue.value
  const step = Math.max(Math.ceil(max / 4), 1)
  return [0, step, step * 2, step * 3, step * 4].filter(t => t <= max)
})

const yGridLines = computed(() => yTicks.value.map(t => yPosition(t)))
const xGridLines = computed(() => growthLabels.value.map((_, i) => xPosition(i)))

// Tooltip (removed visual dots; keeping logic optional if needed later)
// const tooltip = ref({ visible: false, x: 0, y: 0, text: '' })
// const tooltipStyle = computed(() => ({ left: `${tooltip.value.x}px`, top: `${tooltip.value.y}px` }))
// const showTooltip = (i, cx, cy) => {
//   const value = growthData.value[i]
//   const label = growthLabels.value[i]
//   tooltip.value = { visible: true, x: cx + margin.left, y: cy + margin.top - 28, text: `${label}: ${value}` }
// }
// const hideTooltip = () => { tooltip.value.visible = false }

// Membership donut
const totalBasic = computed(() => userManagementStore.stats.totalBasicMemberships || 0)
const totalPremium = computed(() => userManagementStore.stats.totalPremiumMemberships || 0)
const totalMembersForDonut = computed(() => (totalBasic.value + totalPremium.value) || 0)

const donutStyle = computed(() => {
  const total = totalMembersForDonut.value
  if (total === 0) {
    return { background: 'conic-gradient(#e0e0e0 0deg 360deg)' }
  }
  const basicDeg = (totalBasic.value / total) * 360
  const premiumDeg = 360 - basicDeg
  return {
    background: `conic-gradient(#e74c3c 0deg ${basicDeg}deg, #2ecc71 ${basicDeg}deg 360deg)`
  }
})

// Logout function
const logout = () => {
  console.log('=== LOGOUT FROM DASHBOARD ===')
  const currentRole = authStore.role
  console.log('Current role before logout:', currentRole)

  authStore.logout()

  // Redirect to appropriate login page based on role
  if (currentRole === 'SUPER_ADMIN') {
    router.push('/superadmin-login')
  } else if (currentRole === 'GYM_ADMIN') {
    router.push('/gymadmin-login')
  } else if (currentRole === 'trainer') {
    router.push('/trainer-login')
  } else {
    router.push('/login-hub')
  }
}

onMounted(async () => {
  console.log('Professional Dashboard mounted')
  // Fetch stats for KPI cards
  try {
    await Promise.all([
      userManagementStore.fetchUserStats(),
      paymentStatusStore.getOverview(),
      userManagementStore.fetchUsers()
    ])

    // Build user growth over last 7 months using users' created_at if available
    const users = userManagementStore.users || []
    const now = new Date()
    const labels = []
    const counts = []
    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const label = date.toLocaleString('en-US', { month: 'short' })
      labels.push(label)
      const month = date.getMonth()
      const year = date.getFullYear()
      const count = users.filter(u => {
        const created = u?.created_at ? new Date(u.created_at) : null
        if (!created) return false
        return created.getMonth() === month && created.getFullYear() === year
      }).length
      counts.push(count)
    }
    if (counts.some(c => c > 0)) {
      growthLabels.value = labels
      growthData.value = counts
    }
  } catch (e) {
    console.error('Failed to load dashboard KPIs', e)
  }
})

// Derive latest status per user from payments array in overview (fallback to backend counts)
const paidUsersCount = computed(() => {
  const payments = paymentStatusStore.overview?.payments
  const totalUsers = userManagementStore.stats?.totalUsers || 0
  if (Array.isArray(payments) && payments.length > 0) {
    const seen = new Set()
    const hasPaid = new Set()
    for (const p of payments) {
      const uid = p?.user_id
      if (!uid) continue
      seen.add(uid)
      if ((p.payment_status || '').toLowerCase() === 'paid') {
        hasPaid.add(uid)
      }
    }
    // Count paid users by any paid record
    const paid = hasPaid.size
    // If there are users with no payments at all, they are not counted here; unpaid calc compensates
    return paid
  }
  // No payments available; fall back to 0 to mirror Payment Status page behavior
  return 0
})

const unpaidUsersCount = computed(() => {
  const totalUsers = userManagementStore.stats?.totalUsers || 0
  const payments = paymentStatusStore.overview?.payments
  if (Array.isArray(payments) && payments.length > 0) {
    const seen = new Set()
    const hasPaid = new Set()
    for (const p of payments) {
      const uid = p?.user_id
      if (!uid) continue
      seen.add(uid)
      if ((p.payment_status || '').toLowerCase() === 'paid') {
        hasPaid.add(uid)
      }
    }
    const paid = hasPaid.size
    // Users without any payments are considered unpaid
    const unpaid = Math.max(totalUsers - paid, 0)
    return unpaid
  }
  // If no payments, all users are unpaid
  return totalUsers
})

// Card-safe values: always numbers
const toNumber = (val) => {
  const n = Number(val)
  return Number.isFinite(n) ? n : 0
}
const paidUsersCard = computed(() => toNumber(paidUsersCount.value))
const unpaidUsersCard = computed(() => toNumber(unpaidUsersCount.value))

// Growth summary calculations
const totalGrowth = computed(() => {
  const total = growthData.value.reduce((sum, val) => sum + val, 0)
  return total
})

const peakMonth = computed(() => {
  const maxValue = Math.max(...growthData.value)
  const maxIndex = growthData.value.indexOf(maxValue)
  return growthLabels.value[maxIndex] || 'N/A'
})

const averageGrowth = computed(() => {
  const total = totalGrowth.value
  const months = growthData.value.length
  return months > 0 ? Math.round(total / months) : 0
})
</script>

<style scoped>
.dashboard-page {
  background: #f8f9fa;
  min-height: 100vh;
  padding: 24px;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
}

/* Responsive adjustments */
@media (max-width: 1024px) {
  .charts-section {
    gap: 20px;
  }
  
  .kpi-grid {
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 16px;
  }
  
  .chart-container {
    width: 100%;
  }
  
  .donut-chart {
    max-width: 250px;
    height: 250px;
  }
}

@media (max-width: 768px) {
  .dashboard-page {
    padding: 16px;
  }
  
  .dashboard-title {
    font-size: 24px !important;
  }
  
  .kpi-grid {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
  }
  
  .kpi-content {
    padding: 16px !important;
    gap: 12px;
  }
  
  .kpi-icon {
    width: 40px !important;
    height: 40px !important;
  }
  
  .kpi-value {
    font-size: 24px !important;
  }
  
  .chart-container {
    height: 250px !important;
    padding: 0 16px 16px 16px !important;
    width: 100% !important;
  }
  
  .growth-chart-wrapper {
    height: 160px !important;
    width: 100% !important;
  }
  
  .donut-chart {
    max-width: 200px !important;
    height: 200px !important;
  }
  
  .chart-legend {
    flex-direction: column;
    gap: 12px;
    align-items: center;
  }
  
  .donut-total {
    font-size: 18px !important;
  }
  
  .growth-summary {
    flex-direction: column;
    gap: 12px;
    padding: 12px;
  }
  
  .summary-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
}

@media (max-width: 480px) {
  .dashboard-page {
    padding: 12px;
  }
  
  .dashboard-title {
    font-size: 20px !important;
  }
  
  .kpi-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  
  .kpi-content {
    padding: 12px !important;
    gap: 10px;
  }
  
  .kpi-icon {
    width: 36px !important;
    height: 36px !important;
  }
  
  .kpi-value {
    font-size: 20px !important;
  }
  
  .chart-container {
    height: 220px !important;
    padding: 0 12px 12px 12px !important;
    width: 100% !important;
  }
  
  .growth-chart-wrapper {
    height: 140px !important;
    width: 100% !important;
  }
  
  .donut-chart {
    max-width: 150px !important;
    height: 150px !important;
  }
  
  .chart-legend {
    flex-direction: column;
    gap: 8px;
    align-items: center;
  }
  
  .donut-total {
    font-size: 16px !important;
  }
  
  .chart-title {
    font-size: 16px !important;
  }
  
  .chart-subtitle {
    font-size: 12px !important;
  }
}

.dashboard-header {
  margin-bottom: 32px;
  padding: 0 8px;
}

.header-content {
  flex: 1;
}

.dashboard-title {
  font-size: 32px;
  font-weight: 700;
  color: #2c3e50;
  margin: 0 0 8px 0;
  line-height: 1.2;
}

.dashboard-subtitle {
  font-size: 16px;
  color: #6c757d;
  margin: 0;
  font-weight: 500;
}

.kpi-section {
  margin-bottom: 32px;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.kpi-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid #e9ecef;
  transition: all 0.3s ease;
  overflow: hidden;
  position: relative;
}

.kpi-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.kpi-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: #DF8A35 !important;
  border-radius: 16px 16px 0 0;
}

.kpi-content {
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.kpi-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: rgba(76, 175, 80, 0.1);
  flex-shrink: 0;
}

.kpi-info {
  flex: 1;
}

.kpi-label {
  font-size: 13px;
  color: #6c757d;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.kpi-value {
  font-size: 32px;
  font-weight: 700;
  color: #2c3e50;
  line-height: 1.1;
  margin: 0;
}

.kpi-change {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  font-weight: 600;
  color: #27ae60;
}

.kpi-avatar {
  background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
  box-shadow: 0 4px 12px rgba(39, 174, 96, 0.3);
}

.charts-section {
  margin-bottom: 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.chart-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid #e9ecef;
  overflow: hidden;
  transition: all 0.3s ease;
}

.chart-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.chart-header {
  padding: 24px 24px 0 24px;
  margin-bottom: 20px;
}

.chart-title {
  font-size: 20px;
  font-weight: 700;
  color: #2c3e50;
  margin: 0 0 4px 0;
}

.chart-subtitle {
  font-size: 14px;
  color: #6c757d;
  margin: 0;
  font-weight: 500;
}

.chart-container {
  height: 300px;
  position: relative;
  padding: 0 24px 24px 24px;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.growth-chart-wrapper {
  height: 200px;
  margin-bottom: 20px;
  width: 100%;
  flex: 1;
}

.growth-summary {
  display: flex;
  justify-content: space-around;
  padding: 16px 0;
  border-top: 1px solid #e9ecef;
  background: #f8f9fa;
  border-radius: 8px;
  margin-top: 16px;
}

.summary-item {
  text-align: center;
  flex: 1;
}

.summary-label {
  font-size: 12px;
  color: #6c757d;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.summary-value {
  font-size: 16px;
  font-weight: 700;
  color: #2c3e50;
}

.summary-value.positive {
  color: #4CAF50;
}

.line-chart {
  height: 200px;
  position: relative;
  background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
  border-radius: 8px;
  overflow: hidden;
}

.chart-line {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(39, 174, 96, 0.3) 0%, rgba(46, 204, 113, 0.3) 100%);
}

.chart-points {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.point {
  position: absolute;
  width: 8px;
  height: 8px;
  background: white;
  border-radius: 50%;
  border: 2px solid #27ae60;
  box-shadow: 0 2px 8px rgba(39, 174, 96, 0.3);
}

.chart-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 16px;
  font-size: 12px;
  color: #6c757d;
  font-weight: 500;
}

.donut-chart {
  position: relative;
  width: 100%;
  max-width: 300px;
  height: 300px;
  margin: 0 auto 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.donut-ring {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: conic-gradient(
    #27ae60 0deg 180deg,
    #2ecc71 180deg 270deg,
    #58d68d 270deg 360deg
  );
  position: relative;
  box-shadow: 0 4px 20px rgba(39, 174, 96, 0.2);
}

.donut-ring::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 80px;
  height: 80px;
  background: white;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  box-shadow: inset 0 2px 8px rgba(39, 174, 96, 0.1);
}

.donut-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.donut-total {
  display: block;
  font-size: 24px;
  font-weight: 700;
  color: #2c3e50;
  line-height: 1.2;
}

.donut-label {
  display: block;
  font-size: 12px;
  color: #6c757d;
  font-weight: 500;
}

.chart-legend {
  display: flex;
  justify-content: center;
  gap: 32px;
  padding: 0 24px 24px 24px;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  color: #2c3e50;
  font-weight: 500;
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.legend-color.basic {
  background: #e74c3c;
}

.legend-color.premium {
  background: #2ecc71;
}

.legend-color.pro {
  background: #58d68d;
}

/* Enhanced SVG line chart styles */
.svg-chart { 
  width: 100%; 
  height: 100%; 
  min-height: 200px;
}
.y-grid line { stroke: #ecf0f1; stroke-width: 1; }
.x-grid line { stroke: #f4f6f7; stroke-width: 1; }
.line { fill: none; stroke: #27ae60; stroke-width: 2; }
.area { fill: rgba(39, 174, 96, 0.15); }
.points circle { fill: #27ae60; stroke: #ffffff; stroke-width: 2; cursor: pointer; }
.x-axis text, .y-axis text { fill: #6c757d; font-size: 12px; }
.chart-tooltip {
  position: absolute;
  background: #ffffff;
  border: 1px solid #e9ecef;
  padding: 6px 8px;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  font-size: 12px;
  color: #2c3e50;
  pointer-events: none;
}
</style>

