<script setup>
import { computed, ref, watch, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import SearchBox from './components/SearchBox.vue';
import UserMenu from './components/UserMenu.vue';
import { useProgramData } from './composables/useProgramData.js';

const router = useRouter();
const route = useRoute();
const { allNodes, selectedNode, chartData, selectNode } = useProgramData();

// --- View Logic ---
// We let the router handle the main view.
// 'catalog' = '/' route
// 'efforts' = '/efforts/:id' route
const isDashboard = computed(() => route.name === 'ProgramTree' || route.path === '/');

const handleNodeSelect = (node) => {
    if (node.isSoftwareEffort) {
        // Navigate to ProgramEfforts with selection
        router.push({ 
            name: 'ProgramEfforts', 
            params: { programId: node.parentId },
            query: { effort_id: node.value }
        });
    } else {
        // Always select the node to update global state
        selectNode(node);
        
        // If we are already on the efforts view, navigate to the new program's efforts
        // This ensures deep linking works when switching programs via search
        if (route.name === 'ProgramEfforts') {
            router.push({ 
                name: 'ProgramEfforts', 
                params: { programId: node.value || node.program_id } 
            });
        }
    }
};

// View Switcher (Sidebar Button Action)
const handleViewEfforts = () => {
    if (selectedNode.value) {
        router.push({ name: 'ProgramEfforts', params: { programId: selectedNode.value.value } });
    }
};

const handleBackToCatalog = () => {
    router.push('/');
};

// --- Breadcrumb Logic ---
const breadcrumbs = computed(() => {
    const crumbs = [{ name: 'Home', id: null, path: '/' }]; // Root
    
    // Reset to default on specific pages
    if (['Dashboard', 'PermissionDenied'].includes(route.name)) {
        return crumbs;
    }

    if (selectedNode.value && chartData.value) {
        // Helper to find path in tree
        const findPath = (node, targetId, currentPath = []) => {
            const nodeId = node.value || node.program_id;
            if (String(nodeId) === String(targetId)) return [...currentPath, node];
            
            if (node.children) {
                for (const child of node.children) {
                    const res = findPath(child, targetId, [...currentPath, node]);
                    if (res) return res;
                }
            }
            return null;
        };
        
        // Ensure we're looking for the ID correctly regardless of which property holds it
        const targetId = selectedNode.value.value || selectedNode.value.program_id;
        const treePath = findPath(chartData.value, targetId);
        if (treePath) {
             crumbs.pop(); // Remove static root
             treePath.forEach(n => crumbs.push({ 
                 name: n.name, 
                 id: n.value || n.program_id,
                 children: n.children // Pass children for dropdown
             }));
        } else {
             crumbs.push({ 
                 name: selectedNode.value.name, 
                 id: selectedNode.value.value || selectedNode.value.program_id,
                 children: selectedNode.value.children 
             });
        }
    }
    return crumbs;
});

// Smart Breadcrumbs (Truncated)
const displayedBreadcrumbs = computed(() => {
    const all = breadcrumbs.value;
    if (all.length <= 4) return all;
    
    return [
        all[0],
        { name: '...', id: 'ellipsis', isEllipsis: true },
        all[all.length - 2],
        all[all.length - 1]
    ];
});

const handleBreadcrumbClick = (crumb) => {
    if (!crumb) return;
    if (crumb.isEllipsis) return;
    
    if (crumb.path === '/') {
        router.push('/');
        return;
    }
    
    if (crumb.id) {
        handleNodeSelect({ value: crumb.id, name: crumb.name });
    }
};

const showBreadcrumbDropdown = ref(false);
const breadcrumbDropdownRef = ref(null);

const toggleDropdown = () => {
    showBreadcrumbDropdown.value = !showBreadcrumbDropdown.value;
};

const selectChild = (child) => {
    handleNodeSelect(child);
    showBreadcrumbDropdown.value = false;
};

// Click outside to close
const closeDropdown = (e) => {
    if (!showBreadcrumbDropdown.value) return;
    
    // Ref inside v-for is an array
    const el = Array.isArray(breadcrumbDropdownRef.value) ? breadcrumbDropdownRef.value[0] : breadcrumbDropdownRef.value;
    
    if (el && !el.contains(e.target)) {
        showBreadcrumbDropdown.value = false;
    }
};

window.addEventListener('click', closeDropdown);

// Close on navigation
watch(route, () => {
    showBreadcrumbDropdown.value = false;
});

onUnmounted(() => {
    window.removeEventListener('click', closeDropdown);
});
</script>

<template>
  <div class="app-container">
    <header class="top-bar m3-elevation-1">
      <div class="header-left">
          <div class="logo-area">
              <h1 class="app-title">Program Catalog</h1>
          </div>
          
          <nav class="breadcrumbs">
            <template v-for="(crumb, index) in displayedBreadcrumbs" :key="index">
                <span v-if="index > 0 && !crumb.isEllipsis" class="separator">/</span>
                <span 
                    class="crumb" 
                    :class="{ 'active': index === displayedBreadcrumbs.length - 1 && !crumb.isEllipsis, 'ellipsis': crumb.isEllipsis }"
                    @click="handleBreadcrumbClick(crumb)"
                >
                    {{ crumb.name }}
                </span>

                <!-- Dropdown for Active/Last Crumb with Children -->
                <div 
                    v-if="index === displayedBreadcrumbs.length - 1 && crumb.children && crumb.children.length > 0" 
                    class="breadcrumb-dropdown-container"
                    ref="breadcrumbDropdownRef"
                >
                    <button class="icon-btn-small" @click.stop="toggleDropdown">
                        <i class="fas fa-chevron-down"></i>
                    </button>
                    
                    <div v-if="showBreadcrumbDropdown" class="dropdown-menu m3-elevation-2">
                        <div class="dropdown-header">Sub-Programs</div>
                        <template v-for="child in crumb.children" :key="child.value || child.program_id">
                            <div class="dropdown-item" @click="selectChild(child)">
                                {{ child.name }}
                            </div>
                        </template>
                    </div>
                </div>
            </template>
          </nav>
      </div>

      <div class="header-right">
        <SearchBox :items="allNodes" @select="handleNodeSelect" />
        <UserMenu />
      </div>
    </header>

    <main class="main-content">
      <!-- Router View replaces explicit view switching -->
      <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
              <component :is="Component" />
          </transition>
      </router-view>

      <!-- M3 Sidebar / Drawer (Only on Catalog View) -->
      <aside v-if="isDashboard" class="sidebar m3-card outlined" :class="{ active: selectedNode }">
        <div v-if="selectedNode" class="sidebar-content">
           <div class="sidebar-header">
               <span class="type-overline">Selected Program</span>
               <h2>{{ selectedNode.name }}</h2>
               <div class="status-tags">
                   <span class="tag" v-if="selectedNode.hasSoftwareEffort">Software Active</span>
                   <span class="tag neutral" v-else>Neutral</span>
                   
                   <span class="tag parent" v-if="selectedNode.has_descendant_expecting_software_effort">Parent of Effort</span>
               </div>
           </div>
           
           <div class="sidebar-body">
               <div class="info-group">
                   <label>ID</label>
                   <span>{{ selectedNode.value }}</span>
               </div>
               
               <!-- New Data Fields -->
               <div class="info-group">
                   <label>Program Leader</label>
                   <span>{{ selectedNode.programLeader }}</span>
               </div>
               <div class="info-group">
                   <label>Chief Engineer</label>
                   <span>{{ selectedNode.chiefEngineer }}</span>
               </div>
               <div class="info-group">
                   <label>Primary Location</label>
                   <span>{{ selectedNode.primaryLocation }}</span>
               </div>
               <div class="info-group">
                   <label>Type</label>
                   <span>{{ selectedNode.primaryType }}</span>
               </div>
                <div class="info-group">
                   <label>Program Value</label>
                   <span>{{ selectedNode.programValue }}</span>
               </div>
               
               <div class="divider"></div>
               
               <div class="action-area">
                   <div class="stat-row">
                       <span class="stat-label">Software Efforts</span>
                       <span class="stat-value">{{ selectedNode.softwareEfforts ? selectedNode.softwareEfforts.length : 0 }}</span>
                   </div>
                   
                   <button 
                        v-if="selectedNode.softwareEfforts && selectedNode.softwareEfforts.length > 0" 
                        class="btn-filled full-width"
                        @click="handleViewEfforts"
                   >
                       View Software Efforts
                   </button>
                   <button v-else class="btn-outlined full-width" @click="handleViewEfforts">
                       View Empty State (Create)
                   </button>
               </div>
           </div>
        </div>
        <div v-else class="sidebar-empty">
            <p>Select a node from the chart to view details.</p>
        </div>
      </aside>
    </main>
  </div>
</template>

<style scoped>
/* App container fill screen */
.app-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--md-sys-color-background);
  color: var(--md-sys-color-on-background);
}

