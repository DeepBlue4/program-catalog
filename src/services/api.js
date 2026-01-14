import { MockApiData } from "./mockApiData.js";

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
     * Saves a single software effort (Create or Update).
     * @param {string} hierarchyNodeUUID - the UUID of the program
     * @param {Object} effort - the effort object to save
     * @returns {APIResponse}
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
     * Deletes a single software effort.
     * @param {string} hierarchyNodeUUID - the UUID of the program 
     * @param {string} effortId - the ID/UUID of the effort to delete
     * @returns {APIResponse}
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
     * Gets organization / program information.
     *
     * @param {string} hierarchyNodeUUID - the UUID of the node in the hierarchy
     * @returns {APIResponse} - the requested program, or an empty object if there was an error
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
     * Get the hierarchy as a tree
     * @returns {APIResponse} - the hierarchy as a tree, or an empty object if there was an error
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
     * Get the currently authenticated user.
     *
     * @returns {APIResponse} - the current user object or an empty object if there was an error
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
     * Get the registered emails.
     *
     * @returns {APIResponse} - the list of emails or an empty object if there was an error
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
