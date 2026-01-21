/**
 * locationOptions
 *
 * Data Source:
 * - Pulled from the `hr_location_tbl` here: https://datacatalog.web.boeing.com/table/199397/
 *
 * Short guidance:
 * - Keep entries as "City, Region/State, Country".
 * - Prefer a single canonical source (internal API or registry) — update here only when that source changes.
 * - For long-term stability consider switching to objects with a stable id (e.g. { id, label }) and use id in the backend.
 * - Avoid duplicates/aliases (e.g., "Bangalore" vs "Bengaluru"); normalize names in one place.
 * - For very long lists enable server-side search and client-side debounce to keep the UI snappy.
 */

const locationOptions = [
    "None",
    "Other",
    "Remote",

    // Dummy Data
    "New York, New York, USA",
    "Los Angeles, California, USA",
    "Chicago, Illinois, USA",
    "Houston, Texas, USA",
    "Phoenix, Arizona, USA",
    "Philadelphia, Pennsylvania, USA",
    "San Antonio, Texas, USA",
    "San Diego, California, USA",
    "Dallas, Texas, USA",
    "San Jose, California, USA",
];

function alphabetizeLocations(list, pinned = ["None", "Other", "Remote"]) {
    // Create a set for quick lookup of pinned items (case-sensitive match to preserve exact strings)
    const pinnedSet = new Set(pinned);

    // Separate pinned items (in order) and the rest
    const rest = list.filter((item) => !pinnedSet.has(item));
    // Stable, case-insensitive sort for the rest
    const sortedRest = rest.slice().sort((a, b) =>
        a.localeCompare(b, undefined, {
            sensitivity: "accent",
            numeric: true,
            caseFirst: "upper",
        }),
    );

    // Return pinned (only those present) followed by sorted rest
    const pinnedPresent = pinned.filter((p) => list.includes(p));
    return [...pinnedPresent, ...sortedRest];
}

export const locationOptionsAlphabetized =
    alphabetizeLocations(locationOptions);

export default locationOptionsAlphabetized;