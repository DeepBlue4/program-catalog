<script setup>
import { watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import OrgChart from '../components/OrgChart.vue';
import Legend from '../components/Legend.vue';
import { useProgramData } from '../composables/useProgramData.js';

const router = useRouter();
const route = useRoute();
const { chartData, selectedNode, selectNode, findNodeById } = useProgramData();

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
</script>

<template>
  <div class="chart-wrapper m3-card elevated">
    <OrgChart 
        v-if="chartData" 
        :data="chartData" 
        :selected-id="selectedNode?.value" 
        @node-click="handleNodeClick" 
    />
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

.legend-wrapper {
    position: absolute;
    bottom: 1rem;
    left: 1rem;
}
</style>
