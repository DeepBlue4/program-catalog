<script setup>
import { computed } from "vue";
import BaseIcon from "./BaseIcon.vue";
import { mdiClose, mdiInformation, mdiHelpCircle } from "@mdi/js";
import { STATUS_HELP } from "src/styles/statusConstants";

const props = defineProps({
  statusType: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(["close"]);

const content = computed(() => {
  return STATUS_HELP[props.statusType] || null;
});
</script>

<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="info-modal-card m3-card elevated help-modal">
      <div class="info-header">
        <div class="header-text">
          <span class="overline">Status Details</span>
          <h2 v-if="content">{{ content.title }}</h2>
        </div>
        <button class="btn-icon" @click="$emit('close')">
          <BaseIcon :path="mdiClose" />
        </button>
      </div>
      <div v-if="content" class="info-body">
        <p class="help-text-large">
          {{ content.desc }}
        </p>
        <div class="context-box">
          <BaseIcon :path="mdiInformation" :size="20" class="context-icon" />
          <p>{{ content.context }}</p>
        </div>

        <div class="support-box">
          <BaseIcon :path="mdiHelpCircle" :size="20" class="support-icon" />
          <p>
            Need to update this status? Please reach out to the
            <a
              href="https://mattermost.web.boeing.com/devhub/channels/data-analytics-force"
              target="_blank"
              class="support-link"
              >DAF: Metrics</a
            >
            Mattermost channel.
          </p>
        </div>
      </div>
      <div v-else class="info-body">
        <p>No details available for this status.</p>
      </div>
      <div class="info-footer">
        <button class="btn-filled" @click="$emit('close')">Got it</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Reusing styles from SoftwareEffortsList.vue for consistency */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  backdrop-filter: blur(2px);
}

.info-modal-card {
  background: #f7f2fa; /* surface-container-low */
  border-radius: 28px;
  width: 100%;
  max-width: 480px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow:
    0px 1px 3px 0px rgba(0, 0, 0, 0.3),
    0px 4px 8px 3px rgba(0, 0, 0, 0.15);
  animation: modal-pop 0.3s cubic-bezier(0.2, 0, 0, 1);
}

@keyframes modal-pop {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.info-header {
  padding: 24px 24px 16px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.header-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.overline {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #625b71; /* secondary */
  font-weight: 600;
}

.info-header h2 {
  margin: 0;
  font-size: 24px;
  color: #1d1b20; /* on-surface */
  font-weight: 400;
}

.btn-icon {
  background: transparent;
  border: none;
  cursor: pointer;
  color: #49454f; /* on-surface-variant */
  padding: 8px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.btn-icon:hover {
  background: rgba(29, 25, 43, 0.08); /* on-surface-variant state-layer */
}

.info-body {
  padding: 0 24px 24px;
  flex: 1;
  overflow-y: auto;
}

.help-text-large {
  font-size: 16px;
  line-height: 1.5;
  color: #1d1b20; /* on-surface */
  margin-bottom: 24px;
}

.context-box {
  background: #e8def8; /* surface-container-highest (ish) - making it distinct */
  padding: 16px;
  border-radius: 12px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  color: #1d192b; /* on-secondary-container */
}

.context-icon {
  color: #6750a4; /* primary */
  flex-shrink: 0;
  margin-top: 2px;
}

.context-box p {
  margin: 0;
  font-size: 14px;
  line-height: 1.4;
}

.info-footer {
  padding: 16px 24px 24px;
  display: flex;
  justify-content: flex-end;
}

.btn-filled {
  background: #6750a4; /* primary */
  color: #ffffff; /* on-primary */
  border: none;
  padding: 10px 24px;
  border-radius: 20px;
  font-weight: 500;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.btn-filled:hover {
  background: #6750a4; /* primary */
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  opacity: 0.9;
}

.support-box {
  margin-top: 16px;
  background: #fdfbff; /* surface-container-lowest */
  border: 1px solid #e0e0e0;
  padding: 12px;
  border-radius: 12px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  color: #625b71; /* secondary */
}

.support-icon {
  color: #625b71;
  flex-shrink: 0;
  margin-top: 2px;
}

.support-box p {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
}

.support-link {
  color: #005ac1;
  text-decoration: none;
  font-weight: 600;
}

.support-link:hover {
  text-decoration: underline;
}
</style>
