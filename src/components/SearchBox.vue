<script setup>
import { ref, computed } from 'vue';
import BaseIcon from '../components/BaseIcon.vue';
import { mdiMagnify } from '@mdi/js';

const props = defineProps({
  items: {
    type: Array, // Array of node objects { name, value, ... }
    required: true
  }
});

const emit = defineEmits(['select']);

const query = ref('');
const isOpen = ref(false);

const filteredItems = computed(() => {
  if (!query.value) return [];
  const lowerQuery = query.value.toLowerCase();
  return props.items.filter(item => 
    item.name.toLowerCase().includes(lowerQuery) || 
    String(item.value).toLowerCase().includes(lowerQuery)
  ).slice(0, 10); // Limit to 10 suggestions
});

const handleInput = () => {
  isOpen.value = true;
};

const selectItem = (item) => {
  query.value = item.name;
  isOpen.value = false;
  emit('select', item);
};

const handleBlur = () => {
  // Delay close to allow click event to register
  setTimeout(() => {
    isOpen.value = false;
  }, 200);
};
</script>

<template>
  <div class="search-container">
    <div class="input-wrapper">
      <input 
        v-model="query" 
        type="text" 
        placeholder="Search Programs or Efforts..." 
        class="search-input"
        @input="handleInput"
        @focus="isOpen = true"
        @blur="handleBlur"
      />
      <span class="search-icon"><BaseIcon :path="mdiMagnify" :size="14" /></span>
    </div>
    
    <ul v-if="isOpen && filteredItems.length" class="suggestions-list">
      <li 
        v-for="item in filteredItems" 
        :key="item.value" 
        @click="selectItem(item)"
        class="suggestion-item"
      >
        <div class="item-content">
             <div class="item-row primary">
                 <span class="item-name">{{ item.name }}</span>
             </div>
             <div class="item-row secondary">
                 <span class="item-type-badge" :class="{ program: !item.isSoftwareEffort }">
                    {{ item.isSoftwareEffort ? 'Effort' : 'Program' }}
                 </span>
                 <span v-if="item.programName" class="item-context">{{ item.programName }}</span>
                 <span class="item-id">ID: {{ item.value }}</span>
             </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.search-container {
  position: relative;
  width: 320px; /* Slightly wider */
}

.input-wrapper {
  position: relative;
}

.search-input {
  width: 100%;
  padding: 10px 16px 10px 40px;
  background: var(--md-sys-color-surface);
  color: var(--md-sys-color-on-surface);
  border: 1px solid var(--md-sys-color-outline);
  border-radius: 24px;
  font-size: 14px;
  outline: none;
  transition: all 0.2s;
  box-sizing: border-box;
  height: 44px;
}

.search-input:focus {
  border-color: var(--md-sys-color-primary);
  background: var(--md-sys-color-surface-container-low);
  box-shadow: 0 0 0 1px var(--md-sys-color-primary);
}

.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0.6;
  font-size: 14px;
  color: var(--md-sys-color-on-surface);
  pointer-events: none;
}

.suggestions-list {
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;
  background: var(--md-sys-color-surface-container-high);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 12px;
  margin-top: 6px;
  padding: 4px;
  list-style: none;
  box-shadow: var(--md-sys-elevation-level2);
  z-index: 1000;
  max-height: 400px;
  overflow-y: auto;
}

.suggestion-item {
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.1s;
}

.suggestion-item:hover {
  background: var(--md-sys-color-surface-container-highest);
}

.item-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.item-row {
    display: flex;
    align-items: center;
    gap: 8px;
}

.item-row.primary {
    justify-content: space-between;
}

.item-name {
  font-weight: 500;
  color: var(--md-sys-color-on-surface);
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-row.secondary {
    font-size: 11px;
    color: var(--md-sys-color-secondary);
}

.item-type-badge {
  font-weight: 600;
  text-transform: uppercase;
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--md-sys-color-tertiary-container);
  color: var(--md-sys-color-on-tertiary-container);
  width: fit-content;
}

.item-type-badge.program {
    background: var(--md-sys-color-secondary-container);
    color: var(--md-sys-color-on-secondary-container);
}

.item-context {
    color: var(--md-sys-color-on-surface-variant);
    opacity: 0.8;
}

.item-context::before {
    content: "•";
    margin-right: 8px;
    opacity: 0.5;
}

.item-id {
    margin-left: auto; /* Push to right */
    font-family: monospace;
    opacity: 0.7;
}
</style>
