<script setup>
import { ref, computed } from 'vue';
import SoftwareEffortForm from './SoftwareEffortForm.vue';
import SoftwareEffortTreeItem from './SoftwareEffortTreeItem.vue';
import ConfirmationModal from './ConfirmationModal.vue';

const props = defineProps({
  programName: { type: String, required: true },
  programId: { type: [String, Number], required: true },
  efforts: { type: Array, default: () => [] }
});

const emit = defineEmits(['back']);

const showModal = ref(false);
const showDeleteModal = ref(false);
const showUnsavedChangesModal = ref(false);
const editingEffort = ref(null);
const selectedEffortId = ref(null);
const itemToDelete = ref(null);
const isFormDirty = ref(false); 
const pendingConfirm = ref(null);
const pendingCancel = ref(null);

const handleDirtyChange = (isDirty) => {
    isFormDirty.value = isDirty;
};

const triggerActionWithCheck = (onConfirm, onCancel = null) => {
    if (isFormDirty.value) {
        pendingConfirm.value = onConfirm;
        pendingCancel.value = onCancel;
        showUnsavedChangesModal.value = true;
    } else {
        onConfirm();
    }
};

const confirmUnsavedChanges = () => {
    isFormDirty.value = false; 
    showUnsavedChangesModal.value = false;
    if (pendingConfirm.value) {
        pendingConfirm.value();
    }
    pendingConfirm.value = null;
    pendingCancel.value = null;
};

const cancelUnsavedChanges = () => {
    showUnsavedChangesModal.value = false;
    if (pendingCancel.value) {
        pendingCancel.value();
    }
    pendingConfirm.value = null;
    pendingCancel.value = null;
};

// --- Tree Building Logic ---
const effortTree = computed(() => {
    const map = {};
    const roots = [];
    
    // Shallow copy for tree construction, preserving references to original objects
    const nodes = props.efforts.map(e => ({ ...e, children: [] }));
    
    nodes.forEach(node => { map[node.id] = node; });

    nodes.forEach(node => {
        if (node.parent && map[node.parent]) {
            map[node.parent].children.push(node);
        } else {
            roots.push(node);
        }
    });
    return roots;
});

const selectedEffort = computed(() => {
    return props.efforts.find(e => e.id === selectedEffortId.value);
});

// Select tree item
const handleSelect = (effort) => {
    if (selectedEffortId.value === effort.id) return;
    
    triggerActionWithCheck(() => {
        selectedEffortId.value = effort.id;
    });
};

const handleCreate = () => {
    triggerActionWithCheck(() => {
         editingEffort.value = null;
         showModal.value = true;
    });
};

const handleEdit = () => {
    // Edit mode is now default in the main panel
};

const handleDelete = (effort) => {
    const target = effort || selectedEffort.value;
    if (!target) return;
    
    itemToDelete.value = target;
    showDeleteModal.value = true;
};

const confirmDelete = () => {
    if (itemToDelete.value) {
        const index = props.efforts.findIndex(e => e.id === itemToDelete.value.id);
        if (index !== -1) {
            props.efforts.splice(index, 1);
            if (selectedEffortId.value === itemToDelete.value.id) {
                selectedEffortId.value = null; 
                isFormDirty.value = false;
            }
        }
    }
    showDeleteModal.value = false;
    itemToDelete.value = null;
    showModal.value = false; 
};

const saveEffort = (effortData) => {
    if (effortData.id) {
        // Update existing
        const index = props.efforts.findIndex(e => e.id === effortData.id);
        if (index !== -1) {
             Object.assign(props.efforts[index], effortData);
        }
    } else {
        // Create new
        const newId = `EFF-${props.programId}-${Date.now()}`;
        const newEffort = { ...effortData, id: newId };
        props.efforts.push(newEffort);
        selectedEffortId.value = newId;
    }
    showModal.value = false;
    isFormDirty.value = false;
};

const handleBack = () => {
    triggerActionWithCheck(() => {
        emit('back'); 
    });
};

const confirmNavigation = (onConfirm, onCancel) => {
    triggerActionWithCheck(onConfirm, onCancel);
};

// Expose checks to parent view
defineExpose({
    isFormDirty,
    confirmNavigation
});

</script>

