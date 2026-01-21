<script setup>
import { ref, computed, watch } from 'vue';
import SoftwareEffortForm from './SoftwareEffortForm.vue';
import SoftwareEffortTreeItem from './SoftwareEffortTreeItem.vue';
import ConfirmationModal from './ConfirmationModal.vue';
import BaseIcon from './BaseIcon.vue';
import {
  mdiArrowLeft,
  mdiInformation,
  mdiPlus,
  mdiChevronLeft,
  mdiChevronRight,
  mdiHandPointingLeft,
  mdiCube,
  mdiSitemap,
  mdiClipboardCheck,
  mdiCheckCircle,
  mdiAlertCircle,
  mdiClose,
  mdiAlert,
  mdiCheckCircleOutline,
  mdiMinusCircleOutline
} from '@mdi/js';
import { STATUS_COLORS } from '../styles/statusConstants';

const props = defineProps({
  programName: { type: String, required: true },
  programId: { type: [String, Number], required: true },
  program: { type: Object, default: () => ({}) }, // Full program details
  efforts: { type: Array, default: () => [] },
  selectedId: { type: [String, Number], default: null }
});

const statusConfig = computed(() => {
  const p = props.program;
  // Check both prop and nested object to be safe against data disconnects
  const propEfforts = props.efforts || [];
  const objEfforts = p.softwareEfforts || [];
  const hasEfforts = propEfforts.length > 0 || objEfforts.length > 0;

  // Ensure boolean
  const expecting = !!p.expecting_software_efforts;

  console.log('[statusConfig 1] Debug for:', p.name, {
    expecting,
    hasEfforts,
    propEffortsLen: propEfforts.length,
    objEffortsLen: objEfforts.length
  });

  if (expecting && !hasEfforts) {
    console.log('[statusConfig 2] Debug for:', p.name, {
      expecting,
      hasEfforts,
      propEffortsLen: propEfforts.length,
      objEffortsLen: objEfforts.length
    });
    return {
      ...STATUS_COLORS.gap,
      label: 'Expected (Missing)',
      icon: mdiAlert,
      isWarning: true
    };
  } else if (hasEfforts && !expecting) {
    console.log('[statusConfig 3] Debug for:', p.name, {
      expecting,
      hasEfforts,
      propEffortsLen: propEfforts.length,
      objEffortsLen: objEfforts.length
    });
    // Anomaly / Unexpected
    return {
      ...STATUS_COLORS.gap,
      label: 'Unexpected (Assigned)',
      icon: mdiAlertCircle,
      isWarning: true
    };
  } else if (hasEfforts) {
    return {
      ...STATUS_COLORS.active,
      label: 'Software Efforts Active',
      icon: mdiCheckCircleOutline
    };
  } else {
    return {
      ...STATUS_COLORS.neutral,
      label: 'Not Expecting Software Efforts',
      icon: mdiMinusCircleOutline
    };
  }
});

const emit = defineEmits(['back', 'selection-change', 'effort-deleted']);

const showModal = ref(false);
const showDeleteModal = ref(false);
const showUnsavedChangesModal = ref(false);
const editingEffort = ref(null);
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
watch(
  () => props.programId,
  () => {
    currentPage.value = 1;
  }
);

