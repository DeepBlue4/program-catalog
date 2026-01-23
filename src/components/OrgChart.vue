<script setup>
import { ref, onMounted, onUnmounted, watch } from "vue";
import * as echarts from "echarts";
import { STATUS_COLORS, RAW_COLORS } from "src/styles/statusConstants";

const props = defineProps({
  data: {
    type: Object,
    required: true,
  },
  selectedId: {
    type: Number,
    default: null,
  },
});

const emit = defineEmits(["node-click"]);

const chartRef = ref(null);
let chartInstance = null;

const initChart = () => {
  if (!chartRef.value) return;

  chartInstance = echarts.init(chartRef.value, null, {
    renderer: "canvas",
    useDirtyRect: false,
  });

  chartInstance.on("click", (params) => {
    if (params.componentType === "series") {
      const nodeId = params.data.program_id;
      const currentCollapsed = collapsedState.value.get(nodeId);

      // Toggle collapsed state
      collapsedState.value.set(nodeId, !currentCollapsed);

      // Trigger update to reflect expansion/collapse
      updateChart();

      // Emit selection (so parent knows to select it)
      emit("node-click", params.data);
    }
  });

  // Initial Sync
  syncState(props.data);
  // Ensure we expand to the selection if one exists on mount
  if (props.selectedId) {
    expandPathToNode(props.selectedId);
  }
  updateChart();
};

const collapsedState = ref(new Map());

const syncState = (node, depth = 0) => {
  if (!node) return;
  // Only set if not already present to preserve user interaction
  if (!collapsedState.value.has(node.program_id)) {
    // Default logic: Root (depth 0) expanded, children (depth 1+) collapsed
    // This shows Root + Level 1 nodes.
    const defaultCollapsed = depth >= 1;
    collapsedState.value.set(
      node.program_id,
      node.collapsed !== undefined ? node.collapsed : defaultCollapsed,
    );
  }
  if (node.children) {
    node.children.forEach((child) => syncState(child, depth + 1));
  }
};

