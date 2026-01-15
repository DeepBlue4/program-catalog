import { reactive, shallowRef, triggerRef } from "vue";
import { CompassAPIService } from "../services/api.js";
import { MockApiData } from "../services/mockApiData.js";

const state = reactive({
    items: shallowRef(null),
    loading: false,
    error: null,
});

let fetchPromise = null;

async function fetchItems() {
    // If we already have items, don't fetch.
    if (state.items) {
        return;
    }

    // If a fetch is already in progress, return that promise to deduplicate requests.
    if (fetchPromise) {
        return fetchPromise;
    }

    state.loading = true;
    state.error = null;

    fetchPromise = (async () => {
        try {
            const response = await CompassAPIService.getEnterpriseHierarchy();

            if (!response.success) {
                state.error = "Could not connect to the backend";
                console.error("[Store] API Connection Failed");
            } else {
                console.log(`[Store] Items fetched. Mode: ${CompassAPIService.useTestData ? 'MOCK' : 'PROD'}.`);

                state.items = response.data;

                // DUMMY DATA INJECTION for "Missing Efforts" verification
                if (CompassAPIService.useTestData) {
                    MockApiData.injectMissingEffortsNode(state.items);
                }

                // In production, the hierarchy endpoint does NOT include software efforts.
                // We must fetch them separately for relevant nodes.
                if (!CompassAPIService.useTestData) {
                    console.log("[Store] Triggering populateSoftwareEfforts...");
                    await populateSoftwareEfforts(state.items);
                }
            }
        } catch (err) {
            state.error = err.message || "Failed to fetch items";
        } finally {
            state.loading = false;
            fetchPromise = null; // Reset promise so we can retry on error or subsequent invalidation
        }
    })();

    return fetchPromise;
}

/**
 * Helper to extract a "name" string from a node. Tries several common fields,
 * falling back to program_id if nothing else is present.
 */
function extractNameFromNode(node) {
    if (!node || typeof node !== "object") return null;

    const candidates = ["name", "program_name", "org_name", "label", "title"];
    for (const key of candidates) {
        if (node[key] != null) {
            return String(node[key]);
        }
    }

    // Fallback to program_id if present
    if (node.program_id != null) {
        return String(node.program_id);
    }

    return null;
}

/**
 * fetchItemsNames
 *
 * Ensures items are loaded (calls fetchItems) and returns a flat array of
 * string names for every node in the tree.
 */
async function fetchItemsNames() {
    await fetchItems();

    if (!state.items) return [];

    const names = [];

    function traverse(node) {
        if (!node) return;

        if (Array.isArray(node)) {
            for (const child of node) traverse(child);
            return;
        }

        const name = extractNameFromNode(node);
        if (name !== null) names.push(name);

        if (node.children && node.children.length > 0) {
            for (const child of node.children) traverse(child);
        }
    }

    traverse(state.items);
    return names;
}

/**
 * fetchSWEItems
 *
 * Ensures items are loaded and returns the same tree structure as state.items
 * but pruned to only include nodes that:
 *  - node.expect_software_effort === true OR
 *  - node.has_descendant_expecting_software_effort === true OR
 *  - have children that match the same predicate
 *
 * The returned structure will be the same type as state.items:
 *  - If state.items is an array -> returns an array (possibly empty)
 *  - If state.items is a single root node -> returns a node or null if nothing matches
 */
function getFilteredSWEItems(root) {
    if (!root) return Array.isArray(root) ? [] : null;

    function filterNode(node) {
        if (!node) return null;

        // If node is an array, return an array of filtered children
        if (Array.isArray(node)) {
            const arr = node
                .map((child) => filterNode(child))
                .filter((c) => c !== null);
            return arr.length > 0 ? arr : null; // Return null if array empty to signal pruning
        }

        // Recurse into children if present
        let filteredChildren = [];
        if (node.children && node.children.length > 0) {
            filteredChildren = node.children
                .map((child) => filterNode(child))
                .filter((c) => c !== null);
        }

        // Logic Customization: 
        // We want to show nodes that EXPECT EFFORTS (expecting_software_efforts) 
        // regardless of whether they currently have them or not.
        const isRelevant = node.expecting_software_efforts === true;
        const hasRelevantChild = filteredChildren.length > 0;

        // Include this node if it matches or any child matched
        if (!isRelevant && !hasRelevantChild) return null;

        // Preserve original node shape but set `children` to the filtered list (if any)
        const copy = { ...node };

        if (filteredChildren.length > 0) {
            copy.children = filteredChildren;
        } else {
            // Leaf node in this view (relevant, no relevant children)
            copy.children = [];
        }

        return copy;
    }

    if (Array.isArray(root)) {
        return root.map(filterNode).filter(n => n !== null);
    } else {
        return filterNode(root);
    }
}



