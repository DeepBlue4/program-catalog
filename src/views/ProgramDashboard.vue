<script setup>
import { ref, onMounted, computed, onUnmounted, watch } from "vue";
import { useRouter } from "vue-router";
import * as echarts from "echarts";
import BaseIcon from "src/components/BaseIcon.vue";
import {
  mdiDomain,
  mdiCodeBraces,
  mdiFlag,
  mdiRocketLaunch,
  mdiFolderMultiple,
  mdiAlertOctagram,
  mdiHelpCircle,
  mdiMinusCircle,
  mdiArrowRight,
  mdiCheckCircle,
  mdiClose,
  mdiLightbulb,
  mdiAlert,
  mdiAlertCircle, // Keep
  mdiTable, // Keep
} from "@mdi/js";
import { useProgramData } from "src/composables/useProgramData";
import { STATUS_COLORS, RAW_COLORS } from "src/styles/statusConstants"; // Import Colors

const router = useRouter();
const { allNodes, selectNode } = useProgramData();

const chartRefCompliance = ref(null);
const chartRefValidity = ref(null);
const chartRefEnvironments = ref(null);
const chartRefEnvironmentsByEffort = ref(null);
let chartInstanceCompliance = null;
let chartInstanceValidity = null;
let chartInstanceEnvironments = null;
let chartInstanceEnvironmentsByEffort = null;

// Modal State
const activeMetricModal = ref(null);



// Standardized Environment Definitions
const ENV_DEFINITIONS = [
  { key: "BSF-Global", label: "BSF-G", color: "#2E7D32" }, // Forest Green
  { key: "BSF-US", label: "BSF-US", color: "#1565C0" }, // Deep Blue
  { key: "BSF-Restricted", label: "BSF-R", color: "#D84315" }, // Burnt Orange
  { key: "BSF-Disconnected", label: "BSF-D", color: "#C62828" }, // Muted Red
  { key: "Boeing Enterprise Network", label: "BEN", color: "#0277BD" }, // Ocean Blue
  { key: "On-Premises/Non-BSF", label: "On-Prem", color: "#455A64" }, // Slate Gray
  { key: "Customer Environment", label: "Customer", color: "#00838F" }, // Teal
  { key: "Other", label: "Other", color: "#795548" }, // Brown
];
const ENV_COLOR_MAP = ENV_DEFINITIONS.reduce((acc, def) => {
  acc[def.key] = def.color;
  return acc;
}, {});

const activeListTab = ref("missing"); // 'missing', 'anomaly', 'active'
const activeEnvTab = ref(null); // Will default to first available env

// Pagination & Search State - Status Table
const statusSearchQuery = ref("");
const statusPage = ref(1);
const statusRowsPerPage = ref(10);

// Pagination & Search State - Environment Table
const envSearchQuery = ref("");
const envPage = ref(1);
const envRowsPerPage = ref(10);

// Chart Category Visibility State
const chartVisibility = ref({
  populated: true,
  missing: true,
  parent: true,
  neutral: true,
  unexpected: true,
});

// Toggle chart category visibility
const toggleChartCategory = (category) => {
  // Prevent disabling all categories - at least one must remain visible
  const visibleCount = Object.values(chartVisibility.value).filter(
    (v) => v,
  ).length;
  if (visibleCount === 1 && chartVisibility.value[category]) {
    return; // Can't disable the last visible category
  }
  chartVisibility.value[category] = !chartVisibility.value[category];
  updateValidityChart();
};

// Environment Visibility State
const envVisibility = ref({});
// Initialize all to true
ENV_DEFINITIONS.forEach((def) => {
  envVisibility.value[def.key] = true;
});

const toggleEnvVisibility = (key) => {
  // Prevent disabling all
  const visibleCount = Object.values(envVisibility.value).filter((v) => v).length;
  if (visibleCount === 1 && envVisibility.value[key]) return;
  
  envVisibility.value[key] = !envVisibility.value[key];
  initCharts(); // Re-render charts with filtered data
};

