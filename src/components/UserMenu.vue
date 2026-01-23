<script setup>
import { ref, onMounted, onUnmounted, computed, inject } from "vue";
import BaseIcon from "src/components/BaseIcon.vue";
import {
  mdiAccountCircle,
  mdiBookOpenVariant,
  mdiChartPie,
  mdiLock,
  mdiOpenInNew,
  mdiCompass,
} from "@mdi/js";
import { evaluateWriteAccess } from "src/router";

const isOpen = ref(false);
const menuRef = ref(null);

// Grab the user we hooked up in main.js
const currentUser = inject("currentUser");

// Handle what we show in the menu before the user loads, or if they're missing info.
const user = computed(() => {
  if (!currentUser.value) {
    return {
      name: "Loading...",
      email: "",
      bemsid: "",
      businessUnit: "",
      // defaulting these to false so we don't accidentally show admin stuff
      isAdmin: false,
      isManager: false,
      is6J: false,
    };
  }

  // Unified Mapping for both Prod and Mock (since Mock now matches Prod structure)
  const u = currentUser.value;
  const daf = u.daf_user || {};
  const cached = u.cached || {};

  return {
    name:
      u.display_name ||
      `${daf.first_name || ""} ${daf.last_name || ""}`.trim() ||
      "User",
    email: daf.email || cached.email || "",
    bemsid: daf.bemsid || daf.username || "",
    businessUnit: cached.business_unit || "N/A",
    isAdmin: daf.is_superuser,
    isManager: cached.manager_status,
    is6J: false,
  };
});

// Calculate the Compass link based on where we are running (local, dev, stage, prod).
const compassUrl = computed(() => {
  if (typeof window === "undefined") return "/403";

  const host = window.location.hostname || "";

  if (host.includes("localhost")) {
    return "http://localhost:8000/ui/accounts/overview";
  }

  // Figure out which environment we're in
  let prefix = "daf-compass";
  if (host.includes("daf-compass-dev") || host.includes("-dev")) {
    prefix = "daf-compass-dev";
  } else if (host.includes("daf-compass-stage") || host.includes("-stage")) {
    prefix = "daf-compass-stage";
  }

  // And which region
  if (host.includes("global")) {
    return `https://${prefix}.common.global.bsf.tools/`;
  } else if (host.includes("us")) {
    return `https://${prefix}.common.us.bsf.tools/`;
  }

  // If we can't figure it out, send them to the 403 page so they don't get lost.
  return "/403";
});

// Re-use the router logic so the "You have write access" badge is honest.
const hasWriteAccess = computed(() => {
  return evaluateWriteAccess(currentUser.value);
});

const toggleMenu = () => {
  isOpen.value = !isOpen.value;
};

const closeMenu = (e) => {
  if (menuRef.value && !menuRef.value.contains(e.target)) {
    isOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener("click", closeMenu);
});

onUnmounted(() => {
  document.removeEventListener("click", closeMenu);
});
</script>

