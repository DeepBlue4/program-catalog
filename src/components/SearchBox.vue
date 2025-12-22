<script setup>
import { ref, computed } from 'vue';

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
    item.name.toLowerCase().includes(lowerQuery)
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
        placeholder="Search Programs..." 
        class="search-input"
        @input="handleInput"
        @focus="isOpen = true"
        @blur="handleBlur"
      />
      <span class="search-icon"><i class="fas fa-magnifying-glass"></i></span>
    </div>
    
    <ul v-if="isOpen && filteredItems.length" class="suggestions-list">
      <li 
        v-for="item in filteredItems" 
        :key="item.value" 
        @click="selectItem(item)"
        class="suggestion-item"
      >
        <span class="item-name">{{ item.name }}</span>
        <span class="item-id">#{{ item.value }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.search-container {
  position: relative;
  width: 300px;
}

.input-wrapper {
  position: relative;
}

.search-input {
  width: 100%;
  padding: 0.5rem 1rem 0.5rem 2.5rem; /* Left padding for icon */
  background: var(--md-sys-color-surface);
  color: var(--md-sys-color-on-surface);
  border: 1px solid var(--md-sys-color-outline);
  border-radius: 20px;
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.search-input:focus {
  border-color: var(--md-sys-color-primary);
  background: var(--md-sys-color-surface-container-low);
}

.search-icon {
  position: absolute;
  left: 0.8rem;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0.5;
  font-size: 0.9rem;
  color: var(--md-sys-color-on-surface);
}

.suggestions-list {
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;
  background: var(--md-sys-color-surface-container-high);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 8px;
  margin-top: 4px;
  padding: 0;
  list-style: none;
  box-shadow: 0 2px 6px rgba(0,0,0,0.15); /* Elevation 2 approx */
  z-index: 1000;
  overflow: hidden;
}

.suggestion-item {
  padding: 0.5rem 1rem;
  display: flex;
  justify-content: space-between;
  cursor: pointer;
  transition: background 0.1s;
}

.suggestion-item:hover {
  background: var(--md-sys-color-surface-container-highest);
}

.item-name {
  font-weight: 500;
  color: var(--md-sys-color-on-surface);
}

.item-id {
  font-size: 0.8rem;
  color: var(--md-sys-color-secondary);
}
</style>
