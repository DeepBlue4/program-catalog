<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useProgramCatalogStore } from '../store/programCatalogStore'; // Import store
import BaseIcon from '../components/BaseIcon.vue';
import MultiSelectDropdown from './MultiSelectDropdown.vue';
import {
  mdiFileSign,
  mdiAccountGroup,
  mdiLaptop,
  mdiMapMarker,
  mdiLink,
  mdiInformation,
  mdiMagnify,
  mdiSourceBranch,
  mdiLayers,
  mdiClose
} from '@mdi/js';

const props = defineProps({
  effort: {
    type: Object,
    default: () => ({
      name: '',
      parent: null,
      linked_software_efforts: [],
      inherit_statement_of_work_profile: false,
      inherit_technical_points_of_contact: false,
      inherit_developer_setup: false,
      inherit_work_location: false,
      local_statement_of_work_profile: {
        allow_non_us: false,
        mission_critical: false,
        security_clearance: [],
        safety_criticality: [],
        allow_non_us: false,
        mission_critical: false,
        security_clearance: [],
        safety_criticality: [],
        program_phase: ['Design', 'Development'], // Default phases
        program_manager_email: ''
      },
      local_technical_points_of_contact: {
        security_focal: '',
        software_lead: '',
        names: ''
      },
      local_developer_setup: {
        development_environments: [],
        source_control_tools: [],
        issue_tracking_tools: [],
        dp_assessment_name: '',
        sbom_location: [],
        programming_languages: [],
        operating_systems: []
      },
      local_work_location: {
        locations: []
      }
    })
  },
  availableParents: {
    type: Array, // List of other efforts in this program
    default: () => []
  },
  isEdit: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['save', 'cancel', 'delete', 'dirty-change', 'revert', 'validation-error']);

// Tabs
const activeTab = ref('sow');
const tabs = [
    { id: 'sow', label: 'Statement of Work', icon: mdiFileSign, required: true },
    { id: 'pocs', label: 'Point of Contacts', icon: mdiAccountGroup, required: true },
    { id: 'dev', label: 'Developer Setup', icon: mdiLaptop },
    { id: 'location', label: 'Work Locations', icon: mdiMapMarker },
    { id: 'general', label: 'General & Links', icon: mdiLink },
];

const store = useProgramCatalogStore();
const allEffortCandidates = ref([]); // Global list of efforts
const linkSearchQuery = ref('');

// Contextual Help Content
const activeHelp = ref(null); // ID of currently open help section
const toggleHelp = (id) => {
    activeHelp.value = activeHelp.value === id ? null : id;
};

const helpContent = {
    sow: {
        title: 'About Statement of Work',
        text: 'The Statement of Work (SOW) defines the specific scope, deliverables, timeline, and governing standards for this effort. It serves as the contract between the program and the engineering team, ensuring clear alignment on *what* is being delivered and the constraints under which it must be built.'
    },
    pocs: {
        title: 'Points of Contact',
        text: 'Identifies the key individuals responsible for technical leadership, security, and operational management. Keeping this up-to-date allows automated tools and other teams to quickly find the right person for approvals, incident response, or technical questions.'
    },
    dev: {
        title: 'Developer Setup',
        text: 'Specifies the approved technical stack, including programming languages, operating systems, and development environments. This information automates onboarding for new engineers by telling them exactly what tools they need and where to find the source code.'
    },
    location: {
        title: 'Work Locations',
        text: 'Lists the authorized physical or virtual locations where this work is performed. This is critical for compliance with export controls, security zones, and resource planning for on-site facilities.'
    },
    general: {
        title: 'General & Links',
        text: 'Manage high-level relationships for this effort. Use "Linked Efforts" to connect this software to dependencies or related components across different programs in the catalog.'
    }
};

// Load all efforts from catalog for linking
onMounted(async () => {
    allEffortCandidates.value = await store.getAllSoftwareEfforts();
});

// Clone to avoid mutating prop directly
const formData = ref(JSON.parse(JSON.stringify(props.effort)));
const initialState = ref(JSON.stringify(props.effort));

const isDirty = computed(() => {
    return JSON.stringify(formData.value) !== initialState.value;
});

watch(isDirty, (newVal) => {
    emit('dirty-change', newVal);
});

// Watch for prop changes to reset form (e.g. opening modal for different item)
watch(() => props.effort, (newVal) => {
    // Ensure nested objects exist to avoid null pointer errors if data is incomplete
    const safeVal = JSON.parse(JSON.stringify(newVal));
    
    if (!safeVal.local_statement_of_work_profile) safeVal.local_statement_of_work_profile = {};
    if (!safeVal.local_technical_points_of_contact) safeVal.local_technical_points_of_contact = {};
    if (!safeVal.local_developer_setup) safeVal.local_developer_setup = {};
    if (!safeVal.local_work_location) safeVal.local_work_location = {};
    
    formData.value = safeVal;
    initialState.value = JSON.stringify(safeVal);
}, { deep: true, immediate: true });

// Valid parents: exclude self if editing
const validParents = computed(() => {
    if (!props.isEdit) return props.availableParents;
    return props.availableParents.filter(p => p.id !== formData.value.id);
});

// Filtered Candidates for Linking
const filteredLinkCandidates = computed(() => {
    const query = linkSearchQuery.value.toLowerCase().trim();
    return allEffortCandidates.value.filter(e => {
        // Exclude self (if editing)
        if (formData.value.id && e.id === formData.value.id) return false;
        
        // Exclude already linked
        if (formData.value.linked_software_efforts && formData.value.linked_software_efforts.includes(e.id)) return false;

        // Apply Search
        if (!query) return false; // Hide if no query to prevent overwhelming list
        
        return (e.name && e.name.toLowerCase().includes(query)) || 
               (e._programName && e._programName.toLowerCase().includes(query));
    }).slice(0, 10);
});

// Objects for currently linked IDs
const linkedEffortObjects = computed(() => {
    if (!formData.value.linked_software_efforts) return [];
    return formData.value.linked_software_efforts.map(id => {
        return allEffortCandidates.value.find(e => e.id === id) || { id, name: 'Unknown/External Effort', _programName: 'Unknown' };
    });
});

const addLink = (effort) => {
    if (!formData.value.linked_software_efforts) formData.value.linked_software_efforts = [];
    if (!formData.value.linked_software_efforts.includes(effort.id)) {
        formData.value.linked_software_efforts.push(effort.id);
        linkSearchQuery.value = ''; // Reset search
    }
};

const removeLink = (id) => {
    formData.value.linked_software_efforts = formData.value.linked_software_efforts.filter(lid => lid !== id);
};

// Inheritance Resolution Logic
const effortMap = computed(() => {
    const map = {};
    props.availableParents.forEach(p => map[p.id] = p);
    return map;
});

const getEffectiveValue = (section, field) => {
    // If not inheriting, return local value
    const inheritKey = `inherit_${section}`;
    if (!formData.value[inheritKey]) {
        // Access local_{section}_profile.{field}
        // Section names in inherit key don't perfectly match local keys, normalize:
        // inherit_statement_of_work_profile -> local_statement_of_work_profile
        // inherit_technical_points_of_contact -> local_technical_points_of_contact
        // inherit_developer_setup -> local_developer_setup
        // inherit_work_location -> local_work_location
        const localKey = `local_${section}`;
        return formData.value[localKey]?.[field];
    }

    // If inheriting, walk up parents
    let currentParentId = formData.value.parent;
    const inheritFlag = `inherit_${section}`;

    while (currentParentId) {
        const parent = effortMap.value[currentParentId];
        if (!parent) break; // Parent not in list?

        // If parent also inherits, keep going up
        if (parent[inheritFlag]) {
            currentParentId = parent.parent;
            continue;
        }

        // Parent has local definition
        const localKey = `local_${section}`;
        return parent[localKey]?.[field];
    }
    
    return null; // No value found up the chain
};

// Wrapper for reading values in template
const sv = (section, field) => getEffectiveValue(section, field);

// Handling writes: only update local if not inheriting
const updateLocal = (section, field, value) => {
    const inheritKey = `inherit_${section}`;
    if (formData.value[inheritKey]) return; // Read only
    const localKey = `local_${section}`;
    if (!formData.value[localKey]) formData.value[localKey] = {};
    formData.value[localKey][field] = value;
};

// Validation State
const errors = ref({});

const tabErrors = computed(() => {
    const map = {};
    if (errors.value.program_manager_email || errors.value.allow_non_us) map.sow = true;
    if (errors.value.software_lead) map.pocs = true;
    return map;
});

const validateEmail = (email) => {
    return String(email)
        .toLowerCase()
        .match(
            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        );
};

const validateForm = () => {
    errors.value = {};
    let isValid = true;

    // Effort Name
    if (!formData.value.name?.trim()) {
        errors.value.name = 'Effort Name is required.';
        isValid = false;
    }

    // Program Manager Email (SOW)
    if (!formData.value.inherit_statement_of_work_profile) {
        const email = formData.value.local_statement_of_work_profile?.program_manager_email;
        if (!email) {
            errors.value.program_manager_email = 'Program Manager Email is required.';
            isValid = false;
            // Auto switch tab if error found and not on tab
            if (activeTab.value !== 'sow' && isValid === false) activeTab.value = 'sow'; 
        } else if (!validateEmail(email)) {
            errors.value.program_manager_email = 'Invalid email format.';
            isValid = false;
             if (activeTab.value !== 'sow') activeTab.value = 'sow';
        }

        // Allow Non-US (Must be boolean explicitly)
        // Check if property exists and is not null/undefined. The requirement is a dropdown, so ensure it's selected.
        const nonUs = formData.value.local_statement_of_work_profile?.allow_non_us;
        if (nonUs === null || nonUs === undefined || nonUs === '') {
             errors.value.allow_non_us = 'Please select a value.';
             isValid = false;
             if (activeTab.value !== 'sow') activeTab.value = 'sow';
        }
    }

    // Software Lead (POCs)
    if (!formData.value.inherit_technical_points_of_contact) {
        const email = formData.value.local_technical_points_of_contact?.software_lead;
         if (!email) {
            errors.value.software_lead = 'Software Technical Lead Email is required.';
            isValid = false;
            if (activeTab.value !== 'pocs' && !errors.value.program_manager_email) activeTab.value = 'pocs';
        } else if (!validateEmail(email)) {
            errors.value.software_lead = 'Invalid email format.';
             isValid = false;
             if (activeTab.value !== 'pocs' && !errors.value.program_manager_email) activeTab.value = 'pocs';
        }
    }

    return isValid;
};

const handleSave = () => {
    if (!validateForm()) {
        const fieldLabels = {
            name: 'Effort Name',
            program_manager_email: 'Program Manager Email',
            allow_non_us: 'Allow Non-US Personnel',
            software_lead: 'Software Technical Lead'
        };

        const errorMessages = Object.entries(errors.value).map(([key, msg]) => {
            const label = fieldLabels[key] || key;
            // Clean up message if it already contains the label to avoid "Name: Name is required"
            // But current messages are mixed. Let's just use "Label: Message" for clarity.
            return `• ${label}: ${msg}`;
        });

        const header = `Unable to save. Please fix the following validation error${errorMessages.length > 1 ? 's' : ''}:`;
        emit('validation-error', `${header}\n\n${errorMessages.join('\n')}`);
        return;
    }
    emit('save', formData.value);
};

// Helper for comma-separated list to array
const toArray = (str) => {
    if (!str) return [];
    if (Array.isArray(str)) return str;
    return str.split(',').map(s => s.trim()).filter(s => s);
};

// Helper for array to comma-separated list (for textareas)
const fromArray = (arr) => {
    if (!arr) return '';
    if (typeof arr === 'string') return arr;
    return arr.join(', ');
};
// Expose resetForm to parent
const resetForm = () => {
    formData.value = JSON.parse(initialState.value);
};

defineExpose({
    resetForm
});

const handleCancel = () => {
    if (props.isEdit) {
        emit('revert');
    } else {
        emit('cancel');
    }
};

// --- Constants ---
const PROGRAM_PHASES = ['Design', 'Legacy', 'Production', 'Development', 'N/A'];
const EFFORT_TYPES = ['System', 'Service', 'Component', 'Application', 'Library', 'Team', 'Other'];
const SAFETY_LEVELS = ['None', 'DAL A / LOR 1', 'DAL B / LOR 2', 'DAL C / LOR 3', 'DAL D / LOR 4', 'DAL E / LOR 5'];
const SECURITY_CLEARANCES = ['None', 'Other', 'CUI', 'Secret', 'Top Secret'];

// Developer Setup Options
const ENVIRONMENT_OPTIONS = ["BSF-Global", "BSF-US", "BSF-Restricted", "BSF-Disconnected", "Boeing Enterprise Network", "On-Premises/Non-BSF", "Customer Environment", "Other"];
const SOURCE_CONTROL_OPTIONS = ["GitLab", "Bitbucket", "ClearCase", "SVN", "Azure DevOps", "Other"];
const ISSUE_TRACKING_OPTIONS = ["GitLab", "ClearCase", "Bitbucket", "SVN", "Azure DevOps", "Version One", "Other"];
const LANGUAGE_OPTIONS = ["Python", "C++", "Java", "Ada", "JavaScript", "C", "Rust", "Other"];
const OS_OPTIONS = ["Boeing Linux", "Other Linux", "Windows", "Android", "iOS", "VxWorks", "Integrity", "macOS", "Other"];
const SBOM_OPTIONS = ["Artifactory", "GitLab", "Nexus", "SBOM Studio", "Other"];

</script>

<template>
  <div class="form-wrapper">
    <!-- Header Section -->
    <header class="form-header-persistent">
        <div class="header-main">
            <div class="name-input-wrapper" :class="{ 'has-error': errors.name }">
                <label>Effort Name <span class="required-star">*</span></label>
                <input v-model="formData.name" type="text" class="clean-input-lg" placeholder="Enter Effort Name...">
            </div>
            
             <div class="form-actions-top">
                <!-- Cancel / Discard Button -->
                <!-- Show if creating (always) OR if updating AND dirty -->
                <button 
                    v-if="!isEdit || (isEdit && isDirty)"
                    @click="handleCancel" 
                    class="btn-outlined"
                >
                    {{ isEdit ? 'Discard Changes' : 'Cancel' }}
                </button>
                
                <button v-if="isEdit" @click="$emit('delete', formData)" class="btn-text danger" title="Delete">
                    Delete
                </button>
                <button @click="handleSave" class="btn-filled">
                    {{ isEdit ? 'Save Changes' : 'Create Effort' }}
                </button>
            </div>
        </div>
        
        <div class="header-meta">
            <div class="meta-field">
                 <label>Parent:</label>
                 <select v-model="formData.parent" class="clean-select-sm">
                    <option :value="null">None (Root)</option>
                    <option v-for="p in validParents" :key="p.id" :value="p.id">{{ p.name }}</option>
                 </select>
            </div>
             <div class="meta-field">
                 <label>ID:</label>
                 <span class="meta-value">{{ formData.id || 'New' }}</span>
            </div>
        </div>
    </header>

    <!-- Main Body -->
    <div class="form-body">
        <!-- Vertical Tabs -->
        <nav class="tabs-vertical">
            <button 
                v-for="tab in tabs" 
                :key="tab.id"
                class="tab-btn"
                :class="{ 
                    active: activeTab === tab.id,
                    'has-error': tabErrors[tab.id]
                }"
                @click="activeTab = tab.id"
            >
                <div class="tab-icon-container">
                    <BaseIcon :path="tab.icon" class="tab-icon" />
                    <span v-if="tabErrors[tab.id]" class="error-badge">!</span>
                </div>
                <div class="tab-info">
                    <span class="tab-label">{{ tab.label }}</span>
                    <span v-if="tab.required" class="required-tag">Required</span>
                </div>
            </button>
        </nav>

        <!-- Content Area -->
        <main class="content-area">
            
            <!-- GENERAL TAB -->
            <div v-if="activeTab === 'general'" class="tab-content fade-in">
                <div class="tab-header" style="margin-bottom: 1.5rem;">
                    <div class="header-text-group">
                         <h3>General Configuration</h3>
                         <button class="btn-icon-sm" @click="toggleHelp('general')" :class="{ 'active': activeHelp === 'general' }">
                            <BaseIcon :path="mdiInformation" :size="16" />
                        </button>
                    </div>
                </div>

                <transition name="expand">
                    <div v-if="activeHelp === 'general'" class="help-card m3-surface-variant">
                        <h4>{{ helpContent.general.title }}</h4>
                        <p>{{ helpContent.general.text }}</p>
                    </div>
                </transition>

                <div class="field-section">
                    <label class="section-label">Linked Efforts</label>
                    <div class="help-text">Search and select other efforts to link across the entire catalog.</div>
                    
                    <div class="link-manager">
                        <!-- Search Box -->
                        <div class="link-search-wrapper">
                            <BaseIcon :path="mdiMagnify" class="search-icon" />
                            <input 
                                v-model="linkSearchQuery" 
                                type="text" 
                                class="clean-input with-icon" 
                                placeholder="Search efforts by name or program..."
                            >
                            
                            <!-- Dropdown Results -->
                            <div v-if="filteredLinkCandidates.length > 0" class="search-dropdown m3-card elevated">
                                <div 
                                    v-for="cand in filteredLinkCandidates" 
                                    :key="cand.id" 
                                    class="dropdown-item" 
                                    @click="addLink(cand)"
                                >
                                    <div class="item-icon">
                                        <BaseIcon :path="mdiSourceBranch" />
                                    </div>
                                    <div class="item-content">
                                        <div class="item-main">
                                            <span class="name">{{ cand.name }}</span>
                                            <span class="id-badge">ID: {{ cand.id }}</span>
                                        </div>
                                        <div class="item-sub">
                                            <span class="program-name">
                                                <BaseIcon :path="mdiLayers" :size="10" /> {{ cand._programName }}
                                                <span class="program-id-sub">({{ cand._programId }})</span>
                                            </span>
                                            <span class="separator">•</span>
                                            <span class="type">{{ cand.type }}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Selected Chips -->
                        <div class="linked-chips-container">
                            <div v-for="link in linkedEffortObjects" :key="link.id" class="link-chip">
                                <span class="chip-icon"><BaseIcon :path="mdiLink" :size="12" /></span>
                                <div class="chip-info">
                                    <div class="chip-label">{{ link.name }}</div>
                                    <div class="chip-meta">{{ link._programName || 'Unknown Program' }}</div>
                                </div>
                                <button class="chip-remove" @click.stop="removeLink(link.id)">
                                    <BaseIcon :path="mdiClose" :size="12" />
                                </button>
                            </div>
                            <div v-if="linkedEffortObjects.length === 0" class="empty-msg">No linked efforts.</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- STATEMENT OF WORK TAB -->
            <div v-if="activeTab === 'sow'" class="tab-content fade-in">
                <div class="tab-header">
                    <div class="header-text-group">
                        <h3>Statement of Work</h3>
                        <button class="btn-icon-sm" @click="toggleHelp('sow')" :class="{ 'active': activeHelp === 'sow' }">
                            <BaseIcon :path="mdiInformation" :size="16" />
                        </button>
                    </div>
                    <div class="header-controls">
                        <span v-if="formData.inherit_statement_of_work_profile" class="inherited-badge">Inheriting from Parent</span>
                        <label class="inherit-toggle">
                            <input type="checkbox" v-model="formData.inherit_statement_of_work_profile" :disabled="!formData.parent">
                            <span class="toggle-track"></span>
                            <span>Inherit</span>
                        </label>
                     </div>
                </div>
                
                <transition name="expand">
                    <div v-if="activeHelp === 'sow'" class="help-card m3-surface-variant">
                        <h4>{{ helpContent.sow.title }}</h4>
                        <p>{{ helpContent.sow.text }}</p>
                    </div>
                </transition>
                
                <div class="form-fields-grid" :class="{ 'is-inherited': formData.inherit_statement_of_work_profile }">
                     <div class="field-group span-2">
                        <label>Effort Type</label>
                         <select 
                            class="clean-select" 
                            :value="sv('statement_of_work_profile', 'type')"
                            @change="e => updateLocal('statement_of_work_profile', 'type', e.target.value)"
                            :disabled="formData.inherit_statement_of_work_profile"
                        >
                            <option value="" disabled selected>Select Effort Type...</option>
                            <option v-for="type in EFFORT_TYPES" :key="type" :value="type">{{ type }}</option>
                        </select>
                    </div>
                    
                    <div class="field-group span-2">
                        <MultiSelectDropdown 
                            :modelValue="sv('statement_of_work_profile', 'program_phase') || []"
                            @update:modelValue="val => updateLocal('statement_of_work_profile', 'program_phase', val)"
                            :options="PROGRAM_PHASES"
                            label="Program Phase"
                            :disabled="formData.inherit_statement_of_work_profile"
                            placeholder="Select Program Phases..."
                        />
                    </div>
                     <div class="field-group" :class="{ 'has-error': errors.program_manager_email }">
                        <label>Program Manager Email <span class="required-star">*</span></label>
                        <input 
                             :value="sv('statement_of_work_profile', 'program_manager_email')"
                             @input="e => updateLocal('statement_of_work_profile', 'program_manager_email', e.target.value)"
                             :disabled="formData.inherit_statement_of_work_profile"
                             type="email" class="clean-input" placeholder="manager@example.com">
                         <span v-if="errors.program_manager_email" class="error-msg">{{ errors.program_manager_email }}</span>
                    </div>

                     <div class="field-group span-2">
                        <MultiSelectDropdown 
                            :modelValue="sv('statement_of_work_profile', 'security_clearance') || []"
                            @update:modelValue="val => updateLocal('statement_of_work_profile', 'security_clearance', val)"
                            :options="SECURITY_CLEARANCES"
                            label="Security Clearance"
                            :disabled="formData.inherit_statement_of_work_profile"
                            placeholder="Select Security Clearance..."
                        />
                    </div>
                     <div class="field-group span-2">
                        <MultiSelectDropdown 
                            :modelValue="sv('statement_of_work_profile', 'safety_criticality') || []"
                            @update:modelValue="val => updateLocal('statement_of_work_profile', 'safety_criticality', val)"
                            :options="SAFETY_LEVELS"
                            label="Safety Criticality"
                            :disabled="formData.inherit_statement_of_work_profile"
                            placeholder="Select Safety Criticality..."
                        />
                    </div>

                    <div class="field-group" :class="{ 'has-error': errors.allow_non_us }">
                         <label>Allow Non-US Personnel <span class="required-star">*</span></label>
                         <select 
                            class="clean-select" 
                            :value="sv('statement_of_work_profile', 'allow_non_us')"
                            @change="e => updateLocal('statement_of_work_profile', 'allow_non_us', e.target.value === 'true')"
                            :disabled="formData.inherit_statement_of_work_profile"
                         >
                            <option value="" disabled selected>Select...</option>
                            <option :value="true">True</option>
                            <option :value="false">False</option>
                         </select>
                         <span v-if="errors.allow_non_us" class="error-msg">{{ errors.allow_non_us }}</span>
                    </div>

                    <div class="field-group">
                         <label>Mission Critical</label>
                         <select 
                            class="clean-select" 
                            :value="sv('statement_of_work_profile', 'mission_critical')"
                            @change="e => updateLocal('statement_of_work_profile', 'mission_critical', e.target.value === 'true')"
                            :disabled="formData.inherit_statement_of_work_profile"
                         >
                            <option :value="true">True</option>
                            <option :value="false">False</option>
                         </select>
                    </div>
                </div>
            </div>

            <!-- POCs TAB -->
             <div v-if="activeTab === 'pocs'" class="tab-content fade-in">
                <div class="tab-header">
                    <div class="header-text-group">
                        <h3>Technical Point of Contacts</h3>
                        <button class="btn-icon-sm" @click="toggleHelp('pocs')" :class="{ 'active': activeHelp === 'pocs' }">
                            <BaseIcon :path="mdiInformation" :size="16" />
                        </button>
                    </div>
                    <div class="header-controls">
                        <span v-if="formData.inherit_technical_points_of_contact" class="inherited-badge">Inheriting from Parent</span>
                        <label class="inherit-toggle">
                            <input type="checkbox" v-model="formData.inherit_technical_points_of_contact" :disabled="!formData.parent">
                            <span class="toggle-track"></span>
                            <span>Inherit</span>
                        </label>
                    </div>
                </div>

                <transition name="expand">
                    <div v-if="activeHelp === 'pocs'" class="help-card m3-surface-variant">
                        <h4>{{ helpContent.pocs.title }}</h4>
                        <p>{{ helpContent.pocs.text }}</p>
                    </div>
                </transition>

                <div class="form-fields-grid" :class="{ 'is-inherited': formData.inherit_technical_points_of_contact }">
                     <div class="field-group" :class="{ 'has-error': errors.software_lead }">
                        <label>Software Lead Email <span class="required-star">*</span></label>
                        <input 
                            :value="sv('technical_points_of_contact', 'software_lead')"
                            @input="e => updateLocal('technical_points_of_contact', 'software_lead', e.target.value)"
                            :disabled="formData.inherit_technical_points_of_contact"
                            type="email" class="clean-input" placeholder="lead@example.com">
                        <span v-if="errors.software_lead" class="error-msg">{{ errors.software_lead }}</span>
                    </div>
                     <div class="field-group">
                        <label>Security Focal</label>
                        <input 
                            :value="sv('technical_points_of_contact', 'security_focal')"
                            @input="e => updateLocal('technical_points_of_contact', 'security_focal', e.target.value)"
                            :disabled="formData.inherit_technical_points_of_contact"
                            type="text" class="clean-input" placeholder="Name or Email">
                    </div>
                     <div class="field-group span-2">
                        <label>Other Contacts (Legacy)</label>
                        <input 
                            :value="sv('technical_points_of_contact', 'names')"
                            @input="e => updateLocal('technical_points_of_contact', 'names', e.target.value)"
                            :disabled="formData.inherit_technical_points_of_contact"
                            type="text" class="clean-input">
                    </div>
                </div>
            </div>

            <!-- DEV SETUP TAB -->
             <div v-if="activeTab === 'dev'" class="tab-content fade-in">
                  <div class="tab-header">
                    <div class="header-text-group">
                        <h3>Developer Setup</h3>
                        <button class="btn-icon-sm" @click="toggleHelp('dev')" :class="{ 'active': activeHelp === 'dev' }">
                            <BaseIcon :path="mdiInformation" :size="16" />
                        </button>
                    </div>
                    <div class="header-controls">
                        <span v-if="formData.inherit_developer_setup" class="inherited-badge">Inheriting from Parent</span>
                        <label class="inherit-toggle">
                            <input type="checkbox" v-model="formData.inherit_developer_setup" :disabled="!formData.parent">
                              <span class="toggle-track"></span>
                            <span>Inherit</span>
                        </label>
                    </div>
                </div>

                <transition name="expand">
                    <div v-if="activeHelp === 'dev'" class="help-card m3-surface-variant">
                        <h4>{{ helpContent.dev.title }}</h4>
                        <p>{{ helpContent.dev.text }}</p>
                    </div>
                </transition>

                <div class="form-fields-grid" :class="{ 'is-inherited': formData.inherit_developer_setup }">
                     <div class="field-group span-2">
                        <MultiSelectDropdown 
                            :modelValue="sv('developer_setup', 'programming_languages') || []"
                            @update:modelValue="val => updateLocal('developer_setup', 'programming_languages', val)"
                            :options="LANGUAGE_OPTIONS"
                            label="Programming Languages"
                            :disabled="formData.inherit_developer_setup"
                            placeholder="Select Languages..."
                        />
                    </div>
                    <div class="field-group span-2">
                        <MultiSelectDropdown 
                            :modelValue="sv('developer_setup', 'operating_systems') || []"
                            @update:modelValue="val => updateLocal('developer_setup', 'operating_systems', val)"
                            :options="OS_OPTIONS"
                            label="Operating Systems"
                            :disabled="formData.inherit_developer_setup"
                            placeholder="Select Operating Systems..."
                        />
                    </div>

                    <div class="field-group span-2">
                        <MultiSelectDropdown 
                            :modelValue="sv('developer_setup', 'development_environments') || []"
                            @update:modelValue="val => updateLocal('developer_setup', 'development_environments', val)"
                            :options="ENVIRONMENT_OPTIONS"
                            label="Development Environments"
                            :disabled="formData.inherit_developer_setup"
                            placeholder="Select Environments..."
                        />
                    </div>

                     <div class="field-group span-2">
                        <MultiSelectDropdown 
                            :modelValue="sv('developer_setup', 'source_control_tools') || []"
                            @update:modelValue="val => updateLocal('developer_setup', 'source_control_tools', val)"
                            :options="SOURCE_CONTROL_OPTIONS"
                            label="Source Control Tools"
                            :disabled="formData.inherit_developer_setup"
                            placeholder="Select Source Control Tools..."
                        />
                    </div>
                     <div class="field-group span-2">
                        <MultiSelectDropdown 
                            :modelValue="sv('developer_setup', 'issue_tracking_tools') || []"
                            @update:modelValue="val => updateLocal('developer_setup', 'issue_tracking_tools', val)"
                            :options="ISSUE_TRACKING_OPTIONS"
                            label="Issue Tracking Tools"
                            :disabled="formData.inherit_developer_setup"
                            placeholder="Select Issue Tracking Tools..."
                        />
                    </div>
                     <div class="field-group span-2">
                        <MultiSelectDropdown 
                            :modelValue="sv('developer_setup', 'sbom_location') || []"
                            @update:modelValue="val => updateLocal('developer_setup', 'sbom_location', val)"
                            :options="SBOM_OPTIONS"
                            label="SBOM Location"
                            :disabled="formData.inherit_developer_setup"
                            placeholder="Select SBOM Location..."
                        />
                    </div>
                    <div class="field-group">
                        <label>Data Protection Assessment</label>
                        <input 
                            :value="sv('developer_setup', 'dp_assessment_name')"
                            @input="e => updateLocal('developer_setup', 'dp_assessment_name', e.target.value)"
                            :disabled="formData.inherit_developer_setup"
                            type="text" class="clean-input">
                    </div>
                </div>
            </div>

            <!-- LOCATION TAB -->
             <div v-if="activeTab === 'location'" class="tab-content fade-in">
                  <div class="tab-header">
                    <div class="header-text-group">
                        <h3>Work Locations</h3>
                         <button class="btn-icon-sm" @click="toggleHelp('location')" :class="{ 'active': activeHelp === 'location' }">
                            <BaseIcon :path="mdiInformation" :size="16" />
                        </button>
                    </div>
                    <div class="header-controls">
                        <span v-if="formData.inherit_work_location" class="inherited-badge">Inheriting from Parent</span>
                        <label class="inherit-toggle">
                            <input type="checkbox" v-model="formData.inherit_work_location" :disabled="!formData.parent">
                             <span class="toggle-track"></span>
                            <span>Inherit</span>
                        </label>
                    </div>
                </div>

                <transition name="expand">
                    <div v-if="activeHelp === 'location'" class="help-card m3-surface-variant">
                        <h4>{{ helpContent.location.title }}</h4>
                        <p>{{ helpContent.location.text }}</p>
                    </div>
                </transition>

                <div class="form-fields-grid" :class="{ 'is-inherited': formData.inherit_work_location }">
                    <div class="field-group span-2">
                        <label>Locations</label>
                         <textarea 
                             :value="fromArray(sv('work_location', 'locations'))" 
                             @input="e => updateLocal('work_location', 'locations', toArray(e.target.value))"
                             :disabled="formData.inherit_work_location"
                             class="clean-textarea" rows="3" placeholder="Building 40, Remote, etc..."
                        ></textarea>
                    </div>
                </div>
            </div>

        </main>
    </div>
  </div>
