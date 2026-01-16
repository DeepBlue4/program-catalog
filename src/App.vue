<script setup>
import { computed, ref, watch, onUnmounted, provide, onErrorCaptured } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import SearchBox from './components/SearchBox.vue';
import UserMenu from './components/UserMenu.vue';
import { useProgramData } from './composables/useProgramData.js';
import { useProgramCatalogStore } from './store/programCatalogStore';
import BaseIcon from './components/BaseIcon.vue';
import { mdiChevronDown, mdiSitemap, mdiCodeBraces, mdiChevronRight } from '@mdi/js';
import { STATUS_COLORS } from './styles/statusConstants'; // Import Colors
import MultiSelectDropdown from './components/MultiSelectDropdown.vue';

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
            query: { effort_id: node.program_id }
        });
    } else {
        // Do NOT select the node here. 
        // We navigate to the route, and let ProgramEffortsView handle the selection logic/data fetching.
        // This ensures that if we are currently on a page with unsaved changes, 
        // the router guards act BEFORE the state changes and component destroys.
        
        // Always navigate to the program's efforts view when selected via search
        // This ensures the Search function acts as a navigation tool to the details page
        router.push({ 
            name: 'ProgramEfforts', 
            params: { programId: node.program_id } 
        });
    }
};

// View Switcher (Sidebar Button Action)
const handleViewEfforts = () => {
    if (selectedNode.value) {
        router.push({ name: 'ProgramEfforts', params: { programId: selectedNode.value.program_id } });
    }
};

const handleEffortClick = (effort) => {
    if (!selectedNode.value) return;
    router.push({
        name: 'ProgramEfforts',
        params: { programId: selectedNode.value.program_id },
        query: { effort_id: effort.id || effort.uuid }
    });
};

const handleBackToCatalog = () => {
    router.push('/');
};

