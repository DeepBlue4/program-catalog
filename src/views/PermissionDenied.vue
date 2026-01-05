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
    background-color: #FEF7FF; /* background */
}

.content {
    text-align: center;
    padding: 3rem;
    max-width: 500px;
    background: #FEF7FF; /* surface */
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
    color: #E7E0EC; /* surface-variant */
}

.shield {
    color: #ECE6F0; /* surface-container-high */
}

.lock {
    position: absolute;
    bottom: -10px;
    right: -10px;
    font-size: 40px;
    color: #BA1A1A; /* error */
    background: #FEF7FF; /* surface */
    border-radius: 50%;
    padding: 4px;
}

h1 {
    font-size: 32px;
    color: #1D1B20; /* on-surface */
    margin: 0;
}

.subtitle {
    font-size: 18px;
    color: #625B71; /* secondary */
    margin: 0;
}

.details {
    font-size: 14px;
    color: #79747E; /* outline */
    line-height: 1.5;
}

.actions {
    margin-top: 1rem;
}

.btn-filled {
    background: #005AC1; /* primary */
    color: #FFFFFF; /* on-primary */
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
