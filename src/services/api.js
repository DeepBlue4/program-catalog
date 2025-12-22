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
            // Return simple mock efforts
            return {
                success: true,
                data: [
                    {
                        id: `eff-${hierarchyNodeUUID}-1`,
                        name: "Mock Effort 1",
                        type: "System",
                        status: "Active",
                        description: "A mock system effort for testing.",
                    },
                    {
                        id: `eff-${hierarchyNodeUUID}-2`,
                        name: "Mock Effort 2",
                        type: "Service",
                        status: "Planned",
                        description: "A mock service effort.",
                    },
                ],
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
                    email: "test.user@boeing.com",
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
                    "jane.doe@boeing.com",
                    "john.smith@boeing.com",
                    "admin@boeing.com",
                    "developer@boeing.com",
                ],
            };
        }
        const data = await CompassAPIService.performGet("emails", {});
        return data;
    }

    // --- Mock Data Generators ---

    static generateMockHierarchy() {
        const createNode = (id, name, type, children = []) => ({
            program_id: id,
            name,
            type,
            children,
            expect_software_effort: Math.random() > 0.5,
            has_descendant_expecting_software_effort: children.some(c => c.expect_software_effort || c.has_descendant_expecting_software_effort)
        });

        return [
            createNode("root-1", "Space Division", "Division", [
                createNode("prog-1", "Mars Mission", "Program", [
                    createNode("team-1", "Avionics Team", "Team"),
                    createNode("team-2", "Propulsion Team", "Team")
                ]),
                createNode("prog-2", "Satellite System", "Program")
            ]),
            createNode("root-2", "Defense Division", "Division", [
                createNode("prog-3", "F-XX Fighter", "Program")
            ])
        ];
    }
}