// --- Breadcrumb Logic ---
const breadcrumbs = computed(() => {
    // UPDATED: Default to Icon instead of Text 'Home'
    const crumbs = [{ icon: mdiSitemap, name: 'Program Tree', id: null, path: '/' }]; 
    
    // Reset to default on specific pages
    if (['Dashboard', 'PermissionDenied'].includes(route.name)) {
        return crumbs;
    }

    if (selectedNode.value && chartData.value) {
        // Helper to find path in tree
        const findPath = (node, targetId, currentPath = []) => {
            const nodeId = node.program_id;
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
        const targetId = selectedNode.value.program_id;
        const treePath = findPath(chartData.value, targetId);
        if (treePath) {
             crumbs.pop(); // Remove static root
             treePath.forEach(n => crumbs.push({ 
                 name: n.name, 
                 id: n.program_id,
                 children: n.children // Pass children for dropdown
             }));
        } else {
             crumbs.push({ 
                 name: selectedNode.value.name, 
                 id: selectedNode.value.program_id,
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
        handleNodeSelect({ program_id: crumb.id, name: crumb.name });
    }
};

const showBreadcrumbDropdown = ref(false);
const breadcrumbDropdownRef = ref(null);

const toggleDropdown = () => {
    showBreadcrumbDropdown.value = !showBreadcrumbDropdown.value;
};


const showEffortsList = ref(true);

const toggleEffortsList = () => {
    showEffortsList.value = !showEffortsList.value;
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

// --- Environment Logic ---
const currentEnvironment = computed(() => {
    const host = window.location.hostname;
    if (host.includes('localhost')) return { label: 'Local', class: 'badge-local' };
    if (host.includes('daf-compass-dev')) return { label: 'Dev', class: 'badge-dev' };
    if (host.includes('daf-compass-stage')) return { label: 'Stage', class: 'badge-stage' };
    return null;
});
</script>

<template>
  <div class="app-container">
    <header class="top-bar m3-elevation-1">
      <div class="header-left">
          <div class="logo-area">
              <h1 class="app-title">Program Catalog</h1>
              <span v-if="currentEnvironment" class="env-badge" :class="currentEnvironment.class">{{ currentEnvironment.label }}</span>
          </div>
          
          <nav class="breadcrumbs">
            <template v-for="(crumb, index) in displayedBreadcrumbs" :key="index">
                <span v-if="index > 0 && !crumb.isEllipsis" class="separator">/</span>
                <span 
                    class="crumb" 
                    :class="{ 'active': index === displayedBreadcrumbs.length - 1 && !crumb.isEllipsis, 'ellipsis': crumb.isEllipsis, 'icon-crumb': crumb.icon }"
                    @click="handleBreadcrumbClick(crumb)"
                    :title="crumb.icon ? crumb.name : ''"
                >
                    <BaseIcon v-if="crumb.icon" :path="crumb.icon" :size="22" class="root-crumb-icon" />
                    <template v-else>{{ crumb.name }}</template>
                </span>

                <!-- Dropdown for Active/Last Crumb with Children -->
                <div 
                    v-if="index === displayedBreadcrumbs.length - 1 && crumb.children && crumb.children.length > 0" 
                    class="breadcrumb-dropdown-container"
                    ref="breadcrumbDropdownRef"
                >
                    <button class="icon-btn-small" @click.stop="toggleDropdown">
                        <BaseIcon :path="mdiChevronDown" :size="14" />
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
              <component :is="Component" :key="$route.path" />
          </transition>
      </router-view>

      <!-- M3 Sidebar / Drawer (Only on Catalog View) -->
      <aside v-if="isDashboard" class="sidebar m3-card outlined" :class="{ active: selectedNode }">
        <div v-if="selectedNode" class="sidebar-content">
           <div class="sidebar-header">
               <span class="type-overline">Selected Program</span>
               <h2>{{ selectedNode.name }}</h2>
                <div class="status-tags">
                   <!-- Primary Status -->
                   <span class="tag active" v-if="selectedNode.hasSoftwareEffort">Software Active</span>
                   <span class="tag gap" v-else-if="selectedNode.expecting_software_efforts">Expected (Missing)</span>
                   <span class="tag neutral" v-else>Neutral</span>
                   
                   <!-- Secondary Context -->
                   <span class="tag parent" v-if="selectedNode.has_descendant_expecting_software_effort">Parent of Effort</span>
               </div>
           </div>
           
           <div class="sidebar-body">
               <div class="info-group">
                   <label>ID</label>
                   <span>{{ selectedNode.program_id }}</span>
               </div>
               
               <!-- New Data Fields -->
               <div class="info-group">
                   <label>Program Leader</label>
                   <span>{{ selectedNode.organization_leader_name || 'N/A' }}</span>
               </div>
               <div class="info-group">
                   <label>Chief Engineer</label>
                   <span>{{ selectedNode.chief_engineer_name || 'N/A' }}</span>
               </div>
               <div class="info-group">
                   <label>Primary Location</label>
                   <span>{{ selectedNode.primary_location || 'N/A' }}</span>
               </div>
               <div class="info-group">
                   <label>Type</label>
                   <span>{{ selectedNode.program_type || 'N/A' }}</span>
               </div>
                <div class="info-group">
                   <label>Program Value</label>
                   <span>{{ selectedNode.program_value || 'N/A' }}</span>
               </div>
               
               <div class="divider"></div>
                             <div class="action-area" style="position: relative;">
                    <button 
                         v-if="selectedNode.softwareEfforts && selectedNode.softwareEfforts.length > 0" 
                         class="btn-filled full-width mb-3"
                         @click="handleViewEfforts"
                    >
                        View Software Efforts
                    </button>
                    <button v-else class="btn-outlined full-width mb-3" @click="handleViewEfforts">
                        Initialize Efforts
                    </button>
                    
                    <div 
                        class="section-header clickable" 
                        @click="toggleEffortsList"
                    >
                        <span class="section-label">Software Efforts ({{ selectedNode.softwareEfforts ? selectedNode.softwareEfforts.length : 0 }})</span>
                        <BaseIcon :path="showEffortsList ? mdiChevronDown : mdiChevronRight" :size="20" class="toggle-icon" />
                    </div>
                    
                    <div v-if="showEffortsList && selectedNode.softwareEfforts && selectedNode.softwareEfforts.length > 0" class="efforts-dropdown floating-dropdown">
                        <div 
                            v-for="effort in selectedNode.softwareEfforts" 
                            :key="effort.id || effort.uuid" 
                            class="effort-card"
                            @click="handleEffortClick(effort)"
                        >
                            <div class="effort-card-content">
                                <span class="effort-name">{{ effort.name }}</span>
                                <span class="effort-id"><span class="id-label">ID:</span> {{ effort.id || effort.uuid }}</span>
                            </div>
                            <BaseIcon :path="mdiChevronRight" :size="18" class="effort-arrow" />
                        </div>
                    </div>
               </div>
           </div>
        </div>
        <div v-else class="sidebar-empty">
            <p>Select a Program from the chart to view details.</p>
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
  background-color: #FEF7FF; /* background */
  color: #1D1B20; /* on-background */
}

/* Header */
.top-bar {
    height: 64px;
    padding: 0 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: #0039A6; /* Boeing Blue */
    color: #FFFFFF; /* on-primary (white) */
    z-index: 10;
    position: relative;
}

.m3-elevation-1 {
    box-shadow: 0px 1px 3px 1px rgba(0, 0, 0, 0.15), 0px 1px 2px 0px rgba(0, 0, 0, 0.3); /* elevation-level1 */
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
    border-right: 1px solid rgba(255, 255, 255, 0.3); /* outline-variant (on-dark) */
}

.env-badge {
    font-size: 0.65rem;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.badge-local {
    background-color: #FFDF90; /* tertiary-container */
    color: #241A00; /* on-tertiary-container */
    border: 1px solid #755B00; /* tertiary */
}

.badge-dev {
    background-color: #D8E2FF; /* primary-container */
    color: #001D35; /* on-primary-container */
    border: 1px solid #005AC1; /* primary */
}

.badge-stage {
    background-color: #FFDAD6; /* error-container */
    color: #410002; /* on-error-container */
    border: 1px solid #BA1A1A; /* error */
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
    color: rgba(255, 255, 255, 0.7); /* secondary (on-dark) */
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
    background: rgba(255, 255, 255, 0.1); /* surface-container-high (on-dark overlay) */
    color: #FFFFFF; /* on-surface */
}

.dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 8px;
    background: #FEF7FF; /* surface */
    border-radius: 8px;
    min-width: 200px;
    max-height: 300px;
    overflow-y: auto;
    z-index: 100;
    padding: 8px 0;
    border: 1px solid #C4C7C5; /* outline-variant */
}

.m3-elevation-2 {
    box-shadow: 0px 2px 6px 2px rgba(0, 0, 0, 0.15), 0px 1px 2px 0px rgba(0, 0, 0, 0.3); /* elevation-level2 */
}

.dropdown-header {
    padding: 8px 16px;
    font-size: 11px;
    text-transform: uppercase;
    color: #625B71; /* secondary */
    font-weight: 600;
    letter-spacing: 0.5px;
}

.dropdown-item {
    padding: 8px 16px;
    font-size: 14px;
    color: #1D1B20; /* on-surface */
    cursor: pointer;
    transition: background 0.2s;
}

.dropdown-item:hover {
    background: #ECE6F0; /* surface-container-high */
}

.breadcrumbs {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-left: 1rem;
    font-size: 14px;
    white-space: nowrap;
}

.crumb {
    color: rgba(255, 255, 255, 0.7); /* secondary (on-dark) */
    cursor: pointer;
    transition: color 0.2s;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    display: flex;
    align-items: center;
}

.crumb:hover:not(.active):not(.ellipsis) {
    color: #FFFFFF; /* primary/highlight (on-dark) */
    text-decoration: underline;
}

.crumb.active {
    color: #FFFFFF; /* on-surface (on-dark) */
    font-weight: 600;
    cursor: default;
}

.crumb.ellipsis {
    cursor: default;
    color: rgba(255, 255, 255, 0.5); /* outline (on-dark) */
    letter-spacing: 2px;
}

.separator {
    color: rgba(255, 255, 255, 0.4); /* outline (on-dark) */
    font-size: 12px;
}

.root-crumb-icon {
    transform: rotate(270deg);
    color: #FFFFFF;
}

/* Make icon crumb look clickable */
.crumb.icon-crumb {
    padding: 6px 10px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.1);
    transition: all 0.2s ease;
    cursor: pointer;
}

.crumb.icon-crumb:hover {
    background: rgba(255, 255, 255, 0.25);
    transform: scale(1.05);
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
    background: #FEF7FF; /* surface */
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
    background: #F7F2FA; /* surface-container-low */
    border-bottom: 1px solid #C4C7C5; /* outline-variant */
}

.type-overline {
    text-transform: uppercase;
    font-size: 0.75rem;
    letter-spacing: 1px;
    color: #625B71; /* secondary */
    font-weight: 500;
}

.sidebar-header h2 {
    margin: 0.5rem 0 1rem 0;
    font-size: 1.5rem;
    color: #1D1B20; /* on-surface */
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
    font-weight: 500;
}

.tag.active {
    background: v-bind('STATUS_COLORS.active.bg');
    color: v-bind('STATUS_COLORS.active.text');
}

.tag.gap {
    background: v-bind('STATUS_COLORS.gap.bg');
    color: v-bind('STATUS_COLORS.gap.text');
}

.tag.neutral {
    background: v-bind('STATUS_COLORS.neutral.bg');
    color: v-bind('STATUS_COLORS.neutral.text');
}

.tag.parent {
    background: v-bind('STATUS_COLORS.parent.bg');
    color: v-bind('STATUS_COLORS.parent.text');
}

.sidebar-body {
    padding: 1.5rem;
    padding-bottom: 20rem; /* Extra space for floating dropdown */
    overflow-y: auto;
    flex: 1;
}

.info-group {
    margin-bottom: 1.25rem;
}

.info-group label {
    display: block;
    font-size: 0.75rem;
    color: #625B71; /* secondary */
    margin-bottom: 0.25rem;
}

.info-group span {
    font-size: 1rem;
    color: #1D1B20; /* on-surface */
}

.divider {
    height: 1px;
    background: #C4C7C5; /* outline-variant */
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
    color: #005AC1; /* primary */
}

.btn-filled {
    background: #005AC1; /* primary */
    color: #FFFFFF; /* on-primary */
    border: none;
    padding: 10px 24px;
    border-radius: 20px;
    font-weight: 500;
    cursor: pointer;
    transition: box-shadow 0.2s;
}

.btn-filled:hover {
    box-shadow: 0px 1px 3px 1px rgba(0, 0, 0, 0.15), 0px 1px 2px 0px rgba(0, 0, 0, 0.3); /* elevation-level1 */
}

.btn-outlined {
    background: transparent;
    border: 1px solid #79747E; /* outline */
    color: #005AC1; /* primary */
    padding: 10px 24px;
    border-radius: 20px;
    font-weight: 500;
    cursor: pointer;
}

.full-width {
    width: 100%;
}

.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    cursor: pointer;
    user-select: none;
    border-top: 1px solid #E7E0EC;
    margin-top: 8px;
}

.section-header:hover .section-label {
    color: #1D1B20;
}

.section-label {
    font-size: 0.75rem;
    color: #625B71;
    font-weight: 500;
    text-transform: uppercase;
}

.toggle-icon {
    color: #625B71;
    transition: transform 0.2s;
}

.efforts-dropdown.floating-dropdown {
    position: absolute;
    /* Aligned to the left of the click action (relative to action-area) */
    top: 100%; /* Below the header (technically below the whole action-area relative parent if not careful, but flex column flow inside means we need to key off the header) */
    /* Check structure: action-area is relative. Header is inside. If we want it relative to Header, Header should be relative? 
       Actually user said "aligned to the left of the click action". 
       Let's position it absolute relative to the .action-area container for simplicity as requested "floating".
    */
    left: 0;
    right: 0; 
    z-index: 50;
    background: #FFFFFF;
    border: 1px solid #C4C7C5;
    border-radius: 8px;
    box-shadow: 0px 4px 8px rgba(0,0,0,0.15);
    max-height: 300px;
    overflow-y: auto;
    margin-top: 4px;
}

.efforts-dropdown {
    display: flex;
    flex-direction: column;
    background: #FFFFFF;
    border: 1px solid #E7E0EC;
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 1rem;
    box-shadow: 0px 1px 2px rgba(0,0,0,0.1);
}

.effort-card {
    padding: 12px 16px;
    cursor: pointer;
    border-bottom: 1px solid #E7E0EC;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.effort-card:last-child {
    border-bottom: none;
}

.effort-card:hover {
    background: linear-gradient(90deg, #F3EDF7 0%, #E8DEF8 100%);
    padding-left: 20px;
}

.effort-card:hover .effort-arrow {
    opacity: 1;
    transform: translateX(2px);
}

.effort-card-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
}

.effort-name {
    font-size: 14px;
    color: #1D1B20;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.effort-id {
    font-size: 11px;
    color: #79747E;
    font-family: 'Roboto Mono', monospace;
}

.id-label {
    color: #625B71;
    font-weight: 600;
    font-family: inherit;
}

.effort-arrow {
    color: #625B71;
    opacity: 0;
    transition: all 0.15s ease;
    flex-shrink: 0;
}

.mt-2 {
    margin-top: 0.5rem;
}

.mb-3 {
    margin-bottom: 0.75rem;
}

.sidebar-empty {
    padding: 2rem;
    text-align: center;
    color: #625B71; /* secondary */
}
</style>
