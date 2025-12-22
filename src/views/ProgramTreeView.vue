<script setup>
import { watch, ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import OrgChart from '../components/OrgChart.vue';
import Legend from '../components/Legend.vue';
import { useProgramData } from '../composables/useProgramData.js';

const router = useRouter();
const route = useRoute();
const { chartData: rawChartData, selectedNode, selectNode, findNodeById } = useProgramData();
// We also need access to the store functions exposed via composable or import
// To avoid breaking useProgramData, let's import store directly for advanced features
import { useProgramCatalogStore } from '../store/programCatalogStore';
const store = useProgramCatalogStore();

const filterMode = ref('ALL'); // 'ALL' or 'SWE'

const chartData = computed(() => {
    if (filterMode.value === 'SWE') {
        const filtered = store.getSWEItems();
        // If filtered is empty/null, we might want to handle it, but OrgChart expects object.
        // If the filtering returns null (no match) and rawData is present, pass null/empty to chart.
        return filtered;
    }
    return rawChartData.value;
});

// Sync Selection -> URL
watch(selectedNode, (newNode) => {
    const currentId = route.query.program_id;
    const newId = newNode ? String(newNode.value) : undefined;

    if (currentId !== newId) {
        const query = { ...route.query };
        if (newId) {
            query.program_id = newId;
        } else {
            delete query.program_id;
        }
        router.replace({ query });
    }
});

// Sync URL -> Selection (Handle initial load and back/forward navigation)
watch(() => route.query.program_id, (newId) => {
    if (newId) {
        // Prevent unnecessary updates if already selected
        if (selectedNode.value && String(selectedNode.value.value) === String(newId)) return;

        const node = findNodeById(newId);
        if (node) {
            selectNode(node);
        }
    } else {
        // If query param is removed, clear selection
        if (selectedNode.value) {
            selectNode(null);
        }
    }
}, { immediate: true });

const handleNodeClick = (nodeData) => {
    selectNode(nodeData);
};

const chartRef = ref(null);

const handleReset = () => {
    // Clear selection state
    selectNode(null);
    // Call OrgChart reset
    if (chartRef.value) {
        chartRef.value.resetView();
    }
};
</script>

<template>
  <div class="chart-wrapper m3-card elevated">
    <div class="filter-bar">
        <label class="filter-label">Filter View:</label>
        <div class="toggle-group">
            <button 
                :class="{ active: filterMode === 'ALL' }" 
                @click="filterMode = 'ALL'"
            >
                All Programs
            </button>
            <button 
                :class="{ active: filterMode === 'SWE' }" 
                @click="filterMode = 'SWE'"
            >
                Software Efforts
            </button>
        </div>
        <div class="v-divider"></div>
        <button class="icon-btn" @click="handleReset" title="Reset View">
            <i class="fas fa-sync-alt"></i>
        </button>
    </div>
    <OrgChart 
        ref="chartRef"
        v-if="chartData" 
        :data="chartData" 
        :selected-id="selectedNode?.value" 
        @node-click="handleNodeClick" 
    />
    <div v-else class="empty-state">
        No software efforts found.
    </div>
    <div class="legend-wrapper">
        <Legend />
    </div>
  </div>
</template>

<style scoped>
.chart-wrapper {
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
    background: var(--md-sys-color-surface);
    border-radius: 12px;
}

.filter-bar {
    position: absolute;
    top: 1rem;
    left: 1rem;
    z-index: 5;
    background: rgba(255, 255, 255, 0.9);
    padding: 8px 16px;
    border-radius: 24px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.12);
    display: flex;
    align-items: center;
    gap: 12px;
}

.filter-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--md-sys-color-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.toggle-group {
    display: flex;
    background: var(--md-sys-color-surface-container-high);
    border-radius: 18px;
    padding: 2px;
}

.toggle-group button {
    border: none;
    background: transparent;
    padding: 6px 16px;
    border-radius: 16px;
    font-size: 13px;
    font-weight: 500;
    color: var(--md-sys-color-on-surface-variant);
    cursor: pointer;
    transition: all 0.2s ease;
}

.toggle-group button.active {
    background: var(--md-sys-color-secondary-container);
    color: var(--md-sys-color-on-secondary-container);
    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.toggle-group button:hover:not(.active) {
    background: rgba(0,0,0,0.05);
}

.v-divider {
    width: 1px;
    height: 24px;
    background: var(--md-sys-color-outline-variant);
}

.icon-btn {
    background: transparent;
    border: none;
    color: var(--md-sys-color-primary);
    cursor: pointer;
    font-size: 16px;
    padding: 8px;
    border-radius: 50%;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
}

.icon-btn:hover {
    background: var(--md-sys-color-surface-container-high);
}

.empty-state {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--md-sys-color-outline);
}

.legend-wrapper {
    position: absolute;
    bottom: 1rem;
    left: 1rem;
}
</style>
