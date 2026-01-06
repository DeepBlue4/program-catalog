<script setup>
import { computed, ref, watch } from 'vue';
import BaseIcon from './BaseIcon.vue';
import { mdiMenuDown, mdiMenuRight } from '@mdi/js';

const props = defineProps({
  effort: {
    type: Object,
    required: true
  },
  depth: {
    type: Number,
    default: 0
  },
  selectedId: {
    type: [String, Number],
    default: null
  }
});

const emit = defineEmits(['select', 'toggle']);

const isExpanded = ref(true);

// Recursive helper to check if this node contains the selected ID
const hasDescendant = (node, id) => {
    if (!node || !id) return false;
    if (String(node.id) === String(id)) return true;
    if (node.children && node.children.length > 0) {
        return node.children.some(child => hasDescendant(child, id));
    }
    return false;
};

// Auto-expand if selection is inside this node
watch(() => props.selectedId, (newId) => {
    if (newId && hasDescendant(props.effort, newId)) {
        isExpanded.value = true;
    }
}, { immediate: true });

const toggleExpand = (e) => {
    e.stopPropagation(); // Don't trigger selection
    if (hasChildren.value) {
        isExpanded.value = !isExpanded.value;
    }
};

const handleSelect = () => {
    emit('select', props.effort);
};

const hasChildren = computed(() => props.effort.children && props.effort.children.length > 0);
const isSelected = computed(() => String(props.effort.id) === String(props.selectedId));



</script>

<template>
  <div class="tree-item">
    <!-- Node Row -->
    <div class="node-row" 
         :class="{ 'selected': isSelected }"
         @click="handleSelect">
         
        <!-- Indentation & Expand Toggle -->
        <div class="node-content">
             <div class="expand-control" @click="toggleExpand" :style="{ visibility: hasChildren ? 'visible' : 'hidden' }">
                <BaseIcon v-if="isExpanded" :path="mdiMenuDown" :size="20" />
                <BaseIcon v-else :path="mdiMenuRight" :size="20" />
             </div>
             

             <div class="info">
                 <span class="name">{{ effort.name }}</span>
                 <span class="type-badge">{{ effort.type }}</span>
             </div>
        </div>
    </div>

    <!-- Children Container -->
    <div v-if="hasChildren && isExpanded" class="children-container">
        <!-- Vertical Line Guide -->
        <div class="vertical-guide"></div>
        
        <SoftwareEffortTreeItem 
            v-for="child in effort.children" 
            :key="child.id" 
            :effort="child"
            :depth="depth + 1"
            :selected-id="selectedId"
            @select="$emit('select', $event)"
        />
    </div>
  </div>
</template>

<style scoped>
.tree-item {
    display: flex;
    flex-direction: column;
    position: relative;
}

.node-row {
    display: flex;
    align-items: center;
    padding: 8px 12px 8px 4px;
    cursor: pointer;
    border-radius: 6px;
    transition: background 0.2s;
    user-select: none;
    margin-bottom: 2px;
}

.node-row:hover {
    background: #ECE6F0; /* surface-container-high */
}

.node-row.selected {
    background: #DBE2F9; /* secondary-container */
    color: #1D192B; /* on-secondary-container */
}

.node-content {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
}

.expand-control {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: #625B71; /* secondary */
    border-radius: 4px;
}

.expand-control:hover {
    background: rgba(0,0,0,0.1);
}



.info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow: hidden;
}

.name {
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.type-badge {
    font-size: 10px;
    text-transform: uppercase;
    opacity: 0.7;
}

/* --- Hierarchy Lines --- */
.children-container {
    position: relative;
    padding-left: 12px; 
    margin-left: 10px; /* Align deeply */
}

.vertical-guide {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 1px;
    background-color: #C4C7C5; /* outline-variant */
}
</style>
