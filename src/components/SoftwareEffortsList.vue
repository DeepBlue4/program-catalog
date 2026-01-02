<script setup>
import { ref, computed, watch } from 'vue';
import SoftwareEffortForm from './SoftwareEffortForm.vue';
import SoftwareEffortTreeItem from './SoftwareEffortTreeItem.vue';
import ConfirmationModal from './ConfirmationModal.vue';


const props = defineProps({
  programName: { type: String, required: true },
  programId: { type: [String, Number], required: true },
  program: { type: Object, default: () => ({}) }, // Full program details
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

// Pagination State
const currentPage = ref(1);
const itemsPerPage = 10;

// Reset page when program changes
watch(() => props.programId, () => {
    currentPage.value = 1;
});

const totalPages = computed(() => Math.ceil(props.efforts.length / itemsPerPage));

const displayedEfforts = computed(() => {
    // Slice raw efforts for pagination
    // Note: This simplistic pagination flattens the view of roots. 
    // If deep hierarchy navigation is desired, we might paginate only roots.
    // For now, based on mock data which is mostly flat list of efforts per program (or shallow tree),
    // we slice the computed roots.

    const start = (currentPage.value - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    
    // We paginate the ROOTS of the tree view
    return effortTree.value.slice(start, end);
});

// --- Tree Building Logic ---
const effortTree = computed(() => {
    const map = {};
    const roots = [];
    
    // Shallow copy for tree construction
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

const notification = ref({ show: false, message: '', type: 'success' }); // type: success, error
let notificationTimeout;

const showNotification = (message, type = 'success') => {
    notification.value = { show: true, message, type };
    if (notificationTimeout) clearTimeout(notificationTimeout);
    notificationTimeout = setTimeout(() => {
        notification.value.show = false;
    }, 3000);
};

// Import API
import { CompassAPIService } from '../services/api';

const confirmDelete = async () => {
    if (itemToDelete.value) {
        const index = props.efforts.findIndex(e => e.id === itemToDelete.value.id);
        if (index !== -1) {
            // Optimistic update
            const deletedItem = props.efforts[index];
            props.efforts.splice(index, 1);
            
            // API Call
            const res = await CompassAPIService.updateSoftwareEffortsForNode(props.programId, props.efforts);
            
            if (res.success) {
                showNotification(`Deleted '${deletedItem.name}' successfully.`);
                if (selectedEffortId.value === itemToDelete.value.id) {
                    selectedEffortId.value = null; 
                    isFormDirty.value = false;
                }
            } else {
                // Revert
                props.efforts.splice(index, 0, deletedItem);
                showNotification('Failed to delete effort. Please try again.', 'error');
            }
        }
    }
    showDeleteModal.value = false;
    itemToDelete.value = null;
    showModal.value = false; 
};

const saveEffort = async (effortData) => {
    // Clone to prepare for API
    const newEffortsList = [...props.efforts];
    let isNew = false;
    let oldItem = null;
    let index = -1;

    if (effortData.id) {
        // Update existing
        index = newEffortsList.findIndex(e => e.id === effortData.id);
        if (index !== -1) {
             oldItem = { ...newEffortsList[index] };
             Object.assign(newEffortsList[index], effortData);
        }
    } else {
        // Create new
        isNew = true;
        const newId = `EFF-${props.programId}-${Date.now()}`;
        const newEffort = { ...effortData, id: newId };
        newEffortsList.push(newEffort);
        effortData.id = newId; // Update so form has ID
    }

    // Call API with new list
    const res = await CompassAPIService.updateSoftwareEffortsForNode(props.programId, newEffortsList);

    if (res.success) {
         // Apply changes to prop (mutable array)
         if (isNew) {
             props.efforts.push(newEffortsList[newEffortsList.length - 1]);
             selectedEffortId.value = effortData.id;
         } else if (index !== -1) {
             Object.assign(props.efforts[index], effortData);
         }
         
         showNotification(isNew ? 'Effort created successfully.' : 'Changes saved successfully.');
         showModal.value = false;
         isFormDirty.value = false;
    } else {
         showNotification('Failed to save changes. Please try again.', 'error');
    }
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
    confirmNavigation,
    selectEffort: (id) => {
        selectedEffortId.value = id;
    }
});

const effortFormRef = ref(null);

const handleRevertRequest = () => {
    // Show confirmation
    pendingConfirm.value = () => {
        if (effortFormRef.value) {
            effortFormRef.value.resetForm();
            isFormDirty.value = false;
            showNotification('Changes discarded.');
        }
    };
    showUnsavedChangesModal.value = true;
};

const showInfoModal = ref(false);

// ... (previous code) ...

</script>

<template>
  <div class="efforts-view">
    <div class="header-section">
      <div class="actions-row">
          <div class="left-actions">
              <button class="btn-outlined" @click="handleBack">
                <i class="fas fa-arrow-left"></i> Back to Catalog
              </button>
          </div>
          <div class="right-actions">
              <button class="btn-icon-tonal" @click="showInfoModal = true" title="Program Information">
                  <i class="fas fa-info-circle"></i>
              </button>
              <button class="btn-filled" @click="handleCreate">
                  <i class="fas fa-plus"></i> New Effort
              </button>
          </div>
      </div>
      <div class="title-block">
          <h2 class="page-title">Software Efforts <span class="program-ref">- {{ programName }}</span></h2>
      </div>
    </div>

    <!-- ... (Master Detail Container) ... -->
    <div class="master-detail-container">
        <!-- Sidebar: Hierarchical Tree -->
        <div class="tree-sidebar m3-card outlined">
            <h3 class="panel-title">Hierarchy</h3>
            <div class="tree-content">
                <SoftwareEffortTreeItem 
                    v-for="rootNode in displayedEfforts" 
                    :key="rootNode.id" 
                    :effort="rootNode" 
                    :selected-id="selectedEffortId"
                    @select="handleSelect"
                />
                <div v-if="efforts.length === 0" class="empty-tree">
                    No efforts found.
                </div>
            </div>
            
            <!-- Pagination Controls -->
            <div v-if="efforts.length > itemsPerPage" class="pagination-controls">
                <button 
                    class="page-btn" 
                    :disabled="currentPage === 1" 
                    @click="currentPage--"
                >
                    <i class="fas fa-chevron-left"></i>
                </button>
                <span class="page-info">
                    {{ (currentPage - 1) * itemsPerPage + 1 }} - {{ Math.min(currentPage * itemsPerPage, efforts.length) }} of {{ efforts.length }}
                </span>
                <button 
                    class="page-btn" 
                    :disabled="currentPage === totalPages" 
                    @click="currentPage++"
                >
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        </div>

        <!-- Main Panel: Detail View -->
        <main class="detail-panel m3-card elevated">
            <div v-if="selectedEffort" class="detail-content-wrapper">
                 <SoftwareEffortForm
                    ref="effortFormRef"
                    :effort="selectedEffort"
                    :available-parents="efforts"
                    :is-edit="true"
                    @save="saveEffort"
                    @delete="handleDelete"
                    @dirty-change="handleDirtyChange"
                    @revert="handleRevertRequest"
                    @validation-error="(msg) => showNotification(msg, 'error')"
                 />
            </div>
            
            <div v-else class="empty-detail">
                <span class="icon"><i class="fas fa-hand-point-left"></i></span>
                <p>Select a Software Effort from the hierarchy to view or edit details.</p>
            </div>
        </main>
    </div>

    <!-- Program Info Modal -->
    <div v-if="showInfoModal" class="modal-overlay" @click.self="showInfoModal = false">
        <div class="info-modal-card m3-card elevated">
            <div class="info-header">
                <div class="header-text">
                    <span class="overline">Program Details</span>
                    <h2>{{ programName }}</h2>
                </div>
                <button class="btn-icon" @click="showInfoModal = false">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="info-body">
                <div class="info-grid">
                    <div class="info-item">
                        <label>Program ID</label>
                        <div class="value code">{{ program.value || programId }}</div>
                    </div>
                    
                    <div class="info-item">
                        <label>Program Leader</label>
                        <div class="value">{{ program.programLeader || 'N/A' }}</div>
                    </div>

                    <div class="info-item">
                        <label>Chief Engineer</label>
                        <div class="value">{{ program.chiefEngineer || 'N/A' }}</div>
                    </div>

                    <div class="info-item">
                        <label>Program Value</label>
                        <div class="value">{{ program.programValue || 'N/A' }}</div>
                    </div>

                    <div class="info-item">
                        <label>Primary Location</label>
                        <div class="value">{{ program.primaryLocation || 'N/A' }}</div>
                    </div>

                    <div class="info-item">
                        <label>Type</label>
                        <div class="value">{{ program.primaryType || 'N/A' }}</div>
                    </div>
                </div>
                
                <div class="info-stats m3-card outlined">
                    <div class="stat">
                        <span class="stat-num">{{ efforts.length }}</span>
                        <span class="stat-label">Software Efforts</span>
                    </div>
                    <div class="stat">
                        <span class="stat-num">{{ efforts.filter(e => e.status === 'Active').length }}</span>
                        <span class="stat-label">Active</span>
                    </div>
                </div>
            </div>
            <div class="info-footer">
                <button class="btn-filled" @click="showInfoModal = false">Close</button>
            </div>
        </div>
    </div>

    <!-- ... (Other Modals) ... -->
    <!-- Modal Overlay (Edit/Create) -->
    <div v-if="showModal" class="modal-overlay">
        <div class="modal-card m3-card elevated">
            <SoftwareEffortForm 
                :effort="editingEffort || undefined" 
                :available-parents="efforts"
                :is-edit="!!editingEffort && !!editingEffort.id"
                @save="saveEffort"
                @cancel="showModal = false"
                @validation-error="(msg) => showNotification(msg, 'error')"
            />
        </div>
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

    <!-- Notification Toast -->
    <transition name="toast-slide">
        <div v-if="notification.show" class="notification-toast" :class="notification.type">
            <i class="fas" :class="notification.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'"></i>
            <span>{{ notification.message }}</span>
        </div>
    </transition>
  </div>
</template>

<style scoped>
/* Notification Toast */
.notification-toast {
    position: fixed;
    bottom: 2rem;
    left: 50%;
    transform: translateX(-50%);
    background: var(--md-sys-color-inverse-surface);
    color: var(--md-sys-color-inverse-on-surface);
    padding: 12px 24px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.15);
    z-index: 2000;
    font-size: 14px;
    font-weight: 500;
    min-width: 300px;
    justify-content: center;
}

.notification-toast.error {
    background: var(--md-sys-color-error, #B3261E);
    color: var(--md-sys-color-on-error);
}

.toast-slide-enter-active,
.toast-slide-leave-active {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.toast-slide-enter-from,
.toast-slide-leave-to {
    opacity: 0;
    transform: translate(-50%, 20px);
}

/* Existing styles */
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

/* Actions */
.right-actions, .left-actions {
    display: flex;
    gap: 1rem;
    align-items: center;
}

.btn-icon-tonal {
    background: var(--md-sys-color-secondary-container);
    color: var(--md-sys-color-on-secondary-container);
    border: none;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 1.2rem;
    transition: filter 0.2s;
}

.btn-icon-tonal:hover {
    filter: brightness(0.95);
}

.btn-icon {
    background: transparent;
    border: none;
    color: var(--md-sys-color-on-surface);
    cursor: pointer;
    font-size: 1.2rem;
    padding: 8px;
    border-radius: 50%;
}

.btn-icon:hover {
    background: var(--md-sys-color-surface-container-high);
}

/* Info Modal */
.info-modal-card {
    width: 600px;
    max-width: 90vw;
    background: var(--md-sys-color-surface);
    border-radius: 12px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.info-header {
    padding: 1.5rem 1.5rem 1rem 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 1px solid var(--md-sys-color-outline-variant);
}

.header-text h2 {
    margin: 0;
    font-size: 24px;
    color: var(--md-sys-color-on-surface);
}

.overline {
    display: block;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--md-sys-color-primary);
    font-weight: 600;
    margin-bottom: 4px;
}

.info-body {
    padding: 1.5rem;
}

.info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
    margin-bottom: 2rem;
}

.info-item label {
    display: block;
    font-size: 12px;
    color: var(--md-sys-color-secondary);
    margin-bottom: 4px;
}

.info-item .value {
    font-size: 16px;
    color: var(--md-sys-color-on-surface);
    font-weight: 400;
}

.info-item .value.code {
    font-family: monospace;
    font-size: 14px;
    background: var(--md-sys-color-surface-container-high);
    padding: 2px 6px;
    border-radius: 4px;
    display: inline-block;
}

.info-stats {
    display: flex;
    justify-content: space-around;
    padding: 1rem;
    background: var(--md-sys-color-surface-container-low);
    border-radius: 12px;
}

.stat {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.stat-num {
    font-size: 24px;
    font-weight: 700;
    color: var(--md-sys-color-primary);
}

.stat-label {
    font-size: 12px;
    color: var(--md-sys-color-secondary);
    text-transform: uppercase;
}

.info-footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--md-sys-color-outline-variant);
    display: flex;
    justify-content: flex-end;
    background: var(--md-sys-color-surface-container-low);
}

.modal-card {
    width: 1000px;
    max-width: 90vw;
    height: 85vh;
    border-radius: 12px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}
.empty-tree {
    padding: 2rem;
    text-align: center;
    color: var(--md-sys-color-secondary);
    font-style: italic;
    font-size: 14px;
}

.pagination-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-top: 1px solid var(--md-sys-color-outline-variant);
    background: var(--md-sys-color-surface-container-low);
}

.page-btn {
    background: transparent;
    border: none;
    color: var(--md-sys-color-on-surface);
    cursor: pointer;
    padding: 8px;
    border-radius: 50%;
    transition: 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
}

.page-btn:hover:not(:disabled) {
    background: var(--md-sys-color-surface-container-high);
}

.page-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
}

.page-info {
    font-size: 12px;
    color: var(--md-sys-color-secondary);
    font-variant-numeric: tabular-nums;
}
</style>