const totalPages = computed(() =>
  Math.ceil(props.efforts.length / itemsPerPage)
);

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
// --- Tree Building Logic ---
const effortTree = computed(() => {
  const map = {};
  const roots = [];

  // Shallow copy for tree construction
  const nodes = props.efforts.map((e) => ({ ...e, children: [] }));

  // Map by UUID (Contract source of truth)
  nodes.forEach((node) => {
    if (node.uuid) {
      map[node.uuid] = node;
    }
  });

  nodes.forEach((node) => {
    // Use parent_uuid to find parent
    if (node.parent_uuid && map[node.parent_uuid]) {
      map[node.parent_uuid].children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
});

const selectedEffort = computed(() => {
  const id = props.selectedId;
  if (!id) return null;

  // Recursive helper to find node in tree
  const findInTree = (nodes) => {
    for (const node of nodes) {
      // Robust String comparison
      if (String(node.id) === String(id)) return node;
      if (node.children && node.children.length > 0) {
        const found = findInTree(node.children);
        if (found) return found;
      }
    }
    return null;
  };

  const res = findInTree(props.efforts);
  console.log('[SEL] Found effort?', !!res, 'for id:', id);
  return res;
});

// --- Pagination & Deep Linking Logic ---
const hasDescendant = (node, id) => {
  if (String(node.id) === String(id)) return true;
  if (node.children && node.children.length > 0) {
    return node.children.some((child) => hasDescendant(child, id));
  }
  return false;
};

const jumpToSelection = (id) => {
  if (!id || !effortTree.value.length) return;

  const rootIndex = effortTree.value.findIndex((root) => {
    return String(root.id) === String(id) || hasDescendant(root, id);
  });

  if (rootIndex !== -1) {
    const page = Math.floor(rootIndex / itemsPerPage) + 1;
    if (currentPage.value !== page) {
      console.log('[Pagination] Jumping to page:', page, 'for item:', id);
      currentPage.value = page;
    }
  }
};

// Auto-jump when selection changes or data loads
watch(
  () => props.selectedId,
  (newId) => {
    if (newId) jumpToSelection(newId);
  },
  { immediate: true }
);

watch(effortTree, () => {
  if (props.selectedId) jumpToSelection(props.selectedId);
});

// Select tree item
const handleSelect = (effort) => {
  triggerActionWithCheck(() => {
    // Toggle logic: If already selected, deselect (emit null)
    if (String(props.selectedId) === String(effort.id)) {
      emit('selection-change', null);
    } else {
      emit('selection-change', effort.id);
    }
  });
};

const handleCreate = () => {
  triggerActionWithCheck(() => {
    editingEffort.value = null;
    showModal.value = true;
  });
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

// Import Store
import { useProgramCatalogStore } from '../store/programCatalogStore';
const store = useProgramCatalogStore();

const confirmDelete = async () => {
  if (itemToDelete.value) {
    const index = props.efforts.findIndex(
      (e) => e.id === itemToDelete.value.id
    );
    if (index !== -1) {
      const deletedItem = props.efforts[index];

      // Call Store's Delete Method (which handles both API and cache update)
      const res = await store.deleteSoftwareEffort(
        props.programId,
        deletedItem.uuid
      );

      if (res.success) {
        // Emit event to parent for any additional UI updates
        emit('effort-deleted', deletedItem.id);
        showNotification(`Deleted '${deletedItem.name}' successfully.`);
        if (String(props.selectedId) === String(deletedItem.id)) {
          // Emit null to clear selection via parent
          emit('selection-change', null);
          isFormDirty.value = false;
        }
      } else {
        showNotification('Failed to delete effort. Please try again.', 'error');
      }
    }
  }
  showDeleteModal.value = false;
  itemToDelete.value = null;
  showModal.value = false;
};

const saveEffort = async (effortData) => {
  const isNew = !effortData.id;

  // Call Store Action
  const res = await store.saveSoftwareEffort(props.programId, effortData);

  if (res.success) {
    // UI Updates only (State is handled by store)
    const savedEffort = res.data || effortData;

    if (isNew) {
      emit('selection-change', savedEffort.id);
    }

    showNotification(
      isNew ? 'Effort created successfully.' : 'Changes saved successfully.'
    );

    if (effortFormRef.value) {
      effortFormRef.value.setClean();
    }

    showModal.value = false;
    isFormDirty.value = false;
  } else {
    showNotification(
      res.message || 'Failed to save changes. Please try again.',
      'error'
    );
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
  confirmNavigation
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
const showHelpModal = ref(false);

// ... (previous code) ...
</script>

<template>
  <div class="efforts-view">
    <div class="header-section">
      <div class="actions-row">
        <div class="left-actions">
          <button class="btn-outlined" @click="handleBack">
            <BaseIcon :path="mdiArrowLeft" /> Back to Catalog
          </button>
        </div>
        <div class="right-actions">
          <!-- Info Icon now shows "What is a Software Effort?" -->
          <button
            class="btn-icon-tonal"
            @click="showHelpModal = true"
            title="What is a Software Effort?"
          >
            <BaseIcon :path="mdiInformation" />
          </button>
          <button class="btn-filled" @click="handleCreate">
            <BaseIcon :path="mdiPlus" /> New Effort
          </button>
        </div>
      </div>
      <div class="title-block">
        <!-- Program Name is now the trigger for Program Info -->
        <h2 class="page-title">
          Software Efforts
          <button
            class="program-ref-btn"
            @click="showInfoModal = true"
            title="View Program Details"
          >
            - {{ programName }}
          </button>
        </h2>
      </div>
    </div>

    <!-- ... (Master Detail Container) ... -->
    <div class="master-detail-container">
      <!-- Sidebar: Hierarchical Tree -->
      <div class="tree-sidebar m3-card outlined">
        <div class="panel-header">
          <h3 class="panel-title">Hierarchy</h3>
          <div
            v-if="statusConfig.isWarning"
            class="sidebar-warning-badge"
            :style="{
              backgroundColor: statusConfig.bg,
              color: statusConfig.text
            }"
            :title="statusConfig.label"
          >
            <BaseIcon :path="statusConfig.icon" :size="14" />
            <span>{{ statusConfig.label }}</span>
          </div>
        </div>
        <div class="tree-content">
          <SoftwareEffortTreeItem
            v-for="rootNode in displayedEfforts"
            :key="rootNode.id"
            :effort="rootNode"
            :selected-id="selectedId"
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
            <BaseIcon :path="mdiChevronLeft" />
          </button>
          <span class="page-info">
            {{ (currentPage - 1) * itemsPerPage + 1 }} -
            {{ Math.min(currentPage * itemsPerPage, efforts.length) }} of
            {{ efforts.length }}
          </span>
          <button
            class="page-btn"
            :disabled="currentPage === totalPages"
            @click="currentPage++"
          >
            <BaseIcon :path="mdiChevronRight" />
          </button>
        </div>
      </div>

      <!-- Main Panel: Detail View -->
      <main class="detail-panel m3-card elevated">
        <div v-if="selectedEffort" class="detail-content-wrapper">
          <SoftwareEffortForm
            ref="effortFormRef"
            :key="selectedEffort.id"
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
          <span class="icon"
            ><BaseIcon :path="mdiHandPointingLeft" :size="48"
          /></span>
          <p>
            Select a Software Effort from the hierarchy to view or edit details.
          </p>
        </div>
      </main>
    </div>

    <!-- Help Modal -->
    <div
      v-if="showHelpModal"
      class="modal-overlay"
      @click.self="showHelpModal = false"
    >
      <div class="info-modal-card m3-card elevated help-modal">
        <div class="info-header">
          <div class="header-text">
            <span class="overline">Contextual Help</span>
            <h2>What is a Software Effort?</h2>
          </div>
          <button class="btn-icon" @click="showHelpModal = false">
            <BaseIcon :path="mdiClose" />
          </button>
        </div>
        <div class="info-body">
          <p class="help-text-large">
            A <strong>Software Effort</strong> serves as the central hub for any
            distinct unit of software development. Whether you are managing a
            <strong>Software Team</strong>, delivering a specific
            <strong>Product</strong>, building a reusable
            <strong>Component (CSCI)</strong>, or executing a time-bound
            <strong>Project</strong>, a Software Effort encapsulates all the
            necessary governance, resources, and technical configurations in one
            place.
          </p>
          <div class="help-grid">
            <div class="help-item">
              <BaseIcon :path="mdiCube" :size="20" />
              <div class="content">
                <h4>Encapsulation</h4>
                <p>
                  It encapsulates the code, its lifecycle, compliance data, and
                  governance in one object.
                </p>
              </div>
            </div>
            <div class="help-item">
              <BaseIcon :path="mdiSitemap" :size="20" />
              <div class="content">
                <h4>Hierarchy</h4>
                <p>
                  Efforts can be nested (e.g., a 'Platform' containing multiple
                  'Services') to model complex systems.
                </p>
              </div>
            </div>
            <div class="help-item">
              <BaseIcon :path="mdiClipboardCheck" :size="20" />
              <div class="content">
                <h4>Governance</h4>
                <p>
                  Track Statements of Work, Security Focals, and Developer Setup
                  requirements centrally.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div class="info-footer">
          <button class="btn-filled" @click="showHelpModal = false">
            Got it
          </button>
        </div>
      </div>
    </div>

    <!-- Program Info Modal -->
    <div
      v-if="showInfoModal"
      class="modal-overlay"
      @click.self="showInfoModal = false"
    >
      <div class="info-modal-card m3-card elevated">
        <div class="info-header">
          <div class="header-text">
            <span class="overline">Program Details</span>
            <h2>{{ programName }}</h2>
            <!-- Status Pill (Moved here) -->
            <div
              class="status-pill small"
              :class="statusConfig.id"
              style="margin-top: 8px; display: inline-flex"
            >
              <BaseIcon :path="statusConfig.icon" :size="16" />
              <span>{{ statusConfig.label }}</span>
            </div>
          </div>
          <button class="btn-icon" @click="showInfoModal = false">
            <BaseIcon :path="mdiClose" />
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
              <div class="value">
                {{ program.organization_leader_name || 'N/A' }}
              </div>
            </div>

            <div class="info-item">
              <label>Chief Engineer</label>
              <div class="value">
                {{ program.chief_engineer_name || 'N/A' }}
              </div>
            </div>

            <div class="info-item">
              <label>Program Value</label>
              <div class="value">{{ program.program_value || 'N/A' }}</div>
            </div>

            <div class="info-item">
              <label>Primary Location</label>
              <div class="value">{{ program.primary_location || 'N/A' }}</div>
            </div>

            <div class="info-item">
              <label>Type</label>
              <div class="value">{{ program.program_type || 'N/A' }}</div>
            </div>

            <div class="info-item">
              <label>Expects Software Efforts</label>
              <div class="value">
                {{ program.expecting_software_efforts ? 'Yes' : 'No' }}
              </div>
            </div>

            <div class="info-item">
              <label>Has Descendant with Efforts</label>
              <div class="value">
                {{
                  program.has_descendant_expecting_software_effort
                    ? 'Yes'
                    : 'No'
                }}
              </div>
            </div>
          </div>

          <div class="info-stats m3-card outlined">
            <div class="stat">
              <span class="stat-num">{{ efforts.length }}</span>
              <span class="stat-label">Software Efforts</span>
            </div>
          </div>
        </div>
        <div class="info-footer">
          <button class="btn-filled" @click="showInfoModal = false">
            Close
          </button>
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
      <div
        v-if="notification.show"
        class="notification-toast"
        :class="notification.type"
      >
        <BaseIcon
          :path="
            notification.type === 'success' ? mdiCheckCircle : mdiAlertCircle
          "
        />
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
  background: #313033; /* inverse-surface */
  color: #f4eff4; /* inverse-on-surface */
  padding: 12px 24px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.15);
  z-index: 2000;
  font-size: 14px;
  font-weight: 500;
  min-width: 300px;
  justify-content: center;
}

.notification-toast span {
  white-space: pre-wrap;
  text-align: left;
}

.notification-toast.error {
  background: #ba1a1a; /* error */
  color: #ffffff; /* on-error */
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
  background-color: #fef7ff; /* surface */
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
  color: #1d1b20; /* on-surface */
}

.program-ref-btn {
  background: transparent;
  border: none;
  font-size: inherit;
  font-weight: 300;
  font-family: inherit;
  color: #005ac1; /* primary */
  cursor: pointer;
  padding: 0 4px;
  border-radius: 4px;
  transition: all 0.2s;
  text-decoration: underline;
  text-decoration-color: transparent;
}

.program-ref-btn:hover {
  background: #ece6f0; /* surface-container-high */
  text-decoration-color: #005ac1; /* primary */
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
  background: #f7f2fa; /* surface-container-low */
  border-radius: 12px;
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #c4c7c5; /* outline-variant */
  background: #f7f2fa; /* surface-container-low */
}

.panel-title {
  margin: 0;
  font-size: 14px;
  text-transform: uppercase;
  color: #625b71; /* secondary */
}

.sidebar-warning-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 12px; /* Chip/Pill shape */
}

.tree-content {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.empty-tree {
  padding: 2rem;
  text-align: center;
  color: #625b71; /* secondary */
  font-size: 14px;
}

/* Detail Panel */
.detail-panel {
  flex: 1;
  background: #fef7ff; /* surface */
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
  border-bottom: 1px solid #c4c7c5; /* outline-variant */
}

.detail-header h1 {
  margin: 0.5rem 0 0.25rem 0;
  font-size: 32px;
  color: #1d1b20; /* on-surface */
}

.badges {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.type-badge {
  font-size: 11px;
  text-transform: uppercase;
  background: #ece6f0; /* surface-container-high */
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.status-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 12px;
  background: #d8e2ff; /* primary-container */
  color: #001d35; /* on-primary-container */
}

.id-ref {
  font-family: monospace;
  color: #625b71; /* secondary */
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
  color: #005ac1; /* primary */
  margin: 0 0 0.75rem 0;
}

.detail-section p {
  margin: 0;
  color: #49454f; /* on-surface-variant */
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
  color: #625b71; /* secondary */
  background: rgba(0, 0, 0, 0.05);
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
  color: #625b71; /* secondary */
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

.title-block {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.status-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  border-radius: 100px;
  font-size: 13px;
  font-weight: 600;
  border: 1px solid transparent;
}

.status-pill.gap {
  background: v-bind('STATUS_COLORS.gap.bg');
  color: v-bind('STATUS_COLORS.gap.text');
  border-color: v-bind('STATUS_COLORS.gap.border');
}

.status-pill.active {
  background: v-bind('STATUS_COLORS.active.bg');
  color: white;
}

.status-pill.neutral {
  background: v-bind('STATUS_COLORS.neutral.bg');
  color: v-bind('STATUS_COLORS.neutral.text');
  border-color: v-bind('STATUS_COLORS.neutral.border');
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
.right-actions,
.left-actions {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.btn-icon-tonal {
  background: #dbe2f9; /* secondary-container */
  color: #1d192b; /* on-secondary-container */
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
  color: #1d1b20; /* on-surface */
  cursor: pointer;
  font-size: 1.2rem;
  padding: 8px;
  border-radius: 50%;
}

.btn-icon:hover {
  background: #ece6f0; /* surface-container-high */
}

/* Info Modal */
.info-modal-card {
  width: 600px;
  max-width: 90vw;
  background: #fef7ff; /* surface */
  border-radius: 28px; /* M3 Standard */
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow:
    0 4px 8px 3px rgba(0, 0, 0, 0.15),
    0 1px 3px rgba(0, 0, 0, 0.3); /* Elevation 3 */
}

.info-header {
  padding: 24px 24px 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  /* Removed border-bottom for cleaner look, widely used in M3 dialogs */
}

.header-text h2 {
  margin: 0;
  font-size: 24px;
  line-height: 32px;
  color: #1d1b20; /* on-surface */
}

.overline {
  display: block;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #005ac1; /* primary */
  font-weight: 500;
  margin-bottom: 8px;
}

.info-body {
  padding: 0 24px 24px 24px;
  overflow-y: auto;
}

.help-text-large {
  font-size: 16px;
  line-height: 1.6;
  color: #1d1b20; /* on-surface */
  margin-bottom: 2rem;
}

.help-grid {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-top: 16px;
}

.help-item {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.help-item i {
  font-size: 20px;
  color: #005ac1; /* primary */
  margin-top: 2px;
}

.help-item h4 {
  margin: 0 0 0.25rem 0;
  font-size: 14px;
  color: #1d1b20; /* on-surface */
}

.help-item p {
  margin: 0;
  font-size: 13px;
  color: #49454f; /* on-surface-variant */
  line-height: 1.4;
}

.info-footer {
  padding: 16px 24px 24px 24px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
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
  color: #625b71; /* secondary */
  margin-bottom: 4px;
}

.info-item .value {
  font-size: 16px;
  color: #1d1b20; /* on-surface */
  font-weight: 400;
}

.info-item .value.code {
  font-family: monospace;
  font-size: 14px;
  background: #ece6f0; /* surface-container-high */
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-block;
}

.info-stats {
  display: flex;
  justify-content: space-around;
  padding: 1rem;
  background: #f7f2fa; /* surface-container-low */
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
  color: #005ac1; /* primary */
}

.stat-label {
  font-size: 12px;
  color: #625b71; /* secondary */
  text-transform: uppercase;
}

.info-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #c4c7c5; /* outline-variant */
  display: flex;
  justify-content: flex-end;
  background: #f7f2fa; /* surface-container-low */
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
  color: #625b71; /* secondary */
  font-style: italic;
  font-size: 14px;
}

.pagination-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-top: 1px solid #c4c7c5; /* outline-variant */
  background: #f7f2fa; /* surface-container-low */
}

.page-btn {
  background: transparent;
  border: none;
  color: #1d1b20; /* on-surface */
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  transition: 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.page-btn:hover:not(:disabled) {
  background: #ece6f0; /* surface-container-high */
}

.page-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.page-info {
  font-size: 12px;
  color: #625b71; /* secondary */
  font-variant-numeric: tabular-nums;
}
</style>