// Metrics & Lists
const dashboardData = computed(() => {
  const nodes = allNodes.value;
  const programs = nodes.filter((n) => !n.isSoftwareEffort);

  // Core Sets
  // Correct property is 'expecting_software_efforts' based on OrgChart logic
  const expecting = programs.filter((n) => n.expecting_software_efforts);
  const hasEffort = programs.filter((n) => n.hasSoftwareEffort);

  // Derived Sets
  const missing = expecting.filter((n) => !n.hasSoftwareEffort);
  const anomaly = hasEffort.filter((n) => !n.expecting_software_efforts); // Unexpected but Active
  const parent = programs.filter(
    (n) => n.has_descendant_expecting_software_effort && !n.hasSoftwareEffort,
  );

  // Strict Neutral: No effort, no expectation, no descendant activity
  const neutral = programs.filter(
    (n) =>
      !n.hasSoftwareEffort &&
      !n.expecting_software_efforts &&
      !n.has_descendant_expecting_software_effort,
  );

  // New Metric: Total Individual Efforts
  const totalEffortsCount = hasEffort.reduce(
    (acc, n) => acc + (n.softwareEfforts ? n.softwareEfforts.length : 0),
    0,
  );

  // Environment Distribution (Count of Programs using each Env)
  // Initialize maps with 0 for all standard envs
  const envMap = {}; 
  const envEffortMap = {};
  
  ENV_DEFINITIONS.forEach(def => {
    envMap[def.key] = new Set(); // Stores program IDs
    envEffortMap[def.key] = 0; // Counts efforts
  });

  hasEffort.forEach((prog) => {
    if (prog.softwareEfforts) {
      prog.softwareEfforts.forEach((eff) => {
        if (
          eff.developer_setup &&
          eff.developer_setup.development_environments
        ) {
          eff.developer_setup.development_environments.forEach((envName) => {
            // Normalize or match exact string
            // Check if this envName matches one of our standard keys
            // If strict match:
            if (envMap[envName]) {
               envMap[envName].add(prog.program_id);
               envEffortMap[envName]++;
            } else {
               // Fallback for unexpected values into "Other" if needed, 
               // or just track them ad-hoc. 
               // For now, let's dump unexpected into "Other"
               envMap["Other"].add(prog.program_id);
               envEffortMap["Other"]++;
            }
          });
        }
      });
    }
  });

  // Convert to arrays for Charts/Tables
  // Map from ENV_DEFINITIONS to ensure Order and Colors are preserved
  const envCounts = ENV_DEFINITIONS.map(def => ({
    name: def.key,
    label: def.label,
    value: envMap[def.key] ? envMap[def.key].size : 0,
    color: def.color
  }));

  const envCountsByEffort = ENV_DEFINITIONS.map(def => ({
     name: def.key,
     label: def.label,
     value: envEffortMap[def.key] || 0,
     color: def.color
  }));

  // Lists for the Tabs (Programs by Env)
  const envLists = {};
  // Iterate over all keys in envMap (which matches ENV_DEFINITIONS + potential others if modified)
  Object.keys(envMap).forEach(key => {
      envLists[key] = hasEffort
        .filter(p => envMap[key].has(p.program_id))
        .map(node => ({
            id: node.program_id,
            name: node.name,
            leader:
            node.details?.organization_leader_name ||
            node.organization_leader_name ||
            "N/A",
            count: node.softwareEfforts ? node.softwareEfforts.length : 0,
            rawNode: node
        }));
  });

  // Helpers for List Mapping
  const mapNodeToList = (n) => ({
    id: n.program_id,
    name: n.name,
    leader:
      n.details?.organization_leader_name ||
      n.organization_leader_name ||
      "N/A",
    count: n.softwareEfforts ? n.softwareEfforts.length : 0,
    rawNode: n,
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
      neutral: neutral.length,
      totalEfforts: totalEffortsCount, // New
      envCounts, // New
      envCountsByEffort, // New
      envLists, // New
    },
    complianceRate,
    lists: {
      missing: missingList,
      anomaly: anomalyList,
      active: activeList,
    },
  };
});

// Context Definitions
const metricDefinitions = {
  total: {
    title: "Total Programs",
    shortDesc: "Total catalog hierarchy nodes",
    desc: "The total number of Program, Division, and Unit nodes currently tracked in the catalog.",
    context:
      "This represents the entire scope of the organization's hierarchy.",
  },
  totalEfforts: {
    title: "Software Efforts",
    shortDesc: "Individual software efforts count",
    desc: "The total number of individual software efforts (projects, products, teams) tracked across all programs.",
    context:
      "A single program may manage multiple software efforts. This metric captures the total volume of software work.",
  },
  expecting: {
    title: "Expecting Software",
    shortDesc: "Programs flagged for software effort(s)",
    desc: "Programs that have been flagged as requiring software effort(s).",
    context:
      "This is the baseline for our compliance tracking. Every program here should eventually have an active effort.",
  },
  active: {
    title: "Assigned (Has Effort)",
    shortDesc: "Currently assigned software effort(s)",
    desc: "Programs that currently have at least one assigned Software Effort.",
    context: "These programs are actively delivering software functionality.",
  },
  missing: {
    title: "Missing Efforts (Gap)",
    shortDesc: "Non-compliant (Gap)",
    desc: "Programs that Expect Software but have Zero assigned efforts.",
    context:
      "CRITICAL: These programs are non-compliant and require immediate attention to link or create software efforts.",
  },
  anomaly: {
    title: "Unexpected Efforts",
    shortDesc: "Unexpected assigned efforts",
    desc: "Programs that have Assigned Software Efforts but were NOT flagged to expect them.",
    context:
      'Configuration Alert: Validate if the "Expect Software" flag should be enabled or if the effort is misplaced.',
  },
  parent: {
    title: "Parent Programs",
    shortDesc: "Containers for sub-programs",
    desc: "Programs that do not have their own efforts but contain sub-programs that do.",
    context:
      "These act as organizational containers and aggregators for lower-level software work.",
  },
  neutral: {
    title: "Neutral Programs",
    shortDesc: "Structural/Empty nodes",
    desc: "Programs with no active efforts, no expectations, and no active descendants.",
    context:
      "These nodes exist primarily for organizational structure and have no direct software workload.",
  },
};

const openMetricModal = (key) => {
  activeMetricModal.value = key;
};

const closeMetricModal = () => {
  activeMetricModal.value = null;
};

// --- Status Table Pagination & Search Logic ---
const filteredStatusList = computed(() => {
  const list = dashboardData.value.lists[activeListTab.value] || [];
  if (!statusSearchQuery.value) return list;

  const query = statusSearchQuery.value.toLowerCase();
  return list.filter(
    (item) =>
      item.name.toLowerCase().includes(query) ||
      String(item.id).toLowerCase().includes(query)
  );
});

const paginatedStatusList = computed(() => {
  const start = (statusPage.value - 1) * statusRowsPerPage.value;
  const end = start + statusRowsPerPage.value;
  return filteredStatusList.value.slice(start, end);
});

const statusTotalPages = computed(() =>
  Math.ceil(filteredStatusList.value.length / statusRowsPerPage.value)
);

// Reset page on filter change
watch([activeListTab, statusSearchQuery], () => {
  statusPage.value = 1;
});

// --- Environment Table Pagination & Search Logic ---
const filteredEnvList = computed(() => {
  if (!activeEnvTab.value) return [];
  const list = dashboardData.value.counts.envLists[activeEnvTab.value] || [];
  
  if (!envSearchQuery.value) return list;

  const query = envSearchQuery.value.toLowerCase();
  return list.filter(
    (item) =>
      item.name.toLowerCase().includes(query) ||
      String(item.id).toLowerCase().includes(query)
  );
});

const paginatedEnvList = computed(() => {
  const start = (envPage.value - 1) * envRowsPerPage.value;
  const end = start + envRowsPerPage.value;
  return filteredEnvList.value.slice(start, end);
});

