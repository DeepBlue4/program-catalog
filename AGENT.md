# Agent Rules & Context

## Project Overview
*   **Project**: Program Catalog (PGC)
*   **Stack**: Vue 3 (Composition API), Vite, Django (Backend)
*   **Styling**: Vanilla CSS (scoped), centralized in `src/styles`.

## Core Guidelines
1.  **Frontend/Backend Contract**:
    *   **Data Hydration**: The store (`programCatalogStore.js`) manually hydrates "Software Efforts" separately from the main hierarchy tree.

2.  **Coding Standards**:
    *   **Indentation**: 2 spaces for .vue and .js files.
    *   **Vue**: Use `<script setup>` syntax.
    *   **Mocking**: Maintain `mockApiData.js` to mirror backend changes. `useTestData = true` is the default for local dev.
    *   **Icons**: Use `@mdi/js` paths (BaseIcon wrapper), NOT font-awesome classes.

3.  **UI/UX**:
    *   **Modals**: Use `ConfirmationModal.vue` for destructive actions.
    *   **Tooltips**: Prefer rich HTML tooltips over simple text titles for complex data.
