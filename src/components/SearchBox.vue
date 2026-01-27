<script setup>
import { ref, computed } from "vue";
import BaseIcon from "src/components/BaseIcon.vue";
import { mdiMagnify } from "@mdi/js";
import { STATUS_COLORS } from "src/styles/statusConstants";

const props = defineProps({
  items: {
    type: Array, // Array of node objects { name, value, ... }
    required: true,
  },
});

const emit = defineEmits(["select"]);

const query = ref("");
const isOpen = ref(false);
const activeFilter = ref("all");

const filters = [
  { label: "All", value: "all" },
  { label: "Programs", value: "program" },
  { label: "Efforts", value: "effort" },
];

const filteredItems = computed(() => {
  if (!query.value) return [];
  const lowerQuery = query.value.toLowerCase();

  return props.items
    .filter((item) => {
      // 1. Check Filter
      if (activeFilter.value === "program" && item.isSoftwareEffort)
        return false;
      if (activeFilter.value === "effort" && !item.isSoftwareEffort)
        return false;

      // 2. Check Query - search name and numeric IDs (exclude UUIDs)
      const isNumericId = (val) => {
        if (!val) return false;
        const str = String(val);
        // Exclude UUID format (contains hyphens)
        return !str.includes('-');
      };

      return (
        (item.name && item.name.toLowerCase().includes(lowerQuery)) ||
        (item.program_id && isNumericId(item.program_id) && String(item.program_id).toLowerCase().includes(lowerQuery)) ||
        (item.id && isNumericId(item.id) && String(item.id).toLowerCase().includes(lowerQuery))
      );
    })
    .slice(0, 10); // Limit to 10 suggestions
});

const handleInput = () => {
  isOpen.value = true;
};

const selectItem = (item) => {
  query.value = item.name;
  isOpen.value = false;
  emit("select", item);
};

const handleBlur = () => {
  // Delay close to allow click event to register
  setTimeout(() => {
    isOpen.value = false;
  }, 200);
};

// Helper to get inline styles using STATUS_COLORS for consistent theming
const getProgramStatusStyle = (item) => {
  if (item.isSoftwareEffort) return {};

  let colors;

  // Check for Software Assigned (has software efforts)
  if (item.softwareEfforts && item.softwareEfforts.length > 0) {
    colors = STATUS_COLORS.active;
  }
  // Check for Expected (Missing) - expecting efforts but has none
  else if (item.expecting_software_efforts) {
    colors = STATUS_COLORS.gap;
  }
  // Check for Parent of Effort
  else if (item.has_descendant_expecting_software_effort) {
    colors = STATUS_COLORS.parent;
  }
  // Neutral
  else {
    colors = STATUS_COLORS.neutral;
  }

  return {
    backgroundColor: colors.bg,
    color: colors.text,
    borderColor: colors.border,
  };
};

// Helper to get program status label
const getProgramStatusLabel = (item) => {
  if (item.isSoftwareEffort) return "";

  if (item.softwareEfforts && item.softwareEfforts.length > 0) {
    return "Software Assigned";
  }
  if (item.expecting_software_efforts) {
    return "Expected (Missing)";
  }
  if (item.has_descendant_expecting_software_effort) {
    return "Parent of Effort";
  }
  return "Neutral Program";
};
</script>

<template>
  <div class="search-container">
    <div class="input-wrapper">
      <input
        v-model="query"
        type="text"
        placeholder="Search Programs or Efforts..."
        class="std-input search-input-override"
        @input="handleInput"
        @focus="isOpen = true"
        @blur="handleBlur"
      />
      <span class="search-icon"
        ><BaseIcon :path="mdiMagnify" :size="14"
      /></span>
    </div>

    <div v-if="isOpen && query" class="suggestions-dropdown">
      <!-- Filter Bar -->
      <div class="filter-bar">
        <span
          v-for="filter in filters"
          :key="filter.value"
          class="filter-chip"
          :class="{ active: activeFilter === filter.value }"
          @mousedown.prevent="activeFilter = filter.value"
        >
          {{ filter.label }}
        </span>
      </div>

      <ul v-if="filteredItems.length" class="suggestions-list">
        <li
          v-for="item in filteredItems"
          :key="item.value"
          @click="selectItem(item)"
          class="suggestion-item"
        >
          <div class="item-content">
            <!-- Row 1: Name + Type Badge -->
            <div class="item-row primary">
              <span class="item-name">{{ item.name }}</span>
              <span
                class="item-type-badge"
                :class="{ program: !item.isSoftwareEffort }"
              >
                {{ item.isSoftwareEffort ? "Effort" : "Program" }}
              </span>
            </div>

            <!-- Row 2: Parent + ID (for efforts) OR Status + ID (for programs) -->
            <div class="item-row meta-row">
              <!-- For Efforts: Parent + ID -->
              <template v-if="item.isSoftwareEffort">
                <span v-if="item.programName" class="parent-info">
                  <span class="parent-label">Parent:</span>
                  <span class="parent-name">{{ item.programName }}</span>
                </span>
              </template>
              <!-- For Programs: Status Badge -->
              <span
                v-else
                class="status-badge"
                :style="getProgramStatusStyle(item)"
              >
                {{ getProgramStatusLabel(item) }}
              </span>
              <span class="item-id">ID: {{ item.value }}</span>
            </div>
          </div>
        </li>
      </ul>
      <div v-else class="no-results">
        No results found for "{{ query }}" in
        {{
          activeFilter === "all"
            ? "All"
            : activeFilter === "program"
              ? "Programs"
              : "Efforts"
        }}.
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-container {
  position: relative;
  width: 480px; /* 50% wider (was 320px) */
}