const envTotalPages = computed(() =>
  Math.ceil(filteredEnvList.value.length / envRowsPerPage.value)
);

// Reset page on filter change
watch([activeEnvTab, envSearchQuery], () => {
  envPage.value = 1;
});

const initCharts = () => {
  // Theme Colors
  const primaryColor = RAW_COLORS.primary;
  const errorColor = RAW_COLORS.error;
  const surfaceVariant = "#E7E0EC"; // Placeholder or add to constants if reused often

  // Compliance Gauge
  if (chartRefCompliance.value) {
    chartInstanceCompliance = echarts.init(chartRefCompliance.value);
    const rate = dashboardData.value.complianceRate;

    chartInstanceCompliance.setOption({
      series: [
        {
          type: "gauge",
          startAngle: 180,
          endAngle: 0,
          center: ["50%", "75%"],
          radius: "100%",
          min: 0,
          max: 100,
          splitNumber: 5,
          itemStyle: {
            color: rate >= 90 ? primaryColor : errorColor,
          },
          axisLine: {
            lineStyle: {
              width: 20,
              color: [
                [0.7, errorColor],
                [0.9, surfaceVariant],
                [1, primaryColor],
              ],
            },
          },
          pointer: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          detail: {
            fontSize: 36,
            offsetCenter: [0, "-20%"],
            valueAnimation: true,
            formatter: "{value}%",
            color: "inherit",
          },
          data: [{ value: rate, name: "Compliance Rate" }],
        },
      ],
    });
  }

  // Program Status Chart (Status Distribution)
  updateValidityChart();

  // Environment Distribution Chart (Programs)
  if (chartRefEnvironments.value) {
    if (chartInstanceEnvironments) chartInstanceEnvironments.dispose();
    chartInstanceEnvironments = echarts.init(chartRefEnvironments.value);

    const envData = dashboardData.value.counts.envCounts.map(item => ({
       value: item.value,
       name: item.name,
       itemStyle: { color: item.color }
    })).filter(item => item.value > 0 && envVisibility.value[item.name]); 

    chartInstanceEnvironments.setOption({
      tooltip: { trigger: "item" },
      legend: { show: false }, // Using Custom Legend
      series: [
        {
          name: "Environment",
          type: "pie",
          radius: ["40%", "70%"],
          avoidLabelOverlap: true, // Allow ECharts to move labels to avoid overlap
          itemStyle: { borderRadius: 10, borderColor: "#fff", borderWidth: 2 },
          label: { 
            show: true, 
            position: 'outside',
            formatter: "{b}: {c}", 
            fontWeight: "bold",
            fontSize: 14 
          },
          labelLine: { show: true },
          emphasis: { label: { show: true, fontSize: 16, fontWeight: "bold" } },
          data: envData,
        },
      ],
    });
  }

  // Environment Distribution Chart (By Effort)
  if (chartRefEnvironmentsByEffort.value) {
    if (chartInstanceEnvironmentsByEffort)
      chartInstanceEnvironmentsByEffort.dispose();
    chartInstanceEnvironmentsByEffort = echarts.init(
      chartRefEnvironmentsByEffort.value,
    );

    const envDataEffort = dashboardData.value.counts.envCountsByEffort.map(item => ({
       value: item.value,
       name: item.name,
       itemStyle: { color: item.color }
    })).filter(item => item.value > 0 && envVisibility.value[item.name]);

    chartInstanceEnvironmentsByEffort.setOption({
      tooltip: { trigger: "item" },
      legend: { show: false }, // Using Custom Legend
      series: [
        {
          name: "Environment (Efforts)",
          type: "pie",
          radius: ["40%", "70%"],
          avoidLabelOverlap: true, // Allow ECharts to move labels to avoid overlap
          itemStyle: { borderRadius: 10, borderColor: "#fff", borderWidth: 2 },
          label: { 
            show: true, 
            position: 'outside',
            formatter: "{b}: {c}", 
            fontWeight: "bold",
            fontSize: 14 
          },
          labelLine: { show: true },
          emphasis: { label: { show: true, fontSize: 16, fontWeight: "bold" } },
          data: envDataEffort,
        },
      ],
    });
  }
};


// Separate function to update validity chart (called on toggle)
const updateValidityChart = () => {
  if (chartRefValidity.value) {
    if (chartInstanceValidity) chartInstanceValidity.dispose();
    chartInstanceValidity = echarts.init(chartRefValidity.value);

    const counts = dashboardData.value.counts;
    const validPopulated = counts.active - counts.anomaly; // Expected & Active

    // Build chart data based on visibility (ordered: Populated, Parent, Neutral, Missing, Unexpected)
    const allData = [
      {
        value: validPopulated,
        name: "Populated",
        key: "populated",
        itemStyle: { color: RAW_COLORS.primary },
      },
      {
        value: counts.parent,
        name: "Parent of Effort",
        key: "parent",
        itemStyle: { color: "#B3D4FF" },
      },
      {
        value: counts.neutral,
        name: "Neutral",
        key: "neutral",
        itemStyle: { color: "#79747E" },
      },
      {
        value: counts.missing,
        name: "Missing",
        key: "missing",
        itemStyle: { color: RAW_COLORS.error },
      },
      {
        value: counts.anomaly,
        name: "Unexpected",
        key: "unexpected",
        itemStyle: { color: RAW_COLORS.errorContainer },
      },
    ];

    // Filter based on visibility state
    const visibleData = allData.filter(
      (item) => chartVisibility.value[item.key],
    );

    chartInstanceValidity.setOption({
      tooltip: { trigger: "item" },
      legend: { show: false },
      series: [
        {
          name: "Program Status",
          type: "pie",
          radius: ["40%", "70%"],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 10, borderColor: "#fff", borderWidth: 2 },
          label: {
            show: true,
            formatter: "{c}",
            fontWeight: "bold",
            fontSize: 14,
          },
          emphasis: { label: { show: true, fontSize: 16, fontWeight: "bold" } },
          data: visibleData,
        },
      ],
    });
  }
};

