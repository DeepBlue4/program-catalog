import { ref, computed } from 'vue';
import { useProgramCatalogStore } from '../store/programCatalogStore';

// Shared state
const selectedNode = ref(null);

export function useProgramData() {
    const store = useProgramCatalogStore();

    // Trigger fetch if needed
    if (!store.state.items && !store.state.loading) {
        store.fetchItems();
    }

    const chartData = computed(() => store.state.items);

    const flattenNodes = (nodes, acc = []) => {
        if (!nodes) return acc;

        // Handle array root
        if (Array.isArray(nodes)) {
            nodes.forEach(n => flattenNodes(n, acc));
            return acc;
        }

        // Map to format expected by SearchBox (name, value)
        // Ensure we preserve all original props
        acc.push({
            ...nodes,
            value: nodes.program_id, // Map program_id to value
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
                    parentId: nodes.program_id || nodes.value,
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
        allNodes,
        selectedNode,
        loading: computed(() => store.state.loading),
        selectNode,
        findNodeById
    };
}
