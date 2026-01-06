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
        // Deterministic Random Generator (Seeded)
        let seed = 5678;
        const random = () => {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };

        const effortTypes = ['System', 'Service', 'Component', 'Application', 'Library'];
        const effortStatuses = ['Active', 'Maintenance', 'Planned', 'Deprecated'];

        // Updated pick to use deterministic random
        const pick = (arr) => arr[Math.floor(random() * arr.length)];

        // Scale Factor: Increase for larger tree
        const MAX_DEPTH = 4; // 0-indexed, so 5 levels
        const MIN_CHILDREN = 2;
        const MAX_CHILDREN = 5;

        const createNode = (depth, parentName, forceName = null) => {
            // Deterministic ID generation logic
            const id = Math.floor(random() * 10000000);
            let name;

            if (forceName) {
                name = forceName;
            } else if (depth === 0) name = "Company PGC";
            else if (depth === 1) name = `${pick(['Space', 'Defense', 'Commercial', 'Global'])} Division ${id.toString().slice(-2)}`;
            else if (depth === 2) name = `${pick(['X', 'Y', 'Z', 'Alpha', 'Beta', 'Gamma', 'Delta'])} Program ${id.toString().slice(-3)}`;
            else if (depth === 3) name = `${pick(['Avionics', 'Propulsion', 'Software', 'Logistics', 'Mission', 'Ground'])} Team ${id.toString().slice(-3)}`;
            else name = `Unit ${Math.floor(random() * 1000)}`;

            const isTargetNeutral = name === "Commercial Division 37";

            // Program Properties (Flattned)
            const programLeader = `Leader ${pick(['Smith', 'Johnson', 'Williams', 'Brown'])}`;
            const chiefEngineer = `Eng. ${pick(['Davis', 'Miller', 'Wilson', 'Moore'])}`;
            const primaryLocation = pick(['Seattle, WA', 'St. Louis, MO', 'Huntsville, AL', 'Arlington, VA']);
            const primaryType = pick(['Production', 'Development', 'Sustainment', 'R&D']);
            const programValue = `$${(random() * 100 + 10).toFixed(1)}M`;

            const isLeafCandidate = depth >= 3;
            const softwareEfforts = [];

            if (isLeafCandidate && !isTargetNeutral && random() > 0.3) {
                // Generate 1 to 5 efforts to ensure "more than just 1" is common
                const numEfforts = Math.floor(random() * 5) + 1;

                for (let j = 0; j < numEfforts; j++) {
                    const effId = `EFF-${id}-${j}`;
                    // Use closure-safe pick
                    const effType = pick(effortTypes);
                    // Differentiate names slightly
                    const baseName = name.split(' ')[0] || 'Project';
                    const effName = j === 0
                        ? `${baseName} Platform`
                        : `${baseName} ${effType} ${j + 1}`;

                    // Hierarchy Logic:
                    // If not the first effort (j > 0), potentially make it a child of a previous effort
                    // Simple chain: each effort is child of previous? Or random?
                    // Let's do: j=0 is root. j=1 is child of j=0. j=2 is child of j=0. j=3 is root. etc.
                    let parentId = null;
                    if (j > 0 && random() > 0.3) {
                        // Pick a random parent from 0 to j-1
                        const parentIndex = Math.floor(random() * j);
                        parentId = `EFF-${id}-${parentIndex}`;
                    }

                    softwareEfforts.push({
                        id: effId,
                        name: effName,

                        status: pick(effortStatuses),
                        parent: parentId,
                        inherit_statement_of_work_profile: false,
                        local_statement_of_work_profile: {
                            type: effType,
                            program_manager_email: `manager.${j}@example.com`,
                            allow_non_us: random() > 0.5,
                            mission_critical: random() > 0.8,
                            program_phase: [pick(['Design', 'Development', 'Production'])],
                            security_clearance: [pick(['None', 'Secret'])],
                            safety_criticality: [pick(['None', 'DAL D / LOR 4'])]
                        },
                        inherit_technical_points_of_contact: false,
                        local_technical_points_of_contact: {
                            names: `Tech Lead: User ${j}`,
                            software_lead: `lead.${j}@example.com`,
                            security_focal: `sec.${j}@example.com`
                        },
                        inherit_developer_setup: false,
                        local_developer_setup: {
                            details: 'See Wiki for setup.',
                            programming_languages: [pick(['Python', 'C++', 'Java'])],
                            operating_systems: [pick(['Linux', 'Windows'])],
                            development_environments: [pick(['BSF-Global', 'BSF-US'])],
                            source_control_tools: [pick(['GitLab', 'Bitbucket'])],
                            issue_tracking_tools: [pick(['Jira', 'GitLab'])]
                        },
                        inherit_work_location: false,
                        local_work_location: {
                            locations: [primaryLocation, 'Remote']
                        },
                        children: [], // will be computed by frontend usually, but good to have
                        linked_software_efforts: []
                    });
                }
            }

            const children = [];
            if (depth < MAX_DEPTH && !isTargetNeutral) {
                // If Root, ensure one child is Commercial Division 37
                const numChildren = Math.floor(random() * (MAX_CHILDREN - MIN_CHILDREN + 1)) + MIN_CHILDREN;

                let forcedChildCreated = false;

                for (let i = 0; i < numChildren; i++) {
                    // Force the neutral node as the FIRST child of Root
                    if (depth === 0 && i === 0) {
                        children.push(createNode(depth + 1, name, "Commercial Division 37"));
                        forcedChildCreated = true;
                    } else {
                        children.push(createNode(depth + 1, name));
                    }
                }
            }

            // NEW: Compliance Requirement simulation
            // Randomly assign expectation (e.g., 60% of leaf candidates expect efforts)
            const expectsEffort = isLeafCandidate && random() > 0.4;

            return {
                value: id,
                name: name,
                children: children,
                // Flattened properties for Sidebar
                programLeader,
                chiefEngineer,
                primaryLocation,
                primaryType,
                programValue,

                softwareEfforts: softwareEfforts,
                hasSoftwareEffort: softwareEfforts.length > 0,
                expecting_software_efforts: expectsEffort,
                has_descendant_expecting_software_effort: children.some(c => c.hasSoftwareEffort || c.has_descendant_expecting_software_effort)
            };
        };

        return createNode(0, "Root");
    }


}