const handleResize = () => {
  chartInstanceCompliance?.resize();
  chartInstanceValidity?.resize();
  chartInstanceEnvironments?.resize();
  chartInstanceEnvironmentsByEffort?.resize();
};

const navigateToProgram = (node) => {
  selectNode(node);
  router.push({ name: "ProgramEfforts", params: { programId: node.value } });
};

// Re-init charts if theme changes or data loads
watch(allNodes, () => {
  initCharts();
  // Set default env tab if not set
  if (
    !activeEnvTab.value &&
    dashboardData.value.counts.envCounts.length > 0
  ) {
    activeEnvTab.value = dashboardData.value.counts.envCounts[0].name;
  }
});

onMounted(() => {
  setTimeout(() => {
    initCharts();
    // Set default env tab if not set
    if (
        !activeEnvTab.value &&
        dashboardData.value.counts.envCounts.length > 0
    ) {
        activeEnvTab.value = dashboardData.value.counts.envCounts[0].name;
    }
  }, 100);
  window.addEventListener("resize", handleResize);
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
  chartInstanceCompliance?.dispose();
  chartInstanceValidity?.dispose();
  chartInstanceEnvironments?.dispose();
  chartInstanceEnvironmentsByEffort?.dispose();
});
</script>

<template>
  <div class="dashboard-container">
    <div class="header-section">
      <h1>Analytics Dashboard</h1>
      <p>
        Enterprise insights, software effort tracking, and compliance metrics
      </p>
    </div>

    <!-- Section 1: Program Health (Visualization) -->
    <section class="dashboard-section">
      <h2 class="section-title">Program Health</h2>
      <div class="charts-grid">
        <!-- 1. Compliance -->
        <div class="chart-card m3-card outlined compliance-card">
          <div class="chart-header">
            <h3>Program Compliance</h3>
            <p>
              Percentage of programs expecting software that actually have
              active efforts.
            </p>
          </div>
          <div class="chart-wrapper" ref="chartRefCompliance"></div>

          <!-- Enhanced Interactive Stats -->
          <div class="compliance-stats">
            <div
              class="stat-item expecting"
              @click="openMetricModal('expecting')"
              title="Click for details"
            >
              <span class="stat-value">{{
                dashboardData.counts.expecting
              }}</span>
              <span class="stat-label">Expecting</span>
            </div>
            <div
              class="stat-item compliant"
              @click="openMetricModal('active')"
              title="Click for details"
            >
              <span class="stat-value">{{
                dashboardData.counts.expecting - dashboardData.counts.missing
              }}</span>
              <span class="stat-label">Compliant</span>
            </div>
            <div
              class="stat-item missing"
              @click="openMetricModal('missing')"
              title="Click for details"
            >
              <span class="stat-value">{{ dashboardData.counts.missing }}</span>
              <span class="stat-label">Missing</span>
            </div>
          </div>

          <!-- Enhanced Legend with Thresholds -->
          <div class="compliance-legend">
            <div class="threshold-item critical">
              <span class="threshold-bar"></span>
              <span class="threshold-range">&lt; 70%</span>
              <span class="threshold-label">Critical</span>
            </div>
            <div class="threshold-item warning">
              <span class="threshold-bar"></span>
              <span class="threshold-range">70-90%</span>
              <span class="threshold-label">Needs Work</span>
            </div>
            <div class="threshold-item good">
              <span class="threshold-bar"></span>
              <span class="threshold-range">&gt; 90%</span>
              <span class="threshold-label">Target</span>
            </div>
          </div>
        </div>

        <!-- 2. Program Status (Renamed from Data Validity) -->
        <div class="chart-card m3-card outlined">
          <div class="chart-header">
            <h3>Program Status</h3>
            <p>
              Breakdown of all programs by their operational state (Assigned,
              Missing, Neutral).
            </p>
          </div>
          <div class="chart-wrapper" ref="chartRefValidity"></div>
          <div class="legend-mini wrap-legend interactive-legend">
            <div
              class="legend-item toggle"
              :class="{ disabled: !chartVisibility.populated }"
              @click="toggleChartCategory('populated')"
              title="Click to toggle"
            >
              <span
                class="dot"
                :style="{ backgroundColor: RAW_COLORS.primary }"
              ></span>
              <span class="legend-text"
                >Populated ({{
                  dashboardData.counts.active - dashboardData.counts.anomaly
                }})</span
              >
            </div>
            <div
              class="legend-item toggle"
              :class="{ disabled: !chartVisibility.parent }"
              @click="toggleChartCategory('parent')"
              title="Click to toggle"
            >
              <span class="dot" style="background-color: #b3d4ff"></span>
              <span class="legend-text"
                >Parent ({{ dashboardData.counts.parent }})</span
              >
            </div>
            <div
              class="legend-item toggle"
              :class="{ disabled: !chartVisibility.neutral }"
              @click="toggleChartCategory('neutral')"
              title="Click to toggle"
            >
              <span class="dot" style="background-color: #79747e"></span>
              <span class="legend-text"
                >Neutral ({{ dashboardData.counts.neutral }})</span
              >
            </div>
            <div
              class="legend-item toggle"
              :class="{ disabled: !chartVisibility.missing }"
              @click="toggleChartCategory('missing')"
              title="Click to toggle"
            >
              <span
                class="dot"
                :style="{ backgroundColor: RAW_COLORS.error }"
              ></span>
              <span class="legend-text"
                >Missing ({{ dashboardData.counts.missing }})</span
              >
            </div>
            <div
              class="legend-item toggle"
              :class="{ disabled: !chartVisibility.unexpected }"
              @click="toggleChartCategory('unexpected')"
              title="Click to toggle"
            >
              <span
                class="dot"
                :style="{ backgroundColor: RAW_COLORS.errorContainer }"
              ></span>
              <span class="legend-text"
                >Unexpected ({{ dashboardData.counts.anomaly }})</span
              >
            </div>
          </div>
        </div>

        <!-- 3. Environment Distribution (Programs) -->
        <div class="chart-card m3-card outlined">
          <div class="chart-header">
            <h3>Dev Envs (Programs)</h3>
            <p>Count of Programs by assigned Environment.</p>
          </div>
          <div class="chart-wrapper" ref="chartRefEnvironments"></div>
          <!-- Custom Detailed Legend -->
          <div class="legend-mini wrap-legend interactive-legend">
            <div
              v-for="env in dashboardData.counts.envCounts"
              :key="env.name"
              class="legend-item toggle"
              :class="{ disabled: !envVisibility[env.name] }"
              @click="toggleEnvVisibility(env.name)"
            >
              <span
                class="dot"
                :style="{ backgroundColor: env.color }"
              ></span>
              <span class="legend-text"
                >{{ env.name }}: {{ env.value }}</span
              >
            </div>
          </div>
        </div>

        <!-- 4. Environment Distribution (Efforts) -->
        <div class="chart-card m3-card outlined">
          <div class="chart-header">
            <h3>Dev Envs (Efforts)</h3>
            <p>Count of Software Efforts by assigned Environment.</p>
          </div>
          <div class="chart-wrapper" ref="chartRefEnvironmentsByEffort"></div>
           <!-- Custom Detailed Legend -->
          <div class="legend-mini wrap-legend interactive-legend">
            <div
              v-for="env in dashboardData.counts.envCountsByEffort"
              :key="env.name"
              class="legend-item toggle"
              :class="{ disabled: !envVisibility[env.name] }"
              @click="toggleEnvVisibility(env.name)"
            >
              <span
                class="dot"
                :style="{ backgroundColor: env.color }"
              ></span>
              <span class="legend-text"
                >{{ env.name }}: {{ env.value }}</span
              >
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Section 4: Environment Details -->
    <section
      class="dashboard-section"
      v-if="dashboardData.counts.envCounts.length > 0"
    >
      <h2 class="section-title">Programs by Environment</h2>
      <div class="list-card m3-card outlined">
        <div class="card-header tabs-header scrollable-tabs">
          <button
            v-for="env in dashboardData.counts.envCounts"
            :key="env.name"
            class="tab-btn"
            :class="{ active: activeEnvTab === env.name }"
            @click="activeEnvTab = env.name"
          >
            {{ env.name }}
            <span class="badge neutral">{{ env.value }}</span>
          </button>
        </div>
        
        <div class="table-controls">
          <div class="search-wrapper">
             <BaseIcon :path="mdiCodeBraces" class="search-icon" />
             <input 
               v-model="envSearchQuery" 
               type="text" 
               placeholder="Search via Name or ID..." 
               class="search-input"
             />
          </div>
        </div>

        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Program Name</th>
                <th>ID</th>
                <th>Leader</th>
                <th>Efforts in Env</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in paginatedEnvList"
                :key="item.id"
              >
                <td class="name-cell">
                  {{ item.name }}
                </td>
                <td class="id-cell">{{ item.id }}</td>
                <td>{{ item.leader }}</td>
                <td>
                  <span class="count-tag">{{ item.count }} Assigned</span>
                </td>
                <td>
                  <button
                    class="btn-text"
                    @click="navigateToProgram(item.rawNode)"
                  >
                    Review <BaseIcon :path="mdiArrowRight" />
                  </button>
                </td>
              </tr>
               <tr v-if="filteredEnvList.length === 0">
                <td colspan="5" class="empty-state">
                  <div class="empty-content">
                    <BaseIcon :path="mdiCheckCircle" />
                    <span>No programs found in this environment matching your search.</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <!-- Pagination Footer -->
        <div class="pagination-footer" v-if="filteredEnvList.length > 0">
          <div class="rows-per-page">
            <span>Rows per page:</span>
            <select v-model="envRowsPerPage">
              <option :value="10">10</option>
              <option :value="50">50</option>
              <option :value="100">100</option>
            </select>
          </div>
          <div class="page-nav">
             <span>{{ envPage }} of {{ envTotalPages }}</span>
             <div class="nav-buttons">
               <button 
                 :disabled="envPage === 1"
                 @click="envPage--"
                 class="nav-btn"
               >Prev</button>
               <button 
                 :disabled="envPage >= envTotalPages"
                 @click="envPage++"
                 class="nav-btn"
               >Next</button>
             </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Section 2: Catalog Inventory (Metrics) -->
    <section class="dashboard-section">
      <h2 class="section-title">Catalog Inventory</h2>
      <div class="inventory-grid">
        <!-- 1. TOTAL -->
        <div
          class="metric-card m3-card filled interactive"
          @click="openMetricModal('total')"
        >
          <div class="card-top">
            <span class="label">Total Programs</span>
            <div class="card-icon neutral small-icon">
              <BaseIcon :path="mdiDomain" />
            </div>
          </div>
          <div class="card-value">{{ dashboardData.counts.total }}</div>
          <div class="card-desc">{{ metricDefinitions.total.shortDesc }}</div>
        </div>

        <!-- 2. TOTAL EFFORTS -->
        <div
          class="metric-card m3-card filled interactive"
          @click="openMetricModal('totalEfforts')"
        >
          <div class="card-top">
            <span class="label">Software Efforts</span>
            <div class="card-icon primary small-icon">
              <BaseIcon :path="mdiCodeBraces" />
            </div>
          </div>
          <div class="card-value">{{ dashboardData.counts.totalEfforts }}</div>
          <div class="card-desc">
            {{ metricDefinitions.totalEfforts.shortDesc }}
          </div>
        </div>

        <!-- 3. EXPECTING -->
        <div
          class="metric-card m3-card filled interactive"
          @click="openMetricModal('expecting')"
        >
          <div class="card-top">
            <span class="label">Expecting Software</span>
            <div class="card-icon primary small-icon">
              <BaseIcon :path="mdiFlag" />
            </div>
          </div>
          <div class="card-value">{{ dashboardData.counts.expecting }}</div>
          <div class="card-desc">
            {{ metricDefinitions.expecting.shortDesc }}
          </div>
        </div>

        <!-- 4. ACTIVE -->
        <div
          class="metric-card m3-card filled interactive"
          @click="openMetricModal('active')"
        >
          <div class="card-top">
            <span class="label">Assigned Efforts</span>
            <div class="card-icon good small-icon">
              <BaseIcon :path="mdiRocketLaunch" />
            </div>
          </div>
          <div class="card-value">{{ dashboardData.counts.active }}</div>
          <div class="card-desc">{{ metricDefinitions.active.shortDesc }}</div>
        </div>

        <!-- 5. PARENT -->
        <div
          class="metric-card m3-card filled interactive"
          @click="openMetricModal('parent')"
        >
          <div class="card-top">
            <span class="label">Parent Programs</span>
            <div class="card-icon neutral small-icon">
              <BaseIcon :path="mdiFolderMultiple" />
            </div>
          </div>
          <div class="card-value">{{ dashboardData.counts.parent }}</div>
          <div class="card-desc">{{ metricDefinitions.parent.shortDesc }}</div>
        </div>

        <!-- 6. MISSING (Attention) -->
        <div
          class="metric-card m3-card filled interactive warning-card"
          @click="openMetricModal('missing')"
        >
          <div class="card-top">
            <span class="label">Missing Efforts</span>
            <div class="card-icon warning small-icon">
              <BaseIcon :path="mdiAlertOctagram" />
            </div>
          </div>
          <div class="card-value">{{ dashboardData.counts.missing }}</div>
          <div class="card-desc">{{ metricDefinitions.missing.shortDesc }}</div>
        </div>

        <!-- 7. UNEXPECTED (Attention) -->
        <div
          class="metric-card m3-card filled interactive anomaly-card"
          @click="openMetricModal('anomaly')"
        >
          <div class="card-top">
            <span class="label">Unexpected Efforts</span>
            <div class="card-icon error-container small-icon">
              <BaseIcon :path="mdiHelpCircle" />
            </div>
          </div>
          <div class="card-value">{{ dashboardData.counts.anomaly }}</div>
          <div class="card-desc">{{ metricDefinitions.anomaly.shortDesc }}</div>
        </div>

        <!-- 8. NEUTRAL -->
        <div
          class="metric-card m3-card filled interactive"
          @click="openMetricModal('neutral')"
        >
          <div class="card-top">
            <span class="label">Neutral Programs</span>
            <div class="card-icon neutral-light small-icon">
              <BaseIcon :path="mdiMinusCircle" />
            </div>
          </div>
          <div class="card-value">{{ dashboardData.counts.neutral }}</div>
          <div class="card-desc">{{ metricDefinitions.neutral.shortDesc }}</div>
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
            <span class="badge warning" v-if="dashboardData.counts.missing">{{
              dashboardData.counts.missing
            }}</span>
          </button>

          <button
            class="tab-btn"
            :class="{ active: activeListTab === 'anomaly' }"
            @click="activeListTab = 'anomaly'"
          >
            <BaseIcon :path="mdiAlertCircle" class="tab-icon" />
            Unexpected
            <span class="badge error" v-if="dashboardData.counts.anomaly">{{
              dashboardData.counts.anomaly
            }}</span>
          </button>

          <button
            class="tab-btn"
            :class="{ active: activeListTab === 'active' }"
            @click="activeListTab = 'active'"
          >
            <BaseIcon :path="mdiTable" class="tab-icon" />
            Populated
            <span class="badge neutral" v-if="dashboardData.counts.active">{{
              dashboardData.counts.active
            }}</span>
          </button>
        </div>

        <div class="table-controls">
          <div class="search-wrapper">
             <BaseIcon :path="mdiCodeBraces" class="search-icon" /> <!-- Reusing icon, maybe import mdiMagnify -->
             <input 
               v-model="statusSearchQuery" 
               type="text" 
               placeholder="Search programs..." 
               class="search-input"
             />
          </div>
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
              <tr
                v-for="item in paginatedStatusList"
                :key="item.id"
              >
                <td class="name-cell">
                  {{ item.name }}
                </td>
                <td class="id-cell">{{ item.id }}</td>
                <td>{{ item.leader }}</td>
                <td>
                  <span v-if="item.count > 0" class="count-tag"
                    >{{ item.count }} assigned</span
                  >
                  <span v-else class="count-tag zero">None</span>
                </td>
                <td>
                  <button
                    class="btn-text"
                    @click="navigateToProgram(item.rawNode)"
                  >
                    Review <BaseIcon :path="mdiArrowRight" />
                  </button>
                </td>
              </tr>
              <tr v-if="filteredStatusList.length === 0">
                <td colspan="5" class="empty-state">
                  <div class="empty-content">
                    <BaseIcon :path="mdiCheckCircle" />
                    <span>No programs found matching your criteria.</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <!-- Pagination Footer -->
        <div class="pagination-footer" v-if="filteredStatusList.length > 0">
          <div class="rows-per-page">
            <span>Rows per page:</span>
            <select v-model="statusRowsPerPage">
              <option :value="10">10</option>
              <option :value="50">50</option>
              <option :value="100">100</option>
            </select>
          </div>
          <div class="page-nav">
             <span>{{ statusPage }} of {{ statusTotalPages }}</span>
             <div class="nav-buttons">
               <button 
                 :disabled="statusPage === 1"
                 @click="statusPage--"
                 class="nav-btn"
               >Prev</button>
               <button 
                 :disabled="statusPage >= statusTotalPages"
                 @click="statusPage++"
                 class="nav-btn"
               >Next</button>
             </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Interactive Metric Modal -->
    <transition name="fade">
      <div
        v-if="activeMetricModal"
        class="modal-backdrop"
        @click="closeMetricModal"
      >
        <div class="metric-modal m3-card elevated" @click.stop>
          <div class="modal-header">
            <h2>{{ metricDefinitions[activeMetricModal].title }}</h2>
            <button class="close-btn" @click="closeMetricModal">
              <BaseIcon :path="mdiClose" />
            </button>
          </div>
          <div class="modal-body">
            <p class="definition">
              {{ metricDefinitions[activeMetricModal].desc }}
            </p>
            <div class="context-box">
              <BaseIcon :path="mdiLightbulb" />
              <p>{{ metricDefinitions[activeMetricModal].context }}</p>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-filled" @click="closeMetricModal">
              Confirm
            </button>
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
  background-color: #fef7ff; /* background */
  color: #1d1b20; /* on-background */
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
  color: #1d1b20; /* on-background */
}

