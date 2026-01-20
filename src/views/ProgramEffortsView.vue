<script setup>
import { onMounted, computed, watch, ref } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router';
import SoftwareEffortsList from '../components/SoftwareEffortsList.vue';
import BaseIcon from '../components/BaseIcon.vue';
import { mdiMagnify, mdiArrowLeft, mdiRefresh } from '@mdi/js';
import { useProgramData } from '../composables/useProgramData.js';

import { useProgramCatalogStore } from '../store/programCatalogStore';

const route = useRoute();
const router = useRouter();
const { selectedNode, findNodeById, selectNode, loading, chartData } = useProgramData();
const store = useProgramCatalogStore(); // Init store
const effortsList = ref(null); // Restored ref for navigation guards
const showDebug = ref(false);

// Get the program from the route
const programId = computed(() => route.params.programId);

const currentProgram = computed(() => {
    // Force dependency on store updates (triggered by triggerRef in store actions)
    // We access it here so Vue knows to re-evaluate this computed when store.state.items is triggered.
     
     
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _tick = store.state.items; 

    // If we have a selected node and it matches, use it (updates from store)
    if (selectedNode.value && selectedNode.value.value == programId.value) {
        return selectedNode.value;
    }
    // Fallback: search in store
    return findNodeById(programId.value);
});

// Sync store selection if accessing directly via URL
onMounted(() => {
    console.log('[PEV] Mounted. ID:', programId.value);
    if (programId.value && (!selectedNode.value || selectedNode.value.value != programId.value)) {
        const node = findNodeById(programId.value);
        console.log('[PEV] Initial findNodeById result:', !!node);
        if (node) {
            selectNode(node);
        }
    }
});

watch(programId, (newId) => {
    console.log('[PEV] programId changed:', newId);
    if (newId) {
        const node = findNodeById(newId);
        if (node) selectNode(node);
    }
});

watch(currentProgram, (val) => {
    console.log('[PEV] currentProgram computed:', val ? val.name : 'null');
});

watch(loading, (val) => {
    console.log('[PEV] Loading state:', val);
});

// Sync Data Load -> Selection (Race Condition Fix)
watch(currentProgram, (node) => {
    // If we have a computed program but it's not currently selected in the global store, select it.
    // This happens on page reload where useProgramData is empty initially.
    if (node && (!selectedNode.value || selectedNode.value.value != node.value)) {
        selectNode(node);
    }
}, { immediate: true });

const retryFetch = () => {
   // Instead of just reload, try to fetch again via store?
   // Since useProgramData triggers fetch on init if missing, a reload is the safest "full reset"
   // but we could also try:
   // store.fetchItems(); 
   // For now, reload is robust.
   window.location.reload();
};

