import { createRouter, createWebHistory } from 'vue-router'

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
      component: () => import('../views/SuperAdmin.vue')
    },
    {
      path: '/gym-admin',
      name: 'GymAdmin',
      component: () => import('../views/GymAdmin.vue')
    },
    {
      path: '/trainer',
      name: 'Trainer',
      component: () => import('../views/Trainer.vue')
    },
    {
      path: '/user',
      name: 'User',
      component: () => import('../views/User.vue')
    }
  ],
})

export default router