.header-section p {
  margin: 0;
  font-size: 14px;
  color: #625b71; /* secondary */
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
  color: #005ac1; /* primary */
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* 1. Charts Grid */
.charts-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
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

/* Metric Cards */
.metric-card {
  display: flex;
  flex-direction: column;
  padding: 1.5rem; /* Increased padding */
  gap: 0.75rem;
  border-radius: 8px; /* Sharper corners */
  background-color: #ffffff; /* White background */
  border: 1px solid #e0e2e5; /* Subtle border */
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  min-height: 150px;
  justify-content: space-between;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); /* Very subtle base shadow */
}

.metric-card:hover {
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.08); /* Professional lift */
  transform: translateY(-2px);
  border-color: #005ac1; /* primary */
}

/* Card Internals */
.card-top {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center; /* Center align icon and label */
  width: 100%;
}

.metric-card .label {
  font-size: 11px; /* Smaller, professional label */
  font-weight: 600;
  color: #6c757d; /* Muted text */
  text-transform: uppercase;
  letter-spacing: 0.8px; /* Wider spacing */
  margin: 0;
}

.card-value {
  font-size: 36px; /* Slightly smaller, more balanced */
  font-weight: 600; /* Medium-Bold */
  line-height: 1.2;
  color: #212529; /* Dark grey instead of pure black */
  margin: 0.25rem 0;
  font-family:
    "Inter", sans-serif; /* Ensure clean font if available, or system default */
}

