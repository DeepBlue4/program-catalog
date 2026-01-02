<script setup>
import { computed, ref } from 'vue';

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

// Helper for status colors
const getStatusLabel = (effort) => effort.status || 'Active';

const getStatusColor = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'active') return 'var(--md-sys-color-primary)';
    if (s === 'maintenance') return 'var(--md-sys-color-secondary)';
    return 'var(--md-sys-color-outline)'; // Dot color
};
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
                <i v-if="isExpanded" class="fas fa-caret-down"></i>
                <i v-else class="fas fa-caret-right"></i>
             </div>
             
             <div class="status-dot" :style="{ backgroundColor: getStatusColor(effort.status) }"></div>

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
    background: var(--md-sys-color-surface-container-high);
}

.node-row.selected {
    background: var(--md-sys-color-secondary-container);
    color: var(--md-sys-color-on-secondary-container);
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
    color: var(--md-sys-color-secondary);
    border-radius: 4px;
}

.expand-control:hover {
    background: rgba(0,0,0,0.1);
}

.status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
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
    background-color: var(--md-sys-color-outline-variant);
}
</style>
