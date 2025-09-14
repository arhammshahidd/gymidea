// import { createRouter, createWebHistory } from 'vue-router'
// import { useAuthStore } from '../stores/auth'

// const router = createRouter({
//   history: createWebHistory(import.meta.env.BASE_URL),
//   routes: [
//     {
//       path: '/',
//       redirect: '/login-hub'
//     },
//     {
//       path: '/login-hub',
//       name: 'LoginHub',
//       component: () => import('../views/LoginHub.vue')
//     },
//     {
//       path: '/superadmin-login',
//       name: 'SuperAdminLogin',
//       component: () => import('../views/SuperAdminLogin.vue')
//     },
//     {
//       path: '/trainer-login',
//       name: 'TrainerLogin',
//       component: () => import('../views/TrainerLogin.vue')
//     },
//     {
//       path: '/user-login',
//       name: 'UserLogin',
//       component: () => import('../views/UserLogin.vue')
//     },
//     {
//       path: '/super-admin',
//       name: 'SuperAdmin',
//       component: () => import('../views/SuperAdmin.vue'),
//       // meta: { requiresAuth: true, role: 'SUPER_ADMIN' }
//     },
//     {
//       path: '/gymadmin-login',
//       name: 'GymAdminLogin',
//       component: () => import('../views/GymAdminLogin.vue')
//     },
//     {
//       path: '/gym-admin',
//       name: 'GymAdmin',
//       component: () => import('../views/GymAdmin.vue'),
//       children: [
//         {
//           path: '',
//           redirect: 'dashboard'
//         },
//         {
//           path: 'dashboard',
//           name: 'GymAdminDashboard',
//           component: () => import('../views/Dashboard.vue')
//         },
//         {
//           path: 'user-management',
//           name: 'GymAdminUserManagement',
//           component: () => import('../components/UserManagement.vue')
//         },
//         {
//           path: 'trainer-management',
//           name: 'GymAdminTrainerManagement',
//           component: () => import('../views/TrainerManagement.vue')
//         },
//         {
//           path: 'trainer-scheduler',
//           name: 'GymAdminTrainerScheduler',
//           component: () => import('../views/TrainerScheduler.vue')
//         },
//         {
//           path: 'food-menu',
//           name: 'GymAdminFoodMenu',
//           component: () => import('../views/FoodMenu.vue')
//         },
//         {
//           path: 'payment-status',
//           name: 'GymAdminPaymentStatus',
//           component: () => import('../views/PaymentStatus.vue')
//         },
//         {
//           path: 'settings',
//           name: 'GymAdminSettings',
//           component: () => import('../views/Settings.vue')
//         }
//       ]
//     },
//     {
//       path: '/trainer',
//       name: 'Trainer',
//       component: () => import('../views/Trainer.vue'),
//       // meta: { requiresAuth: true, role: 'trainer' },
//       children: [
//         {
//           path: '',
//           redirect: 'dashboard'
//         },
//         {
//           path: 'dashboard',
//           name: 'TrainerDashboard',
//           component: () => import('../views/Dashboard.vue')
//         },
//         {
//           path: 'user-management',
//           name: 'TrainerUserManagement',
//           component: () => import('../components/UserManagement.vue')
//         },
//         {
//           path: 'trainer-scheduler',
//           name: 'TrainerScheduler',
//           component: () => import('../views/TrainerScheduler.vue')
//         },
//         {
//           path: 'food-menu',
//           name: 'TrainerFoodMenu',
//           component: () => import('../views/FoodMenu.vue')
//         },
//         {
//           path: 'payment-status',
//           name: 'TrainerPaymentStatus',
//           component: () => import('../views/PaymentStatus.vue')
//         },
//         {
//           path: 'settings',
//           name: 'TrainerSettings',
//           component: () => import('../views/Settings.vue')
//         }
//       ]
//     },
//     {
//       path: '/user',
//       name: 'User',
//       component: () => import('../views/User.vue'),
//       // meta: { requiresAuth: true, role: 'USER' }
//     },
//     {
//       path: '/:pathMatch(.*)*',
//       redirect: '/login-hub'
//     }
//   ],
// })

// // Navigation guard removed - using /dashboard route's beforeEnter instead

// export default router
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
      component: () => import('../views/SuperAdmin.vue')
    },
    {
      path: '/gymadmin-login',
      name: 'GymAdminLogin',
      component: () => import('../views/GymAdminLogin.vue'),

      // ✅ Guard only on Gym Admin Login
      beforeEnter: (to, from, next) => {
        const authStore = useAuthStore()

        if (authStore.isAuthenticated && authStore.role === 'GYM_ADMIN') {
          // Already logged in → go straight to dashboard
          next({ name: 'GymAdminDashboard' })
        } else {
          // Not logged in → allow login page
          next()
        }
      }
    },
    {
      path: '/gym-admin',
      name: 'GymAdmin',
      component: () => import('../views/GymAdmin.vue'),
      children: [
        { path: '', redirect: 'dashboard' },
        {
          path: 'dashboard',
          name: 'GymAdminDashboard',
          component: () => import('../views/Dashboard.vue')
        },
        {
          path: 'user-management',
          name: 'GymAdminUserManagement',
          component: () => import('../components/UserManagement.vue')
        },
        {
          path: 'trainer-management',
          name: 'GymAdminTrainerManagement',
          component: () => import('../views/TrainerManagement.vue')
        },
        {
          path: 'trainer-scheduler',
          name: 'GymAdminTrainerScheduler',
          component: () => import('../views/TrainerScheduler.vue')
        },
        {
          path: 'food-menu',
          name: 'GymAdminFoodMenu',
          component: () => import('../views/FoodMenu.vue')
        },
        {
          path: 'payment-status',
          name: 'GymAdminPaymentStatus',
          component: () => import('../views/PaymentStatus.vue')
        },
        {
          path: 'settings',
          name: 'GymAdminSettings',
          component: () => import('../views/Settings.vue')
        },
        {
          path: 'no-permissions',
          name: 'GymAdminNoPermissions',
          component: () => import('../views/NoPermissions.vue')
        }
      ]
    },
    {
      path: '/trainer',
      name: 'Trainer',
      component: () => import('../views/Trainer.vue'),
      children: [
        { path: '', redirect: 'dashboard' },
        {
          path: 'dashboard',
          name: 'TrainerDashboard',
          component: () => import('../views/Dashboard.vue')
        },
        {
          path: 'user-management',
          name: 'TrainerUserManagement',
          component: () => import('../components/UserManagement.vue')
        },
        {
          path: 'trainer-scheduler',
          name: 'TrainerScheduler',
          component: () => import('../views/TrainerScheduler.vue')
        },
        {
          path: 'food-menu',
          name: 'TrainerFoodMenu',
          component: () => import('../views/FoodMenu.vue')
        },
        {
          path: 'payment-status',
          name: 'TrainerPaymentStatus',
          component: () => import('../views/PaymentStatus.vue')
        },
        {
          path: 'settings',
          name: 'TrainerSettings',
          component: () => import('../views/Settings.vue')
        }
      ]
    },
    {
      path: '/user',
      name: 'User',
      component: () => import('../views/User.vue')
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/login-hub'
    }
  ],
})

export default router
