<script setup>
import { ref, onMounted, computed, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import * as echarts from 'echarts';
import BaseIcon from '../components/BaseIcon.vue';
import {
  mdiLayers,
  mdiInformation,
  mdiClipboardCheck,
  mdiSourceBranch,
  mdiAlert,
  mdiSitemap,
  mdiCircle,
  mdiFolderOpen,
  mdiArrowRight,
  mdiCheckCircle,
  mdiClose,
  mdiLightbulb
} from '@mdi/js';
import { useProgramData } from '../composables/useProgramData';

const router = useRouter();
const { allNodes, selectNode } = useProgramData();

const chartRefCompliance = ref(null);
let chartInstanceCompliance = null;

// Modal State
const activeMetricModal = ref(null);

// Metrics & Lists
const dashboardData = computed(() => {
    const nodes = allNodes.value;
    const programs = nodes.filter(n => !n.isSoftwareEffort);
    
    // Core Sets
    const expecting = programs.filter(n => n.expect_software_effort);
    const hasEffort = programs.filter(n => n.hasSoftwareEffort);
    
    // Derived Sets
    const missing = expecting.filter(n => !n.hasSoftwareEffort);
    const parent = programs.filter(n => n.has_descendant_expecting_software_effort && !n.hasSoftwareEffort);
    
    // Strict Neutral: No effort, no expectation, no descendant activity
    const neutral = programs.filter(n => 
        !n.hasSoftwareEffort && 
        !n.expect_software_effort && 
        !n.has_descendant_expecting_software_effort
    );
    
    // Non-Compliant List for Table
    const nonCompliantList = missing.map(n => ({
        id: n.value,
        name: n.name,
        leader: n.details?.programLeader || n.programLeader || 'N/A',
        value: n.details?.programValue || n.programValue || 'N/A',
        rawNode: n
    }));

    const complianceRate = expecting.length 
        ? Math.round(((expecting.length - missing.length) / expecting.length) * 100) 
        : 100;

    return {
        counts: {
            total: programs.length,
            expecting: expecting.length,
            active: hasEffort.length,
            missing: missing.length,
            parent: parent.length,
            neutral: neutral.length
        },
        complianceRate,
        nonCompliantList
    };
});

// Context Definitions
const metricDefinitions = {
    total: {
        title: 'Total Programs',
        desc: 'The total number of Program, Division, and Unit nodes currently tracked in the catalog.',
        context: 'This represents the entire scope of the organization\'s hierarchy.'
    },
    expecting: {
        title: 'Expecting Software',
        desc: 'Programs that have been flagged as requiring software deliverables.',
        context: 'This is the baseline for our compliance tracking. Every program here should eventually have an active effort.'
    },
    active: {
        title: 'Active (Has Effort)',
        desc: 'Programs that currently have at least one assigned Software Effort.',
        context: 'These programs are actively delivering software functionality.'
    },
    missing: {
        title: 'Missing Efforts (Gap)',
        desc: 'Programs that Expect Software but have Zero assigned efforts.',
        context: 'CRITICAL: These programs are non-compliant and require immediate attention to link or create software efforts.'
    },
    parent: {
        title: 'Parent Programs',
        desc: 'Programs that do not have their own efforts but contain sub-programs that do.',
        context: 'These act as organizational containers and aggregators for lower-level software work.'
    },
    neutral: {
        title: 'Neutral Programs',
        desc: 'Programs with no active efforts, no expectations, and no active descendants.',
        context: 'These nodes exist primarily for organizational structure and have no direct software workload.'
    }
};

const openMetricModal = (key) => {
    activeMetricModal.value = key;
};

const closeMetricModal = () => {
    activeMetricModal.value = null;
};

// Helper to get CSS variable value
const getCssVar = (name) => {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
};

const initCharts = () => {
    // Theme Colors derived from CSS variables
    const primaryColor = getCssVar('--md-sys-color-primary') || '#6750A4';
    const errorColor = getCssVar('--md-sys-color-error') || '#B3261E';

    // Compliance Gauge
    if (chartRefCompliance.value) {
        chartInstanceCompliance = echarts.init(chartRefCompliance.value);
        const rate = dashboardData.value.complianceRate;

        chartInstanceCompliance.setOption({
             series: [{
                type: 'gauge',
                startAngle: 180,
                endAngle: 0,
                center: ['50%', '75%'],
                radius: '100%',
                min: 0,
                max: 100,
                splitNumber: 5,
                itemStyle: {
                    color: rate >= 90 ? primaryColor : errorColor
                },
                axisLine: {
                    lineStyle: {
                        width: 20,
                        color: [
                            [0.7, errorColor], 
                            [0.9, getCssVar('--md-sys-color-surface-variant') || '#E7E0EC'], 
                            [1, primaryColor]    
                        ]
                    }
                },
                pointer: { show: false },
                axisTick: { show: false },
                splitLine: { show: false },
                axisLabel: { show: false },
                detail: {
                    fontSize: 36,
                    offsetCenter: [0, '-20%'],
                    valueAnimation: true,
                    formatter: '{value}%',
                    color: 'inherit'
                },
                data: [{ value: rate, name: 'Compliance Rate' }]
            }]
        });
    }
};

const handleResize = () => {
    chartInstanceCompliance?.resize();
};

const navigateToProgram = (node) => {
    selectNode(node);
    router.push({ name: 'ProgramEfforts', params: { programId: node.value } });
};

// Re-init charts if theme changes or data loads
watch(allNodes, () => {
    initCharts();
});

onMounted(() => {
    setTimeout(() => {
        initCharts();
    }, 100);
    window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
    window.removeEventListener('resize', handleResize);
    chartInstanceCompliance?.dispose();
});

</script>

<template>
  <div class="dashboard-container">
    <!-- ... (Header and Metrics Grid remain unchanged) ... -->
    <div class="header-section">
        <h1>Analytics Dashboard</h1>
        <p>Enterprise insights, software delivery tracking, and compliance metrics</p>
    </div>

    <!-- Metrics Grid (6 items) -->
    <div class="metrics-grid">
        <!-- 1. Total -->
        <div class="metric-card m3-card filled interactive" @click="openMetricModal('total')">
            <div class="card-icon neutral">
                <BaseIcon :path="mdiLayers" />
            </div>
            <div class="metric-content">
                <span class="value">{{ dashboardData.counts.total }}</span>
                <span class="label">Total Programs</span>
            </div>
            <BaseIcon :path="mdiInformation" class="info-icon" />
        </div>
        
        <!-- 2. Expecting -->
        <div class="metric-card m3-card filled interactive" @click="openMetricModal('expecting')">
            <div class="card-icon primary">
                <BaseIcon :path="mdiClipboardCheck" />
            </div>
             <div class="metric-content">
                <span class="value">{{ dashboardData.counts.expecting }}</span>
                <span class="label">Expecting Effort</span>
            </div>
             <BaseIcon :path="mdiInformation" class="info-icon" />
        </div>

        <!-- 3. Active (Has Effort) -->
        <div class="metric-card m3-card filled interactive" @click="openMetricModal('active')">
            <div class="card-icon good">
                <BaseIcon :path="mdiSourceBranch" />
            </div>
             <div class="metric-content">
                <span class="value">{{ dashboardData.counts.active }}</span>
                <span class="label">Active Efforts</span>
            </div>
             <BaseIcon :path="mdiInformation" class="info-icon" />
        </div>

        <!-- 4. Missing (Complaince Gap) -->
        <div class="metric-card m3-card filled interactive warning-card" @click="openMetricModal('missing')">
            <div class="card-icon warning">
                <BaseIcon :path="mdiAlert" />
            </div>
            <div class="metric-content">
                <span class="value">{{ dashboardData.counts.missing }}</span>
                <span class="label">Missing Efforts</span>
            </div>
             <BaseIcon :path="mdiInformation" class="info-icon" />
        </div>

        <!-- 5. Parent -->
        <div class="metric-card m3-card filled interactive" @click="openMetricModal('parent')">
            <div class="card-icon neutral">
                <BaseIcon :path="mdiSitemap" />
            </div>
            <div class="metric-content">
                <span class="value">{{ dashboardData.counts.parent }}</span>
                <span class="label">Parent Programs</span>
            </div>
             <BaseIcon :path="mdiInformation" class="info-icon" />
        </div>

         <!-- 6. Neutral -->
        <div class="metric-card m3-card filled interactive" @click="openMetricModal('neutral')">
            <div class="card-icon neutral-light">
                <BaseIcon :path="mdiCircle" />
            </div>
            <div class="metric-content">
                <span class="value">{{ dashboardData.counts.neutral }}</span>
                <span class="label">Neutral Programs</span>
            </div>
             <BaseIcon :path="mdiInformation" class="info-icon" />
        </div>
    </div>

    <!-- Main Content Area -->
    <div class="content-grid">
        <!-- Actionable List -->
        <div class="list-card m3-card outlined">
            <div class="card-header">
                <h3>Action Needed: Missing Efforts</h3>
                <span class="badge warning">{{ dashboardData.counts.missing }} Programs</span>
            </div>
            
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Program Name</th>
                            <th>ID</th>
                            <th>Leader</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="item in dashboardData.nonCompliantList" :key="item.id">
                            <td class="name-cell">
                                <BaseIcon :path="mdiFolderOpen" class="icon-indicator" />
                                {{ item.name }}
                            </td>
                            <td class="id-cell">{{ item.id }}</td>
                            <td>{{ item.leader }}</td>
                            <td>
                                <button class="btn-text" @click="navigateToProgram(item.rawNode)">
                                    Review <BaseIcon :path="mdiArrowRight" />
                                </button>
                            </td>
                        </tr>
                        <tr v-if="dashboardData.nonCompliantList.length === 0">
                            <td colspan="4" class="empty-state">
                                <BaseIcon :path="mdiCheckCircle" /> No concerns found. All programs are compliant.
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        
        <!-- Compliance Chart -->
        <div class="chart-card m3-card outlined compliance-card">
            <!-- ... (Chart content remains unchanged) ... -->
            <div class="chart-header">
                <h3>Platform Compliance</h3>
                <p>Programs meeting expectations</p>
            </div>
            <div class="chart-wrapper" ref="chartRefCompliance"></div>
            <div class="legend-mini">
                <div class="legend-item">
                    <span class="dot error"></span> < 70%
                </div>
                <div class="legend-item">
                    <span class="dot good"></span> > 90%
                </div>
            </div>
        </div>
    </div>

    <!-- Interactive Metric Modal -->
    <transition name="fade">
        <div v-if="activeMetricModal" class="modal-backdrop" @click="closeMetricModal">
            <div class="metric-modal m3-card elevated" @click.stop>
                <div class="modal-header">
                    <h2>{{ metricDefinitions[activeMetricModal].title }}</h2>
                    <button class="close-btn" @click="closeMetricModal"><BaseIcon :path="mdiClose" /></button>
                </div>
                <div class="modal-body">
                    <p class="definition">{{ metricDefinitions[activeMetricModal].desc }}</p>
                    <div class="context-box">
                        <BaseIcon :path="mdiLightbulb" />
                        <p>{{ metricDefinitions[activeMetricModal].context }}</p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-filled" @click="closeMetricModal">Confirm</button>
                </div>
            </div>
        </div>
    </transition>

  </div>
</template>

<style scoped>
/* ... (Keep existing styles) ... */
.dashboard-container {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    background-color: var(--md-sys-color-background);
    color: var(--md-sys-color-on-background);
    padding: 1.5rem;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.header-section {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.header-section h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 500;
    color: var(--md-sys-color-on-background);
}

.header-section p {
    margin: 0;
    font-size: 14px;
    color: var(--md-sys-color-secondary);
}

/* Metrics Grid - 6 Columns adaptive */
.metrics-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr); /* Default to 3 columns */
    gap: 1rem;
    width: 100%;
}