</template>

<style scoped>
.form-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background: #FEF7FF; /* surface */
    overflow: hidden;
    /* Definition Borders & Sizing */
    box-sizing: border-box;
    border: 1px solid #C4C7C5; /* outline-variant */
    border-radius: 12px;
}

/* HEADER */
.form-header-persistent {
    padding: 1.5rem 2rem 1rem 2rem;
    border-bottom: 1px solid #C4C7C5; /* outline-variant */
    background: #FEF7FF; /* surface */
}

.header-main {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 1rem;
}

.name-input-wrapper {
    flex: 1;
    margin-right: 2rem;
}

.name-input-wrapper label {
    display: block;
    font-size: 12px;
    font-weight: 500;
    color: #005AC1; /* primary */
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
}

.clean-input-lg {
    width: 100%;
    font-size: 24px;
    font-weight: 400;
    font-family: inherit;
    color: #1D1B20; /* on-surface */
    border: none;
    border-bottom: 2px solid transparent;
    background: transparent;
    padding: 4px 0;
    transition: 0.2s;
}

.clean-input-lg:focus {
    outline: none;
    border-bottom-color: #005AC1; /* primary */
}

.clean-input-lg::placeholder {
    color: #49454F; /* on-surface-variant */
    opacity: 0.5;
}

