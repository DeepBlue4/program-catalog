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

onBeforeRouteLeave(handleNavigation);
onBeforeRouteUpdate(handleNavigation);
</script>

<template>
  <div class="efforts-wrapper m3-card elevated">
      <div v-if="currentProgram" class="efforts-inner">
          <SoftwareEffortsList 
            ref="effortsList"
            :key="currentProgram.value"
            :program-name="currentProgram.name" 
            :program-id="currentProgram.value" 
            :efforts="currentProgram.softwareEfforts"
            @back="goBack"
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