.card-desc {
  font-size: 12px; /* Smaller description */
  color: #6c757d; /* Secondary text */
  line-height: 1.4;
}

/* Icon Resizing & Styling */
.card-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%; /* Circle */
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

/* Warning/Anomaly Specifics */
.warning-card .card-value {
  color: #ba1a1a;
} /* error */
.anomaly-card .card-value {
  color: #ba1a1a;
}

/* Icons Colors - Subtle Tinted Backgrounds */
.card-icon.primary {
  background-color: #e8f0fe; /* Very light blue */
  color: #1967d2; /* Strong blue */
}
.card-icon.good {
  background-color: #e6f4ea; /* Very light green */
  color: #137333; /* Strong green */
}
.card-icon.warning {
  background-color: #fef7e0; /* Very light yellow/orange */
  color: #ea8600; /* Strong orange */
}
.card-icon.neutral {
  background-color: #f1f3f4; /* Light grey */
  color: #5f6368; /* Dark grey */
}
.card-icon.neutral-light {
  background-color: #f8f9fa; /* Very light grey */
  color: #9aa0a6; /* Medium grey */
}
.card-icon.error-container {
  background-color: #fce8e6; /* Very light red */
  color: #c5221f; /* Strong red */
}

/* Action List Card */
.list-card {
  background-color: #fef7ff; /* surface */
  border: 1px solid #c4c7c5; /* outline-variant */
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

.list-card h3,
.chart-card h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 500;
  color: #1d1b20; /* on-surface */
}

