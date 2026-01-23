<script setup>
import { useRouter } from "vue-router";
import BaseIcon from "src/components/BaseIcon.vue";
import { mdiShield, mdiLock, mdiHelpCircle, mdiSitemap } from "@mdi/js";

const router = useRouter();

const goHome = () => {
  router.push("/");
};
</script>

<template>
  <div class="forbidden-container">
    <div class="content m3-card elevated">
      <div class="icon-area">
        <BaseIcon :path="mdiShield" class="shield" :size="80" />
        <BaseIcon :path="mdiLock" class="lock" :size="40" />
      </div>

      <h1>Access Denied</h1>
      <p class="subtitle">You don't have permission to view this page.</p>

      <div class="details">
        <p>This area requires elevated privileges (Error 403).</p>
        <p class="help-text">
          If you need help getting access, please reach out to the
          <strong>DAF: Metrics</strong> Mattermost channel.
        </p>
      </div>

      <div class="actions">
        <a
          href="https://mattermost.web.boeing.com/devhub/channels/data-analytics-force"
          target="_blank"
          rel="noopener noreferrer"
          class="btn-text"
        >
          <BaseIcon :path="mdiHelpCircle" /> Contact Support
        </a>
        <button class="btn-filled" @click="goHome">
          <BaseIcon :path="mdiSitemap" class="catalog-icon" /> Go to Catalog
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.forbidden-container {
  height: 100%;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #fef7ff; /* background */
}

.content {
  text-align: center;
  padding: 3rem;
  max-width: 500px;
  background: #fef7ff; /* surface */
  border-radius: 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.icon-area {
  position: relative;
  font-size: 80px;
  margin-bottom: 1rem;
  color: #e7e0ec; /* surface-variant */
}

.shield {
  color: #ece6f0; /* surface-container-high */
}

.lock {
  position: absolute;
  bottom: -10px;
  right: -10px;
  font-size: 40px;
  color: #ba1a1a; /* error */
  background: #fef7ff; /* surface */
  border-radius: 50%;
  padding: 4px;
}

h1 {
  font-size: 32px;
  color: #1d1b20; /* on-surface */
  margin: 0;
}

.subtitle {
  font-size: 18px;
  color: #625b71; /* secondary */
  margin: 0;
}

.details {
  font-size: 14px;
  color: #79747e; /* outline */
  line-height: 1.5;
}

.actions {
  display: flex;
  align-items: center;
  gap: 16px; /* Space between buttons */
}

.help-text {
  margin-top: 12px;
  font-size: 15px;
}

.btn-filled {
  background: #005ac1; /* primary */
  color: #ffffff; /* on-primary */
  border: none;
  padding: 12px 32px;
  border-radius: 100px;
  font-weight: 500;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
}

.btn-text {
  background: transparent;
  color: #005ac1; /* primary */
  padding: 12px 24px;
  border-radius: 100px;
  font-weight: 500;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  border: 1px solid transparent;
  transition: all 0.2s;
}

.btn-text:hover {
  background: rgba(0, 90, 193, 0.08); /* primary opacity */
}

.btn-filled:hover {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  transform: translateY(-1px);
}

.catalog-icon {
  transform: rotate(270deg);
}
</style>
