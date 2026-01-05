<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import BaseIcon from '../components/BaseIcon.vue';
import { mdiAccountCircle, mdiBookOpenVariant, mdiChartPie, mdiLock, mdiLogout } from '@mdi/js';

const isOpen = ref(false);
const menuRef = ref(null);

const user = {
  name: 'Sawyer',
  email: 'sawyer@example.com',
  isManager: true,
  isAdmin: true
};

const toggleMenu = () => {
  isOpen.value = !isOpen.value;
};

const closeMenu = (e) => {
  if (menuRef.value && !menuRef.value.contains(e.target)) {
    isOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', closeMenu);
});

onUnmounted(() => {
  document.removeEventListener('click', closeMenu);
});
</script>

<template>
  <div class="user-menu" ref="menuRef">
    <button class="menu-trigger" @click.stop="toggleMenu">
      <BaseIcon :path="mdiAccountCircle" class="trigger-icon" :size="36" />
    </button>

    <div v-if="isOpen" class="menu-dropdown m3-card elevated">
      <div class="user-info">
        <div class="avatar large">
          {{ user.name.charAt(0) }}
        </div>
        <div class="details">
          <div class="name">{{ user.name }}</div>
          <div class="email">{{ user.email }}</div>
        </div>
      </div>
      
      <div class="badges">
        <span v-if="user.isAdmin" class="role-badge admin">Admin</span>
        <span v-if="user.isManager" class="role-badge manager">Manager</span>
      </div>

      <div class="divider"></div>

      <a href="https://vuejs.org" target="_blank" class="menu-item">
        <span class="icon"><BaseIcon :path="mdiBookOpenVariant" :size="16" /></span>
        Documentation
      </a>

      <div class="divider"></div>

      <router-link to="/dashboard" class="menu-item">
        <span class="icon"><BaseIcon :path="mdiChartPie" :size="16" /></span>
        Dashboard
      </router-link>

      <router-link to="/403" class="menu-item">
        <span class="icon"><BaseIcon :path="mdiLock" :size="16" /></span>
        Unauthorized (Demo)
      </router-link>
      
      <button class="menu-item logout">
        <span class="icon"><BaseIcon :path="mdiLogout" :size="16" /></span>
        Sign Out
      </button>
    </div>
  </div>
</template>

<style scoped>
.user-menu {
  position: relative;
  margin-left: 1rem;
}

.menu-trigger {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.menu-trigger:hover {
  background: #ECE6F0; /* surface-container-high */
}

.trigger-icon {
  font-size: 36px;
  color: #005AC1; /* primary */
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #005AC1; /* primary */
  color: #FFFFFF; /* on-primary */
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  font-size: 18px;
}

.avatar.large {
  width: 48px;
  height: 48px;
  font-size: 24px;
}

.menu-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 8px;
  width: 280px;
  background: #F3EDF7; /* surface-container */
  border-radius: 12px;
  padding: 1rem;
  z-index: 100;
  transform-origin: top right;
  animation: scaleIn 0.15s ease-out;
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.user-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.details {
  overflow: hidden;
}

.name {
  font-weight: 500;
  color: #1D1B20; /* on-surface */
  font-size: 16px;
}

.email {
  font-size: 12px;
  color: #625B71; /* secondary */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.badges {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.role-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
  text-transform: uppercase;
}

.role-badge.admin {
  background: #FFDF90; /* tertiary-container */
  color: #241A00; /* on-tertiary-container */
}

.role-badge.manager {
  background: #DBE2F9; /* secondary-container */
  color: #1D192B; /* on-secondary-container */
}

.divider {
  height: 1px;
  background: #C4C7C5; /* outline-variant */
  margin: 0.5rem 0;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  text-decoration: none;
  color: #1D1B20; /* on-surface */
  background: none;
  border: none;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
  box-sizing: border-box;
}

.menu-item:hover {
  background: rgba(0,0,0,0.05); /* Hover state */
}

.menu-item.logout {
  color: #B3261E; /* Error/Logout color */
}

.icon {
  font-size: 16px;
}
</style>
