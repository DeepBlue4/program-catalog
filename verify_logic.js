
// Mock Node Structure (mimicking Mock Data)
const mockRoot = {
    value: "123",
    name: "Root Program",
    children: [
        {
            value: "456",
            name: "Child Program", // Mock uses 'value'
            program_id: undefined
        }
    ]
};

// Mock Real API Node Structure (mimicking production)
const apiRoot = {
    program_id: "789",
    name: "API Program",
    children: []
};

// Extracted Logic from Store
function findByOrgId(orgId, node) {
    if (!node) return null;

    // Check match
    if (String(node.program_id) === String(orgId) || String(node.value) === String(orgId)) {
        return node;
    }

    if (node.children) {
        for (const child of node.children) {
            const found = findByOrgId(orgId, child);
            if (found) return found;
        }
    }
    return null;
}

// Extracted Logic from App.vue
function findPath(node, targetId, currentPath = []) {
    const nodeId = node.value || node.program_id;

    if (String(nodeId) === String(targetId)) return [...currentPath, node];

    if (node.children) {
        for (const child of node.children) {
            const res = findPath(child, targetId, [...currentPath, node]);
            if (res) return res;
        }
    }
    return null;
}

// Tests
console.log("--- Testing findByOrgId ---");
const foundMock = findByOrgId("456", mockRoot);
console.log("Found Mock Node:", foundMock ? "SUCCESS" : "FAIL");

const foundApi = findByOrgId("789", apiRoot);
console.log("Found API Node:", foundApi ? "SUCCESS" : "FAIL");

console.log("\n--- Testing findPath ---");
const pathMock = findPath(mockRoot, "456");
console.log("Path to Mock Node:", pathMock && pathMock.length === 2 ? "SUCCESS" : "FAIL");
// Expected: [Root, Child]

const pathApi = findPath(apiRoot, "789");
console.log("Path to API Node:", pathApi && pathApi.length === 1 ? "SUCCESS" : "FAIL");
// Expected: [Root]

if (foundMock && foundApi && pathMock && pathApi) {
    console.log("\nALL TESTS PASSED");
} else {
    console.log("\nTESTS FAILED");
    process.exit(1);
}
