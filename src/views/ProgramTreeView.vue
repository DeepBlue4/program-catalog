<script setup>
import { watch, ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import OrgChart from '../components/OrgChart.vue';
import Legend from '../components/Legend.vue';
import BaseIcon from '../components/BaseIcon.vue';
import { mdiRefresh } from '@mdi/js';
import { useProgramData } from '../composables/useProgramData.js';

const router = useRouter();
const route = useRoute();
const { chartData: rawChartData, sweChartData, selectedNode, selectNode, findNodeById } = useProgramData();
// We also need access to the store functions exposed via composable or import
// To avoid breaking useProgramData, let's import store directly for advanced features
import { useProgramCatalogStore } from '../store/programCatalogStore';
const store = useProgramCatalogStore();

const filterMode = ref('ALL'); // 'ALL' or 'SWE'

const chartData = computed(() => {
    if (filterMode.value === 'SWE') {
        // Use normalized SWE data from composable
        return sweChartData.value;
    }
    return rawChartData.value;
});

// Sync Selection -> URL
watch(selectedNode, (newNode) => {
    const currentId = route.query.program_id;
    const newId = newNode ? String(newNode.program_id) : undefined;

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
        if (selectedNode.value && String(selectedNode.value.program_id) === String(newId)) return;

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

// Sync Data Load -> Selection (Race Condition Fix)
// If URL has ID but data wasn't ready during immediate route watch, try again when data loads.
watch(chartData, (newData) => {
    const targetId = route.query.program_id;
    // Check if we need to sync:
    // 1. Data is available
    // 2. We have a target ID in URL
    // 3. AND (We have no selection OR selection doesn't match target)
    if (newData && targetId) {
        if (!selectedNode.value || String(selectedNode.value.program_id) !== String(targetId)) {
            const node = findNodeById(targetId);
            if (node) selectNode(node);
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
    <!-- Loading Overlay -->
    <div v-if="store.state.loading" class="loading-overlay">
        <div class="spinner"></div>
        <span>Loading Catalog...</span>
    </div>

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
                Software Programs
            </button>
        </div>
        <div class="v-divider"></div>
        <button class="icon-btn" @click="handleReset" title="Reset View">
            <BaseIcon :path="mdiRefresh" />
        </button>
    </div>
    
    <div class="chart-container">
        <OrgChart 
            v-if="chartData"
            ref="chartRef"
            :data="chartData" 
            :selected-id="selectedNode ? selectedNode.program_id : null"
            @node-click="handleNodeClick" 
        />
        <div v-else class="empty-state">
            No program data available.
        </div>
        <div class="legend-wrapper">
            <Legend />
        </div>
    </div>
  </div>
</template>

<style scoped>
.chart-wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #FEF7FF; /* surface */
    border-radius: 12px;
    overflow: hidden;
    position: relative;
    border: 1px solid #C4C7C5; /* outline-variant */
}

.loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.8);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 100;
    gap: 1rem;
    color: #005AC1; /* primary */
    font-weight: 500;
}

.spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #ECE6F0; /* surface-container-high */
    border-top: 4px solid #005AC1; /* primary */
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
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
    color: #625B71; /* secondary */
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.toggle-group {
    display: flex;
    background: #ECE6F0; /* surface-container-high */
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
    color: #49454F; /* on-surface-variant */
    cursor: pointer;
    transition: all 0.2s ease;
}

.toggle-group button.active {
    background: #DAE2F9; /* secondary-container */
    color: #131C2B; /* on-secondary-container */
    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.toggle-group button:hover:not(.active) {
    background: rgba(0,0,0,0.05);
}

.v-divider {
    width: 1px;
    height: 24px;
    background: #C4C7C5; /* outline-variant */
}

.icon-btn {
    background: transparent;
    border: none;
    color: #005AC1; /* primary */
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
    background: #ECE6F0; /* surface-container-high */
}

.empty-state {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #79747E; /* outline */
}

.chart-container {
    flex: 1;
    position: relative;
    overflow: hidden;
}

.legend-wrapper {
    position: absolute;
    bottom: 1rem;
    left: 1rem;
    z-index: 100;
}
</style>
