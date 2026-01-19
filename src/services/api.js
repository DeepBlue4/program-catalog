import { MockApiData } from "./mockApiData.js";

export class CompassAPIService {
    static pathPrefix = "/ui/swe-program-catalog/";
    static useTestData = true;

    /**
     * Standard response format for our API calls.
     * @typedef {Object} APIResponse
     * @property {bool} success - Did it work?
     * @property {Array | Object | undefined} response - The actual data payload.
     */

    /**
     * Grabs the CSRF token so Django doesn't block our unsafe requests (POST/PUT/DELETE).
     * 
     * In prod, we usually pluck this from the DOM hidden input.
     * In local dev, we might have to fish it out of a cookie.
     *
     * @static
     * @returns {string | null} - The token string or null if we can't find it.
     */
    static getCSRFToken() {
        // Try to get it from the DOM first (standard Django template way)
        const csrfToken = document.querySelector("[name=csrfmiddlewaretoken]");
        if (csrfToken !== null) {
            return csrfToken.value;
        }

        // If we're running locally (not served by Django), we might need to check the cookies.
        // This is mostly a dev-environment workaround.
        console.warn("CSRF via cookie should be in local development only");
        let cookieValue = null;
        if (document.cookie && document.cookie !== "") {
            const cookies = document.cookie.split(";");
            for (const rawCookie of cookies) {
                const cookie = rawCookie.trim();
                // Simple string match to find the token
                if (cookie.substring(0, 10) === "csrftoken" + "=") {
                    cookieValue = decodeURIComponent(cookie.substring(10));
                    break;
                }
            }
        }
        return cookieValue;
    }

    /**
     * Wrapper for HTTP PUT requests. Handles headers and JSON conversion for you.
     *
     * @param {string} path - API endpoint
     * @param {object} payload - What you're sending
     * @returns {APIResponse}
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
     * Basic GET wrapper.
     *
     * @param {string} pathSuffix - Endpoint to hit (e.g. 'current-user')
     * @param {any} defaultValue - What to return if things explode.
     * @returns {any}
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
     * Fetches all software efforts for a specific program node.
     * This is separate because the main tree payload is usually too light to include them.
     */
    static async getSoftwareEfforts(hierarchyNodeUUID) {
        if (CompassAPIService.useTestData) {
            await MockApiData.simulateLatency(CompassAPIService.useTestData);
            return {
                success: true,
                data: MockApiData.getMockSoftwareEfforts(hierarchyNodeUUID)
            };
        }

        const path = `enterprise-hierarchy/${hierarchyNodeUUID}/software-effort`;
        console.log(`[API] getSoftwareEfforts fetching: ${path}`);

        const data = await CompassAPIService.performGet(
            path,
            [],
        );
        return data;
    }

    /**
     * Create or Update a software effort.
     *
     * @param {string} hierarchyNodeUUID - Program UUID context
     * @param {Object} effort - The actual effort data
     */
    static async saveSoftwareEffort(hierarchyNodeUUID, effort) {
        if (CompassAPIService.useTestData) {
            await MockApiData.simulateLatency(CompassAPIService.useTestData);
            console.log(`[Mock SAVE] Saving effort for ${hierarchyNodeUUID}:`, effort);

            // In a real mock scenario with state persistence, we would update the list locally.
            // For now, we return success with the data passed back (mimicking backend echo).
            return {
                success: true,
                data: effort
            };
        }

        const path = `enterprise-hierarchy/${hierarchyNodeUUID}/software-effort`;
        return await this.performPut(path, effort);
    }

    /**
     * Removes an effort from existence.
     */
    static async deleteSoftwareEffort(hierarchyNodeUUID, effortId) {
        if (CompassAPIService.useTestData) {
            await MockApiData.simulateLatency(CompassAPIService.useTestData);
            console.log(`[Mock DELETE] Deleting effort ${effortId} from ${hierarchyNodeUUID}`);
            return { success: true };
        }

        const path = `enterprise-hierarchy/${hierarchyNodeUUID}/software-effort/${effortId}`;

        // We need a performDelete helper or use fetch directly
        const csrfToken = CompassAPIService.getCSRFToken();
        try {
            const response = await fetch(`${CompassAPIService.pathPrefix}${path}`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": csrfToken
                }
            });
            if (!response.ok) {
                console.error("DELETE request failed:", response);
                return { success: false };
            }
            return { success: true };
        } catch (e) {
            console.error("DELETE request exception:", e);
            return { success: false };
        }
    }

    /**
     * Get details for a single program node.
     */
    static async getProgram(hierarchyNodeUUID) {
        if (CompassAPIService.useTestData) {
            return {
                success: true,
                data: MockApiData.getMockProgram(hierarchyNodeUUID),
            };
        }

        const data = await CompassAPIService.performGet(
            `enterprise-hierarchy/${hierarchyNodeUUID}`,
            [],
        );
        return data;
    }

    /**
     * Fetches the entire organization hierarchy tree (the "Program Catalog").
     */
    static async getEnterpriseHierarchy() {
        if (CompassAPIService.useTestData) {
            await MockApiData.simulateLatency(CompassAPIService.useTestData);
            return {
                success: true,
                data: MockApiData.generateMockHierarchy(),
            };
        }
        const data = await CompassAPIService.performGet("enterprise-hierarchy", {});
        return data;
    }

    /**
     * Info about who is currently logged in.
     */
    static async getCurrentUser() {
        if (CompassAPIService.useTestData) {
            return {
                success: true,
                data: MockApiData.getMockUser(),
            };
        }
        const data = await CompassAPIService.performGet("current-user", {});
        return data;
    }

    /**
     * Fetch a list of known emails (for autocomplete, etc).
     */
    static async getEmails() {
        if (CompassAPIService.useTestData) {
            return {
                success: true,
                data: MockApiData.getMockEmails(),
            };
        }
        const data = await CompassAPIService.performGet("emails", {});
        return data;
    }
}