.input-wrapper {
  position: relative;
}

.search-input-override {
  padding-left: 40px !important; /* Space for icon */
  border-radius: 24px; /* Maintain pill shape for search, or use 8px for strict consistency? strict consistency = 8px */
  border-radius: 8px !important;
}

.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0.6;
  font-size: 14px;
  color: #1d1b20; /* on-surface */
  pointer-events: none;
}

.suggestions-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;
  background: #ece6f0; /* surface-container-high */
  border: 1px solid #c4c7c5; /* outline-variant */
  border-radius: 12px;
  margin-top: 6px;
  box-shadow:
    0px 2px 6px 2px rgba(0, 0, 0, 0.15),
    0px 1px 2px 0px rgba(0, 0, 0, 0.3); /* elevation-2 */
  z-index: 1000;
  overflow: hidden;
}

.filter-bar {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid #c4c7c5;
  background: #f3edf7; /* surface-container */
}

.filter-chip {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 10px;
  border-radius: 12px;
  border: 1px solid #79747e;
  color: #49454f;
  cursor: pointer;
  transition: 0.2s;
}

.filter-chip:hover {
  background: #e8def8;
}

.filter-chip.active {
  background: #e8def8; /* secondary-container */
  color: #1d192b; /* on-secondary-container */
  border-color: transparent;
}

.suggestions-list {
  padding: 4px;
  list-style: none;
  max-height: 400px;
  overflow-y: auto;
  margin: 0;
}

.suggestion-item {
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.1s;
}

.suggestion-item:hover {
  background: #e6e0e9; /* surface-container-highest */
}

.item-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.item-row.primary {
  justify-content: space-between;
}

.item-name {
  font-weight: 500;
  color: #1d1b20; /* on-surface */
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-row.secondary {
  font-size: 11px;
  color: #625b71; /* secondary */
}

.item-type-badge {
  font-weight: 600;
  text-transform: uppercase;
  font-size: 10px;
  padding: 3px 10px;
  border-radius: 12px;
  background: linear-gradient(135deg, #ffdf90 0%, #ffd54f 100%);
  color: #5d4037;
  letter-spacing: 0.5px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  flex-shrink: 0;
}

.item-type-badge.program {
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  color: #1565c0;
  border-color: rgba(21, 101, 192, 0.15);
}

.item-context {
  color: #49454f; /* on-surface-variant */
  opacity: 0.8;
}

.item-context::before {
  content: "•";
  margin-right: 8px;
  opacity: 0.5;
}

.item-id {
  margin-left: auto; /* Push to right */
  font-family: monospace;
  color: #625b71; /* secondary color for visibility */
  font-size: 11px;
}

.no-results {
  padding: 16px;
  text-align: center;
  color: #49454f; /* on-surface-variant */
  font-size: 13px;
  font-style: italic;
}

/* Parent Row for Software Efforts */
.item-row.parent-row {
  font-size: 11px;
  color: #625b71;
  margin-top: 2px;
}

.parent-label {
  font-weight: 500;
  color: #79747e;
  margin-right: 4px;
}

.parent-name {
  color: #49454f;
  font-weight: 500;
}

.parent-info {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Meta Row */
.item-row.meta-row {
  font-size: 11px;
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Status Badges for Programs - colors applied via inline styles from STATUS_COLORS */
.status-badge {
  font-size: 9px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  border-width: 1px;
  border-style: solid;
}
</style>
