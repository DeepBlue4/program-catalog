import { reactive, shallowRef, triggerRef, ref } from "vue";
import { CompassAPIService } from "../services/api.js";
import { MockApiData } from "../services/mockApiData.js";

// ==============================================================================
// CONFIGURATION FLAGS
// ==============================================================================

/**
 * FETCH_ALL_EFFORTS: Decides how aggressively we load software efforts.
 * 
 * - true (New approach): Grabs efforts for every single program in the tree.
 *   Good: We don't miss anything, even if it's in a weird spot.
 *   Bad: Uses more bandwidth, might slow down the initial load a bit.
 *
 * - false (Old approach): Only looks where the 'expecting_software_efforts' flag tells us to.
 *   Good: Faster startup, fewer API calls.
 *   Bad: Could potentialy miss data if the flags aren't perfect.
 *
 * Flip this to test out performance differences.
 */
const FETCH_ALL_EFFORTS = true;

// ==============================================================================

// Basic reactive state for the catalog
const state = reactive({
    items: shallowRef(null),
    currentUser: ref(null),
    loading: false,
    error: null,
});

// Simple counter we bump whenever we load new efforts.
// This lets computed properties know they need to re-run.
const hydrationVersion = ref(0);

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

                // If we're mocking, let's inject some fake "missing efforts" data to test that edge case.
                if (CompassAPIService.useTestData) {
                    MockApiData.injectMissingEffortsNode(state.items);
                }

                // In prod, the main tree endpoint is lightweight and doesn't include the actual efforts.
                // So we have to go back and fetch them for the relevant nodes.
                if (!CompassAPIService.useTestData) {
                    console.log("[Store] Triggering populateSoftwareEfforts...");
                    await populateSoftwareEfforts(state.items);
                }
            }
        } catch (err) {
            state.error = err.message || "Failed to fetch items";
        } finally {
            state.loading = false;
            fetchPromise = null; // Clear the promise so we can try again if needed.
        }
    })();

    return fetchPromise;
}

/**
 * fetchCurrentUser
 * 
 * Populates state.currentUser based on the environment (Mock vs Prod).
 */
function fetchCurrentUser() {
    if (CompassAPIService.useTestData) {
        console.log("[Store] Loading Mock User Data...");
        state.currentUser = MockApiData.getMockUser();
    } else {
        // Just filler data until the real auth flow is ready.
        console.log("[Store] Loading Default User Data (N/A)...");
        state.currentUser = {
            name: 'N/A',
            email: 'N/A',
            bemsid: 'N/A',
            businessUnit: 'N/A',
            isManager: false,
            isAdmin: false,
            isStaff: false,
            is6J: false
        };
    }
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

    // Fallback: use the program_id if we really can't find a name.
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
            // Leaf node in this specific view
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

    // Check if current node matches (using string comparison to be safe)
    if (String(node.program_id) === String(orgId) || String(node.value) === String(orgId)) {
        return node;
    }

    // Keep digging down recursively
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
 * Returns the breadcrumb trail from the root down to the specific orgId.
 * Includes the target node itself at the end.
 * Returns null if we can't find it.
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

        // Determine if we should fetch for this node based on config flag
        const shouldFetch = FETCH_ALL_EFFORTS
            ? true  // NEW: Fetch for all programs
            : node.expecting_software_efforts;  // OLD: Only fetch for expecting programs

        if (shouldFetch) {
            const targetId = node.program_id || node.id;
            if (!targetId) return;

            const p = CompassAPIService.getSoftwareEfforts(targetId).then(resp => {
                if (resp.success && Array.isArray(resp.data)) {
                    if (resp.data.length > 0) {
                        console.log(`[Store] Hydrated node ${targetId} (${node.name}): ${resp.data.length} efforts`);
                    }
                    node.softwareEfforts = resp.data;
                    node.hasSoftwareEffort = resp.data.length > 0;
                } else {
                    // Start fresh if nothing came back
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

    // Wait for all fetches to complete with performance timing
    if (promises.length > 0) {
        const mode = FETCH_ALL_EFFORTS ? 'ALL_PROGRAMS' : 'EXPECTING_ONLY';
        console.log(`\n[Store] ========== HYDRATION PERFORMANCE ==========`);
        console.log(`[Store] Mode: ${mode}`);
        console.log(`[Store] Fetching efforts for ${promises.length} nodes...`);
        console.time('[Store] Hydration Duration');

        await Promise.all(promises);

        console.timeEnd('[Store] Hydration Duration');
        console.log(`[Store] Hydration complete. ${promises.length} API calls made.`);
        console.log(`[Store] ==============================================\n`);

        // Force reactivity update since state.items is a shallowRef and we mutated deep properties
        triggerRef(state.items);

        // Increment hydration version to trigger computed re-evaluation
        hydrationVersion.value++;
        console.log('[Store] hydrationVersion incremented to:', hydrationVersion.value);
    } else {
        console.log('[Store] No nodes to hydrate.');
    }
}

/**
 * saveSoftwareEffort
 *
 * One-stop shop for creating or updating an effort.
 * Handles the API call and makes sure the local state stays in sync so the UI updates instantly.
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
        hydrationVersion, // Expose for computed dependency
        fetchItems,
        fetchCurrentUser,
        fetchItemsNames,
        getSWEItems,

        findByOrgId,
        findByOrgName,
        getOrgPathByID,
        getAllSoftwareEfforts,
        saveSoftwareEffort,
    };
}
