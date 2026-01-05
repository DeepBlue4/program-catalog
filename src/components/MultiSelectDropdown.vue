<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import BaseIcon from './BaseIcon.vue';
import { mdiMenuDown, mdiClose, mdiMagnify, mdiCheck } from '@mdi/js';

const props = defineProps({
    modelValue: {
        type: Array,
        default: () => []
    },
    options: {
        type: Array,
        default: () => []
    },
    label: {
        type: String,
        default: ''
    },
    placeholder: {
        type: String,
        default: 'Select options...'
    },
    disabled: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['update:modelValue']);

const isOpen = ref(false);
const containerRef = ref(null);
const searchQuery = ref('');

// Close dropdown when clicking outside
const handleClickOutside = (event) => {
    if (containerRef.value && !containerRef.value.contains(event.target)) {
        isOpen.value = false;
    }
};

onMounted(() => document.addEventListener('click', handleClickOutside));
onUnmounted(() => document.removeEventListener('click', handleClickOutside));

const toggleDropdown = () => {
    if (props.disabled) return;
    isOpen.value = !isOpen.value;
    if (isOpen.value) {
        // dynamic positioning could go here, for now simpler relative
        searchQuery.value = ''; // Reset search on open
    }
};

const filteredOptions = computed(() => {
    if (!searchQuery.value) return props.options;
    const query = searchQuery.value.toLowerCase();
    return props.options.filter(opt => 
        String(opt).toLowerCase().includes(query)
    );
});

const isSelected = (option) => {
    return props.modelValue.includes(option);
};

const toggleOption = (option) => {
    const newValue = [...props.modelValue];
    const index = newValue.indexOf(option);
    
    if (index === -1) {
        newValue.push(option);
    } else {
        newValue.splice(index, 1);
    }
    emit('update:modelValue', newValue);
};

const removeOption = (option) => {
    const newValue = props.modelValue.filter(v => v !== option);
    emit('update:modelValue', newValue);
};
</script>

<template>
    <div class="multi-select-container" ref="containerRef" :class="{ disabled }">
        <label v-if="label" class="field-label">{{ label }}</label>
        
        <div 
            class="select-trigger" 
            :class="{ active: isOpen, 'has-selection': modelValue.length > 0 }"
            @click="toggleDropdown"
        >
            <div class="trigger-content">
                <span v-if="modelValue.length === 0" class="placeholder">{{ placeholder }}</span>
                
                <div v-else class="chips-wrapper">
                    <span 
                        v-for="item in modelValue" 
                        :key="item" 
                        class="select-chip"
                        @click.stop
                    >
                        {{ item }}
                        <button class="chip-remove" @click.stop="removeOption(item)">
                            <BaseIcon :path="mdiClose" :size="14" />
                        </button>
                    </span>
                </div>
            </div>
            
            <div class="trigger-icon">
                <BaseIcon :path="mdiMenuDown" />
            </div>
        </div>

        <transition name="dropdown-fade">
            <div v-if="isOpen" class="dropdown-menu m3-card elevated">
                <!-- Search Bar -->
                <div class="dropdown-search">
                     <BaseIcon :path="mdiMagnify" :size="18" class="search-icon" />
                     <input 
                        v-model="searchQuery" 
                        type="text" 
                        class="search-input" 
                        placeholder="Search..."
                        @click.stop
                    >
                </div>

                <div class="options-list">
                    <div 
                        v-for="opt in filteredOptions" 
                        :key="opt" 
                        class="dropdown-option"
                        :class="{ selected: isSelected(opt) }"
                        @click.stop="toggleOption(opt)"
                    >
                        <div class="checkbox-custom">
                            <BaseIcon v-if="isSelected(opt)" :path="mdiCheck" :size="14" />
                        </div>
                        <span class="option-label">{{ opt }}</span>
                    </div>
                    <div v-if="filteredOptions.length === 0" class="no-results">
                        No results found.
                    </div>
                </div>
            </div>
        </transition>
    </div>
</template>

<style scoped>
.multi-select-container {
    position: relative;
    width: 100%;
    margin-bottom: 4px;
}

.multi-select-container.disabled {
    opacity: 0.6;
    pointer-events: none;
}

.field-label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: var(--md-sys-color-secondary);
    margin-bottom: 6px;
    text-transform: uppercase;
}