/* Header */
.top-bar {
    height: 64px;
    padding: 0 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: var(--md-sys-color-surface);
    color: var(--md-sys-color-on-surface);
    z-index: 10;
}

.m3-elevation-1 {
    box-shadow: var(--md-sys-elevation-level1);
}

.header-left {
    display: flex;
    align-items: center;
}

.logo-area {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding-right: 1.5rem;
    border-right: 1px solid var(--md-sys-color-outline-variant);
}

.logo-icon {
    font-size: 1.5rem;
}

.app-title {
    font-size: 1.25rem;
    font-weight: 500;
    margin: 0;
    letter-spacing: -0.5px;
}

.header-right {
    display: flex;
    align-items: center;
    gap: 1rem;
}

/* Breadcrumb Dropdown */
.breadcrumb-dropdown-container {
    position: relative;
    display: flex;
    align-items: center;
}

.icon-btn-small {
    background: transparent;
    border: none;
    color: var(--md-sys-color-secondary);
    cursor: pointer;
    padding: 4px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: 4px;
    transition: background 0.2s;
}

.icon-btn-small:hover {
    background: var(--md-sys-color-surface-container-high);
    color: var(--md-sys-color-on-surface);
}

.dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 8px;
    background: var(--md-sys-color-surface);
    border-radius: 8px;
    min-width: 200px;
    max-height: 300px;
    overflow-y: auto;
    z-index: 100;
    padding: 8px 0;
    border: 1px solid var(--md-sys-color-outline-variant);
}