.header-meta {
    display: flex;
    gap: 2rem;
    font-size: 13px;
    color: #49454F; /* on-surface-variant */
}

.meta-field {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.meta-field label {
    color: #49454F; /* on-surface-variant */
}

.meta-value {
    color: #1D1B20; /* on-surface */
    font-family: monospace;
}

.clean-select-sm {
    background: transparent;
    border: none;
    font-size: 13px;
    color: #1D1B20; /* on-surface */
    padding: 2px;
    cursor: pointer;
}

.clean-select-sm:hover {
    background: #ECE6F0; /* surface-container-high */
    border-radius: 4px;
}

/* Actions */
.form-actions-top {
    display: flex;
    gap: 1rem;
}



/* BODY */
.form-body {
    flex: 1;
    display: flex;
    overflow: hidden;
}

/* Tabs */
.tabs-vertical {
    width: 220px;
    background: #F7F2FA; /* surface-container-low */
    display: flex;
    flex-direction: column;
    padding: 1rem 0;
    border-right: 1px solid #C4C7C5; /* outline-variant */
}

.header-text-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.btn-icon-sm {
    background: transparent;
    border: none;
    color: #625B71; /* secondary */
    cursor: pointer;
    padding: 4px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}

.btn-icon-sm:hover, .btn-icon-sm.active {
    color: #005AC1; /* primary */
    background: #ECE6F0; /* surface-container-high */
}

.help-card {
    margin-bottom: 1.5rem;
    padding: 1rem;
    border-radius: 8px;
    background: #F3EDF7; /* surface-container */
    border-left: 4px solid #005AC1; /* primary */
}

.help-card h4 {
    margin: 0 0 0.5rem 0;
    font-size: 14px;
    color: #005AC1; /* primary */
}

.help-card p {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
    color: #49454F; /* on-surface-variant */
}

/* Expansion Animation */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
  max-height: 200px;
  opacity: 1;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
  margin-bottom: 0;
  padding: 0 1rem;
}

