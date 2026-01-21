---
description: Workflow for adding a new feature to the PGC frontend
---

# New Feature Implementation

1.  **Requirement Analysis**
    - [ ] Identify which views/components are affected.
    - [ ] Check if new data fields are needed in the API.

2.  **Mock Data Update**
    - [ ] Open `src/services/mockApiData.js`.
    - [ ] Add new fields or endpoints to support the feature locally.
    - [ ] Verify `useTestData = true` in `api.js`.

3.  **Store Implementation**
    - [ ] Update `src/store/programCatalogStore.js`.
    - [ ] Add actions/mutations for the new feature.
    - [ ] Ensure state reactivity (triggerRef if needed).

4.  **UI Component Implementation**
    - [ ] Create or update Vue components.
    - [ ] Use `BaseIcon` for any new icons.
    - [ ] Ensure responsiveness.

5.  **Integration & Verification**
    - [ ] Test with Mock Data.
    - [ ] (Optional) Test with real backend if available.
    - [ ] Verify no console errors.
