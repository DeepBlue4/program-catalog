<script setup>
import { onMounted, computed, watch, ref } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router';
import SoftwareEffortsList from '../components/SoftwareEffortsList.vue';
import { useProgramData } from '../composables/useProgramData.js';

const route = useRoute();
const router = useRouter();
const { selectedNode, findNodeById, selectNode } = useProgramData();
const effortsList = ref(null);

// Get the program from the route
const programId = computed(() => route.params.programId);

const currentProgram = computed(() => {
    // If we have a selected node and it matches, use it (updates from store)
    if (selectedNode.value && selectedNode.value.value == programId.value) {
        return selectedNode.value;
    }
    // Fallback: search in store
    return findNodeById(programId.value);
});

// Sync store selection if accessing directly via URL
onMounted(() => {
    if (programId.value && (!selectedNode.value || selectedNode.value.value != programId.value)) {
        const node = findNodeById(programId.value);
        if (node) {
            selectNode(node);
        }
    }
});

watch(programId, (newId) => {
    if (newId) {
        const node = findNodeById(newId);
        if (node) selectNode(node);
    }
});

// Sync Data Load -> Selection (Race Condition Fix)
watch(currentProgram, (node) => {
    // If we have a computed program but it's not currently selected in the global store, select it.
    // This happens on page reload where useProgramData is empty initially.
    if (node && (!selectedNode.value || selectedNode.value.value != node.value)) {
        selectNode(node);
    }
}, { immediate: true });

const goBack = () => {
    // Navigate back to tree with program selected
    if (currentProgram.value) {
        router.push({ path: '/', query: { program_id: currentProgram.value.value } });
    } else {
        router.push('/');
    }
};

// Navigation Guards for Unsaved Changes
const handleNavigation = (to, from, next) => {
    if (effortsList.value && effortsList.value.isFormDirty) {
        effortsList.value.confirmNavigation(
            () => next(), 
            () => next(false)
        );
    } else {
        next();
    }
};

// Deep Linking Logic 
// 1. URL -> Selection (Initial Load & Navigation)
const syncSelectionFromUrl = () => {
    const targetId = route.query.effort_id;
    if (targetId && effortsList.value) {
        // Wait for next tick to ensure list is mounted/ready if needed, though ref check handles most
        effortsList.value.selectEffort(targetId);
    }
};

watch(() => route.query.effort_id, (newId) => {
    if (effortsList.value) {
        // Handle selection and deselection
        effortsList.value.selectEffort(newId || null);
    }
}, { immediate: true });

// 2. Selection -> URL (User Interaction)
const handleEffortSelection = (id) => {
    const currentId = route.query.effort_id;
    if (String(currentId) !== String(id)) {
        const query = { ...route.query };
        if (id) {
            query.effort_id = id;
        } else {
             delete query.effort_id;
        }
        router.replace({ query });
    }
};

// Wait for list to be mounted/updated
watch(effortsList, (val) => {
    if (val) syncSelectionFromUrl();
});

onBeforeRouteLeave(handleNavigation);
onBeforeRouteUpdate(handleNavigation);
</script>

<template>
  <div class="efforts-wrapper m3-card elevated">
      <div v-if="currentProgram" class="efforts-inner">
          <SoftwareEffortsList 
            ref="effortsList"
            :key="currentProgram.value"
            :program="currentProgram"
            :program-name="currentProgram.name" 
            :program-id="currentProgram.value" 
            :efforts="currentProgram.softwareEfforts"
            @back="goBack"
            @selection-change="handleEffortSelection"
          />
      </div>
      <div v-else class="loading-state">
          <p>Loading Program Data...</p>
          <button @click="goBack">Return to Catalog</button>
      </div>
  </div>
</template>

<style scoped>
.efforts-wrapper {
    width: 100%;
    height: 100%;
    background: var(--md-sys-color-surface);
    border-radius: 12px;
    overflow: hidden;
}

.efforts-inner {
    height: 100%;
}

.loading-state {
    padding: 2rem;
    text-align: center;
    color: var(--md-sys-color-secondary);
}
</style>
