<template>
  <div class="dashboard-page">
    <!-- Header -->
    <div class="dashboard-header">
      <div class="header-content">
        <h1 class="dashboard-title">Dashboard Overview</h1>
        <p class="dashboard-subtitle">Welcome back, let's get you up to speed!</p>
      </div>
    </div>

    <!-- KPI Cards -->
    <div class="kpi-section">
      <div class="row q-gutter-lg">
        <div class="col-12 col-lg-7">
          <div class="row q-gutter-lg">
        <!-- Total Users -->
        <div class="col-12 col-sm-6 col-md-4 col-lg-3">
          <q-card class="kpi-card">
            <div class="kpi-content">
              <div class="kpi-info">
                <div class="kpi-label">Total Users</div>
                <div class="kpi-value">{{ userManagementStore.stats.totalUsers || 0 }}</div>
              </div>
              
            </div>
          </q-card>
        </div>

        <!-- Total Payment -->
        <div class="col-12 col-sm-6 col-md-4 col-lg-3">
          <q-card class="kpi-card">
            <div class="kpi-content">
              <div class="kpi-info">
                <div class="kpi-label">Total Payment</div>
                <div class="kpi-value">PKR{{ paymentStatusStore.overview.total_amount || 0 }}</div>
              </div>
              
            </div>
          </q-card>
        </div>

        <!-- Paid Users -->
        <div class="col-12 col-sm-6 col-md-4 col-lg-3">
          <q-card class="kpi-card">
            <div class="kpi-content">
              <div class="kpi-info">
                <div class="kpi-label">Paid Users</div>
                <div class="kpi-value">{{ paymentStatusStore.overview.paid_members || 0 }}</div>
              </div>
              
            </div>
          </q-card>
        </div>

        <!-- Unpaid Users -->
        <div class="col-12 col-sm-6 col-md-4 col-lg-3">
          <q-card class="kpi-card">
            <div class="kpi-content">
              <div class="kpi-info">
                <div class="kpi-label">Unpaid Users</div>
                <div class="kpi-value">{{ paymentStatusStore.overview.unpaid_members || 0 }}</div>
              </div>
             
            </div>
          </q-card>
        </div>

        <!-- Active Users -->
        <div class="col-12 col-sm-6 col-md-4 col-lg-3">
          <q-card class="kpi-card">
            <div class="kpi-content">
              <div class="kpi-info">
                <div class="kpi-label">Active Users</div>
                <div class="kpi-value">{{ userManagementStore.stats.totalActiveUsers || 0 }}</div>
              </div>
              
            </div>
          </q-card>
        </div>

        <!-- Inactive Users -->
        <div class="col-12 col-sm-6 col-md-4 col-lg-3">
          <q-card class="kpi-card">
            <div class="kpi-content">
              <div class="kpi-info">
                <div class="kpi-label">Inactive Users</div>
                <div class="kpi-value">{{ userManagementStore.stats.totalInactiveUsers || 0 }}</div>
              </div>
              
            </div>
          </q-card>
        </div>

        <!-- Basic Memberships -->
        <div class="col-12 col-sm-6 col-md-4 col-lg-3">
          <q-card class="kpi-card">
            <div class="kpi-content">
              <div class="kpi-info">
                <div class="kpi-label">Basic Memberships</div>
                <div class="kpi-value">{{ userManagementStore.stats.totalBasicMemberships || 0 }}</div>
              </div>
              
            </div>
          </q-card>
        </div>

        <!-- Premium Memberships -->
        <div class="col-12 col-sm-6 col-md-4 col-lg-3">
          <q-card class="kpi-card">
            <div class="kpi-content">
              <div class="kpi-info">
                <div class="kpi-label">Premium Memberships</div>
                <div class="kpi-value">{{ userManagementStore.stats.totalPremiumMemberships || 0 }}</div>
              </div>
             
            </div>
          </q-card>
        </div>
          </div>
        </div>
        <div class="col-12 col-lg-4">
          <q-card class="chart-card">
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
        </div>
      </div>
    </div>

    <!-- Charts Section -->
    <div class="charts-section ">
      <div class="row q-gutter-lg">
        <!-- User Growth Chart -->
        <div class="col-12 col-md-12">
          <q-card class="chart-card">
            <div class="chart-header">
              <h3 class="chart-title">User Growth</h3>
            </div>
            <div class="chart-container">
              <svg class="svg-chart" :viewBox="`0 0 ${chartWidth} ${chartHeight}`" preserveAspectRatio="none">
                <g :transform="`translate(${margin.left}, ${margin.top})`">
                  <g class="y-grid">
                    <line v-for="(y, idx) in yGridLines" :key="`yg${idx}`" :x1="0" :x2="innerWidth" :y1="y" :y2="y" />
                  </g>
                  <g class="x-grid">
                    <line v-for="(x, idx) in xGridLines" :key="`xg${idx}`" :x1="x" :x2="x" :y1="0" :y2="innerHeight" />
                  </g>
                  <path class="area" :d="areaPath" />
                  <g class="lines">
                    <line v-for="(s, i) in lineSegments" :key="`seg${i}`"
                      :x1="s.x1" :y1="s.y1" :x2="s.x2" :y2="s.y2"
                      :stroke="s.color" stroke-width="2" fill="none" />
                  </g>
                  <g class="x-axis">
                    <text v-for="(label, i) in growthLabels" :key="`xl${i}`" :x="xPosition(i)" :y="innerHeight + 18" text-anchor="middle">{{ label }}</text>
                  </g>
                  <g class="y-axis">
                    <text v-for="(tick, i) in yTicks" :key="`yl${i}`" :x="-8" :y="yPosition(tick) + 4" text-anchor="end">{{ tick }}</text>
                  </g>
                </g>
              </svg>
              
            </div>
          </q-card>
        </div>

        
      </div>
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

.kpi-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid #e9ecef;
  transition: all 0.3s ease;
  overflow: hidden;
}

.kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.kpi-content {
  padding: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.kpi-info {
  flex: 1;
}

.kpi-label {
  font-size: 12px;
  color: #27ae60;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.kpi-value {
  font-size: 28px;
  font-weight: 700;
  color: #2c3e50;
  margin-bottom: 8px;
  line-height: 1.2;
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
}

.chart-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid #e9ecef;
  overflow: hidden;
}

.chart-header {
  padding: 24px 24px 0 24px;
  margin-bottom: 20px;
}

.chart-title {
  font-size: 18px;
  font-weight: 600;
  color: #2c3e50;
  margin: 0;
}

.chart-container {
  height: 250px;
  position: relative;
  padding: 0 24px 24px 24px;
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
  width: 200px;
  height: 200px;
  margin: 0 auto 24px;
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
  flex-direction: column;
  gap: 12px;
  padding: 0 24px 24px 24px;
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
.svg-chart { width: 100%; height: 220px; }
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

