# Data Models & Identifiers

## IDs vs UUIDs

### The Rule
*   **READ (GET)**: Often uses `program_id` (integer) for the hierarchy navigation.
*   **WRITE (PUT/DELETE)**: **MUST** use `uuid` (string) for specific resources like Software Efforts.

### Common Pitfalls
*   `deleteSoftwareEffort(id)` -> **FAIL** (Backend expects UUID).
*   `deleteSoftwareEffort(uuid)` -> **SUCCESS**.

### Reference
*   **Program Node**: Uses `program_id`.
*   **Software Effort**:
    *   `id`: Internal/Legacy ID (sometimes matches UUID in mock, but strictly UUID string in prod).
    *   `uuid`: The canonical identifier for API operations.