.select-trigger {
    background: var(--md-sys-color-surface-container-lowest);
    border: 1px solid var(--md-sys-color-outline);
    border-radius: 6px;
    padding: 6px 36px 6px 8px; /* Right padding for arrow */
    min-height: 42px;
    display: flex;
    align-items: center;
    cursor: pointer;
    position: relative;
    transition: all 0.2s;
}

.select-trigger:hover {
    border-color: var(--md-sys-color-outline-variant);
    background: var(--md-sys-color-surface-container-low);
}

.select-trigger.active {
    border-color: var(--md-sys-color-primary);
    box-shadow: 0 0 0 1px var(--md-sys-color-primary);
    background: var(--md-sys-color-surface);
}

.trigger-content {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.placeholder {
    color: var(--md-sys-color-on-surface-variant);
    font-size: 14px;
    padding-left: 4px;
    opacity: 0.7;
}

.trigger-icon {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--md-sys-color-secondary);
    pointer-events: none;
}

/* Chips */
.chips-wrapper {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.select-chip {
    display: flex;
    align-items: center;
    background: var(--md-sys-color-secondary-container);
    color: var(--md-sys-color-on-secondary-container);
    font-size: 13px;
    font-weight: 500;
    padding: 2px 8px;
    border-radius: 12px;
    gap: 6px;
}

.chip-remove {
    background: rgba(0,0,0,0.1);
    border: none;
    border-radius: 50%;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: inherit;
    padding: 0;
}

.chip-remove:hover {
    background: rgba(0,0,0,0.2);
}

/* Dropdown */
.dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 4px;
    background: var(--md-sys-color-surface-container);
    border-radius: 8px;
    z-index: 100;
    border: 1px solid var(--md-sys-color-outline-variant);
    overflow: hidden;
    max-height: 300px;
    display: flex;
    flex-direction: column;
}

.dropdown-search {
    padding: 8px;
    border-bottom: 1px solid var(--md-sys-color-outline-variant);
    display: flex;
    align-items: center;
    gap: 8px;
}

.search-input {
    background: transparent;
    border: none;
    color: var(--md-sys-color-on-surface);
    font-size: 14px;
    width: 100%;
    font-family: inherit;
}

.search-input:focus {
    outline: none;
}

.search-icon {
    color: var(--md-sys-color-secondary);
}

.options-list {
    overflow-y: auto;
    max-height: 250px;
    padding: 4px 0;
}

.dropdown-option {
    padding: 8px 12px;
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    font-size: 14px;
    color: var(--md-sys-color-on-surface);
    transition: background 0.1s;
}

.dropdown-option:hover {
    background: var(--md-sys-color-surface-container-high);
}

.dropdown-option.selected {
    background: var(--md-sys-color-secondary-container);
    color: var(--md-sys-color-on-secondary-container);
}

.checkbox-custom {
    width: 18px;
    height: 18px;
    border: 2px solid var(--md-sys-color-outline);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}

.dropdown-option.selected .checkbox-custom {
    background: var(--md-sys-color-primary);
    border-color: var(--md-sys-color-primary);
    color: var(--md-sys-color-on-primary);
}

.no-results {
    padding: 12px;
    text-align: center;
    font-size: 13px;
    color: var(--md-sys-color-on-surface-variant);
    opacity: 0.7;
}

/* Transitions */
.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
    transition: opacity 0.2s, transform 0.2s;
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
    opacity: 0;
    transform: translateY(-8px);
}
</style>