// Synchronous getter for UI comp
function getSWEItems() {
    return getFilteredSWEItems(state.items);
}

// ... existing code ...

function findByOrgId(orgId, node = state.items) {
    if (!node) return null;

    // If node is an array (top-level could be array), search each element
    if (Array.isArray(node)) {
        for (const child of node) {
            const found = findByOrgId(orgId, child);
            if (found) return found;
        }
        return null;
    }

    // Check if current node matches (compare as strings to handle route params)
    // Support both program_id (API) and value (Mock)
    if (String(node.program_id) === String(orgId) || String(node.value) === String(orgId)) {
        return node;
    }

    // If node has children, search recursively
    if (node.children && node.children.length > 0) {
        for (const child of node.children) {
            const found = findByOrgId(orgId, child);
            if (found) return found;
        }
    }

    return null;
}

/**
 * findByOrgName
 *
 * Async: ensures items are loaded first.
 * Performs a depth-first search and returns the first node whose extracted
 * name matches the provided `name` (case-insensitive, trimmed).
 *
 * If not found returns null.
 */
async function findByOrgName(name) {
    if (name == null) return null;
    const needle = String(name).trim().toLowerCase();
    if (needle.length === 0) return null;

    await fetchItems();

    if (!state.items) return null;

    function search(node) {
        if (!node) return null;

        if (Array.isArray(node)) {
            for (const child of node) {
                const res = search(child);
                if (res) return res;
            }
            return null;
        }

        const nodeName = extractNameFromNode(node);
        if (nodeName != null && String(nodeName).trim().toLowerCase() === needle) {
            return node;
        }

        if (node.children && node.children.length > 0) {
            for (const child of node.children) {
                const res = search(child);
                if (res) return res;
            }
        }

        return null;
    }

    return search(state.items);
}

/**
 * getOrgPathByID
 *
 * Returns an array of nodes from the root down to the node matching orgId (inclusive).
 * The returned array always includes the target node as the last element.
 * If not found returns null.
 *
 * Example return: [ rootNode, ..., parentNode, targetNode ]
 */
async function getOrgPathByID(orgId) {
    // Ensure we have items loaded
    await fetchItems();

    if (!state.items) return null;

    // Depth-first search that builds the path and includes the current (matching) node.
    function findPath(node, targetId, acc = []) {
        if (!node) return null;

        // If node is an array, iterate elements
        if (Array.isArray(node)) {
            for (const child of node) {
                const res = findPath(child, targetId, acc);
                if (res) return res;
            }
            return null;
        }

        // Add current node to accumulator path
        const pathSoFar = acc.concat(node);

        // If current node matches, return path including this node
        if (String(node.program_id) === String(targetId)) {
            return pathSoFar;
        }

        // Recurse children
        if (node.children && node.children.length > 0) {
            for (const child of node.children) {
                const res = findPath(child, targetId, pathSoFar);
                if (res) return res;
            }
        }

        return null;
    }

    return findPath(state.items, orgId, []);
}

/**
     * getAllSoftwareEfforts
     *
     * Flattens the hierarchy to find ALL software efforts across all programs.
     * Returns an array of efforts augmented with program context.
     */