.badge.warning {
  background: v-bind("STATUS_COLORS.gap.bg");
  color: v-bind("STATUS_COLORS.gap.text");
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 100px;
  font-weight: 700;
}

.badge.error {
  background: v-bind("STATUS_COLORS.gap.border"); /* Dark red */
  color: #ffffff;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 100px;
  font-weight: 700;
}

.badge.neutral {
  background: v-bind("STATUS_COLORS.neutral.bg");
  color: v-bind("STATUS_COLORS.neutral.text");
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 100px;
}

/* Tabs */
.tabs-header {
  display: flex;
  justify-content: flex-start;
  gap: 8px;
  border-bottom: 1px solid #c4c7c5; /* outline-variant */
  padding-bottom: 0;
  margin-bottom: 0;
}

.tab-btn {
  background: transparent;
  border: none;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  color: #49454f; /* on-surface-variant */
  cursor: pointer;
  border-bottom: 2px solid transparent;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
}

.tab-btn:hover {
  background: #ece6f0; /* surface-container-high */
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
}

.tab-btn.active {
  color: #005ac1; /* primary */
  border-bottom-color: #005ac1; /* primary */
}

.tab-icon {
  font-size: 18px;
}

.count-tag {
  font-size: 12px;
  padding: 2px 8px;
  background: #d8e2ff; /* primary-container */
  color: #001d35; /* on-primary-container */
  border-radius: 4px;
  font-weight: 500;
}

.count-tag.zero {
  background: #ece6f0; /* surface-container-high */
  color: #49454f; /* on-surface-variant */
}

.table-container {
  flex: 1;
  overflow-y: auto;
  border: 1px solid #c4c7c5; /* outline-variant */
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
  background: #f7f2fa; /* surface-container-low */
  color: #625b71; /* secondary */
  font-weight: 500;
  position: sticky;
  top: 0;
  z-index: 1;
}

.data-table td {
  padding: 12px 16px;
  border-bottom: 1px solid #c4c7c5; /* outline-variant */
  color: #1d1b20; /* on-surface */
}

.data-table .id-cell {
  font-family: monospace;
  font-size: 12px;
  color: #625b71; /* secondary */
}

.btn-text {
  background: none;
  border: none;
  color: #005ac1; /* primary */
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
  background: #ece6f0; /* surface-container-high */
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 2rem !important;
  color: #005ac1; /* primary */
  font-weight: 500;
}