.tab-btn {
    background: transparent;
    border: none;
    text-align: left;
    padding: 12px 24px;
    font-size: 14px;
    color: #49454F; /* on-surface-variant */
    cursor: pointer;
    border-left: 3px solid transparent;
    transition: 0.2s;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 12px;
}


.tab-btn:hover {
    background: #ECE6F0; /* surface-container-high */
    color: #1D1B20; /* on-surface */
}

.tab-btn.active {
    background: #F3EDF7; /* surface-container */
    color: #005AC1; /* primary */
    border-left-color: #005AC1; /* primary */
}

/* Content */
.content-area {
    flex: 1;
    padding: 2rem 3rem;
    overflow-y: auto;
}

.tab-content {
    max-width: 800px;
}

.tab-content h3 {
    margin: 0 0 1.5rem 0;
    font-size: 18px;
    color: #1D1B20; /* on-surface */
    font-weight: 500;
}

.tab-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    border-bottom: 1px solid #C4C7C5; /* outline-variant */
    padding-bottom: 0.5rem;
}

.tab-header h3 {
    margin: 0;
}

.header-controls {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.inherited-badge {
    font-size: 12px;
    font-weight: 500;
    color: #625B71; /* secondary */
    background: #F3EDF7; /* surface-container */
    padding: 4px 8px;
    border-radius: 4px;
}

/* Fields */
.form-fields-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem 2rem;
    transition: opacity 0.3s;
}

