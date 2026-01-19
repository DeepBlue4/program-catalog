import { createRouter, createWebHistory } from 'vue-router';
import { ref } from 'vue';
import { CompassAPIService } from '../services/api.js';
import ProgramTreeView from '../views/ProgramTreeView.vue';
import ProgramEffortsView from '../views/ProgramEffortsView.vue';

/*
  Shared reactive user ref exported so main.js can provide it to the app.
  Initialize to null meaning "not fetched yet / unknown".
*/
export const currentUserRef = ref(null);

const permissionCache = new Map();

/* fetch current user using your existing service */
async function fetchCurrentUser() {
    try {
        const resp = await CompassAPIService.getCurrentUser();
        if (resp && resp.success) {
            currentUserRef.value = resp.data;
        } else {
            currentUserRef.value = resp ? resp.data : null;
            console.warn("getCurrentUser returned success:false or no data");
        }
    } catch (err) {
        console.error("Error fetching current user:", err);
        currentUserRef.value = null;
        throw err;
    }
}

/* evaluate the "write" rule you want enforced throughout the app */
function evaluateWriteAccess(user) {
    if (!user) return false;
    // Adjust property access based on actual API response structure (usually flat or specific nesting)
    // Assuming the Mock/API returns a flat object or structured as expected.
    // The provided snippet used user?.cached?.manager_status etc, checking if that matches our API.
    // Our MockApiData returns flat properties: isManager, isAdmin, etc.
    // BUT the user snippet expects: user?.cached?.manager_status, user?.daf_user?.is_staff
    // Let's assume the backend aligns with the snippet OR we need to adapt.
    // Given we are using MockApiData.getMockUser() which returns { isManager: true, isAdmin: true... }
    // We should probably support BOTH structures to be safe or check MockApiData.

    // Safe check for Mock Data Structure (flat)
    if (user.isManager || user.isAdmin || user.isStaff) return true;

    // Snippet Structure (Real Backend?)
    const isManager = Boolean(user?.cached?.manager_status);
    const isStaff = Boolean(user?.daf_user?.is_staff);
    const isAdmin = Boolean(user?.daf_user?.is_superuser);
    return isManager || isStaff || isAdmin;
}

/* checkPermission now enforces the write rule for protected routes */
async function checkPermission() {
    const cacheKey = "global_write_access";
    if (permissionCache.has(cacheKey)) return permissionCache.get(cacheKey);

    if (currentUserRef.value === null) {
        await fetchCurrentUser();
    }

    const allowed = evaluateWriteAccess(currentUserRef.value);
    permissionCache.set(cacheKey, allowed);
    return allowed;
}

/* clear caches on logout or roles change */
export function clearPermissionCache() {
    permissionCache.clear();
    currentUserRef.value = null;
}

const routes = [
    {
        path: '/',
        name: 'ProgramTree',
        component: ProgramTreeView
    },
    {
        path: '/efforts/:programId',
        name: 'ProgramEfforts',
        component: ProgramEffortsView,
        meta: { requiresAuth: true }
    },
    {
        path: '/dashboard',
        name: 'Dashboard',
        component: () => import('../views/Dashboard.vue')
    },
    {
        path: '/403',
        name: 'PermissionDenied',
        component: () => import('../views/PermissionDenied.vue')
    },
    // Catch-all: redirect unknown routes to ProgramTree
    {
        path: "/:pathMatch(.*)*",
        redirect: { name: "ProgramTree" },
    },
];

const router = createRouter({
    history: createWebHistory(),
    routes
});

router.beforeEach(async (to, from, next) => {
    const requiresAuth = to.meta && to.meta.requiresAuth;
    if (!requiresAuth) return next();

    try {
        const allowed = await checkPermission();
        if (allowed) return next();
        // redirect to forbidden if not allowed
        return next({ name: "PermissionDenied" });
    } catch (err) {
        // on fetch/network errors, block access for safety
        console.error("Permission check failed:", err);
        return next({ name: "PermissionDenied" });
    }
});

export default router;