const updateChart = () => {
  if (!chartInstance) return;

  // Sync state ensures we have entries for all nodes
  syncState(props.data);

  // We need to resolve CSS variables to hex for Canvas if necessary,
  // but ECharts works best with explicit hex for performance or complex strokes.
  // We'll hardcode the tokens mapped to the CSS vars for the chart specifically to ensure exact match.

  // Use standardized shared colors
  const colors = RAW_COLORS;

  const option = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      triggerOn: "mousemove",
      backgroundColor: colors.surface,
      borderColor: "#C4C7C5",
      textStyle: {
        color: "#1D1B20",
      },
      extraCssText:
        "box-shadow: 0px 1px 3px 1px rgba(0, 0, 0, 0.15); border-radius: 8px;",
      formatter: (params) => {
        const d = params.data;
        let status = "Neutral Program";
        let color = colors.neutral;

        if (d.softwareEfforts && d.softwareEfforts.length > 0) {
          status = STATUS_COLORS.active.label;
          color = STATUS_COLORS.active.border; // Use border (darker) for text
        } else if (d.expecting_software_efforts) {
          status = STATUS_COLORS.gap.label;
          color = STATUS_COLORS.gap.border; // Use border (darker) for text
        } else if (d.has_descendant_expecting_software_effort) {
          status = STATUS_COLORS.parent.label;
          color = STATUS_COLORS.parent.border; // Use border (darker) for text
        } else {
          status = STATUS_COLORS.neutral.label;
          color = STATUS_COLORS.neutral.border;
        }

        // Calculate Metrics
        const childrenCount = d.children ? d.children.length : 0;
        const effortsCount = d.softwareEfforts ? d.softwareEfforts.length : 0;

        // Row Helper
        const createRow = (label, value) => `
       <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
         <span style="color: #666; font-size: 12px;">${label}</span>
         <span style="color: #333; font-weight: 500; font-size: 12px;">${value}</span>
       </div>
     `;

        return `
      <div style="font-family: 'Roboto', sans-serif; min-width: 200px; padding: 4px;">
       <div style="font-weight: 600; font-size: 14px; color: #1f1f1f; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 8px;">
         ${d.name}
       </div>
        
       <div style="display: flex; align-items: center; margin-bottom: 12px;">
         <span style="font-size: 11px; font-weight: 600; color: ${color}; background: ${color}1A; padding: 4px 8px; border-radius: 12px;">
           ${status}
         </span>
       </div>
 
       ${childrenCount > 0 ? createRow("Sub-programs", childrenCount) : ""}
       ${effortsCount > 0 ? createRow("Software Efforts", effortsCount) : ""}
       ${childrenCount === 0 && effortsCount === 0 ? '<div style="font-size:12px; color:#999; font-style:italic;">No direct children</div>' : ""}
        
       <div style="margin-top: 12px; text-align: right; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 6px;">
         ID: ${d.program_id}
       </div>
      </div>
     `;
      },
    },
    series: [
      {
        type: "tree",
        data: [], // Will be set below
        top: "10%",
        left: "10%",
        bottom: "10%",
        right: "20%",
        symbolSize: 12,
        symbol: "circle",
        orient: "horizontal",

        label: {
          position: "left",
          verticalAlign: "middle",
          align: "right",
          fontSize: 13,
          fontFamily: "Roboto, sans-serif",
          color: colors.neutral,
          offset: [-8, 0],
        },

        leaves: {
          label: {
            position: "right",
            verticalAlign: "middle",
            align: "left",
            offset: [8, 0],
          },
        },

        roam: true, // Enable dragging/panning

        emphasis: {
          focus: "none", // Disable fading of other nodes
          itemStyle: {
            shadowBlur: 10,
            shadowColor: "rgba(0, 0, 0, 0.2)",
          },
        },

        // Critical Fix: Animation Threshold to prevent artifacts
        animationThreshold: 3000,

        // Disable internal expansion management to prevent conflicts
        expandAndCollapse: false,
        animationDuration: 550,
        animationDurationUpdate: 750,

        // Neutral Style Default
        itemStyle: {
          color: colors.primary,
          borderColor: colors.primary,
          borderWidth: 0,
        },

        lineStyle: {
          color: "#C4C7C5", // Outline Variant
          width: 1.5,
          curveness: 0.5,
        },
      },
    ],
  };

  // Pre-process data to inject styles
  const recursiveStyle = (node) => {
    const newNode = { ...node };

    // M3 Style Mapping
    if (newNode.softwareEfforts && newNode.softwareEfforts.length > 0) {
      // 1. Active Efforts
      const s = STATUS_COLORS.active;
      newNode.itemStyle = {
        color: s.fill,
        borderColor: s.border,
        borderWidth: 0,
      };
    } else if (newNode.expecting_software_efforts) {
      // 2. Expected & No Efforts
      const s = STATUS_COLORS.gap;
      newNode.itemStyle = {
        color: s.fill,
        borderColor: s.border,
        borderWidth: 1,
      };
    } else if (newNode.has_descendant_expecting_software_effort) {
      // 3. Parent of Effort
      const s = STATUS_COLORS.parent;
      newNode.itemStyle = {
        color: s.fill,
        borderColor: s.border,
        borderWidth: 1,
      };
    } else {
      // 4. Neutral
      const s = STATUS_COLORS.neutral;
      newNode.itemStyle = {
        color: s.fill,
        borderColor: s.border,
        borderWidth: 1,
      };
    }

    // Apply Selection Highlight
    if (props.selectedId && newNode.program_id == props.selectedId) {
      newNode.itemStyle.shadowBlur = 10;
      newNode.itemStyle.shadowColor = "#2E7D32"; // Distinct highlight (Green)
      newNode.itemStyle.borderColor = "#2E7D32";
      newNode.itemStyle.borderWidth = 3;
      // Ensure it pops visual (scale if possible, but symbolSize is global in this config usually)
      newNode.symbolSize = 18;
    }

    // Apply Managed Collapsed State
    if (collapsedState.value.has(newNode.program_id)) {
      newNode.collapsed = collapsedState.value.get(newNode.program_id);
    }

    if (newNode.children) {
      newNode.children = newNode.children.map((child) => recursiveStyle(child));
    }
    return newNode;
  };

  option.series[0].data = [recursiveStyle(props.data)];

  chartInstance.setOption(option);
};

const handleResize = () => {
  chartInstance?.resize();
};

const expandPathToNode = (targetId) => {
  if (!targetId && targetId !== 0) return;

  // Helper to find path
  const findPath = (node, path = []) => {
    if (node.program_id == targetId) return path;

    if (node.children) {
      for (const child of node.children) {
        const res = findPath(child, [...path, node.program_id]);
        if (res) return res;
      }
    }
    return null;
  };

  const pathToCheck = findPath(props.data);
  if (pathToCheck) {
    pathToCheck.forEach((id) => {
      collapsedState.value.set(id, false); // Expand parent
    });
  }
};

watch(
  () => props.data,
  () => {
    // Sync state
    syncState(props.data);
    // Ensure selection is visible if present
    if (props.selectedId) expandPathToNode(props.selectedId);
    updateChart();
  },
  { deep: true },
);

watch(
  () => props.selectedId,
  (newId) => {
    if (newId) expandPathToNode(newId);
    updateChart();
  },
);

const resetView = () => {
  // Clear manual expansion state to revert to data defaults
  collapsedState.value.clear();
  // Re-sync with initial data props
  syncState(props.data);
  // Force chart update
  updateChart();
  // Reset zoom/pan if possible (ECharts instance method)
  chartInstance?.dispatchAction({
    type: "restore",
  });
};

defineExpose({
  resetView,
});

onMounted(() => {
  initChart();
  window.addEventListener("resize", handleResize);
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
  chartInstance?.dispose();
});
</script>

<template>
  <div ref="chartRef" class="w-full h-full min-h-[500px]"></div>
</template>

<style scoped>
.w-full {
  width: 100%;
}
.h-full {
  height: 100%;
}
.min-h-\[500px\] {
  min-height: 500px;
}
</style>