.form-fields-grid.is-inherited {
    opacity: 0.7;
}

.field-group {
    display: flex;
    flex-direction: column;
}

.field-group.span-2 {
    grid-column: span 2;
}

.field-group label {
    font-size: 12px;
    font-weight: 600;
    color: #625B71; /* secondary */
    margin-bottom: 8px;
    text-transform: uppercase;
}

.clean-input, .clean-textarea {
    width: 100%;
    padding: 10px 12px;
    font-size: 14px;
    color: #1D1B20; /* on-surface */
    background: #FFFFFF; /* surface-container-lowest */
    border: 1px solid #79747E; /* outline */
    border-radius: 6px;
    font-family: inherit;
    box-sizing: border-box;
    transition: 0.2s;
}

.clean-input:focus, .clean-textarea:focus {
    outline: none;
    border-color: #005AC1; /* primary */
    background: #FEF7FF; /* surface */
    box-shadow: 0 0 0 3px #D8E2FF; /* primary-container */
}

.clean-input:disabled, .clean-textarea:disabled {
    background: rgba(0,0,0,0.02);
    border-color: transparent;
    color: #49454F; /* on-surface-variant */
    cursor: default;
}

.checkbox-row {
    flex-direction: row;
    gap: 2rem;
    align-items: center;
}