@media (max-width: 1100px) {
    .metrics-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (max-width: 600px) {
    .metrics-grid {
        grid-template-columns: 1fr;
    }
}

.metric-card {
    display: flex;
    align-items: center;
    padding: 1.25rem;
    gap: 1rem;
    border-radius: 12px;
    background-color: var(--md-sys-color-surface-container);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    cursor: pointer;
    border: 1px solid transparent;
}

.metric-card:hover {
    box-shadow: var(--md-sys-elevation-level2);
    transform: translateY(-2px);
    border-color: var(--md-sys-color-primary);
}

.info-icon {
    position: absolute;
    top: 10px;
    right: 10px;
    color: var(--md-sys-color-outline);
    font-size: 14px;
    opacity: 0;
    transition: opacity 0.2s;
}

.metric-card:hover .info-icon {
    opacity: 1;
}

.card-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
}

/* Icons Colors */
.card-icon.primary { background-color: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container); }
.card-icon.good { background-color: var(--md-sys-color-tertiary-container); color: var(--md-sys-color-on-tertiary-container); }
.card-icon.warning { background-color: var(--md-sys-color-error-container); color: var(--md-sys-color-on-error-container); }
.card-icon.neutral { background-color: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
.card-icon.neutral-light { background-color: var(--md-sys-color-surface-container-high); color: var(--md-sys-color-on-surface-variant); }

.metric-content {
    display: flex;
    flex-direction: column;
}

.metric-content .value {
    font-size: 24px;
    font-weight: 600;
    line-height: 1.2;
    color: var(--md-sys-color-on-surface);
}

.metric-content .label {
    font-size: 11px;
    font-weight: 500;
    color: var(--md-sys-color-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

/* Content Grid */
.content-grid {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 1.5rem;
    flex: 1;
    min-height: 400px;
}

@media (max-width: 900px) {
    .content-grid {
        grid-template-columns: 1fr;
    }
}

/* Action List Card */
.list-card {
    background-color: var(--md-sys-color-surface);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: 12px;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.25rem;
}

.list-card h3, .chart-card h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 500;
    color: var(--md-sys-color-on-surface);
}

.badge.warning {
    background: var(--md-sys-color-error-container);
    color: var(--md-sys-color-on-error-container);
    font-size: 12px;
    padding: 4px 12px;
    border-radius: 100px;
    font-weight: 600;
}

.table-container {
    flex: 1;
    overflow-y: auto;
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: 8px;
    margin-top: 1rem;
}

.data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
}

.data-table th {
    text-align: left;
    padding: 12px 16px;
    background: var(--md-sys-color-surface-container-low);
    color: var(--md-sys-color-secondary);
    font-weight: 500;
    position: sticky;
    top: 0;
    z-index: 1;
}

.data-table td {
    padding: 12px 16px;
    border-bottom: 1px solid var(--md-sys-color-outline-variant);
    color: var(--md-sys-color-on-surface);
}

.data-table .id-cell {
    font-family: monospace;
    font-size: 12px;
    color: var(--md-sys-color-secondary);
}

.btn-text {
    background: none;
    border: none;
    color: var(--md-sys-color-primary);
    font-weight: 500;
    cursor: pointer;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 4px;
}

.btn-text:hover {
    background: var(--md-sys-color-surface-container-high);
}

/* Empty State */
.empty-state {
    text-align: center;
    padding: 2rem !important;
    color: var(--md-sys-color-primary);
    font-weight: 500;
}

/* Chart Card */
.chart-card {
    background-color: var(--md-sys-color-surface);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: 12px;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
}

.chart-header {
    text-align: center;
    margin-bottom: 1rem;
}

.chart-header p {
    margin: 4px 0 0 0;
    font-size: 12px;
    color: var(--md-sys-color-secondary);
}

.chart-wrapper {
    flex: 1;
    width: 100%;
    min-height: 250px;
}

.legend-mini {
    display: flex;
    gap: 1rem;
    font-size: 12px;
    color: var(--md-sys-color-secondary);
    margin-top: 1rem;
}

.legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
}

.dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
}

.dot.error { background: var(--md-sys-color-error); }
.dot.neutral { background: var(--md-sys-color-surface-variant); }
.dot.good { background: var(--md-sys-color-primary); }

/* Modals */
.modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0,0,0,0.5);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    /* backdrop-filter: none;  Removed per request */
}

.metric-modal {
    background: var(--md-sys-color-surface);
    width: 400px;
    max-width: 90%;
    border-radius: 28px;
    padding: 1.5rem;
    box-shadow: var(--md-sys-elevation-level3);
    display: flex;
    flex-direction: column;
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
}

.modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    color: var(--md-sys-color-on-surface);
}

.close-btn {
    background: transparent;
    border: none;
    font-size: 1.25rem;
    color: var(--md-sys-color-on-surface-variant);
    cursor: pointer;
    padding: 4px;
    border-radius: 50%;
}

.close-btn:hover {
    background: var(--md-sys-color-surface-container-high);
}

.modal-body {
    flex: 1;
}

.definition {
    font-size: 1rem;
    color: var(--md-sys-color-on-surface-variant);
    margin-bottom: 1.5rem;
    line-height: 1.5;
}

.context-box {
    background: var(--md-sys-color-secondary-container);
    color: var(--md-sys-color-on-secondary-container);
    padding: 1rem;
    border-radius: 12px;
    display: flex;
    gap: 1rem;
    align-items: flex-start;
}

.context-box i {
    font-size: 1.25rem;
    margin-top: 2px;
}

.context-box p {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.4;
}

.modal-footer {
    margin-top: 1.5rem;
    display: flex;
    justify-content: flex-end;
}

.btn-filled {
    background: var(--md-sys-color-primary);
    color: var(--md-sys-color-on-primary);
    border: none;
    padding: 10px 24px;
    border-radius: 100px;
    font-weight: 500;
    cursor: pointer;
    transition: box-shadow 0.2s;
}

.btn-filled:hover {
    box-shadow: var(--md-sys-elevation-level1);
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
</style>
