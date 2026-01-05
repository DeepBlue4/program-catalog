<script setup>
defineProps({
  title: {
    type: String,
    default: 'Confirm Action'
  },
  message: {
    type: String,
    required: true
  },
  confirmLabel: {
    type: String,
    default: 'Confirm'
  },
  cancelLabel: {
    type: String,
    default: 'Cancel'
  },
  isDanger: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['confirm', 'cancel']);
</script>

<template>
  <div class="modal-backdrop" @click.self="$emit('cancel')">
    <div class="modal-card">
      <h3 class="modal-title">{{ title }}</h3>
      <p class="modal-message">{{ message }}</p>
      
      <div class="modal-actions">
        <button class="btn-text" @click="$emit('cancel')">{{ cancelLabel }}</button>
        <button 
            class="btn-filled" 
            :class="{ danger: isDanger }"
            @click="$emit('confirm')"
        >
            {{ confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    animation: fadeIn 0.2s ease-out;
}

.modal-card {
    background: #FEF7FF; /* surface */
    padding: 1.5rem;
    border-radius: 28px;
    width: 90%;
    max-width: 400px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    display: flex;
    flex-direction: column;
    animation: scaleIn 0.2s ease-out;
}

.modal-title {
    margin: 0 0 1rem 0;
    font-size: 24px;
    color: #1D1B20; /* on-surface */
}

.modal-message {
    margin: 0 0 1.5rem 0;
    color: #49454F; /* on-surface-variant */
    font-size: 16px;
    line-height: 1.5;
}

.modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
}

.btn-text {
    background: transparent;
    border: none;
    color: #005AC1; /* primary */
    padding: 10px 24px;
    border-radius: 20px;
    font-weight: 500;
    cursor: pointer;
    font-size: 14px;
}

.btn-text:hover {
    background: rgba(0, 90, 193, 0.08); /* primary-rgb */
    background: #E7E0EC; /* surface-variant */
}

.btn-filled {
    background: #005AC1; /* primary */
    color: #FFFFFF; /* on-primary */
    border: none;
    padding: 10px 24px;
    border-radius: 20px;
    font-weight: 500;
    cursor: pointer;
    font-size: 14px;
}

.btn-filled:hover {
    box-shadow: 0 1px 3px rgba(0,0,0,0.12);
}

.btn-filled.danger {
    background: #BA1A1A; /* error */
    color: #FFFFFF; /* on-error */
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes scaleIn {
    from { transform: scale(0.9); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
}
</style>
