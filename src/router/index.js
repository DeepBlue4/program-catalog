import { createRouter, createWebHistory } from 'vue-router';
import { ref } from 'vue';
import { CompassAPIService } from '../services/api.js';
import ProgramTreeView from '../views/ProgramTreeView.vue';
import ProgramEffortsView from '../views/ProgramEffortsView.vue';

/* 
  We modify the currentUserRef here so the rest of the app (via main.js) 
  can reactively see who is logged in. 
  Starts as null until the API call finishes.
*/
export const currentUserRef = ref(null);

const permissionCache = new Map();

/* 
  Hit the backend to get the user context. 
  If it fails or returns bad data, we just leave the user as null.
*/
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


/* 
  Central place to decide if a user has "Write" access.
  Using the user's provided logic which handles the real backend structure.
*/
export function evaluateWriteAccess(user) {
    if (!user) return false;

    // Check for Real Backend Structure
    const isManager = Boolean(user?.cached?.manager_status);
    const isStaff = Boolean(user?.daf_user?.is_staff);
    const isAdmin = Boolean(user?.daf_user?.is_superuser);

    // Check for Mock Structure (fallback for local dev)
    const isMockManager = Boolean(user.isManager);
    const isMockStaff = Boolean(user.isStaff);
    const isMockAdmin = Boolean(user.isAdmin);

    return isManager || isStaff || isAdmin || isMockManager || isMockStaff || isMockAdmin;
}

/*
  New rule: Dashboard is Restricted.
  Only Admins or Staff can see it. Managers are NOT allowed unless they also have these flags.
*/
export function evaluateDashboardAccess(user) {
    if (!user) return false;

    // Real structure check
    const isStaff = Boolean(user?.daf_user?.is_staff);
    const isAdmin = Boolean(user?.daf_user?.is_superuser);

    // Mock structure check
    const isMockStaff = Boolean(user.isStaff);
    const isMockAdmin = Boolean(user.isAdmin);

    return isStaff || isAdmin || isMockStaff || isMockAdmin;
}

/* 
  The router guard calls this. We cache the result so we don't 
  spam the login check on every route change.
*/
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

/* Clear everything out if the user logs out so we don't use stale permissions. */
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
        component: () => import('../views/Dashboard.vue'),
        meta: { requiresDashboardAccess: true }
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
    const requiresDashboard = to.meta && to.meta.requiresDashboardAccess;

    // Fast path: if no special requirements, let them through
    if (!requiresAuth && !requiresDashboard) return next();

    // If we're here, we need to check permissions, so make sure user data is loaded
    if (currentUserRef.value === null) {
        // This might be redundant if fetchCurrentUser() already started, 
        // but we await it here to be safe.
        await fetchCurrentUser();
    }

    try {
        const user = currentUserRef.value;

        // 1. Check Write Access (for /efforts/:id)
        if (requiresAuth) {
            // Using our cached check logic is fine here
            const allowed = await checkPermission();
            if (!allowed) return next({ name: "PermissionDenied" });
        }

        // 2. Check Dashboard Access (Strict: Admin/Staff only)
        if (requiresDashboard) {
            const hasDashboardAccess = evaluateDashboardAccess(user);
            if (!hasDashboardAccess) return next({ name: "PermissionDenied" });
        }

        return next();
    } catch (err) {
        // on fetch/network errors, block access for safety
        console.error("Permission check failed:", err);
        return next({ name: "PermissionDenied" });
    }
});

export default router;

// Kick off user fetch immediately so the UI (UserMenu) populates even on public pages.
fetchCurrentUser();