const goBack = () => {
    // Navigate back to tree with program selected
    // Use the ID from the route params to ensure we always have context
    const targetId = programId.value;
    
    if (targetId) {
        router.push({ path: '/', query: { program_id: targetId } });
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
// Deep Linking Logic 
// Selection -> URL (User Interaction)
const handleEffortSelection = (id) => {
    // If the event provides an ID, update URL. If ID is null (deleted/cleared), update URL.
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

const handleEffortDeletion = (id) => {
   // We need to remove it from the reactive graph so the list updates immediately
   // without waiting for a full refetch (though refetch would be safer).
   // `currentProgram` matches `selectedNode` from `useProgramData`.
   if (currentProgram.value && currentProgram.value.softwareEfforts) {
       const idx = currentProgram.value.softwareEfforts.findIndex(e => e.id === id);
       if (idx !== -1) {
           currentProgram.value.softwareEfforts.splice(idx, 1);
       }
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
            :program="currentProgram"
            :program-name="currentProgram.name" 
            :program-id="currentProgram.program_id" 
            :efforts="currentProgram.softwareEfforts"
            :selected-id="route.query.effort_id"
            @back="goBack"
            @selection-change="handleEffortSelection"
            @effort-deleted="handleEffortDeletion"
          />
      </div>
      <div v-else class="state-container">
          <!-- Loading State -->
          <div v-if="loading" class="state-content">
              <div class="spinner"></div>
              <p class="state-text">Loading Program Data...</p>
          </div>

          <!-- Error / Not Found State -->
          <div v-else class="state-content error-state">
              <div class="icon-circle error">
                  <BaseIcon :path="mdiMagnify" />
              </div>
              <h3 class="state-title">Program Not Found</h3>
              <p class="state-description">
                  We couldn't find a program with ID <strong>{{ programId }}</strong>. 
                  It may have been removed or you may have an invalid link.
              </p>
              
              <!-- Action Buttons -->
              <div class="state-actions">
                  <button class="btn-filled" @click="goBack">
                      <BaseIcon :path="mdiArrowLeft" /> Return to Catalog
                  </button>
                  <button class="btn-outlined" @click="retryFetch">
                      <BaseIcon :path="mdiRefresh" /> Retry
                  </button>
              </div>

              <!-- Collapsible Debug Info -->
              <div class="debug-toggle" @click="showDebug = !showDebug">
                  {{ showDebug ? 'Hide Debug Info' : 'Show Debug Info' }}
              </div>
              <div v-if="showDebug" class="debug-info m3-card outlined">
                  <p><strong>Program ID:</strong> {{ programId }}</p>
                  <p><strong>Loading:</strong> {{ loading }}</p>
                  <p><strong>Total Items in Store:</strong> {{ chartData ? (Array.isArray(chartData) ? chartData.length : 1) : 'null' }}</p>
              </div>
          </div>
      </div>
  </div>
</template>

<style scoped>
.efforts-wrapper {
    width: 100%;
    height: 100%;
    background: #FEF7FF; /* surface */
    border-radius: 12px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.efforts-inner {
    height: 100%;
    flex: 1;
}

.state-container {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    background: #FEF7FF; /* surface */
}

.state-content {
    text-align: center;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
}

.icon-circle {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    margin-bottom: 0.5rem;
}

.icon-circle.error {
    background: #FFDAD6; /* error-container */
    color: #410002; /* on-error-container */
}

.spinner {
    width: 48px;
    height: 48px;
    border: 4px solid #ECE6F0; /* surface-container-high */
    border-top: 4px solid #005AC1; /* primary */
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
}

.state-title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 500;
    color: #1D1B20; /* on-surface */
}

.state-text {
    font-size: 1.1rem;
    color: #625B71; /* secondary */
}

.state-description {
    margin: 0;
    color: #49454F; /* on-surface-variant */
    line-height: 1.5;
}

.state-actions {
    display: flex;
    gap: 1rem;
    margin-top: 0.5rem;
}

.btn-filled {
    background: #005AC1; /* primary */
    color: #FFFFFF; /* on-primary */
    border: none;
    padding: 10px 24px;
    border-radius: 100px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s;
}

.btn-filled:hover {
    box-shadow: 0px 1px 3px 1px rgba(0, 0, 0, 0.15), 0px 1px 2px 0px rgba(0, 0, 0, 0.3); /* elevation-level1 */
    transform: translateY(-1px);
}

.btn-outlined {
    background: transparent;
    border: 1px solid #79747E; /* outline */
    color: #005AC1; /* primary */
    padding: 10px 24px;
    border-radius: 100px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s;
}

.btn-outlined:hover {
    background: #F3EDF7; /* surface-container */
}

.debug-toggle {
    margin-top: 2rem;
    font-size: 0.75rem;
    color: #79747E; /* outline */
    cursor: pointer;
    text-decoration: underline;
}

.debug-info {
    margin-top: 1rem;
    padding: 1rem;
    width: 100%;
    background: #F7F2FA; /* surface-container-low */
    text-align: left;
    font-family: monospace;
    font-size: 0.75rem;
    border-radius: 8px;
    border: 1px solid #C4C7C5; /* outline-variant */
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
</style>