.checkbox-clean {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    cursor: pointer;
}

.checkbox-clean.disabled {
    cursor: default;
    opacity: 0.7;
}

/* Inherit Toggle */
.inherit-toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    color: #625B71; /* secondary */
}

.inherit-toggle input {
    display: none;
}

.toggle-track {
    width: 36px;
    height: 20px;
    background: #E7E0EC; /* surface-variant */
    border-radius: 20px;
    position: relative;
    transition: 0.3s;
}

.toggle-track::after {
    content: '';
    position: absolute;
    height: 16px;
    width: 16px;
    background: white;
    border-radius: 50%;
    left: 2px;
    top: 2px;
    transition: 0.3s;
}

.inherit-toggle input:checked + .toggle-track {
    background: #005AC1; /* primary */
}

.inherit-toggle input:checked + .toggle-track::after {
    transform: translateX(16px);
}

.inherit-toggle input:disabled + .toggle-track {
    opacity: 0.5;
    cursor: not-allowed;
}

/* Link Manager Styles */
.link-search-wrapper {
    position: relative;
    margin-bottom: 1rem;
}

.with-icon {
    padding-left: 36px;
}

.search-icon {
    position: absolute;
    left: 10px;
    top: 50%;
    transform: translateY(-50%);
    color: #625B71; /* secondary */
    font-size: 14px;
}