.m3-elevation-2 {
    box-shadow: var(--md-sys-elevation-level2);
}

.dropdown-header {
    padding: 8px 16px;
    font-size: 11px;
    text-transform: uppercase;
    color: var(--md-sys-color-secondary);
    font-weight: 600;
    letter-spacing: 0.5px;
}

.dropdown-item {
    padding: 8px 16px;
    font-size: 14px;
    color: var(--md-sys-color-on-surface);
    cursor: pointer;
    transition: background 0.2s;
}

.dropdown-item:hover {
    background: var(--md-sys-color-surface-container-high);
}

.breadcrumbs {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-left: 1rem;
    font-size: 14px;
    white-space: nowrap;
    /* overflow: hidden; Removed to allow dropdown */
}

.crumb {
    color: var(--md-sys-color-secondary);
    cursor: pointer;
    transition: color 0.2s;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
}

.crumb:hover:not(.active):not(.ellipsis) {
    color: var(--md-sys-color-primary);
    text-decoration: underline;
}

.crumb.active {
    color: var(--md-sys-color-on-surface);
    font-weight: 600;
    cursor: default;
}

.crumb.ellipsis {
    cursor: default;
    color: var(--md-sys-color-outline);
    letter-spacing: 2px;
}

.separator {
    color: var(--md-sys-color-outline);
    font-size: 12px;
}

/* Main Content Layout */
.main-content {
    flex: 1;
    position: relative;
    overflow: hidden;
    padding: 1rem;
    display: flex;
    gap: 1rem;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Sidebar Styling */
.sidebar {
    width: 360px;
    background: var(--md-sys-color-surface);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    transition: transform 0.3s cubic-bezier(0.2, 0.0, 0, 1.0);
    overflow: hidden;
}

.sidebar-content {
    height: 100%;
    display: flex;
    flex-direction: column;
}

.sidebar-header {
    padding: 1.5rem;
    background: var(--md-sys-color-surface-container-low);
    border-bottom: 1px solid var(--md-sys-color-outline-variant);
}

.type-overline {
    text-transform: uppercase;
    font-size: 0.75rem;
    letter-spacing: 1px;
    color: var(--md-sys-color-secondary);
    font-weight: 500;
}

.sidebar-header h2 {
    margin: 0.5rem 0 1rem 0;
    font-size: 1.5rem;
    color: var(--md-sys-color-on-surface);
}

.status-tags {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.tag {
    font-size: 0.75rem;
    padding: 4px 12px;
    border-radius: 16px;
    background: var(--md-sys-color-tertiary-container);
    color: var(--md-sys-color-on-tertiary-container);
    font-weight: 500;
}

.tag.neutral {
    background: var(--md-sys-color-surface-container-high);
    color: var(--md-sys-color-on-surface-variant);
}

.tag.parent {
    background: var(--md-sys-color-secondary-container);
    color: var(--md-sys-color-on-secondary-container);
}

.sidebar-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
}

.info-group {
    margin-bottom: 1.25rem;
}

.info-group label {
    display: block;
    font-size: 0.75rem;
    color: var(--md-sys-color-secondary);
    margin-bottom: 0.25rem;
}

.info-group span {
    font-size: 1rem;
    color: var(--md-sys-color-on-surface);
}

.divider {
    height: 1px;
    background: var(--md-sys-color-outline-variant);
    margin: 1.5rem 0;
}

.stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
}

.stat-value {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--md-sys-color-primary);
}

.btn-filled {
    background: var(--md-sys-color-primary);
    color: var(--md-sys-color-on-primary);
    border: none;
    padding: 10px 24px;
    border-radius: 20px;
    font-weight: 500;
    cursor: pointer;
    transition: box-shadow 0.2s;
}

.btn-filled:hover {
    box-shadow: var(--md-sys-elevation-level1);
}

.btn-outlined {
    background: transparent;
    border: 1px solid var(--md-sys-color-outline);
    color: var(--md-sys-color-primary);
    padding: 10px 24px;
    border-radius: 20px;
    font-weight: 500;
    cursor: pointer;
}

.full-width {
    width: 100%;
}

.sidebar-empty {
    padding: 2rem;
    text-align: center;
    color: var(--md-sys-color-secondary);
}
</style>
