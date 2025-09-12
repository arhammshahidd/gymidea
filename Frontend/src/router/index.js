import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/login-hub'
    },
    {
      path: '/login-hub',
      name: 'LoginHub',
      component: () => import('../views/LoginHub.vue')
    },
    {
      path: '/superadmin-login',
      name: 'SuperAdminLogin',
      component: () => import('../views/SuperAdminLogin.vue')
    },
    {
      path: '/gymadmin-login',
      name: 'GymAdminLogin',
      component: () => import('../views/GymAdminLogin.vue')
    },
    {
      path: '/trainer-login',
      name: 'TrainerLogin',
      component: () => import('../views/TrainerLogin.vue')
    },
    {
      path: '/user-login',
      name: 'UserLogin',
      component: () => import('../views/UserLogin.vue')
    },
    {
      path: '/super-admin',
      name: 'SuperAdmin',
      component: () => import('../views/SuperAdmin.vue'),
      meta: { requiresAuth: true, role: 'SUPER_ADMIN' }
    },
    {
      path: '/gym-admin',
      name: 'GymAdmin',
      component: () => import('../views/GymAdmin.vue'),
      meta: { requiresAuth: true, role: 'GYM_ADMIN' }
    },
    {
      path: '/trainer',
      name: 'Trainer',
      component: () => import('../views/Trainer.vue'),
      meta: { requiresAuth: true, role: 'trainer' }
    },
    {
      path: '/user',
      name: 'User',
      component: () => import('../views/User.vue'),
      meta: { requiresAuth: true, role: 'USER' }
    }
  ],
})

// Navigation guard
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  
  console.log('=== ROUTER NAVIGATION ===');
  console.log('To:', to.path);
  console.log('From:', from.path);
  console.log('Auth store state:', {
    isAuthenticated: authStore.isAuthenticated,
    role: authStore.role,
    user: authStore.user
  });
  
  // If route requires authentication
  if (to.meta.requiresAuth) {
    if (!authStore.isAuthenticated) {
      // Redirect to appropriate login page based on role
      const role = to.meta.role
      if (role === 'SUPER_ADMIN') {
        next('/superadmin-login')
      } else if (role === 'GYM_ADMIN') {
        next('/gymadmin-login')
      } else if (role === 'trainer') {
        next('/trainer-login')
      } else if (role === 'USER') {
        next('/user-login')
      } else {
        next('/login-hub')
      }
      return
    }
    
    // Check if user has correct role
    if (to.meta.role && authStore.role !== to.meta.role) {
      // Redirect to appropriate dashboard based on user's role
      if (authStore.role === 'SUPER_ADMIN') {
        next('/super-admin')
      } else if (authStore.role === 'GYM_ADMIN') {
        next('/gym-admin')
      } else if (authStore.role === 'trainer') {
        next('/trainer')
      } else if (authStore.role === 'USER') {
        next('/user')
      } else {
        next('/login-hub')
      }
      return
    }
  }
  
  // If user is authenticated and trying to access login pages, redirect to dashboard
  if (authStore.isAuthenticated && to.path.includes('-login')) {
    if (authStore.role === 'SUPER_ADMIN') {
      next('/super-admin')
    } else if (authStore.role === 'GYM_ADMIN') {
      next('/gym-admin')
    } else if (authStore.role === 'trainer') {
      next('/trainer')
    } else if (authStore.role === 'USER') {
      next('/user')
    } else {
      next('/login-hub')
    }
    return
  }
  
  console.log('Navigation guard: calling next()');
  next()
})

export default router
