<script setup>
import { useRouter } from 'vue-router';
import BaseIcon from '../components/BaseIcon.vue';
import { mdiShield, mdiLock, mdiHome } from '@mdi/js';

const router = useRouter();

const goHome = () => {
    router.push('/');
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
        <p>If you believe this is a mistake, please contact your system administrator.</p>
      </div>
      
      <div class="actions">
        <button class="btn-filled" @click="goHome">
            <BaseIcon :path="mdiHome" /> Go to Home
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
    background-color: var(--md-sys-color-background);
}

.content {
    text-align: center;
    padding: 3rem;
    max-width: 500px;
    background: var(--md-sys-color-surface);
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
    color: var(--md-sys-color-surface-variant);
}

.shield {
    color: var(--md-sys-color-surface-container-high);
}

.lock {
    position: absolute;
    bottom: -10px;
    right: -10px;
    font-size: 40px;
    color: var(--md-sys-color-error);
    background: var(--md-sys-color-surface);
    border-radius: 50%;
    padding: 4px;
}

h1 {
    font-size: 32px;
    color: var(--md-sys-color-on-surface);
    margin: 0;
}

.subtitle {
    font-size: 18px;
    color: var(--md-sys-color-secondary);
    margin: 0;
}

.details {
    font-size: 14px;
    color: var(--md-sys-color-outline);
    line-height: 1.5;
}

.actions {
    margin-top: 1rem;
}

.btn-filled {
    background: var(--md-sys-color-primary);
    color: var(--md-sys-color-on-primary);
    border: none;
    padding: 12px 32px;
    border-radius: 100px;
    font-weight: 500;
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: box-shadow 0.2s;
}

.btn-filled:hover {
    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
}
</style>
