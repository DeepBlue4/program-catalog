export class CompassAPIService {
    static pathPrefix = "/ui/swe-program-catalog/";
    static useTestData = true;

    /**
     * API Response
     * @typedef {Object} APIResponse
     * @property {bool} success - True if the request was successful
     * @property {Array | Object | undefined} response - the API response.
     */

    /**
     * Helper for fetching the CSRF token.
     *
     * @static
     * @returns {string | null} - null of the token could not be fetched
     * @see https://docs.djangoproject.com/en/5.2/howto/csrf/#using-csrf-protection-with-ajax
     */
    static getCSRFToken() {
        // For production, we should be able to get this from the DOM since that is where Django
        // sets it in the template that contains the app
        const csrfToken = document.querySelector("[name=csrfmiddlewaretoken]");
        if (csrfToken !== null) {
            return csrfToken.value;
        }
        // Code path for dev since the index.html is not hosted via Django and running locally. Here,
        // the value is pulled from a cookie. When running locally, the cookie is not restricted to
        // HTTP Only thus is available to the JS code
        console.warn("CSRF via cookie should be in local development only");
        let cookieValue = null;
        if (document.cookie && document.cookie !== "") {
            const cookies = document.cookie.split(";");
            for (const rawCookie of cookies) {
                const cookie = rawCookie.trim();
                // Does this cookie string begin with the name we want?
                if (cookie.substring(0, 10) === "csrftoken" + "=") {
                    cookieValue = decodeURIComponent(cookie.substring(10));
                    break;
                }
            }
        }
        return cookieValue;
    }

    /**
     * Performs a PUT with the CSRF token in the header.
     *
     * @param {string} path - the path to the API endpoint
     * @param {object} payload - the payload in the body
     * @returns {APIResponse} - the API response
     */
    static async performPut(path, payload) {
        if (CompassAPIService.useTestData) {
            console.log(`[Mock PUT] Path: ${path}`, payload);
            return { success: true, data: payload };
        }

        const csrfToken = CompassAPIService.getCSRFToken();
        const response = await fetch(`${CompassAPIService.pathPrefix}${path}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken },
            body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok) {
            console.error("PUT request failed:", response);
            return {
                success: false,
                data,
            };
        }

        return {
            success: true,
            data,
        };
    }

    /**
     * Helper for performing an HTTP GET to the Compass Server/
     *
     * @param {string} pathSuffix - the suffixed used to completer the URL
     * @param {any} defaultValue - the objected returned if an error occurred while making the call.
     * @returns {any} - the result of the request
     * @see SoftwareEffort in core/src/models/program/software_effort.py
     */
    static async performGet(pathSuffix, defaultValue = undefined) {
        const endpointPath = `${CompassAPIService.pathPrefix}${pathSuffix}`;
        try {
            const res = await fetch(endpointPath);
            if (!res.ok) {
                console.warn("Could not perform GET on path:", endpointPath);
                return defaultValue;
            }
            const data = await res.json();
            return {
                success: true,
                data,
            };
        } catch (err) {
            console.warn("Error while calling", endpointPath, err);
            return {
                success: false,
                data: defaultValue,
            };
        }
    }

    /**
     * Gets all Software Efforts assigned to a program.
     *
     * @param {string} hierarchyNodeUUID - the UUID of the node in the hierarchy
     * @returns {APIResponse} - the API response containing the list of efforts (if any)
     * @see SoftwareEffort in core/src/models/program/software_effort.py
     */
    static async getSoftwareEfforts(hierarchyNodeUUID) {
        if (CompassAPIService.useTestData) {
            await CompassAPIService.simulateLatency();
            // Return simple mock efforts locally or via generator if needed
            // For now, let's generate a larger list to test paging
            const count = 45; // Test pagination
            const efforts = [];
            for (let i = 0; i < count; i++) {
                efforts.push({
                    id: `eff-${hierarchyNodeUUID}-${i}`,
                    name: `Mock Effort ${i + 1}`,
                    type: i % 3 === 0 ? 'System' : 'Service',
                    status: 'Active',
                    description: `Automated mock effort ${i + 1} description.`,
                });
            }
            return {
                success: true,
                data: efforts
            };
        }

        const data = await CompassAPIService.performGet(
            `enterprise-hierarchy/${hierarchyNodeUUID}/software-effort`,
            [],
        );
        return data;
    }

    /**
     * Updates the efforts assigned to a node
     * @param {string} hierarchyNodeUUID - the UUID of the node in the hierarchy
     * @param {Array} efforts - the efforts to set on the node
     * @returns {APIResponse} - the result of the request (success/failure)
     * @see SoftwareEffort in core/src/models/program/software_effort.py
     */
    static async updateSoftwareEffortsForNode(hierarchyNodeUUID, efforts) {
        const path = `enterprise-hierarchy/${hierarchyNodeUUID}/software-effort`;
        return await this.performPut(path, efforts);
    }

    /**
     * Gets organization / program information.
     *
     * @param {string} hierarchyNodeUUID - the UUID of the node in the hierarchy
     * @returns {APIResponse} - the requested program, or an empty object if there was an error
     */
    static async getProgram(hierarchyNodeUUID) {
        if (CompassAPIService.useTestData) {
            return {
                success: true,
                data: {
                    program_id: hierarchyNodeUUID,
                    program_name: "Mock Program",
                    program_manager: "Jane Doe",
                    description: "This is a mock program description.",
                },
            };
        }

        const data = await CompassAPIService.performGet(
            `enterprise-hierarchy/${hierarchyNodeUUID}`,
            [],
        );
        return data;
    }

    /**
     * Get the hierarchy as a tree
     * @returns {APIResponse} - the hierarchy as a tree, or an empty object if there was an error
     */
    static async getEnterpriseHierarchy() {
        if (CompassAPIService.useTestData) {
            await CompassAPIService.simulateLatency();
            return {
                success: true,
                data: CompassAPIService.generateMockHierarchy(),
            };
        }
        const data = await CompassAPIService.performGet("enterprise-hierarchy", {});
        return data;
    }

    /**
     * Get the currently authenticated user.
     *
     * @returns {APIResponse} - the current user object or an empty object if there was an error
     */
    static async getCurrentUser() {
        if (CompassAPIService.useTestData) {
            return {
                success: true,
                data: {
                    username: "testuser",
                    email: "test.user@company.com",
                    first_name: "Test",
                    last_name: "User",
                },
            };
        }
        const data = await CompassAPIService.performGet("current-user", {});
        return data;
    }

    /**
     * Get the registered emails.
     *
     * @returns {APIResponse} - the list of emails or an empty object if there was an error
     */
    static async getEmails() {
        if (CompassAPIService.useTestData) {
            return {
                success: true,
                data: [
                    "jane.doe@company.com",
                    "john.smith@company.com",
                    "admin@company.com",
                    "developer@company.com",
                ],
            };
        }
        const data = await CompassAPIService.performGet("emails", {});
        return data;
    }

    // --- Mock Data Generators ---

    static async simulateLatency() {
        if (!CompassAPIService.useTestData) return;
        const ms = Math.floor(Math.random() * 800) + 800; // 800 - 1600ms
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static generateMockHierarchy() {
        const effortTypes = ['System', 'Service', 'Component', 'Application', 'Library'];
        const effortStatuses = ['Active', 'Maintenance', 'Planned', 'Deprecated'];
        const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

        // Scale Factor: Increase for larger tree
        const MAX_DEPTH = 4; // 0-indexed, so 5 levels
        const MIN_CHILDREN = 2;
        const MAX_CHILDREN = 5;

        const createNode = (depth, parentName) => {
            const id = Math.floor(Math.random() * 10000000); // Larger ID space
            let name;

            if (depth === 0) name = "Company PGC";
            else if (depth === 1) name = `${pick(['Space', 'Defense', 'Commercial', 'Global'])} Division ${id.toString().slice(-2)}`;
            else if (depth === 2) name = `${pick(['X', 'Y', 'Z', 'Alpha', 'Beta', 'Gamma', 'Delta'])} Program ${id.toString().slice(-3)}`;
            else if (depth === 3) name = `${pick(['Avionics', 'Propulsion', 'Software', 'Logistics', 'Mission', 'Ground'])} Team ${id.toString().slice(-3)}`;
            else name = `Unit ${Math.floor(Math.random() * 1000)}`;

            // Program Properties
            const programLeader = `Leader ${pick(['Smith', 'Johnson', 'Williams', 'Brown'])}`;
            const chiefEngineer = `Eng. ${pick(['Davis', 'Miller', 'Wilson', 'Moore'])}`;
            const primaryLocation = pick(['Seattle, WA', 'St. Louis, MO', 'Huntsville, AL', 'Arlington, VA']);
            const primaryType = pick(['Production', 'Development', 'Sustainment', 'R&D']);
            const programValue = `$${(Math.random() * 100 + 10).toFixed(1)}M`;

            const isLeafCandidate = depth >= 3;
            const softwareEfforts = [];

            // Generate specific software efforts with hierarchy
            if (isLeafCandidate && Math.random() > 0.3) {
                // Create a root effort
                const rootId = `EFF-${id}-root`;
                softwareEfforts.push({
                    id: rootId,
                    name: `${name.split(' ')[0]} Platform`,
                    type: 'System',
                    status: 'Active',
                    description: 'Main platform system.',
                    parent: null,
                    inherit_statement_of_work_profile: false,
                    local_statement_of_work_profile: { description: 'Governing SOW for the entire platform lifecycle.' },
                    inherit_technical_points_of_contact: false,
                    local_technical_points_of_contact: { names: 'Chief Architect: Jane Doe' },
                    inherit_developer_setup: false,
                    local_developer_setup: { details: 'See Wiki: /platform-setup' },
                    inherit_work_location: false,
                    local_work_location: { location: primaryLocation },
                    children: [],
                    linked_software_efforts: []
                });

                // Create 1-2 Child efforts
                const numChildren = Math.floor(Math.random() * 3) + 1;
                for (let c = 0; c < numChildren; c++) {
                    const childId = `EFF-${id}-child-${c}`;
                    softwareEfforts.push({
                        id: childId,
                        name: `${name.split(' ')[0]} Module ${c + 1}`,
                        type: pick(effortTypes),
                        status: pick(effortStatuses),
                        description: `Sub-component for ${name}`,
                        parent: rootId,
                        inherit_statement_of_work_profile: true,
                        local_statement_of_work_profile: {},
                        inherit_technical_points_of_contact: true,
                        local_technical_points_of_contact: {},
                        inherit_developer_setup: true,
                        local_developer_setup: {},
                        inherit_work_location: true,
                        local_work_location: {},
                        children: [],
                        linked_software_efforts: []
                    });
                }
            }

            // Recursive Children
            const children = [];
            if (depth < MAX_DEPTH) {
                const numChildren = Math.floor(Math.random() * (MAX_CHILDREN - MIN_CHILDREN + 1)) + MIN_CHILDREN;
                for (let i = 0; i < numChildren; i++) {
                    children.push(createNode(depth + 1, name));
                }
            }

            return {
                value: id,
                name: name,
                children: children,
                details: {
                    programLeader,
                    chiefEngineer,
                    primaryLocation,
                    primaryType,
                    programValue
                },
                softwareEfforts: softwareEfforts,
                hasSoftwareEffort: softwareEfforts.length > 0,
                has_descendant_expecting_software_effort: children.some(c => c.hasSoftwareEffort || c.has_descendant_expecting_software_effort)
            };
        };

        return createNode(0, "Root");
    }


}
