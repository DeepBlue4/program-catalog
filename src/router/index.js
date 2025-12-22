import { createRouter, createWebHistory } from 'vue-router';
import ProgramTreeView from '../views/ProgramTreeView.vue';
import ProgramEffortsView from '../views/ProgramEffortsView.vue';

const routes = [
    {
        path: '/',
        name: 'ProgramTree',
        component: ProgramTreeView
    },
    {
        path: '/efforts/:programId',
        name: 'ProgramEfforts',
        component: ProgramEffortsView
    }
];

const router = createRouter({
    history: createWebHistory(),
    routes
});

export default router;
