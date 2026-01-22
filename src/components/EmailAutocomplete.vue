<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useEmailsStore } from "../store/emailsStore";
import BaseIcon from "./BaseIcon.vue";
import { mdiAccountSearch, mdiClose } from "@mdi/js";

const props = defineProps({
  modelValue: {
    type: String,
    default: "",
  },
  label: {
    type: String,
    default: "Email",
  },
  placeholder: {
    type: String,
    default: "Enter email...",
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: "",
  },
  required: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["update:modelValue", "blur"]);

const store = useEmailsStore();
const searchQuery = ref(props.modelValue || "");
const showDropdown = ref(false);
const inputRef = ref(null);

// Sync internal query with v-model
watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal !== searchQuery.value) {
      searchQuery.value = newVal || "";
    }
  },
);

onMounted(() => {
  store.fetchEmails();
});

const filteredEmails = computed(() => {
  if (!searchQuery.value) return [];
  const query = searchQuery.value.toLowerCase();

  // If exact match exists, still show it but maybe user wants others?
  // Let's filter: query must be part of email
  return store.state.emails
    .filter((email) => email.toLowerCase().includes(query))
    .slice(0, 8); // Limit to 8 suggestions
});

const handleInput = (e) => {
  searchQuery.value = e.target.value;
  emit("update:modelValue", searchQuery.value);
  showDropdown.value = true;
};

const selectEmail = (email) => {
  searchQuery.value = email;
  emit("update:modelValue", email);
  showDropdown.value = false;
  emit("blur"); // Treat selection as blur/completion
};

const clearInput = () => {
  if (props.disabled) return;
  searchQuery.value = "";
  emit("update:modelValue", "");
  showDropdown.value = false;
  inputRef.value?.focus();
};

const handleBlur = () => {
  // Delay closing to allow click event on dropdown item
  setTimeout(() => {
    showDropdown.value = false;
    emit("blur");
  }, 200);
};

const handleFocus = () => {
  if (!props.disabled) {
    showDropdown.value = true;
  }
};
</script>

<template>
  <div
    class="email-autocomplete-wrapper"
    :class="{ 'has-error': error, 'is-disabled': disabled }"
  >
    <label v-if="label" class="field-label">
      {{ label }} <span v-if="required" class="required-star">*</span>
    </label>

    <div class="input-container">
      <input
        ref="inputRef"
        type="text"
        class="std-input with-icon-right"
        :class="{ 'has-error': error }"
        :value="searchQuery"
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
        :disabled="disabled"
        :placeholder="placeholder"
      />

      <div class="icon-actions">
        <button
          v-if="searchQuery && !disabled"
          @click="clearInput"
          class="btn-icon-input"
          title="Clear"
        >
          <BaseIcon :path="mdiClose" :size="16" />
        </button>
        <div class="static-icon" v-else>
          <BaseIcon :path="mdiAccountSearch" :size="20" />
        </div>
      </div>

      <!-- Validation Error Message -->
      <span v-if="error" class="error-msg-overlay">{{ error }}</span>

      <!-- Dropdown Suggestions -->
      <transition name="fade-slide">
        <div
          v-if="showDropdown && filteredEmails.length > 0"
          class="suggestions-dropdown m3-card elevated"
        >
          <div
            v-for="email in filteredEmails"
            :key="email"
            class="suggestion-item"
            @mousedown.prevent="selectEmail(email)"
          >
            <span class="match-highlight">
              <!-- Simple highlight logic could go here, for now just text -->
              {{ email }}
            </span>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<style scoped>
.email-autocomplete-wrapper {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  position: relative;
  font-family: "Roboto", sans-serif;
}

.field-label {
  font-size: 14px;
  font-weight: 500;
  color: #49454f;
  margin-bottom: 4px;
}

.required-star {
  color: #ba1a1a;
}

.input-container {
  position: relative;
  width: 100%;
}

.std-input {
  width: 100%;
  padding: 10px 12px;
  padding-right: 40px; /* Space for icon */
  border: 1px solid #79747e;
  border-radius: 4px;
  font-size: 14px;
  background: #ffffff; /* White background as requested */
  color: #1d1b20;
  transition: all 0.2s;
  height: 48px; /* Consistent M3 height */
  box-sizing: border-box;
}

.std-input:focus {
  border-color: #005ac1; /* primary */
  border-width: 2px;
  padding-left: 11px; /* Adjust for border width change */
  padding-right: 39px;
  outline: none;
}

.std-input.has-error {
  border-color: #ba1a1a;
}

.std-input:disabled {
  background-color: #e6e0e9; /* surface-variant/disabled look */
  color: #1d1b20;
  opacity: 0.6;
  cursor: not-allowed;
  border-color: transparent;
}

/* Icon Actions on Right */
.icon-actions {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: #49454f;
}

.btn-icon-input {
  background: none;
  border: none;
  cursor: pointer;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #49454f;
}

.btn-icon-input:hover {
  background-color: rgba(0, 0, 0, 0.08); /* slight hover overlay */
}

/* Error Msg */
.error-msg-overlay {
  position: absolute;
  bottom: -20px;
  left: 0;
  font-size: 11px;
  color: #ba1a1a;
  font-weight: 500;
}

/* Suggestions Dropdown */
.suggestions-dropdown {
  position: absolute;
  top: 100%; /* Below input */
  left: 0;
  right: 0;
  margin-top: 4px;
  background-color: #ffffff; /* Specifically white */
  border-radius: 4px;
  z-index: 100;
  max-height: 200px;
  overflow-y: auto;
  /* Elevated shadow from M3 classes presumed available, or add here */
  box-shadow:
    0px 4px 8px 3px rgba(0, 0, 0, 0.15),
    0px 1px 3px rgba(0, 0, 0, 0.3);
}

.suggestion-item {
  padding: 12px 16px;
  cursor: pointer;
  font-size: 14px;
  color: #1d1b20;
  transition: background 0.1s;
}

.suggestion-item:hover {
  background-color: #e8f0fe; /* primary container-ish hover */
  color: #001d35;
}

/* Transitions */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition:
    opacity 0.2s,
    transform 0.2s;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}
</style>