.search-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: #F7F2FA; /* surface-container-low */
    max-height: 200px;
    overflow-y: auto;
    z-index: 10;
    border-radius: 8px;
    margin-top: 4px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.15);
    border: 1px solid #C4C7C5; /* outline-variant */
}

.dropdown-item {
    padding: 8px 16px;
    cursor: pointer;
    border-bottom: 1px solid #C4C7C5; /* outline-variant */
}

.dropdown-item:last-child {
    border-bottom: none;
}

.dropdown-item:hover {
    background: #ECE6F0; /* surface-container-high */
}

.item-main {
    font-size: 14px;
    font-weight: 500;
    color: #1D1B20; /* on-surface */
}

.item-sub {
    font-size: 11px;
    color: #625B71; /* secondary */
}

.linked-chips-container {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.link-chip {
    display: flex;
    align-items: center;
    background: #DBE2F9; /* secondary-container */
    color: #1D192B; /* on-secondary-container */
    padding: 6px 12px;
    border-radius: 16px;
    gap: 8px;
    max-width: 100%;
}

.chip-icon {
    font-size: 12px;
    opacity: 0.7;
}

.chip-info {
    display: flex;
    flex-direction: column;
}

.chip-label {
    font-size: 13px;
    font-weight: 500;
}

.chip-meta {
    font-size: 10px;
    opacity: 0.8;
}

.chip-remove {
    background: transparent;
    border: none;
    color: inherit;
    cursor: pointer;
    padding: 4px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.6;
    transition: 0.2s;
}

.chip-remove:hover {
    background: rgba(0,0,0,0.1);
    opacity: 1;
}

.empty-msg {
    font-size: 13px;
    color: #625B71; /* secondary */
    font-style: italic;
    padding: 0.5rem 0;
}

.fade-in {
    animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
}

/* Validation Styles */
.required-star {
    color: #BA1A1A; /* error */
    margin-left: 4px;
    font-weight: bold;
}

.has-error label {
    color: #BA1A1A; /* error */
}

.has-error input, .has-error select, .has-error textarea {
    border-color: #BA1A1A !important;
    /* error */
}

.error-msg {
    font-size: 11px;
    color: #BA1A1A; /* error */
    margin-top: 4px;
    display: block;
}

/* Clean Select (Dropdowns) */
.clean-select {
    width: 100%;
    padding: 8px 12px;
    border-radius: 4px;
    border: 1px solid #79747E; /* outline */
    background: #FEF7FF; /* surface */
    color: #1D1B20; /* on-surface */
    font-size: 14px;
    font-family: inherit;
    transition: 0.2s;
    box-sizing: border-box;
    appearance: none;
    background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23000000%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E");
    background-repeat: no-repeat;
    background-position: right 12px top 50%;
    background-size: 10px auto;
    padding-right: 32px;
}

.clean-select:focus {
    outline: none;
    border-color: #005AC1; /* primary */
    box-shadow: 0 0 0 1px #005AC1; /* primary */
}

/* Updated Tab UX */
.tab-btn {
    align-items: flex-start; /* Align for multi-line */
    padding: 12px 16px;
    gap: 12px;
}

.tab-icon-container {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    padding-top: 2px;
}

.tab-info {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
}

.required-tag {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    color: #BA1A1A; /* error */
    background: #FFDAD6; /* error-container */
    padding: 2px 6px;
    border-radius: 4px;
    letter-spacing: 0.5px;
}

.tab-btn.has-error {
    color: #BA1A1A; /* error */
    background: #FFDAD6; /* error-container */
}

.tab-btn.has-error:hover {
    background: #FFDAD6; /* error-container */
}

.tab-btn.has-error .tab-label, 
.tab-btn.has-error .tab-icon {
    color: #BA1A1A; /* error */
}

.error-badge {
    position: absolute;
    top: -6px;
    right: -8px;
    background: #B3261E;
    color: white;
    font-size: 10px;
    font-weight: bold;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 2px rgba(0,0,0,0.2);
}

/* Search Dropdown Enhanced */
.search-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    width: 100%;
    max-height: 300px;
    overflow-y: auto;
    background: #F3EDF7; /* surface-container */
    border-radius: 8px; /* M3 Standard */
    margin-top: 4px;
    z-index: 100;
    display: flex;
    flex-direction: column;
    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
}

.dropdown-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    cursor: pointer;
    border-bottom: 1px solid #C4C7C5; /* outline-variant */
    transition: background 0.2s;
}

.dropdown-item:last-child {
    border-bottom: none;
}

.dropdown-item:hover {
    background: #ECE6F0; /* surface-container-high */
}

.item-icon {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: #DBE2F9; /* secondary-container */
    color: #1D192B; /* on-secondary-container */
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
}

.item-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.item-main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
}

.item-main .name {
    font-size: 14px;
    font-weight: 500;
    color: #1D1B20; /* on-surface */
}

.id-badge {
    font-size: 11px;
    font-family: monospace;
    background: #E7E0EC; /* surface-variant */
    color: #49454F; /* on-surface-variant */
    padding: 2px 6px;
    border-radius: 4px;
}

.item-sub {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #625B71; /* secondary */
}

.item-sub .program-name i {
    font-size: 10px;
    margin-right: 2px;
    opacity: 0.7;
}

.item-sub .program-name {
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 4px;
}

.program-id-sub {
    font-family: monospace;
    opacity: 0.8;
    font-size: 11px;
}
</style>
