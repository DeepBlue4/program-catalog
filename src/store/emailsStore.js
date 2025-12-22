import { reactive } from "vue";
import { CompassAPIService } from "../services/api.js";

const state = reactive({
    emails: [],
    loading: false,
    error: null,
});

async function fetchEmails() {
    if (state.emails.length > 0) {
        // Don't fetch again since we already have the data
        return;
    }
    state.loading = true;
    state.error = null;
    try {
        const response = await CompassAPIService.getEmails();

        if (!response.success) {
            state.error = "Could not connect to the backend";
        } else {
            state.emails = response.data;
        }
    } catch (err) {
        state.error = err.message || "Failed to fetch emails";
    } finally {
        state.loading = false;
    }
}

export function useEmailsStore() {
    return {
        state,
        fetchEmails,
    };
}