<template>
  <div class="user-menu" ref="menuRef">
    <button class="menu-trigger" @click.stop="toggleMenu">
      <BaseIcon :path="mdiAccountCircle" class="trigger-icon" :size="36" />
    </button>

    <div v-if="isOpen" class="menu-dropdown m3-card elevated">
      <!-- User Header -->
      <div class="user-info">
        <div class="avatar large">
          {{ user.name.charAt(0) }}
        </div>
        <div class="details">
          <div class="name">{{ user.name }}</div>
          <div class="email">{{ user.email }}</div>
        </div>
      </div>

      <!-- Role Badges -->
      <div class="badges">
        <span v-if="user.isAdmin" class="role-badge admin">Admin</span>
        <span v-if="user.isManager" class="role-badge manager">Manager</span>
        <span v-if="user.is6J" class="role-badge swe">6J</span>
      </div>

      <!-- User Details Grid -->
      <div class="user-details-grid">
        <div class="detail-row">
          <span class="detail-label">BEMSID</span>
          <span class="detail-value">{{ user.bemsid }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Business Unit</span>
          <span class="detail-value">{{ user.businessUnit }}</span>
        </div>
      </div>

      <!-- Write Access Card -->
      <div class="write-access-card" :class="{ 'has-access': hasWriteAccess }">
        <div class="wa-badge">{{ hasWriteAccess ? "Editor" : "Viewer" }}</div>
        <div class="wa-text">
          <div class="wa-title">Program Catalog Access</div>
          <div class="wa-hint">
            {{ hasWriteAccess ? "You have write access" : "Read-only access" }}
          </div>
        </div>
      </div>

      <div class="divider"></div>

      <!-- Navigation Links -->
      <router-link to="/dashboard" class="menu-item" @click="isOpen = false">
        <span class="icon"><BaseIcon :path="mdiChartPie" :size="16" /></span>
        Dashboard
      </router-link>

      <router-link to="/403" class="menu-item" @click="isOpen = false">
        <span class="icon"><BaseIcon :path="mdiLock" :size="16" /></span>
        Unauthorized (Demo)
      </router-link>

      <div class="divider"></div>

      <!-- External Links Section -->
      <div class="external-links-label">External Links</div>

      <a
        :href="compassUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="menu-item external"
        @click="isOpen = false"
      >
        <span class="icon"><BaseIcon :path="mdiCompass" :size="16" /></span>
        Compass
        <BaseIcon :path="mdiOpenInNew" :size="12" class="external-icon" />
      </a>

      <a
        href="
https://data-analytics-force.pages.global.bsf.tools/products/compass/latest/pages/program-catalog/program-catalog-overview/"
        target="_blank"
        rel="noopener noreferrer"
        class="menu-item external"
        @click="isOpen = false"
      >
        <span class="icon"
          ><BaseIcon :path="mdiBookOpenVariant" :size="16"
        /></span>
        Documentation
        <BaseIcon :path="mdiOpenInNew" :size="12" class="external-icon" />
      </a>
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
  background: #ece6f0; /* surface-container-high */
}

.trigger-icon {
  font-size: 36px;
  color: #ffffff; /* on-primary (for dark header) */
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #005ac1; /* primary */
  color: #ffffff; /* on-primary */
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
  width: 320px;
  background: #f3edf7; /* surface-container */
  border-radius: 12px;
  padding: 1rem;
  z-index: 100;
  transform-origin: top right;
  animation: scaleIn 0.15s ease-out;
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
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
  color: #1d1b20; /* on-surface */
  font-size: 16px;
}

.email {
  font-size: 12px;
  color: #625b71; /* secondary */
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
  background: #ffdf90; /* tertiary-container */
  color: #241a00; /* on-tertiary-container */
}

.role-badge.manager {
  background: #dbe2f9; /* secondary-container */
  color: #1d192b; /* on-secondary-container */
}

.role-badge.swe {
  background: #d6f5d6; /* green tint */
  color: #1b5e20; /* dark green */
}

.divider {
  height: 1px;
  background: #c4c7c5; /* outline-variant */
  margin: 0.5rem 0;
}

/* User Details Grid */
.user-details-grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
  padding: 8px 0;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.detail-label {
  color: #625b71;
  font-weight: 500;
}

.detail-value {
  color: #1d1b20;
  font-weight: 600;
}

/* Write Access Card */
.write-access-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f5f5f5;
  margin-bottom: 8px;
}

.write-access-card.has-access {
  background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
}

.wa-badge {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  background: #9e9e9e;
  color: white;
}

.write-access-card.has-access .wa-badge {
  background: linear-gradient(180deg, #2e7d32, #1b5e20);
}

.wa-text {
  flex: 1;
}

.wa-title {
  font-size: 12px;
  font-weight: 600;
  color: #1d1b20;
}

.wa-hint {
  font-size: 11px;
  color: #625b71;
}

/* Menu Items */
.menu-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  text-decoration: none;
  color: #1d1b20; /* on-surface */
  background: none;
  border: none;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
  box-sizing: border-box;
}

.menu-item:hover {
  background: rgba(0, 0, 0, 0.05); /* Hover state */
}

/* External Links */
.external-links-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  color: #625b71;
  padding: 4px 12px;
  letter-spacing: 0.5px;
}

.menu-item.external {
  color: #005ac1;
}

.external-icon {
  margin-left: auto;
  opacity: 0.6;
}

.menu-item.external:hover .external-icon {
  opacity: 1;
}

.icon {
  font-size: 16px;
}
</style>