<template>
  <div class="efforts-view">
    <div class="header-section">
      <div class="actions-row">
          <button class="btn-outlined" @click="handleBack">
            <i class="fas fa-arrow-left"></i> Back to Catalog
          </button>
          <button class="btn-filled" @click="handleCreate">
              <i class="fas fa-plus"></i> New Effort
          </button>
      </div>
      <div class="title-block">
          <h2 class="page-title">Software Efforts <span class="program-ref">- {{ programName }}</span></h2>
      </div>
    </div>

    <div class="master-detail-container">
        <!-- Sidebar: Hierarchical Tree -->
        <div class="tree-sidebar m3-card outlined">
            <h3 class="panel-title">Hierarchy</h3>
            <div class="tree-content">
                <SoftwareEffortTreeItem 
                    v-for="rootNode in effortTree" 
                    :key="rootNode.id" 
                    :effort="rootNode" 
                    :selected-id="selectedEffortId"
                    @select="handleSelect"
                />
                <div v-if="efforts.length === 0" class="empty-tree">
                    No efforts found.
                </div>
            </div>
        </div>

        <!-- Main Panel: Detail View -->
        <main class="detail-panel m3-card elevated">
            <div v-if="selectedEffort" class="detail-content-wrapper">
                 <SoftwareEffortForm
                    :effort="selectedEffort"
                    :available-parents="efforts"
                    :is-edit="true"
                    @save="saveEffort"
                    @delete="handleDelete"
                    @dirty-change="handleDirtyChange"
                 />
            </div>
            
            <div v-else class="empty-detail">
                <span class="icon"><i class="fas fa-hand-point-left"></i></span>
                <p>Select a Software Effort from the hierarchy to view or edit details.</p>
            </div>
        </main>
    </div>

    <!-- Modal Overlay -->
    <div v-if="showModal" class="modal-overlay">
        <SoftwareEffortForm 
            :effort="editingEffort || undefined" 
            :available-parents="efforts"
            :is-edit="!!editingEffort && !!editingEffort.id"
            @save="saveEffort"
            @cancel="showModal = false"
        />
    </div>

    <!-- Unsaved Changes Confirmation -->
    <ConfirmationModal
        v-if="showUnsavedChangesModal"
        title="Unsaved Changes"
        message="You have unsaved changes. Are you sure you want to leave? Your changes will be lost."
        confirm-label="Discard Changes"
        cancel-label="Keep Editing"
        :is-danger="true"
        @confirm="confirmUnsavedChanges"
        @cancel="cancelUnsavedChanges"
    />

    <!-- Delete Confirmation -->
    <ConfirmationModal
        v-if="showDeleteModal"
        :title="'Delete Effort?'"
        :message="`Are you sure you want to delete '${itemToDelete?.name}'? This action cannot be undone.`"
        confirm-label="Delete"
        :is-danger="true"
        @confirm="confirmDelete"
        @cancel="showDeleteModal = false"
    />
  </div>
</template>

<style scoped>
.efforts-view {
  padding: 1rem;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--md-sys-color-surface);
  box-sizing: border-box;
  overflow: hidden;
}

.header-section {
    flex-shrink: 0;
    margin-bottom: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.actions-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
}



.page-title {
    margin: 0;
    font-size: 24px;
    color: var(--md-sys-color-on-surface);
}

.program-ref {
    font-weight: 300;
    color: var(--md-sys-color-secondary);
}

.master-detail-container {
    flex: 1;
    display: flex;
    gap: 1.5rem;
    overflow: hidden; /* Contain inner scrolls */
}

/* Sidebar */
.tree-sidebar {
    width: 320px;
    display: flex;
    flex-direction: column;
    background: var(--md-sys-color-surface-container-low);
    border-radius: 12px;
    overflow: hidden;
}

.panel-title {
    padding: 1rem;
    margin: 0;
    font-size: 14px;
    text-transform: uppercase;
    color: var(--md-sys-color-secondary);
    border-bottom: 1px solid var(--md-sys-color-outline-variant);
}

.tree-content {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
}

.empty-tree {
    padding: 2rem;
    text-align: center;
    color: var(--md-sys-color-secondary);
    font-size: 14px;
}

/* Detail Panel */
.detail-panel {
    flex: 1;
    background: var(--md-sys-color-surface);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.detail-content-wrapper {
    flex: 1;
    overflow: hidden;
    height: 100%;
}

.detail-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--md-sys-color-outline-variant);
}

.detail-header h1 {
    margin: 0.5rem 0 0.25rem 0;
    font-size: 32px;
    color: var(--md-sys-color-on-surface);
}

.badges {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
}

.type-badge {
    font-size: 11px;
    text-transform: uppercase;
    background: var(--md-sys-color-surface-container-high);
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 600;
}

.status-badge {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 12px;
    background: var(--md-sys-color-primary-container);
    color: var(--md-sys-color-on-primary-container);
}

.id-ref {
    font-family: monospace;
    color: var(--md-sys-color-secondary);
    font-size: 12px;
}

.detail-body {
    display: flex;
    flex-direction: column;
    gap: 2rem;
}

.detail-section h3 {
    font-size: 16px;
    font-weight: 500;
    color: var(--md-sys-color-primary);
    margin: 0 0 0.75rem 0;
}

.detail-section p {
    margin: 0;
    color: var(--md-sys-color-on-surface-variant);
    line-height: 1.5;
}

.grid-2-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
}

.inherited-pill {
    display: inline-block;
    font-size: 12px;
    color: var(--md-sys-color-secondary);
    background: rgba(0,0,0,0.05);
    padding: 4px 12px;
    border-radius: 16px;
    font-style: italic;
}

.empty-detail {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--md-sys-color-secondary);
}

.empty-detail .icon {
    font-size: 48px;
    margin-bottom: 1rem;
    opacity: 0.5;
}

.actions {
    display: flex;
    gap: 0.75rem;
}

/* Modal Overlay */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}
</style>
