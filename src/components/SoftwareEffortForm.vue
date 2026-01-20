<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useProgramCatalogStore } from '../store/programCatalogStore'; // Import store
import BaseIcon from '../components/BaseIcon.vue';
import MultiSelectDropdown from './MultiSelectDropdown.vue';
import EmailAutocomplete from './EmailAutocomplete.vue';
import {
  mdiFileSign,
  mdiAccountGroupOutline,
  mdiCogs,
  mdiMapMarkerOutline,
  mdiLinkVariant,
  mdiInformationOutline,
  mdiMagnify,
  mdiSourceBranch,
  mdiClose
} from '@mdi/js';

const props = defineProps({
  effort: {
    type: Object,
    default: () => ({
      name: '',
      parent: null,
      parent_uuid: null,
      linked_software_efforts: [],
      inherit_statement_of_work_profile: false,
      inherit_technical_points_of_contact: false,
      inherit_developer_setup: false,
      inherit_work_location: false,
      statement_of_work_profile: {
        allow_non_us: null,
        mission_critical: null,
        security_clearance: [],
        safety_criticality: [],
        program_phase: '', // Default phases
        program_manager_email: ''
      },
      technical_points_of_contact: {
        security_focal: '',
        software_lead: '',
        names: ''
      },
      developer_setup: {
        development_environments: [],
        source_control_tools: [],
        issue_tracking_tools: [],
        dp_assessment_name: '',
        sbom_location: [],
        programming_languages: [],
        operating_systems: []
      },
      work_location: {
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
    { id: 'pocs', label: 'Point of Contacts', icon: mdiAccountGroupOutline, required: true },
    { id: 'dev', label: 'Developer Setup', icon: mdiCogs },
    { id: 'location', label: 'Work Locations', icon: mdiMapMarkerOutline },
    { id: 'general', label: 'General & Links', icon: mdiLinkVariant },
];

const store = useProgramCatalogStore();
const allEffortCandidates = ref([]); // Everyone we can link to
const linkSearchQuery = ref('');

// Helpful tooltips content
const activeHelp = ref(null); // ID of currently open help section
const toggleHelp = (id) => {
    activeHelp.value = activeHelp.value === id ? null : id;
};

const helpContent = {
    overview: {
        title: 'What is a Software Effort?',
        text: 'A Software Effort is a central hub for a distinct unit of software work. This could be a Software Team, a Product, a Component (CSCI), or a specific Project. You are editing this effort\'s profile, which tracks its key contacts, developer setup, work location, and relationships to other efforts.'
    },
    sow: {
        title: 'About Statement of Work',
        text: 'The statement-of-work (SOW) profile for an effort: captures high-level scope, mission-critical flags, personnel constraints, and applicable security or safety classifications.'
    },
    pocs: {
        title: 'Points of Contact',
        text: 'A compact record listing primary technical contacts for the effort. Tell managers this stores the go-to technical points for questions, escalations, and clarifications about the work or architecture.'
    },
    dev: {
        title: 'Developer Setup',
        text: 'Developer tooling profile for an effort. Use these records environment details, source control, issue-tracking tools, SBOM locations, and supported languages/OS — critical for planning onboarding, resource allocation, and technical readiness.'
    },
    location: {
        title: 'Work Locations',
        text: 'The work-location profile describing where the effort is performed (on-site, remote, hybrid, or specific sites). Used as the place to record constraints and logistics that affect staffing, travel, and security.'
    },
    general: {
        title: 'General & Links',
        text: 'Use to record direct relationships between this effort and other efforts in the catalog — for example a dependency, an integration partner, or a contractually connected work package. Linking efforts makes it easy to navigate related work, understand impact when requirements or schedules change, and produce traceability reports across development and contract boundaries.'
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
    
    if (!safeVal.statement_of_work_profile) safeVal.statement_of_work_profile = {};
    if (!safeVal.technical_points_of_contact) safeVal.technical_points_of_contact = {};
    if (!safeVal.developer_setup) safeVal.developer_setup = {};
    if (!safeVal.work_location) safeVal.work_location = {};
    
    // No restoration needed. We rely on parent_uuid as the source of truth.
    // Ensure parent_uuid is set (it should generally come from props).
    
    formData.value = safeVal;
    initialState.value = JSON.stringify(safeVal);
}, { deep: true, immediate: true });

// Valid parents: exclude self if checking against the list while editing.
const validParents = computed(() => {
    if (!props.isEdit) return props.availableParents;
    // Just to be safe, don't let a node parent itself.
    return props.availableParents.filter(p => p.uuid !== formData.value.uuid);
});

// Filtered Candidates for Linking
const filteredLinkCandidates = computed(() => {
    const query = linkSearchQuery.value.toLowerCase().trim();
    return allEffortCandidates.value.filter(e => {
        // Can't link to yourself
        if (formData.value.uuid && e.uuid === formData.value.uuid) return false;
        
        // Or things you're already linked to
        if (formData.value.linked_software_efforts && formData.value.linked_software_efforts.some(l => l.uuid === e.uuid)) return false;

        // Apply Search
        if (!query) return false; // Don't show anything until they type
        
        return (e.name && e.name.toLowerCase().includes(query)) || 
               (e._programName && e._programName.toLowerCase().includes(query));
    }).slice(0, 10);
});

// Convert the linked IDs/UUIDs into full objects for display
const linkedEffortObjects = computed(() => {
    if (!formData.value.linked_software_efforts) return [];
    
    // We might have a mix of raw strings (legacy) or full objects.
    // We want to normalize everything into a nice object for the UI.
    return formData.value.linked_software_efforts.map(link => {
        if (typeof link === 'string') {
            // Try matching by UUID first, then ID
             return allEffortCandidates.value.find(e => e.uuid === link || e.id === link) || { id: link, name: 'Unknown/External Effort', _programName: 'Unknown' };
        }
        return link; 
    });
});

const addLink = (effort) => {
    if (!formData.value.linked_software_efforts) formData.value.linked_software_efforts = [];
    // Check duplication by UUID
    const exists = formData.value.linked_software_efforts.some(l => l.uuid === effort.uuid);
    if (!exists) {
        // Push the structure expected by Pydantic: { uuid, name, program_id, program_name }
        formData.value.linked_software_efforts.push({
            uuid: effort.uuid,
            name: effort.name,
            program_id: effort._programId || '', 
            program_name: effort._programName || ''
        });
        linkSearchQuery.value = ''; // Reset search
    }
};

const removeLink = (id) => {
    // ID here could be UUID
    formData.value.linked_software_efforts = formData.value.linked_software_efforts.filter(l => (l.uuid) !== id);
};

// Inheritance Resolution Logic
const effortMap = computed(() => {
    const map = {};
    // Map available parents by UUID for robust lookup
    props.availableParents.forEach(p => {
        if (p.uuid) map[p.uuid] = p;
    });
    return map;
});

const parentEffort = computed(() => {
    if (!formData.value.parent_uuid) return null;
    return effortMap.value[formData.value.parent_uuid];
});

// NO watcher needed for parent -> parent_uuid sync.
// We just bind directly to parent_uuid in the dropdown.

const getEffectiveValue = (section, field) => {
    // If not inheriting, return local value
    const inheritKey = `inherit_${section}`;
    if (!formData.value[inheritKey]) {
        // Access {section}.{field} (No local_ prefix)
        return formData.value[section]?.[field];
    }

    // If inheriting, walk up parents
    let currentParentUuid = formData.value.parent_uuid;
    
    const inheritFlag = `inherit_${section}`;

    while (currentParentUuid) {
        const parent = effortMap.value[currentParentUuid];
        if (!parent) break; // Parent not in list?

        // If parent also inherits, keep going up
        if (parent[inheritFlag]) {
            currentParentUuid = parent.parent_uuid;
            continue;
        }

        // Parent has value
        return parent[section]?.[field];
    }
    
    return null; // No value found up the chain
};

// Wrapper for reading values in template
const sv = (section, field) => getEffectiveValue(section, field);

// Handling writes: only update local if not inheriting
const updateLocal = (section, field, value) => {
    const inheritKey = `inherit_${section}`;
    if (formData.value[inheritKey]) return; // Can't touch it if we're inheriting!
    
    if (!formData.value[section]) formData.value[section] = {};
    formData.value[section][field] = value;
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
        const email = formData.value.statement_of_work_profile?.program_manager_email;
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
        const nonUs = formData.value.statement_of_work_profile?.allow_non_us;
        if (nonUs === null || nonUs === undefined || nonUs === '') {
             errors.value.allow_non_us = 'Please select a value.';
             isValid = false;
             if (activeTab.value !== 'sow') activeTab.value = 'sow';
        }
    }

    // Software Lead (POCs)
    if (!formData.value.inherit_technical_points_of_contact) {
        const email = formData.value.technical_points_of_contact?.software_lead;
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



// Helper for Tri-State Booleans (Select inputs give us strings usually)
const parseTriState = (val) => {
    if (val === 'true') return true;
    if (val === 'false') return false;
    return null;
};


// Expose resetForm to parent
const resetForm = () => {
    formData.value = JSON.parse(initialState.value);
};

const setClean = () => {
    initialState.value = JSON.stringify(formData.value);
};

defineExpose({
    resetForm,
    setClean
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

const WORK_LOCATION_OPTIONS = [
    "USA, WA, Seattle",
    "USA, WA, Everett",
    "USA, WA, Renton",
    "USA, MO, St. Louis",
    "USA, SC, North Charleston",
    "USA, CA, Long Beach",
    "USA, TX, Plano",
    "USA, VA, Arlington",
    "USA, AL, Huntsville",
    "USA, AZ, Mesa",
    "Canada, BC, Vancouver",
    "Canada, ON, Ottawa",
    "UK, London, London",
    "Australia, QLD, Brisbane",
    "India, KA, Bengaluru"
];

</script>

<template>
  <div class="form-wrapper">
    <!-- Header Section -->
    <header class="form-header-persistent">
        <div class="header-main">
            <div class="name-input-wrapper" :class="{ 'has-error': errors.name }">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <label style="margin-bottom: 0;">Effort Name <span class="required-star">*</span></label>
                    <button class="btn-icon-sm" @click="toggleHelp('overview')" :class="{ 'active': activeHelp === 'overview' }" title="What is a Software Effort?">
                        <BaseIcon :path="mdiInformationOutline" :size="16" />
                    </button>
                </div>
                <!-- Overview Help Card -->
                <transition name="expand">
                    <div v-if="activeHelp === 'overview'" class="help-card m3-surface-variant" style="margin-bottom: 1rem;">
                        <h4>{{ helpContent.overview.title }}</h4>
                        <p>{{ helpContent.overview.text }}</p>
                    </div>
                </transition>
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
                 <select v-model="formData.parent_uuid" class="std-select">
                    <option :value="null">None (Root)</option>
                    <option v-for="p in validParents" :key="p.id" :value="p.uuid">{{ p.name }}</option>
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
                    <span v-if="tab.required" class="required-tag" :class="{ 'has-error': tabErrors[tab.id] }">Required</span>
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
                            <BaseIcon :path="mdiInformationOutline" :size="16" />
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
                    <div class="section-header-modern">
                        <label class="section-label-lg">Linked Software Efforts</label>
                        <p class="section-desc">Connect this software to other components, dependent services, or related libraries across the catalog.</p>
                    </div>
                    
                    <div class="link-manager link-card">
                        <!-- Search Header -->
                        <div class="link-manager-header">
                            <div class="link-search-wrapper">
                                <BaseIcon :path="mdiMagnify" class="search-icon" />
                                <input 
                                    v-model="linkSearchQuery" 
                                    type="text" 
                                    class="std-input with-icon search-input-modern" 
                                    placeholder="Add link..."
                                >
                            </div>
                             <!-- Dropdown Results (Absolute) -->
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
                                        <div class="item-sub-grid">
                                            <div class="sub-field">
                                                <span class="label">Program:</span>
                                                <span class="value">{{ cand._programName }}</span>
                                            </div>
                                            <div class="sub-field">
                                                <span class="label">Prog ID:</span>
                                                <span class="value code">{{ cand._programId }}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Selected Chips List -->
                        <div class="linked-items-list-modern">
                            <div v-for="link in linkedEffortObjects" :key="link.id" class="link-item-row">
                                <div class="row-icon">
                                     <BaseIcon :path="mdiLinkVariant" :size="20" />
                                </div>
                                <div class="row-content">
                                    <div class="row-top">
                                        <span class="row-name">{{ link.name }}</span>
                                        <span class="row-id-badge">ID: {{ link.uuid || link.id }}</span>
                                    </div>
                                    <div class="row-meta-grid">
                                        <div class="meta-pair">
                                            <span class="meta-label">Program:</span>
                                            <span class="meta-val">{{ link.program_name || link._programName || 'Unknown' }}</span>
                                        </div>
                                        <div class="meta-pair">
                                            <span class="meta-label">Prog ID:</span>
                                            <span class="meta-val code">{{ link.program_id || link._programId || 'N/A' }}</span>
                                        </div>
                                    </div>
                                </div>
                                <button class="btn-icon-danger" @click.stop="removeLink(link.uuid || link.id)" title="Remove Link">
                                    <BaseIcon :path="mdiClose" :size="18" />
                                </button>
                            </div>
                            
                            <div v-if="linkedEffortObjects.length === 0" class="empty-state-modern">
                                <div class="empty-icon-circle">
                                    <BaseIcon :path="mdiLinkVariant" :size="24" />
                                </div>
                                <span class="empty-text">No linked efforts yet. Search above to add dependencies.</span>
                            </div>
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
                            <BaseIcon :path="mdiInformationOutline" :size="16" />
                        </button>
                    </div>
                    <div class="header-controls">
                        <span v-if="formData.inherit_statement_of_work_profile" class="inherited-badge">Read-only while Inheriting from Parent</span>
                        <label class="inherit-toggle">
                            <input type="checkbox" v-model="formData.inherit_statement_of_work_profile" :disabled="!formData.parent">
                            <span class="toggle-track"></span>
                            <span>Inherit</span>
                        </label>
                     </div>
                </div>
                
                <div v-if="formData.inherit_statement_of_work_profile && parentEffort" class="inheritance-info-banner">
                    <BaseIcon :path="mdiSourceBranch" :size="16" />
                    <span>Inheriting <strong>Statement of Work</strong> from <strong>{{ parentEffort.name }}</strong> (ID: {{ parentEffort.id }})</span>
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
                            class="std-select" 
                            :value="sv('statement_of_work_profile', 'effort_type')"
                            @change="e => updateLocal('statement_of_work_profile', 'effort_type', e.target.value)"
                            :disabled="formData.inherit_statement_of_work_profile"
                        >
                            <option value="" disabled selected>Select Effort Type...</option>
                            <option v-for="type in EFFORT_TYPES" :key="type" :value="type">{{ type }}</option>
                        </select>
                    </div>
                    
                    <div class="field-group span-2">
                         <label>Program Phase</label>
                         <select 
                            class="std-select" 
                            :value="sv('statement_of_work_profile', 'program_phase')"
                            @change="e => updateLocal('statement_of_work_profile', 'program_phase', e.target.value)"
                            :disabled="formData.inherit_statement_of_work_profile"
                        >
                            <option value="" disabled selected>Select Program Phase...</option>
                            <option v-for="phase in PROGRAM_PHASES" :key="phase" :value="phase">{{ phase }}</option>
                        </select>
                    </div>
                     <div class="field-group" :class="{ 'has-error': errors.program_manager_email }">
                        <EmailAutocomplete 
                             :modelValue="sv('statement_of_work_profile', 'program_manager_email')"
                             @update:modelValue="val => updateLocal('statement_of_work_profile', 'program_manager_email', val)"
                             :disabled="formData.inherit_statement_of_work_profile"
                             label="Program Manager Email"
                             placeholder="manager@example.com"
                             :error="errors.program_manager_email"
                             :required="true"
                        />
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
                            class="std-select" 
                            :value="sv('statement_of_work_profile', 'allow_non_us')"
                            @change="e => updateLocal('statement_of_work_profile', 'allow_non_us', parseTriState(e.target.value))"
                            :disabled="formData.inherit_statement_of_work_profile"
                         >
                            <option value="">None</option>
                            <option value="true">True</option>
                            <option value="false">False</option>
                         </select>
                         <span v-if="errors.allow_non_us" class="error-msg">{{ errors.allow_non_us }}</span>
                    </div>

                    <div class="field-group">
                         <label>Mission Critical</label>
                         <select 
                            class="std-select" 
                            :value="sv('statement_of_work_profile', 'mission_critical')"
                            @change="e => updateLocal('statement_of_work_profile', 'mission_critical', parseTriState(e.target.value))"
                            :disabled="formData.inherit_statement_of_work_profile"
                         >
                            <option value="">None</option>
                            <option value="true">True</option>
                            <option value="false">False</option>
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
                            <BaseIcon :path="mdiInformationOutline" :size="16" />
                        </button>
                    </div>
                    <div class="header-controls">
                        <span v-if="formData.inherit_technical_points_of_contact" class="inherited-badge">Read-only while Inheriting from Parent</span>
                        <label class="inherit-toggle">
                            <input type="checkbox" v-model="formData.inherit_technical_points_of_contact" :disabled="!formData.parent">
                            <span class="toggle-track"></span>
                            <span>Inherit</span>
                        </label>
                    </div>
                </div>

                <div v-if="formData.inherit_technical_points_of_contact && parentEffort" class="inheritance-info-banner">
                    <BaseIcon :path="mdiSourceBranch" :size="16" />
                    <span>Inheriting <strong>Points of Contact</strong> from <strong>{{ parentEffort.name }}</strong> (ID: {{ parentEffort.id }})</span>
                </div>

                <transition name="expand">
                    <div v-if="activeHelp === 'pocs'" class="help-card m3-surface-variant">
                        <h4>{{ helpContent.pocs.title }}</h4>
                        <p>{{ helpContent.pocs.text }}</p>
                    </div>
                </transition>

                <div class="form-fields-grid" :class="{ 'is-inherited': formData.inherit_technical_points_of_contact }">
                     <div class="field-group" :class="{ 'has-error': errors.software_lead }">
                        <EmailAutocomplete 
                            :modelValue="sv('technical_points_of_contact', 'software_lead')"
                            @update:modelValue="val => updateLocal('technical_points_of_contact', 'software_lead', val)"
                            :disabled="formData.inherit_technical_points_of_contact"
                            label="Software Lead Email"
                            placeholder="lead@example.com"
                            :error="errors.software_lead"
                            :required="true"
                        />
                    </div>
                     <div class="field-group">
                        <EmailAutocomplete 
                            :modelValue="sv('technical_points_of_contact', 'security_focal')"
                            @update:modelValue="val => updateLocal('technical_points_of_contact', 'security_focal', val)"
                            :disabled="formData.inherit_technical_points_of_contact"
                            label="Security Focal"
                            placeholder="Name or Email"
                        />
                    </div>

                </div>
            </div>

            <!-- DEV SETUP TAB -->
             <div v-if="activeTab === 'dev'" class="tab-content fade-in">
                  <div class="tab-header">
                    <div class="header-text-group">
                        <h3>Developer Setup</h3>
                        <button class="btn-icon-sm" @click="toggleHelp('dev')" :class="{ 'active': activeHelp === 'dev' }">
                            <BaseIcon :path="mdiInformationOutline" :size="16" />
                        </button>
                    </div>
                    <div class="header-controls">
                        <span v-if="formData.inherit_developer_setup" class="inherited-badge">Read-only while Inheriting from Parent</span>
                        <label class="inherit-toggle">
                            <input type="checkbox" v-model="formData.inherit_developer_setup" :disabled="!formData.parent">
                              <span class="toggle-track"></span>
                            <span>Inherit</span>
                        </label>
                    </div>
                </div>

                <div v-if="formData.inherit_developer_setup && parentEffort" class="inheritance-info-banner">
                    <BaseIcon :path="mdiSourceBranch" :size="16" />
                    <span>Inheriting <strong>Developer Setup</strong> from <strong>{{ parentEffort.name }}</strong> (ID: {{ parentEffort.id }})</span>
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
                    <div class="field-group span-2">
                        <label>Design Practice Assessment</label>
                        <input 
                            :value="sv('developer_setup', 'dp_assessment_name')"
                            @input="e => updateLocal('developer_setup', 'dp_assessment_name', e.target.value)"
                            :disabled="formData.inherit_developer_setup"
                            type="text" class="std-input">
                    </div>
                </div>
            </div>

            <!-- LOCATION TAB -->
             <div v-if="activeTab === 'location'" class="tab-content fade-in">
                  <div class="tab-header">
                    <div class="header-text-group">
                        <h3>Work Locations</h3>
                         <button class="btn-icon-sm" @click="toggleHelp('location')" :class="{ 'active': activeHelp === 'location' }">
                            <BaseIcon :path="mdiInformationOutline" :size="16" />
                        </button>
                    </div>
                    <div class="header-controls">
                        <span v-if="formData.inherit_work_location" class="inherited-badge">Read-only while Inheriting from Parent</span>
                        <label class="inherit-toggle">
                            <input type="checkbox" v-model="formData.inherit_work_location" :disabled="!formData.parent">
                             <span class="toggle-track"></span>
                            <span>Inherit</span>
                        </label>
                    </div>
                </div>

                <div v-if="formData.inherit_work_location && parentEffort" class="inheritance-info-banner">
                    <BaseIcon :path="mdiSourceBranch" :size="16" />
                    <span>Inheriting <strong>Work Locations</strong> from <strong>{{ parentEffort.name }}</strong> (ID: {{ parentEffort.id }})</span>
                </div>

                <transition name="expand">
                    <div v-if="activeHelp === 'location'" class="help-card m3-surface-variant">
                        <h4>{{ helpContent.location.title }}</h4>
                        <p>{{ helpContent.location.text }}</p>
                    </div>
                </transition>

                <div class="form-fields-grid" :class="{ 'is-inherited': formData.inherit_work_location }">
                    <div class="field-group span-2">
                        <MultiSelectDropdown 
                            :modelValue="sv('work_location', 'locations') || []"
                            @update:modelValue="val => updateLocal('work_location', 'locations', val)"
                            :options="WORK_LOCATION_OPTIONS"
                            label="Work Locations"
                            :disabled="formData.inherit_work_location"
                            placeholder="Search and select locations..."
                        />
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
    padding: 12px 16px;
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

.tab-icon-container {
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    width: 20px; /* Fix width to ensure icon center stability */
    height: 24px;
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

.tab-info {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start; /* Ensure left alignment of text */
    line-height: normal;
    gap: 4px;
}

.required-tag {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    color: #49454F; /* on-surface-variant (Grey) */
    background: #E7E0EC; /* surface-variant (Light Grey) */
    padding: 2px 6px;
    border-radius: 4px;
    letter-spacing: 0.5px;
}

.required-tag.has-error {
    color: #BA1A1A; /* error */
    background: #FFDAD6; /* error-container */
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

/* Clean Input Removed - Using .std-input globally */

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

/* Modern General Tab Styles */
.section-header-modern {
    margin-bottom: 1.5rem;
}

.section-label-lg {
    font-size: 16px;
    font-weight: 500;
    color: #1D1B20;
    display: block;
    margin-bottom: 4px;
}

.section-desc {
    font-size: 14px;
    color: #49454F;
    margin: 0;
    line-height: 1.5;
}

.link-card {
    background: #FFFFFF;
    border: 1px solid #C4C7C5;
    border-radius: 12px;
    overflow: hidden;
}

.link-manager-header {
    padding: 1rem;
    background: #F7F2FA; /* surface-container-low */
    border-bottom: 1px solid #C4C7C5;
    position: relative;
}

.search-input-modern {
    background: #FFFFFF;
    border-radius: 100px !important; /* Pill shape for this search */
}

/* Link List */
.linked-items-list-modern {
    padding: 0.5rem 0;
}

.link-item-row {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    gap: 16px;
    border-bottom: 1px solid #E7E0EC;
}

.link-item-row:last-child {
    border-bottom: none;
}

.row-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #E8DEF8; /* primary-container-low */
    color: #1D192B;
    display: flex;
    align-items: center;
    justify-content: center;
}

.row-content {
    flex: 1;
}

.row-main {
    font-size: 14px;
    font-weight: 500;
    color: #1D1B20;
}

.row-sub {
    font-size: 12px;
    color: #49454F;
    display: flex;
    gap: 8px;
    align-items: center;
}

.program-tag {
    background: #E7E0EC;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 500;
}

.id-text {
    font-family: monospace;
    opacity: 0.7;
}

.btn-icon-danger {
    background: transparent;
    border: none;
    color: #BA1A1A;
    cursor: pointer;
    padding: 8px;
    border-radius: 50%;
    transition: 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
}

.btn-icon-danger:hover {
    background: #FFDAD6;
}

.empty-state-modern {
    padding: 3rem 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    text-align: center;
    color: #49454F;
}

.empty-icon-circle {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: #F2F2F2;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.5rem;
    opacity: 0.5;
}

.empty-text {
    font-size: 14px;
    max-width: 250px;
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

/* Clean Select Removed - Using .std-select globally */

/* Updated Tab UX block removed (merged upstream) */

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
    align-items: flex-start; /* Align top for multi-line */
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
    flex-shrink: 0;
}

.item-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
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

/* New Grid Layout for Dropdown Sub-info */
.item-sub-grid {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 11px;
    color: #49454F;
    margin-top: 4px;
}

.sub-field {
    display: flex;
    flex-direction: row; /* Change to row */
    align-items: center;
    gap: 8px; /* Slightly bigger gap for separation */
}

.sub-field .label {
    font-size: 10px;
    text-transform: uppercase;
    color: #625B71; /* secondary */
    font-weight: 600;
    min-width: 55px; /* Fixed width for alignment */
}

.sub-field .value {
    color: #1D1B20;
    font-weight: 500;
}

.sub-field .value.code {
    font-family: monospace;
    font-size: 10px;
    background: #F2F2F2;
    padding: 1px 4px;
    border-radius: 3px;
    width: fit-content;
}

/* List Item Styles */
.row-top {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 2px;
}

.row-name {
    font-weight: 500;
    color: #1D1B20;
    font-size: 14px;
}

.row-id-badge {
    font-size: 10px;
    background: #E8F0FE;
    color: #005AC1;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
}

.row-meta-grid {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    align-items: flex-start;
    margin-top: 4px;
}

.meta-pair {
    display: flex;
    align-items: center;
    gap: 4px;
}

.meta-label {
    color: #625B71;
    font-size: 11px;
    min-width: 55px; /* Match dropdown width */
}

.meta-val {
    color: #1D1B20;
    font-weight: 500;
}

.meta-val.code {
    font-family: monospace;
    font-size: 11px;
}

/* Inheritance Banner */
.inheritance-info-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #F2F6FC; /* surface-variant / light primary tint */
    color: #444746; /* on-surface-variant */
    padding: 8px 12px;
    border-radius: 8px;
    margin-bottom: 1.5rem; /* Match help card margin */
    font-size: 13px;
    border: 1px solid #D3E3FD;
}

.inheritance-info-banner strong {
    font-weight: 600;
    color: #005AC1; /* primary */
}

/* Responsive Implementation */
@media (max-width: 768px) {
    .form-wrapper {
        border-radius: 0; /* Full screen on mobile usually looks better without corners */
        border: none;
    }

    /* Stack Header */
    .header-main {
        flex-direction: column;
        align-items: stretch;
        gap: 1rem;
    }

    .name-input-wrapper {
        margin-right: 0;
        margin-bottom: 0.5rem;
    }

    .form-actions-top {
        justify-content: flex-end;
    }

    .header-meta {
        flex-direction: column;
        gap: 0.75rem;
        align-items: flex-start;
    }

    .meta-field {
        width: 100%;
        justify-content: space-between;
    }

    /* Change Body Layout */
    .form-body {
        flex-direction: column;
    }

    /* Horizontal Scrollable Tabs */
    .tabs-vertical {
        width: 100%;
        flex-direction: row;
        overflow-x: auto;
        border-right: none;
        border-bottom: 1px solid #C4C7C5;
        padding: 0;
        scroll-behavior: smooth;
        /* Hide scrollbar structure but keep functionality */
        scrollbar-width: none; 
        -ms-overflow-style: none;
    }

    .tabs-vertical::-webkit-scrollbar {
        display: none;
    }

    .tab-btn {
        flex: 0 0 auto; /* Don't shrink */
        border-left: none;
        border-bottom: 3px solid transparent;
        padding: 12px 16px;
        justify-content: center;
    }

    .tab-btn.active {
        background: transparent; /* Or keep slight tint */
        border-bottom-color: #005AC1;
        border-left-color: transparent;
    }
    
    .tab-info {
        display: none; /* Hide labels if very small, or keep? Let's keep labels but make text smaller if needed. */
        /* For better horizontal fit, let's just show icons? 
           User asked for layout help. Horizontal tabs usually have text. 
           Let's keep text but ensure it flows. 
        */
        display: flex;
    }

    /* Content Area Adjustment */
    .content-area {
        padding: 1.5rem 1rem; /* Reduce padding */
    }

    /* Stack Form Fields */
    .form-fields-grid {
        grid-template-columns: 1fr;
        gap: 1.5rem;
    }

    .field-group.span-2 {
        grid-column: span 1;
    }
    
    /* Adjust controls in tab header */
    .tab-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
    }
    
    .header-controls {
        width: 100%;
        justify-content: space-between;
    }
}
</style>
