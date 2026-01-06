import { ref, computed } from 'vue';
import { useProgramCatalogStore } from '../store/programCatalogStore';

// Shared state
const selectedNode = ref(null);

export function useProgramData() {
    const store = useProgramCatalogStore();

    // Trigger fetch if needed
    if (!store.state.items && !store.state.loading) {
        console.log('[useProgramData] Triggering fetchItems');
        store.fetchItems();
    } else {
        console.log('[useProgramData] Items available or loading:', !!store.state.items, store.state.loading);
    }

    // Helper to ensure data structure matches OrgChart requirements (specifically 'value' key)
    const normalizeTree = (node) => {
        if (!node) return null;

        // Handle array root
        if (Array.isArray(node)) {
            return node.map(n => normalizeTree(n));
        }

        const newNode = { ...node };

        // Ensure 'value' exists for OrgChart ID matching and ECharts uniqueness
        // Fallback to program_id if value is missing (common in production data vs mock)
        if (newNode.value === undefined || newNode.value === null) {
            newNode.value = newNode.program_id;
        }

        if (newNode.children && Array.isArray(newNode.children)) {
            newNode.children = newNode.children.map(c => normalizeTree(c));
        }

        return newNode;
    };

    const chartData = computed(() => normalizeTree(store.state.items));
    const sweChartData = computed(() => normalizeTree(store.getSWEItems()));

    const flattenNodes = (nodes, acc = []) => {
        if (!nodes) return acc;

        // Handle array root
        if (Array.isArray(nodes)) {
            nodes.forEach(n => flattenNodes(n, acc));
            return acc;
        }

        // Map to format expected by SearchBox (name, value)
        // Ensure we preserve all original props
        const idValue = nodes.program_id || nodes.value || nodes.id;
        acc.push({
            ...nodes,
            value: idValue, // Robust ID mapping
            name: nodes.name // Ensure name is present
        });

        if (nodes.children) {
            flattenNodes(nodes.children, acc);
        }

        // Include Software Efforts for Search
        if (nodes.softwareEfforts && nodes.softwareEfforts.length > 0) {
            nodes.softwareEfforts.forEach(effort => {
                acc.push({
                    name: effort.name,
                    value: effort.id,
                    type: 'Software Effort',
                    isSoftwareEffort: true,
                    isSoftwareEffort: true,
                    parentId: nodes.program_id || nodes.value || nodes.id,
                    programName: nodes.name
                });
            });
        }

        return acc;
    };

    const allNodes = computed(() => {
        return flattenNodes(store.state.items);
    });

    const findNodeById = (id) => {
        return store.findByOrgId(id);
    };

    const selectNode = (node) => {
        if (!node) {
            selectedNode.value = null;
            return;
        }

        // If the node passed is a partial or from search (might have 'value' but not full props),
        // try to find the real node in the tree.
        const id = node.program_id || node.value;
        const found = findNodeById(id);

        selectedNode.value = found || node;
    };


    return {
        chartData,
        sweChartData,
        allNodes,
        selectedNode,
        loading: computed(() => store.state.loading),
        selectNode,
        findNodeById
    };
}
