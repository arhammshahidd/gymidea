<script setup>
import { onMounted } from 'vue'
import { useAuthStore } from './stores/auth'

const authStore = useAuthStore()

onMounted(() => {
  authStore.initAuth()
})
</script>

<template>
  <div id="app">
    <router-view />
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  line-height: 1.6;
  color: var(--text);
}

/* Theme variables */
:root {
  --bg: #f8f9fa;
  --card: #ffffff;
  --text: #2c3e50;
  --muted: #6c757d;
  --border: #e9ecef;
}

:root.dark {
  --bg: #0f172a;
  --card: #111827;
  --text: #ffffff;
  --muted: #94a3b8;
  --border: #1f2937;
}

html, body, #app { background: var(--bg); }

#app { min-height: 100vh; }

.bg-surface { background: var(--bg); }
.card-surface { background: var(--card); border-color: var(--border); }
.text-muted { color: var(--muted); }

/* Dark mode overrides for common surfaces */
:root.dark .dashboard-page,
:root.dark .payment-status-page,
:root.dark .gym-admin-layout .main-content { background: var(--bg) !important; color: var(--text) !important; }

:root.dark .sidebar { background: var(--card) !important; border-right-color: var(--border) !important; }

/* Card-like elements */
:root.dark .kpi-card,
:root.dark .overview-card,
:root.dark .chart-card,
:root.dark .user-card,
:root.dark .q-card { background: var(--card) !important; color: var(--text) !important; border-color: var(--border) !important; }

/* Generic text colors */
:root.dark .text-grey-1,
:root.dark .text-grey-2,
:root.dark .text-grey-3,
:root.dark .text-grey-4,
:root.dark .text-grey-5,
:root.dark .text-grey-6,
:root.dark .text-grey-7,
:root.dark .text-grey-8,
:root.dark .text-grey-9,
:root.dark .text-blue-8,
:root.dark .text-green-8,
:root.dark .text-primary,
:root.dark .text-caption,
:root.dark .text-subtitle2,
:root.dark .text-h6,
:root.dark .text-subtitle1 { color: var(--text) !important; }

/* Force body and common elements to white text in dark */
:root.dark body, :root.dark .dashboard-title, :root.dark .kpi-label, :root.dark .kpi-value, :root.dark .page-title { color: var(--text) !important; }

/* Quasar common labels */
:root.dark .q-item__label,
:root.dark .q-field__label,
:root.dark .q-field__native,
:root.dark .q-card__section,
:root.dark .q-tab__label { color: var(--text) !important; }

/* Tables (Quasar q-table) */
:root.dark .q-table,
:root.dark .q-table__container,
:root.dark .q-table__top,
:root.dark .q-table__bottom,
:root.dark .q-table thead,
:root.dark .q-table tbody,
:root.dark .q-table tr,
:root.dark .q-table td,
:root.dark .q-table th { background: var(--card) !important; color: var(--text) !important; border-color: var(--border) !important; }

:root.dark .q-table td,
:root.dark .q-table th { border-bottom: 1px solid var(--border) !important; }

:root.dark .q-table__top,
:root.dark .q-table__bottom { border-top: 1px solid var(--border) !important; }

:root.dark .q-table .q-btn,
:root.dark .q-table .q-input .q-field__native,
:root.dark .q-table .q-select .q-field__native { color: var(--text) !important; }
</style>
