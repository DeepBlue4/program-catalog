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
const activeFilter = ref('all');

const filters = [
    { label: 'All', value: 'all' },
    { label: 'Programs', value: 'program' },
    { label: 'Efforts', value: 'effort' }
];

const filteredItems = computed(() => {
  if (!query.value) return [];
  const lowerQuery = query.value.toLowerCase();
  
  return props.items.filter(item => {
    // 1. Check Filter
    if (activeFilter.value === 'program' && item.isSoftwareEffort) return false;
    if (activeFilter.value === 'effort' && !item.isSoftwareEffort) return false;

    // 2. Check Query
    return item.name.toLowerCase().includes(lowerQuery) || 
           String(item.value).toLowerCase().includes(lowerQuery);
  }).slice(0, 10); // Limit to 10 suggestions
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
        class="std-input search-input-override"
        @input="handleInput"
        @focus="isOpen = true"
        @blur="handleBlur"
      />
      <span class="search-icon"><BaseIcon :path="mdiMagnify" :size="14" /></span>
    </div>
    
    <div v-if="isOpen && query" class="suggestions-dropdown">
       <!-- Filter Bar -->
       <div class="filter-bar">
           <span 
                v-for="filter in filters" 
                :key="filter.value"
                class="filter-chip"
                :class="{ active: activeFilter === filter.value }"
                @mousedown.prevent="activeFilter = filter.value"
            >
                {{ filter.label }}
           </span>
       </div>

        <ul v-if="filteredItems.length" class="suggestions-list">
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
        <div v-else class="no-results">
            No results found for "{{ query }}" in {{ activeFilter === 'all' ? 'All' : activeFilter === 'program' ? 'Programs' : 'Efforts' }}.
        </div>
    </div>
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

.search-input-override {
  padding-left: 40px !important; /* Space for icon */
  border-radius: 24px; /* Maintain pill shape for search, or use 8px for strict consistency? strict consistency = 8px */
  border-radius: 8px !important;
}

.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0.6;
  font-size: 14px;
  color: #1D1B20; /* on-surface */
  pointer-events: none;
}

.suggestions-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;
  background: #ECE6F0; /* surface-container-high */
  border: 1px solid #C4C7C5; /* outline-variant */
  border-radius: 12px;
  margin-top: 6px;
  box-shadow: 0px 2px 6px 2px rgba(0, 0, 0, 0.15), 0px 1px 2px 0px rgba(0, 0, 0, 0.3); /* elevation-2 */
  z-index: 1000;
  overflow: hidden;
}

.filter-bar {
    display: flex;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid #C4C7C5;
    background: #F3EDF7; /* surface-container */
}

.filter-chip {
    font-size: 11px;
    font-weight: 500;
    padding: 2px 10px;
    border-radius: 12px;
    border: 1px solid #79747E;
    color: #49454F;
    cursor: pointer;
    transition: 0.2s;
}

.filter-chip:hover {
    background: #E8DEF8;
}

.filter-chip.active {
    background: #E8DEF8; /* secondary-container */
    color: #1D192B; /* on-secondary-container */
    border-color: transparent;
}

.suggestions-list {
  padding: 4px;
  list-style: none;
  max-height: 400px;
  overflow-y: auto;
  margin: 0;
}

.suggestion-item {
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.1s;
}

.suggestion-item:hover {
  background: #E6E0E9; /* surface-container-highest */
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
  color: #1D1B20; /* on-surface */
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-row.secondary {
    font-size: 11px;
    color: #625B71; /* secondary */
}

.item-type-badge {
  font-weight: 600;
  text-transform: uppercase;
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 4px;
  background: #FFDF90; /* tertiary-container */
  color: #241A00; /* on-tertiary-container */
  width: fit-content;
}

.item-type-badge.program {
    background: #DBE2F9; /* secondary-container */
    color: #1D192B; /* on-secondary-container */
}

.item-context {
    color: #49454F; /* on-surface-variant */
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

.no-results {
    padding: 16px;
    text-align: center;
    color: #49454F; /* on-surface-variant */
    font-size: 13px;
    font-style: italic;
}
</style>
