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
        <div class="col-12 col-md-4">
          <q-card class="kpi-card">
            <div class="kpi-content">
              <div class="kpi-info">
                <div class="kpi-label">Total Users</div>
                <div class="kpi-value">12,458</div>
                <div class="kpi-change">
                  <q-icon name="trending_up" size="16px" />
                  +12% this month
                </div>
              </div>
              <div class="kpi-icon">
                <q-avatar size="50px" class="kpi-avatar">
                  <q-icon name="people" size="24px" color="white" />
                </q-avatar>
              </div>
            </div>
          </q-card>
        </div>

        <div class="col-12 col-md-4">
          <q-card class="kpi-card">
            <div class="kpi-content">
              <div class="kpi-info">
                <div class="kpi-label">Active Memberships</div>
                <div class="kpi-value">3,210</div>
                <div class="kpi-change">
                  <q-icon name="trending_up" size="16px" />
                  +8% this month
                </div>
              </div>
              <div class="kpi-icon">
                <q-avatar size="50px" class="kpi-avatar">
                  <q-icon name="receipt" size="24px" color="white" />
                </q-avatar>
              </div>
            </div>
          </q-card>
        </div>

        <div class="col-12 col-md-4">
          <q-card class="kpi-card">
            <div class="kpi-content">
              <div class="kpi-info">
                <div class="kpi-label">Total Payments</div>
                <div class="kpi-value">$45,890</div>
                <div class="kpi-change">
                  <q-icon name="trending_up" size="16px" />
                  +20% this month
                </div>
              </div>
              <div class="kpi-icon">
                <q-avatar size="50px" class="kpi-avatar">
                  <q-icon name="attach_money" size="24px" color="white" />
                </q-avatar>
              </div>
            </div>
          </q-card>
        </div>
      </div>
    </div>

    <!-- Charts Section -->
    <div class="charts-section">
      <div class="row q-gutter-lg">
        <!-- User Growth Chart -->
        <div class="col-12 col-md-8">
          <q-card class="chart-card">
            <div class="chart-header">
              <h3 class="chart-title">User Growth</h3>
            </div>
            <div class="chart-container">
              <div class="line-chart">
                <div class="chart-line"></div>
                <div class="chart-points">
                  <div class="point" style="left: 0%; bottom: 20%;"></div>
                  <div class="point" style="left: 16.66%; bottom: 35%;"></div>
                  <div class="point" style="left: 33.33%; bottom: 25%;"></div>
                  <div class="point" style="left: 50%; bottom: 45%;"></div>
                  <div class="point" style="left: 66.66%; bottom: 60%;"></div>
                  <div class="point" style="left: 83.33%; bottom: 75%;"></div>
                  <div class="point" style="left: 100%; bottom: 85%;"></div>
                </div>
              </div>
              <div class="chart-labels">
                <span>Jan</span>
                <span>Feb</span>
                <span>Mar</span>
                <span>Apr</span>
                <span>May</span>
                <span>Jun</span>
                <span>Jul</span>
              </div>
            </div>
          </q-card>
        </div>

        <!-- Membership Tiers Chart -->
        <div class="col-12 col-md-4">
          <q-card class="chart-card">
            <div class="chart-header">
              <h3 class="chart-title">Membership Tiers</h3>
            </div>
            <div class="donut-chart">
              <div class="donut-ring">
                <div class="donut-segment basic"></div>
                <div class="donut-segment premium"></div>
                <div class="donut-segment pro"></div>
              </div>
              <div class="donut-center">
                <span class="donut-total">1,250</span>
                <span class="donut-label">Total</span>
              </div>
            </div>
            <div class="chart-legend">
              <div class="legend-item">
                <div class="legend-color basic"></div>
                <span>Basic</span>
              </div>
              <div class="legend-item">
                <div class="legend-color premium"></div>
                <span>Premium</span>
              </div>
              <div class="legend-item">
                <div class="legend-color pro"></div>
                <span>Pro</span>
              </div>
            </div>
          </q-card>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

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

onMounted(() => {
  console.log('Professional Dashboard mounted')
})
</script>

<style scoped>
.dashboard-page {
  background: #f8f9fa;
  min-height: 100vh;
  padding: 24px;
  width: 100%;
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
  background: #27ae60;
}

.legend-color.premium {
  background: #2ecc71;
}

.legend-color.pro {
  background: #58d68d;
}
</style>