async function getAllSoftwareEfforts() {
    await fetchItems();
    if (!state.items) return [];

    const allEfforts = [];

    function traverse(node) {
        if (!node) return;

        if (Array.isArray(node)) {
            for (const child of node) traverse(child);
            return;
        }

        // Collect efforts from this node
        if (node.softwareEfforts && Array.isArray(node.softwareEfforts)) {
            node.softwareEfforts.forEach(eff => {
                // Return a shallow copy with program name added for detailed selection context
                allEfforts.push({
                    ...eff,
                    _programName: node.name,
                    _programId: node.value || node.program_id,
                    _fullLabel: `${node.name} > ${eff.name} (${eff.type})`
                });
            });
        }

        if (node.children) {
            for (const child of node.children) traverse(child);
        }
    }

    traverse(state.items);
    return allEfforts;
}

/**
 * Helper to recursively populate software efforts for nodes that expect them.
 * This is required in production because the hierarchy endpoint is lightweight.
 */
async function populateSoftwareEfforts(root) {
    if (!root) return;

    // Collect all promises to run in parallel
    const promises = [];

    function traverseAndCollect(node) {
        if (!node) return;

        if (Array.isArray(node)) {
            node.forEach(traverseAndCollect);
            return;
        }

        // If the node expects efforts, we should fetch them.
        // We do this regardless of 'hasSoftwareEffort' flag if it's unreliable as per user report.
        if (node.expecting_software_efforts) {
            // Ensure we have a valid ID to query
            const targetId = node.program_id || node.id;
            if (!targetId) return;

            console.log(`[Store] Hydrating efforts for node ID: ${targetId} (${node.name})`);

            const p = CompassAPIService.getSoftwareEfforts(targetId).then(resp => {
                if (resp.success && Array.isArray(resp.data)) {
                    console.log(`[Store] Success hydrating node ${targetId}: found ${resp.data.length} efforts.`);
                    node.softwareEfforts = resp.data;
                    node.hasSoftwareEffort = resp.data.length > 0;
                } else {
                    console.warn(`[Store] Failed/Empty hydrating node ${targetId}`, resp);
                    // Initialize empty if failed or empty
                    if (!node.softwareEfforts) node.softwareEfforts = [];
                }
            });
            promises.push(p);
        }

        if (node.children && Array.isArray(node.children)) {
            node.children.forEach(traverseAndCollect);
        }
    }

    traverseAndCollect(root);

    // Wait for all fetches to complete
    if (promises.length > 0) {
        console.log(`[Store] Hydrating software efforts for ${promises.length} nodes...`);
        await Promise.all(promises);
        console.log('[Store] Hydration complete.');

        // Force reactivity update since state.items is a shallowRef and we mutated deep properties
        triggerRef(state.items);
    }
}

/**
 * saveSoftwareEffort
 *
 * Centrally handles saving a software effort (create/update), updating the local state,
 * and triggering reactivity.
 */
async function saveSoftwareEffort(programId, effortData) {
    const res = await CompassAPIService.saveSoftwareEffort(programId, effortData);

    if (res.success) {
        // Find the program node to update local state
        const programNode = findByOrgId(programId);

        if (programNode) {
            if (!programNode.softwareEfforts) programNode.softwareEfforts = [];

            const savedEffort = res.data || effortData;
            // Ensure ID is present (if backend didn't return it but we generated it, or fallback)
            // The backend MUST return the new ID for this to work correctly with the tree.

            const existingIndex = programNode.softwareEfforts.findIndex(e => e.id === savedEffort.id || (e.uuid && e.uuid === savedEffort.uuid));

            if (existingIndex !== -1) {
                // Update
                programNode.softwareEfforts[existingIndex] = savedEffort;
            } else {
                // Create
                programNode.softwareEfforts.push(savedEffort);
                // Also update metadata if needed
                programNode.hasSoftwareEffort = true;
            }

            // Force UI update
            triggerRef(state.items);
        } else {
            console.warn(`[Store] Could not find program node ${programId} to update state.`);
        }
    }

    return res;
}

export function useProgramCatalogStore() {
    return {
        state,
        fetchItems,
        fetchItemsNames,
        getSWEItems,

        findByOrgId,
        findByOrgName,
        getOrgPathByID,
        getAllSoftwareEfforts,
        saveSoftwareEffort,
    };
}
