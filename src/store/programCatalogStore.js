import { reactive } from "vue";
import { CompassAPIService } from "../services/api.js";

const state = reactive({
    items: null,
    loading: false,
    error: null,
});

async function fetchItems() {
    if (state.items) {
        // Don't fetch again since we already have the data
        return;
    }
    state.loading = true;
    state.error = null;
    try {
        const response = await CompassAPIService.getEnterpriseHierarchy();

        if (!response.success) {
            state.error = "Could not connect to the backend";
        } else {
            state.items = response.data;
        }
    } catch (err) {
        state.error = err.message || "Failed to fetch items";
    } finally {
        state.loading = false;
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
async function fetchSWEItems() {
    await fetchItems();

    if (!state.items) return Array.isArray(state.items) ? [] : null;

    function filterNode(node) {
        if (!node) return null;

        // If node is an array, return an array of filtered children
        if (Array.isArray(node)) {
            const arr = node
                .map((child) => filterNode(child))
                .filter((c) => c !== null);
            return arr;
        }

        // Recurse into children if present
        let filteredChildren = [];
        if (node.children && node.children.length > 0) {
            filteredChildren = node.children
                .map((child) => filterNode(child))
                .filter((c) => c !== null);
        }

        const expects = Boolean(node.expect_software_effort);
        const descendantFlag = Boolean(
            node.has_descendant_expecting_software_effort,
        );

        // Include this node if it matches or any child matched
        const includeNode =
            expects || descendantFlag || filteredChildren.length > 0;

        if (!includeNode) return null;

        // Preserve original node shape but set `children` to the filtered list (if any)
        // Use shallow copy to avoid mutating original state data
        const copy = { ...node };

        // If there were filtered children, set them; otherwise remove children to keep structure tidy
        if (filteredChildren.length > 0) {
            copy.children = filteredChildren;
        } else {
            // Ensure `children` is either undefined or an empty array depending on original structure.
            // Prefer to remove the key entirely to avoid empty arrays where not needed:
            delete copy.children;
        }

        return copy;
    }

    // Return the same top-level type as state.items
    if (Array.isArray(state.items)) {
        return filterNode(state.items);
    } else {
        return filterNode(state.items);
    }
}

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
    if (String(node.program_id) === String(orgId)) {
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

export function useProgramCatalogStore() {
    return {
        state,
        fetchItems,
        fetchItemsNames,
        fetchSWEItems,
        findByOrgId,
        findByOrgName,
        getOrgPathByID,
    };
}
