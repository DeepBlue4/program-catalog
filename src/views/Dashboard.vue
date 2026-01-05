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
  mdiLightbulb,
  mdiAlertCircle, // For Anomaly
  mdiTable,       // For All Active
  mdiFormatListBulleted
} from '@mdi/js';
import { useProgramData } from '../composables/useProgramData';
import { STATUS_COLORS, RAW_COLORS } from '../styles/statusConstants'; // Import Colors

const router = useRouter();
const { allNodes, selectNode } = useProgramData();

const chartRefCompliance = ref(null);
const chartRefCoverage = ref(null);
const chartRefValidity = ref(null);
let chartInstanceCompliance = null;
let chartInstanceCoverage = null;
let chartInstanceValidity = null;

// Modal State
const activeMetricModal = ref(null);

// List View State
const activeListTab = ref('missing'); // 'missing', 'anomaly', 'active'

// Metrics & Lists
const dashboardData = computed(() => {
    const nodes = allNodes.value;
    const programs = nodes.filter(n => !n.isSoftwareEffort);
    
    // Core Sets
    // Correct property is 'expecting_software_efforts' based on OrgChart logic
    const expecting = programs.filter(n => n.expecting_software_efforts);
    const hasEffort = programs.filter(n => n.hasSoftwareEffort);
    
    // Derived Sets
    const missing = expecting.filter(n => !n.hasSoftwareEffort);
    const anomaly = hasEffort.filter(n => !n.expecting_software_efforts); // Unexpected but Active
    const parent = programs.filter(n => n.has_descendant_expecting_software_effort && !n.hasSoftwareEffort);
    
    // Strict Neutral: No effort, no expectation, no descendant activity
    const neutral = programs.filter(n => 
        !n.hasSoftwareEffort && 
        !n.expecting_software_efforts && 
        !n.has_descendant_expecting_software_effort
    );

    // Helpers for List Mapping
    const mapNodeToList = (n) => ({
        id: n.value,
        name: n.name,
        leader: n.details?.programLeader || n.programLeader || 'N/A',
        count: n.softwareEfforts ? n.softwareEfforts.length : 0,
        rawNode: n
    });
    
    const missingList = missing.map(mapNodeToList);
    const anomalyList = anomaly.map(mapNodeToList);
    const activeList = hasEffort.map(mapNodeToList); // All active for admin review

    const complianceRate = expecting.length 
        ? Math.round(((expecting.length - missing.length) / expecting.length) * 100) 
        : 100;

    return {
        counts: {
            total: programs.length,
            expecting: expecting.length,
            active: hasEffort.length,
            missing: missing.length,
            anomaly: anomaly.length,
            parent: parent.length,
            neutral: neutral.length
        },
        complianceRate,
        lists: {
            missing: missingList,
            anomaly: anomalyList,
            active: activeList
        }
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
    anomaly: {
        title: 'Unexpected Efforts',
        desc: 'Programs that have Active Software Efforts but were NOT flagged to expect them.',
        context: 'Configuration Alert: Validate if the "Expect Software" flag should be enabled or if the effort is misplaced.'
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

const initCharts = () => {
    // Theme Colors
    const primaryColor = RAW_COLORS.primary;
    const errorColor = RAW_COLORS.error;
    const surfaceVariant = '#E7E0EC'; // Placeholder or add to constants if reused often

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
                            [0.9, surfaceVariant], 
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

    // Coverage Chart (Expecting vs Filled vs Missing)
    if (chartRefCoverage.value) {
        chartInstanceCoverage = echarts.init(chartRefCoverage.value);
        const data = dashboardData.value.counts;
        const filled = data.expecting - data.missing;

        chartInstanceCoverage.setOption({
            tooltip: { trigger: 'item' },
            legend: { top: '5%', left: 'center', show: false },
            series: [{
                name: 'Coverage',
                type: 'pie',
                radius: ['40%', '70%'],
                avoidLabelOverlap: false,
                itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
                label: { show: false },
                emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
                data: [
                    { value: filled, name: 'Filled', itemStyle: { color: primaryColor } },
                    { value: data.missing, name: 'Missing', itemStyle: { color: errorColor } }
                ]
            }]
        });
    }

    // Validity Chart (Active vs Valid vs Unexpected)
    if (chartRefValidity.value) {
        chartInstanceValidity.setOption && chartInstanceValidity.dispose();
        chartInstanceValidity = echarts.init(chartRefValidity.value);
        const data = dashboardData.value.counts;
        const valid = data.active - data.anomaly;
        
        chartInstanceValidity.setOption({
            tooltip: { trigger: 'item' },
            legend: { show: false },
            series: [{
                name: 'Validity',
                type: 'pie',
                radius: ['40%', '70%'],
                avoidLabelOverlap: false,
                itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
                label: { show: false },
                emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
                data: [
                    { value: valid, name: 'Valid', itemStyle: { color: primaryColor } }, // Using primary for Valid
                    { value: data.anomaly, name: 'Unexpected', itemStyle: { color: RAW_COLORS.errorContainer } } 
                ]
            }]
        });
    }
};

const handleResize = () => {
    chartInstanceCompliance?.resize();
    chartInstanceCoverage?.resize();
    chartInstanceValidity?.resize();
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
    chartInstanceCoverage?.dispose();
    chartInstanceValidity?.dispose();
});

</script>

<template>
  <div class="dashboard-container">
    <div class="header-section">
        <h1>Analytics Dashboard</h1>
        <p>Enterprise insights, software delivery tracking, and compliance metrics</p>
    </div>

    <!-- Section 1: Program Health (Visualization) -->
    <section class="dashboard-section">
        <h2 class="section-title">Program Health</h2>
        <div class="charts-grid">
            <!-- 1. Compliance -->
            <div class="chart-card m3-card outlined compliance-card">
                <div class="chart-header">
                    <h3>Platform Compliance</h3>
                    <p>Meeting expectations</p>
                </div>
                <div class="chart-wrapper" ref="chartRefCompliance"></div>
                <div class="legend-mini">
                    <div class="legend-item"><span class="dot error"></span> < 70%</div>
                    <div class="legend-item"><span class="dot good"></span> > 90%</div>
                </div>
            </div>

            <!-- 2. Coverage -->
            <div class="chart-card m3-card outlined">
                <div class="chart-header">
                    <h3>Effort Coverage</h3>
                    <p>Expected programs with efforts</p>
                </div>
                <div class="chart-wrapper" ref="chartRefCoverage"></div>
                <div class="legend-mini">
                     <div class="legend-item"><span class="dot primary"></span> Filled</div>
                     <div class="legend-item"><span class="dot error"></span> Missing</div>
                </div>
            </div>

            <!-- 3. Validity -->
             <div class="chart-card m3-card outlined">
                <div class="chart-header">
                    <h3>Data Validity</h3>
                    <p>Active efforts validation</p>
                </div>
                <div class="chart-wrapper" ref="chartRefValidity"></div>
                <div class="legend-mini">
                     <div class="legend-item"><span class="dot primary"></span> Valid</div>
                     <div class="legend-item"><span class="dot warning-color"></span> Unexpected</div>
                </div>
            </div>
        </div>
    </section>

    <!-- Section 2: Catalog Inventory (Metrics) -->
    <section class="dashboard-section">
        <h2 class="section-title">Catalog Inventory</h2>
        <div class="inventory-grid">
            <!-- Expecting -->
            <div class="metric-card m3-card filled interactive" @click="openMetricModal('expecting')">
                <div class="card-icon primary small-icon">
                    <BaseIcon :path="mdiClipboardCheck" />
                </div>
                 <div class="metric-content">
                    <span class="value">{{ dashboardData.counts.expecting }}</span>
                    <span class="label">Expecting Effort</span>
                </div>
            </div>

            <!-- Missing -->
            <div class="metric-card m3-card filled interactive warning-card" @click="openMetricModal('missing')">
                <div class="card-icon warning small-icon">
                    <BaseIcon :path="mdiAlert" />
                </div>
                <div class="metric-content">
                    <span class="value">{{ dashboardData.counts.missing }}</span>
                    <span class="label">Missing Efforts</span>
                </div>
            </div>

            <!-- Unexpectd -->
            <div class="metric-card m3-card filled interactive anomaly-card" @click="openMetricModal('anomaly')">
                <div class="card-icon error-container small-icon">
                    <BaseIcon :path="mdiAlertCircle" />
                </div>
                <div class="metric-content">
                    <span class="value">{{ dashboardData.counts.anomaly }}</span>
                    <span class="label">Unexpected Efforts</span>
                </div>
            </div>

            <!-- Total -->
            <div class="metric-card m3-card filled interactive" @click="openMetricModal('total')">
                <div class="card-icon neutral small-icon">
                    <BaseIcon :path="mdiLayers" />
                </div>
                <div class="metric-content">
                    <span class="value">{{ dashboardData.counts.total }}</span>
                    <span class="label">Total Programs</span>
                </div>
            </div>

            <!-- Active -->
            <div class="metric-card m3-card filled interactive" @click="openMetricModal('active')">
                <div class="card-icon good small-icon">
                    <BaseIcon :path="mdiSourceBranch" />
                </div>
                 <div class="metric-content">
                    <span class="value">{{ dashboardData.counts.active }}</span>
                    <span class="label">Active Efforts</span>
                </div>
            </div>

            <!-- Parent -->
            <div class="metric-card m3-card filled interactive" @click="openMetricModal('parent')">
                <div class="card-icon neutral small-icon">
                    <BaseIcon :path="mdiSitemap" />
                </div>
                <div class="metric-content">
                    <span class="value">{{ dashboardData.counts.parent }}</span>
                    <span class="label">Parent Programs</span>
                </div>
            </div>

            <!-- Neutral -->
            <div class="metric-card m3-card filled interactive" @click="openMetricModal('neutral')">
                <div class="card-icon neutral-light small-icon">
                    <BaseIcon :path="mdiCircle" />
                </div>
                <div class="metric-content">
                    <span class="value">{{ dashboardData.counts.neutral }}</span>
                    <span class="label">Neutral Programs</span>
                </div>
            </div>
        </div>
    </section>

    <!-- Section 3: Action Items -->
    <section class="dashboard-section">
        <h2 class="section-title">Program Status</h2>
        <div class="list-card m3-card outlined">
            <div class="card-header tabs-header">
                <button 
                    class="tab-btn" 
                    :class="{ active: activeListTab === 'missing' }"
                    @click="activeListTab = 'missing'"
                >
                    <BaseIcon :path="mdiAlert" class="tab-icon" />
                    Missing Efforts 
                    <span class="badge warning" v-if="dashboardData.counts.missing">{{ dashboardData.counts.missing }}</span>
                </button>

                <button 
                    class="tab-btn" 
                    :class="{ active: activeListTab === 'anomaly' }"
                    @click="activeListTab = 'anomaly'"
                >
                     <BaseIcon :path="mdiAlertCircle" class="tab-icon" />
                    Unexpected 
                    <span class="badge error" v-if="dashboardData.counts.anomaly">{{ dashboardData.counts.anomaly }}</span>
                </button>

                <button 
                    class="tab-btn" 
                    :class="{ active: activeListTab === 'active' }"
                    @click="activeListTab = 'active'"
                >
                     <BaseIcon :path="mdiTable" class="tab-icon" />
                    Populated
                    <span class="badge neutral" v-if="dashboardData.counts.active">{{ dashboardData.counts.active }}</span>
                </button>
            </div>
            
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Program Name</th>
                            <th>ID</th>
                            <th>Leader</th>
                            <th>Efforts</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="item in dashboardData.lists[activeListTab]" :key="item.id">
                            <td class="name-cell">
                                <BaseIcon :path="mdiFolderOpen" class="icon-indicator" />
                                {{ item.name }}
                            </td>
                            <td class="id-cell">{{ item.id }}</td>
                            <td>{{ item.leader }}</td>
                            <td>
                                <span v-if="item.count > 0" class="count-tag">{{ item.count }} assigned</span>
                                <span v-else class="count-tag zero">None</span>
                            </td>
                            <td>
                                <button class="btn-text" @click="navigateToProgram(item.rawNode)">
                                    Review <BaseIcon :path="mdiArrowRight" />
                                </button>
                            </td>
                        </tr>
                        <tr v-if="dashboardData.lists[activeListTab].length === 0">
                            <td colspan="5" class="empty-state">
                                <BaseIcon :path="mdiCheckCircle" /> 
                                <span v-if="activeListTab === 'missing'">No missing efforts! Compliance is 100%.</span>
                                <span v-else-if="activeListTab === 'anomaly'">No configuration anomalies found.</span>
                                <span v-else>No active programs found.</span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </section>

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
    background-color: #FEF7FF; /* background */
    color: #1D1B20; /* on-background */
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
    color: #1D1B20; /* on-background */
}

.header-section p {
    margin: 0;
    font-size: 14px;
    color: #625B71; /* secondary */
}

/* Sections */
.dashboard-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.section-title {
    margin: 0;
    font-size: 16px;
    font-weight: 500;
    color: #005AC1; /* primary */
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

/* 1. Charts Grid */
.charts-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
}

@media (max-width: 1200px) {
    .charts-grid {
        grid-template-columns: 1fr; 
    }
}

/* 2. Inventory Grid (Auto-fit for 7 items) */
.inventory-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
}

@media (max-width: 1000px) {
    .inventory-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (max-width: 600px) {
    .inventory-grid {
        grid-template-columns: 1fr;
    }
}

.metric-card {
    display: flex;
    align-items: center;
    padding: 1.25rem;
    gap: 1rem;
    border-radius: 12px;
    background-color: #F3EDF7; /* surface-container */
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    cursor: pointer;
    border: 1px solid transparent;
}

/* No compact class needed if all are uniformly styled */

.metric-card:hover {
    box-shadow: 0px 2px 4px rgba(0,0,0,0.14); /* elevation-level2 approx */
    transform: translateY(-2px);
    border-color: #005AC1; /* primary */
}

.info-icon {
    position: absolute;
    top: 10px;
    right: 10px;
    color: #79747E; /* outline */
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
/* Icons Colors */
.card-icon.primary { background-color: v-bind('STATUS_COLORS.active.bg'); color: v-bind('STATUS_COLORS.active.text'); }
.card-icon.good { background-color: #FFDF90; color: #231B00; } /* tertiary-container/on-tertiary-container */
.card-icon.warning { background-color: v-bind('STATUS_COLORS.gap.bg'); color: v-bind('STATUS_COLORS.gap.text'); }
.card-icon.neutral { background-color: v-bind('STATUS_COLORS.parent.bg'); color: v-bind('STATUS_COLORS.parent.text'); }
.card-icon.neutral-light { background-color: v-bind('STATUS_COLORS.neutral.bg'); color: v-bind('STATUS_COLORS.neutral.border'); }
.card-icon.error-container { background-color: v-bind('STATUS_COLORS.gap.bg'); color: v-bind('STATUS_COLORS.gap.text'); }

.metric-content {
    display: flex;
    flex-direction: column;
}

.metric-content .value {
    font-size: 24px;
    font-weight: 600;
    line-height: 1.2;
    color: #1D1B20; /* on-surface */
}

.metric-content .label {
    font-size: 11px;
    font-weight: 500;
    color: #625B71; /* secondary */
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.small-icon {
    width: 40px;
    height: 40px;
    font-size: 18px;
    border-radius: 8px;
}

/* Action List Card */
.list-card {
    background-color: #FEF7FF; /* surface */
    border: 1px solid #C4C7C5; /* outline-variant */
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
    color: #1D1B20; /* on-surface */
}

.badge.warning {
    background: v-bind('STATUS_COLORS.gap.bg');
    color: v-bind('STATUS_COLORS.gap.text');
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 100px;
    font-weight: 700;
}

.badge.error {
    background: v-bind('STATUS_COLORS.gap.border'); /* Dark red */
    color: #FFFFFF;
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 100px;
    font-weight: 700;
}

.badge.neutral {
    background: v-bind('STATUS_COLORS.neutral.bg');
    color: v-bind('STATUS_COLORS.neutral.text');
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 100px;
}

/* Tabs */
.tabs-header {
    display: flex;
    gap: 8px;
    border-bottom: 1px solid #C4C7C5; /* outline-variant */
    padding-bottom: 0;
    margin-bottom: 0;
}

.tab-btn {
    background: transparent;
    border: none;
    padding: 8px 16px;
    font-size: 14px;
    font-weight: 500;
    color: #49454F; /* on-surface-variant */
    cursor: pointer;
    border-bottom: 2px solid transparent;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s;
}

.tab-btn:hover {
    background: #ECE6F0; /* surface-container-high */
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
}

.tab-btn.active {
    color: #005AC1; /* primary */
    border-bottom-color: #005AC1; /* primary */
}

.tab-icon {
    font-size: 18px;
}

.count-tag {
    font-size: 12px;
    padding: 2px 8px;
    background: #D8E2FF; /* primary-container */
    color: #001D35; /* on-primary-container */
    border-radius: 4px;
    font-weight: 500;
}

.count-tag.zero {
    background: #ECE6F0; /* surface-container-high */
    color: #49454F; /* on-surface-variant */
}

.table-container {
    flex: 1;
    overflow-y: auto;
    border: 1px solid #C4C7C5; /* outline-variant */
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
    background: #F7F2FA; /* surface-container-low */
    color: #625B71; /* secondary */
    font-weight: 500;
    position: sticky;
    top: 0;
    z-index: 1;
}

.data-table td {
    padding: 12px 16px;
    border-bottom: 1px solid #C4C7C5; /* outline-variant */
    color: #1D1B20; /* on-surface */
}

.data-table .id-cell {
    font-family: monospace;
    font-size: 12px;
    color: #625B71; /* secondary */
}

.btn-text {
    background: none;
    border: none;
    color: #005AC1; /* primary */
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
    background: #ECE6F0; /* surface-container-high */
}

/* Empty State */
.empty-state {
    text-align: center;
    padding: 2rem !important;
    color: #005AC1; /* primary */
    font-weight: 500;
}

/* Chart Card */
.chart-card {
    background-color: #FEF7FF; /* surface */
    border: 1px solid #C4C7C5; /* outline-variant */
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
    color: #625B71; /* secondary */
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
    color: #625B71; /* secondary */
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

.dot.error { background: #BA1A1A; }
.dot.neutral { background: #E0E0E0; }
.dot.good { background: #005AC1; }
.dot.primary { background: #005AC1; }
.dot.warning-color { background: #FFDAD6; }

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
    background: #FEF7FF; /* surface */
    width: 400px;
    max-width: 90%;
    border-radius: 28px;
    padding: 1.5rem;
    box-shadow: 0px 4px 8px 3px rgba(0,0,0,0.15), 0px 1px 3px rgba(0,0,0,0.3); /* elevation-level3 */
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
    color: #1D1B20; /* on-surface */
}

.close-btn {
    background: transparent;
    border: none;
    font-size: 1.25rem;
    color: #49454F; /* on-surface-variant */
    cursor: pointer;
    padding: 4px;
    border-radius: 50%;
}

.close-btn:hover {
    background: #ECE6F0; /* surface-container-high */
}

.modal-body {
    flex: 1;
}

.definition {
    font-size: 1rem;
    color: #49454F; /* on-surface-variant */
    margin-bottom: 1.5rem;
    line-height: 1.5;
}

.context-box {
    background: #DAE2F9; /* secondary-container */
    color: #131C2B; /* on-secondary-container */
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
    background: #005AC1; /* primary */
    color: #FFFFFF; /* on-primary */
    border: none;
    padding: 10px 24px;
    border-radius: 100px;
    font-weight: 500;
    cursor: pointer;
    transition: box-shadow 0.2s;
}

.btn-filled:hover {
    box-shadow: 0px 1px 2px rgba(0,0,0,0.3); /* elevation-level1 */
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