/* Chart Card */
.chart-card {
  background-color: #fef7ff; /* surface */
  border: 1px solid #c4c7c5; /* outline-variant */
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
  color: #625b71; /* secondary */
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
  color: #625b71; /* secondary */
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

.dot.error {
  background: #ba1a1a;
}
.dot.neutral {
  background: #e0e0e0;
}
.dot.good {
  background: #005ac1;
}
.dot.primary {
  background: #005ac1;
}
.dot.warning-color {
  background: #ffdad6;
}

/* Modals */
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  /* backdrop-filter: none;  Removed per request */
}

.metric-modal {
  background: #fef7ff; /* surface */
  width: 400px;
  max-width: 90%;
  border-radius: 28px;
  padding: 1.5rem;
  box-shadow:
    0px 4px 8px 3px rgba(0, 0, 0, 0.15),
    0px 1px 3px rgba(0, 0, 0, 0.3); /* elevation-level3 */
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
  color: #1d1b20; /* on-surface */
}

.close-btn {
  background: transparent;
  border: none;
  font-size: 1.25rem;
  color: #49454f; /* on-surface-variant */
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
}

.close-btn:hover {
  background: #ece6f0; /* surface-container-high */
}

.modal-body {
  flex: 1;
}

.definition {
  font-size: 1rem;
  color: #49454f; /* on-surface-variant */
  margin-bottom: 1.5rem;
  line-height: 1.5;
}

.context-box {
  background: #dae2f9; /* secondary-container */
  color: #131c2b; /* on-secondary-container */
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
  background: #005ac1; /* primary */
  color: #ffffff; /* on-primary */
  border: none;
  padding: 10px 24px;
  border-radius: 100px;
  font-weight: 500;
  cursor: pointer;
  transition: box-shadow 0.2s;
}

.btn-filled:hover {
  box-shadow: 0px 1px 2px rgba(0, 0, 0, 0.3); /* elevation-level1 */
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
/* Interactive Legend Toggles */
.interactive-legend {
  user-select: none;
}

.legend-item.toggle {
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend-item.toggle:hover {
  background-color: rgba(0, 90, 193, 0.08);
}

.legend-item.toggle.disabled {
  opacity: 0.4;
}

.legend-item.toggle.disabled .legend-text {
  text-decoration: line-through;
}

.legend-item.toggle.disabled .dot {
  opacity: 0.5;
}

.legend-text {
  font-size: 12px;
  color: #49454f;
}

/* Program Compliance Enhanced Styles */
.compliance-stats {
  display: flex;
  justify-content: space-around;
  gap: 8px;
  margin-top: 12px;
  padding: 8px 0;
  border-top: 1px solid #e7e0ec;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  flex: 1;
}

.stat-item:hover {
  transform: translateY(-2px);
}

.stat-item.expecting {
  background: rgba(0, 90, 193, 0.08);
}

.stat-item.expecting:hover {
  background: rgba(0, 90, 193, 0.15);
}

.stat-item.compliant {
  background: rgba(46, 125, 50, 0.08);
}

.stat-item.compliant:hover {
  background: rgba(46, 125, 50, 0.15);
}

.stat-item.missing {
  background: rgba(186, 26, 26, 0.08);
}

.stat-item.missing:hover {
  background: rgba(186, 26, 26, 0.15);
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #1d1b20;
}

.stat-item.expecting .stat-value {
  color: #005ac1;
}

.stat-item.compliant .stat-value {
  color: #2e7d32;
}

.stat-item.missing .stat-value {
  color: #ba1a1a;
}

.stat-label {
  font-size: 11px;
  color: #625b71;
  margin-top: 2px;
  font-weight: 500;
  text-transform: uppercase;
}

/* Compliance Legend/Thresholds */
.compliance-legend {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid #e7e0ec;
}

.threshold-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
}

.threshold-bar {
  width: 16px;
  height: 8px;
  border-radius: 4px;
}

.threshold-item.critical .threshold-bar {
  background: #ba1a1a;
}

.threshold-item.warning .threshold-bar {
  background: #e7e0ec;
}

.threshold-item.good .threshold-bar {
  background: #005ac1;
}

.threshold-range {
  font-weight: 600;
  color: #1d1b20;
}

.threshold-label {
  color: #625b71;
}

.wrap-legend {
  flex-wrap: wrap;
  justify-content: center;
}

.scrollable-tabs {
  overflow-x: auto;
  padding-bottom: 4px; /* Space for scrollbar if needed */
}

/* Table Controls & Search */
.table-controls {
  padding: 12px 16px;
  border-bottom: 1px solid #e7e0ec;
  display: flex;
  justify-content: flex-end;
}

.search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  max-width: 300px;
}

.search-icon {
  position: absolute;
  left: 12px;
  color: #79747e;
  pointer-events: none;
  width: 18px;
  height: 18px;
}

.search-input {
  width: 100%;
  padding: 8px 12px 8px 36px;
  border-radius: 8px;
  border: 1px solid #79747e;
  background: transparent;
  font-size: 14px;
  color: #1d1b20;
}

.search-input:focus {
  outline: 2px solid #005ac1;
  border-color: transparent;
}

/* Pagination Footer */
.pagination-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-top: 1px solid #e7e0ec;
  font-size: 12px;
  color: #49454f;
}

.rows-per-page {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rows-per-page select {
  padding: 4px;
  border-radius: 4px;
  border: 1px solid #e7e0ec;
  background: #fff;
  font-size: 12px;
  cursor: pointer;
}

.page-nav {
  display: flex;
  align-items: center;
  gap: 16px;
}

.nav-buttons {
  display: flex;
  gap: 8px;
}

.nav-btn {
  background: transparent;
  border: 1px solid #e7e0ec;
  padding: 4px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  color: #1d1b20;
  transition: all 0.2s;
}

.nav-btn:hover:not(:disabled) {
  background: #f1f0f4;
  border-color: #79747e;
}

.nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

</style>
