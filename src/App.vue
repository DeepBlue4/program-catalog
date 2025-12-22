<script setup>
import { computed } from 'vue';
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
    if (route.name === 'ProgramEfforts') {
        router.push({ name: 'ProgramEfforts', params: { programId: node.value } });
    } else {
        selectNode(node);
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
    const crumbs = [{ name: 'Program Catalog', id: null, path: '/' }]; // Root
    
    if (selectedNode.value && chartData.value) {
        // Helper to find path in tree
        const findPath = (node, targetId, currentPath = []) => {
            if (node.value === targetId) return [...currentPath, node];
            if (node.children) {
                for (const child of node.children) {
                    const res = findPath(child, targetId, [...currentPath, node]);
                    if (res) return res;
                }
            }
            return null;
        };
        
        const treePath = findPath(chartData.value, selectedNode.value.value);
        if (treePath) {
             crumbs.pop(); // Remove static root
             treePath.forEach(n => crumbs.push({ name: n.name, id: n.value }));
        } else {
             crumbs.push({ name: selectedNode.value.name, id: selectedNode.value.value });
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
        // If we represent a "folder", maybe we stay in catalog view.

    }
};
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
                   
                   <span class="tag parent" v-if="selectedNode.containsSoftwareEffort">Parent of Effort</span>
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

.breadcrumbs {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-left: 1rem;
    font-size: 14px;
    white-space: nowrap;
    overflow: hidden;
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
