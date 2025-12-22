<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

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
      <div class="avatar">
        {{ user.name.charAt(0) }}
      </div>
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
        <span class="icon"><i class="fas fa-book"></i></span>
        Documentation
      </a>
      
      <button class="menu-item logout">
        <span class="icon"><i class="fas fa-right-from-bracket"></i></span>
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
}

.menu-trigger:hover {
  background: var(--md-sys-color-surface-container-high);
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
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
  background: var(--md-sys-color-surface-container);
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
  color: var(--md-sys-color-on-surface);
  font-size: 16px;
}

.email {
  font-size: 12px;
  color: var(--md-sys-color-secondary);
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
  background: var(--md-sys-color-tertiary-container);
  color: var(--md-sys-color-on-tertiary-container);
}

.role-badge.manager {
  background: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
}

.divider {
  height: 1px;
  background: var(--md-sys-color-outline-variant);
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
  color: var(--md-sys-color-on-surface);
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
