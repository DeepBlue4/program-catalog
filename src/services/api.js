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
                const effId = `eff-${hierarchyNodeUUID}-${i}`;
                const effType = i % 3 === 0 ? 'System' : 'Service';

                efforts.push({
                    id: effId,
                    name: `Mock Effort ${i + 1}`,
                    parent: null, // Flat list for this mock scope usually

                    inherit_statement_of_work_profile: false,
                    local_statement_of_work_profile: {
                        type: effType, // Kept per user request
                        program_manager_email: `manager.${i}@example.com`,
                        allow_non_us: i % 2 === 0,
                        mission_critical: i % 4 === 0,
                        program_phase: 'Development', // String to match Django text
                        security_clearance: ['None'],
                        safety_criticality: ['None']
                    },

                    inherit_technical_points_of_contact: false,
                    local_technical_points_of_contact: {
                        software_lead: `lead.${i}@example.com`,
                        security_focal: `sec.${i}@example.com`
                    },

                    inherit_developer_setup: false,
                    local_developer_setup: {
                        programming_languages: ['Python', 'Java'],
                        operating_systems: ['Linux'],
                        development_environments: ['BSF-Global'],
                        source_control_tools: ['GitLab'],
                        issue_tracking_tools: ['Jira'],
                        dp_assessment_name: `DP-Assess-${i}`,
                        sbom_location: ['Artifactory']
                    },

                    inherit_work_location: false,
                    local_work_location: {
                        locations: ['Seattle, WA', 'Remote']
                    },

                    children: [],
                    linked_software_efforts: []
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

        const createNode = (depth, parentName, parentPath = '', forceName = null) => {
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

            // Program Properties
            const organization_leader_name = `Leader ${pick(['Smith', 'Johnson', 'Williams', 'Brown'])}`;
            const chief_engineer_name = `Eng. ${pick(['Davis', 'Miller', 'Wilson', 'Moore'])}`;
            const primary_location = pick(['Seattle, WA', 'St. Louis, MO', 'Huntsville, AL', 'Arlington, VA']);
            const program_allow_non_us = random() > 0.5;
            const program_type = pick(['Production', 'Development', 'Sustainment', 'R&D']);
            const program_value = `$${(random() * 100 + 10).toFixed(1)}M`;
            const description = `This is a mock description for ${name}. It contains generic information.`;
            const aliases = random() > 0.7 ? `Alias-${id}` : null;
            const status = "Green";

            const currentPath = parentPath ? `${parentPath}.${id}` : `${id}`;

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

                    let parentId = null;
                    if (j > 0 && random() > 0.3) {
                        // Pick a random parent from 0 to j-1
                        const parentIndex = Math.floor(random() * j);
                        parentId = `EFF-${id}-${parentIndex}`;
                    }

                    softwareEfforts.push({
                        id: effId,
                        name: effName,
                        parent: parentId,

                        inherit_statement_of_work_profile: false,
                        local_statement_of_work_profile: {
                            type: effType, // Kept per user request
                            program_manager_email: `manager.${j}@example.com`,
                            allow_non_us: random() > 0.5,
                            mission_critical: random() > 0.8,
                            program_phase: pick(['Design', 'Development', 'Production']), // Django CharField match (string)
                            security_clearance: [pick(['None', 'Secret'])],
                            safety_criticality: [pick(['None', 'DAL D / LOR 4'])]
                        },

                        inherit_technical_points_of_contact: false,
                        local_technical_points_of_contact: {
                            software_lead: `lead.${j}@example.com`,
                            security_focal: `sec.${j}@example.com`
                        },

                        inherit_developer_setup: false,
                        local_developer_setup: {
                            programming_languages: [pick(['Python', 'C++', 'Java'])],
                            operating_systems: [pick(['Linux', 'Windows'])],
                            development_environments: [pick(['BSF-Global', 'BSF-US'])],
                            source_control_tools: [pick(['GitLab', 'Bitbucket'])],
                            issue_tracking_tools: [pick(['Jira', 'GitLab'])],
                            dp_assessment_name: `DP-Assess-${j}`,
                            sbom_location: [pick(['Artifactory', 'Nexus'])]
                        },

                        inherit_work_location: false,
                        local_work_location: {
                            locations: [primary_location, 'Remote']
                        },

                        children: [],
                        linked_software_efforts: []
                    });
                }
            }

            const children = [];
            let hasDescendantExpecting = false;

            if (depth < MAX_DEPTH && !isTargetNeutral) {
                // If Root, ensure one child is Commercial Division 37
                const numChildren = Math.floor(random() * (MAX_CHILDREN - MIN_CHILDREN + 1)) + MIN_CHILDREN;

                for (let i = 0; i < numChildren; i++) {
                    let childNode;
                    // Force the neutral node as the FIRST child of Root
                    if (depth === 0 && i === 0) {
                        childNode = createNode(depth + 1, name, currentPath, "Commercial Division 37");
                    } else {
                        childNode = createNode(depth + 1, name, currentPath);
                    }
                    children.push(childNode);
                    if (childNode.hasSoftwareEffort || childNode.has_descendant_expecting_software_effort) {
                        hasDescendantExpecting = true;
                    }
                }
            }

            // Compliance Requirement simulation
            const expectsEffort = isLeafCandidate && random() > 0.4;
            if (expectsEffort) hasDescendantExpecting = true; // Logic check: if self expects, does it count for parent? 
            // In Django model: has_descendant_expecting_software_effort checks descendants.
            // But strict implementation: a node might expect effort itself. 
            // The method name is has_descendant... so strictly checks descendants.
            // But let's assume if children have it, true.

            return {
                // ProgramCatalogModel fields (implied/merged)
                id: id,
                program_id: id, // Replaces value for OrgChart/Frontend ID
                active: true,
                critical: random() > 0.9,

                // ProgramCatalogInfoModel fields
                date: new Date().toISOString().split('T')[0],
                name: name,
                program_path: currentPath,
                expect_software_effort: expectsEffort,
                description: description,
                aliases: aliases,
                status: status,
                primary_location: primary_location,
                organization_leader_name: organization_leader_name,
                chief_engineer_name: chief_engineer_name,
                program_affiliation: parentName, // Rough approx
                program_value: program_value,
                program_type: program_type,

                // Tree structure
                children: children,

                // Helper / Flattened properties for UI convenience if needed, 
                // but trying to match model structure more closely.
                // The frontend likely relies on these:
                programLeader: organization_leader_name, // Map for UI compatibility if needed by existing views?
                chiefEngineer: chief_engineer_name,      // Map for UI compatibility
                primaryLocation: primary_location,       // Map for UI compatibility
                primaryType: program_type,               // Map for UI compatibility
                programValue: program_value,             // Map for UI compatibility

                softwareEfforts: softwareEfforts,
                hasSoftwareEffort: softwareEfforts.length > 0,
                expecting_software_efforts: expectsEffort,
                has_descendant_expecting_software_effort: hasDescendantExpecting
            };
        };

        return createNode(0, "Root");
    }


}
