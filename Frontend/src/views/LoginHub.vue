<template>
  <div class="login-hub">
    <div class="hub-container">
      <div class="hub-header">
        <h1>Gym Management System</h1>
        <p>Choose your login type to access the system</p>
      </div>

      <div class="login-options">
        <div class="login-option" @click="navigateToLogin('/superadmin-login')">
          <div class="option-icon">👑</div>
          <h3>Super Admin</h3>
          <p>System administration and gym management</p>
          <div class="option-features">
            <span>• Create & manage gyms</span>
            <span>• Manage gym administrators</span>
            <span>• System-wide control</span>
          </div>
        </div>

        <div class="login-option" @click="navigateToLogin('/gymadmin-login')">
          <div class="option-icon">🏢</div>
          <h3>Gym Admin</h3>
          <p>Gym operations and staff management</p>
          <div class="option-features">
            <span>• Manage trainers</span>
            <span>• Handle gym members</span>
            <span>• Gym operations</span>
          </div>
        </div>

        <div class="login-option" @click="navigateToLogin('/trainer-login')">
          <div class="option-icon">🏋️</div>
          <h3>Trainer</h3>
          <p>Training services and client management</p>
          <div class="option-features">
            <span>• Manage clients</span>
            <span>• Create workout plans</span>
            <span>• Training sessions</span>
          </div>
        </div>

        <div class="login-option" @click="navigateToLogin('/user-login')">
          <div class="option-icon">👤</div>
          <h3>Gym Member</h3>
          <p>Access your membership and services</p>
          <div class="option-features">
            <span>• View membership</span>
            <span>• Book classes</span>
            <span>• Track progress</span>
          </div>
        </div>
      </div>

      <div class="hub-footer">
        <p>Need help? Contact your system administrator</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

const navigateToLogin = (path) => {
  router.push(path)
}
</script>

<style scoped>
.login-hub {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.hub-container {
  background: white;
  border-radius: 20px;
  padding: 3rem;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  max-width: 1200px;
  width: 100%;
}

.hub-header {
  text-align: center;
  margin-bottom: 3rem;
}

.hub-header h1 {
  color: #333;
  font-size: 2.5rem;
  margin-bottom: 1rem;
  font-weight: 700;
}

.hub-header p {
  color: #666;
  font-size: 1.1rem;
}

.login-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
  margin-bottom: 2rem;
}

.login-option {
  background: #f8f9fa;
  border: 2px solid #e9ecef;
  border-radius: 15px;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.login-option::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s;
}

.login-option:hover::before {
  left: 100%;
}

.login-option:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  border-color: #667eea;
}

.option-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.login-option h3 {
  color: #333;
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
  font-weight: 600;
}

.login-option p {
  color: #666;
  margin-bottom: 1.5rem;
  font-size: 0.95rem;
}

.option-features {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.option-features span {
  color: #555;
  font-size: 0.9rem;
  text-align: left;
}

.hub-footer {
  text-align: center;
  padding-top: 2rem;
  border-top: 1px solid #e9ecef;
}

.hub-footer p {
  color: #666;
  font-size: 0.9rem;
}

/* Responsive Design */
@media (max-width: 768px) {
  .hub-container {
    padding: 2rem 1rem;
  }
  
  .hub-header h1 {
    font-size: 2rem;
  }
  
  .login-options {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  
  .login-option {
    padding: 1.5rem;
  }
}
</style>
