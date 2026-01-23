import { ref, computed } from "vue";
import { useProgramCatalogStore } from "src/store/programCatalogStore";

// Shared state - store only the selected ID, not the node object
// This allows the computed to always fetch fresh data from the tree
const selectedNodeId = ref(null);

export function useProgramData() {
  const store = useProgramCatalogStore();

  // Trigger fetch if needed
  if (!store.state.items && !store.state.loading) {
    console.log("[useProgramData] Triggering fetchItems");
    store.fetchItems();
  } else {
    console.log(
      "[useProgramData] Items available or loading:",
      !!store.state.items,
      store.state.loading,
    );
  }

  // Helper to ensure data structure matches OrgChart requirements (specifically 'value' key)
  const normalizeTree = (node) => {
    if (!node) return null;

    // Handle array root
    if (Array.isArray(node)) {
      return node.map((n) => normalizeTree(n));
    }

    const newNode = { ...node };

    // Ensure 'value' exists for OrgChart ID matching and ECharts uniqueness
    // Fallback to program_id if value is missing (common in production data vs mock)
    if (newNode.value === undefined || newNode.value === null) {
      newNode.value = newNode.program_id;
    }

    if (newNode.children && Array.isArray(newNode.children)) {
      newNode.children = newNode.children.map((c) => normalizeTree(c));
    }

    return newNode;
  };

  const chartData = computed(() => {
    // Access hydrationVersion to establish dependency - triggers recompute when hydration completes
    // eslint-disable-next-line no-unused-vars
    const _version = store.hydrationVersion.value;
    return normalizeTree(store.state.items);
  });
  const sweChartData = computed(() => normalizeTree(store.getSWEItems()));

  const flattenNodes = (nodes, acc = []) => {
    if (!nodes) return acc;

    // Handle array root
    if (Array.isArray(nodes)) {
      nodes.forEach((n) => flattenNodes(n, acc));
      return acc;
    }

    // Map to format expected by SearchBox (name, value)
    // Ensure we preserve all original props
    const idValue = nodes.program_id || nodes.value || nodes.id;
    acc.push({
      ...nodes,
      value: idValue, // Robust ID mapping
      program_id: idValue, // Ensure consistent ID access for App.vue navigation
      name: nodes.name, // Ensure name is present
    });

    if (nodes.children) {
      flattenNodes(nodes.children, acc);
    }

    // Include Software Efforts for Search
    if (nodes.softwareEfforts && nodes.softwareEfforts.length > 0) {
      console.log(
        `[useProgramData] Processing ${nodes.softwareEfforts.length} efforts for ${nodes.name}`,
      );
      nodes.softwareEfforts.forEach((effort) => {
        const effortValue = effort.id || effort.uuid; // Fallback if ID invalid
        if (!effortValue)
          console.warn("[useProgramData] Effort missing ID/UUID:", effort);

        acc.push({
          name: effort.name,
          value: effortValue,
          program_id: effortValue, // Ensure App.vue can read this for navigation
          id: effortValue,
          type: "Software Effort",
          isSoftwareEffort: true,
          parentId: nodes.program_id || nodes.value || nodes.id,
          programName: nodes.name,
        });
      });
    }

    return acc;
  };

  const allNodes = computed(() => {
    // Depend on hydrationVersion to trigger recompute when efforts are loaded
    // eslint-disable-next-line no-unused-vars
    const _version = store.hydrationVersion.value;
    return flattenNodes(store.state.items);
  });

  const findNodeById = (id) => {
    return store.findByOrgId(id);
  };

  // Computed that always reads fresh node data from the tree
  // This ensures reactivity when softwareEfforts are hydrated asynchronously or modified
  const selectedNode = computed(() => {
    if (!selectedNodeId.value) return null;
    // Access hydrationVersion to establish reactivity dependency
    // This triggers when softwareEfforts are loaded or CRUD operations occur
    // eslint-disable-next-line no-unused-vars
    const _version = store.hydrationVersion.value;
    return store.findByOrgId(selectedNodeId.value);
  });

  const selectNode = (node) => {
    if (!node) {
      selectedNodeId.value = null;
      return;
    }

    // Store just the ID - the computed will look up the full node
    const id = node.program_id || node.value;
    selectedNodeId.value = id;
  };

  return {
    chartData,
    sweChartData,
    allNodes,
    selectedNode,
    loading: computed(() => store.state.loading),
    selectNode,
    findNodeById,
  };
}
