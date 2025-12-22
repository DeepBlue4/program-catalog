<script setup>
import { ref, computed, watch } from 'vue';

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
        program_phase: '',
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

const emit = defineEmits(['save', 'cancel', 'delete', 'dirty-change']);

// Tabs
const activeTab = ref('general');
const tabs = [
    { id: 'general', label: 'General & Links', icon: 'fas fa-link' },
    { id: 'sow', label: 'Statement of Work', icon: 'fas fa-file-contract' },
    { id: 'pocs', label: 'Point of Contacts', icon: 'fas fa-users' },
    { id: 'dev', label: 'Developer Setup', icon: 'fas fa-laptop-code' },
    { id: 'location', label: 'Work Locations', icon: 'fas fa-map-marker-alt' },
];

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

// Linked efforts: exclude self
const validLinked = computed(() => {
     if (!props.isEdit) return props.availableParents;
     return props.availableParents.filter(p => p.id !== formData.value.id);
});

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

const handleSave = () => {
    if (!formData.value.name) return;
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
</script>

<template>
  <div class="form-wrapper">
    <!-- Header Section -->
    <header class="form-header-persistent">
        <div class="header-main">
            <div class="name-input-wrapper">
                <label>Effort Name</label>
                <input v-model="formData.name" type="text" class="clean-input-lg" placeholder="Enter Effort Name...">
            </div>
            
             <div class="form-actions-top">
                <button @click="$emit('cancel')" class="btn-outlined">Cancel</button>
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
                :class="{ active: activeTab === tab.id }"
                @click="activeTab = tab.id"
            >
                <i :class="[tab.icon, 'tab-icon']"></i>
                <span class="tab-label">{{ tab.label }}</span>
            </button>
        </nav>

        <!-- Content Area -->
        <main class="content-area">
            
            <!-- GENERAL TAB -->
            <div v-if="activeTab === 'general'" class="tab-content fade-in">
                <h3>General Configuration</h3>
                <div class="field-section">
                    <label class="section-label">Linked Efforts</label>
                    <div class="help-text">Select other efforts related to this one.</div>
                    <div class="multi-select-grid">
                        <label v-for="opt in validLinked" :key="opt.id" class="checkbox-clean">
                            <input type="checkbox" :value="opt.id" v-model="formData.linked_software_efforts">
                            <span>{{ opt.name }}</span>
                        </label>
                         <div v-if="validLinked.length === 0" class="empty-msg">No other efforts available to link.</div>
                    </div>
                </div>
            </div>

            <!-- STATEMENT OF WORK TAB -->
            <div v-if="activeTab === 'sow'" class="tab-content fade-in">
                <div class="tab-header">
                    <h3>Statement of Work</h3>
                    <div class="header-controls">
                        <span v-if="formData.inherit_statement_of_work_profile" class="inherited-badge">Inheriting from Parent</span>
                        <label class="inherit-toggle">
                            <input type="checkbox" v-model="formData.inherit_statement_of_work_profile" :disabled="!formData.parent">
                            <span class="toggle-track"></span>
                            <span>Inherit</span>
                        </label>
                     </div>
                </div>
                
                <div class="form-fields-grid" :class="{ 'is-inherited': formData.inherit_statement_of_work_profile }">
                     <div class="field-group span-2">
                        <label>Description / Description of Work</label>
                        <textarea 
                            :value="sv('statement_of_work_profile', 'description')" 
                            @input="e => updateLocal('statement_of_work_profile', 'description', e.target.value)"
                            :disabled="formData.inherit_statement_of_work_profile"
                            class="clean-textarea" rows="4"></textarea>
                    </div>
                    
                    <div class="field-group">
                        <label>Program Phase</label>
                        <input 
                            :value="sv('statement_of_work_profile', 'program_phase')"
                            @input="e => updateLocal('statement_of_work_profile', 'program_phase', e.target.value)"
                            :disabled="formData.inherit_statement_of_work_profile"
                            type="text" class="clean-input" placeholder="e.g. Design, Implementation">
                    </div>
                     <div class="field-group">
                        <label>PM Email</label>
                        <input 
                             :value="sv('statement_of_work_profile', 'program_manager_email')"
                             @input="e => updateLocal('statement_of_work_profile', 'program_manager_email', e.target.value)"
                             :disabled="formData.inherit_statement_of_work_profile"
                             type="email" class="clean-input" placeholder="manager@example.com">
                    </div>

                     <div class="field-group">
                        <label>Security Clearance</label>
                        <input 
                            :value="fromArray(sv('statement_of_work_profile', 'security_clearance'))" 
                            @input="e => updateLocal('statement_of_work_profile', 'security_clearance', toArray(e.target.value))"
                            :disabled="formData.inherit_statement_of_work_profile"
                            type="text" class="clean-input"
                        />
                    </div>
                     <div class="field-group">
                        <label>Safety Criticality</label>
                        <input 
                            :value="fromArray(sv('statement_of_work_profile', 'safety_criticality'))" 
                            @input="e => updateLocal('statement_of_work_profile', 'safety_criticality', toArray(e.target.value))"
                            :disabled="formData.inherit_statement_of_work_profile"
                            type="text" class="clean-input"
                        />
                    </div>

                    <div class="field-group checkbox-row span-2">
                         <label class="checkbox-clean" :class="{ disabled: formData.inherit_statement_of_work_profile }">
                            <input 
                                type="checkbox" 
                                :checked="sv('statement_of_work_profile', 'allow_non_us')"
                                @change="e => updateLocal('statement_of_work_profile', 'allow_non_us', e.target.checked)"
                                :disabled="formData.inherit_statement_of_work_profile">
                            <span>Allow Non-US Personnel</span>
                        </label>
                        <label class="checkbox-clean" :class="{ disabled: formData.inherit_statement_of_work_profile }">
                            <input 
                                type="checkbox" 
                                :checked="sv('statement_of_work_profile', 'mission_critical')"
                                @change="e => updateLocal('statement_of_work_profile', 'mission_critical', e.target.checked)"
                                :disabled="formData.inherit_statement_of_work_profile">
                            <span>Mission Critical</span>
                        </label>
                    </div>
                </div>
            </div>

            <!-- POCs TAB -->
             <div v-if="activeTab === 'pocs'" class="tab-content fade-in">
                <div class="tab-header">
                    <h3>Technical Point of Contacts</h3>
                    <div class="header-controls">
                        <span v-if="formData.inherit_technical_points_of_contact" class="inherited-badge">Inheriting from Parent</span>
                        <label class="inherit-toggle">
                            <input type="checkbox" v-model="formData.inherit_technical_points_of_contact" :disabled="!formData.parent">
                            <span class="toggle-track"></span>
                            <span>Inherit</span>
                        </label>
                    </div>
                </div>

                <div class="form-fields-grid" :class="{ 'is-inherited': formData.inherit_technical_points_of_contact }">
                     <div class="field-group">
                        <label>Software Lead</label>
                        <input 
                            :value="sv('technical_points_of_contact', 'software_lead')"
                            @input="e => updateLocal('technical_points_of_contact', 'software_lead', e.target.value)"
                            :disabled="formData.inherit_technical_points_of_contact"
                            type="text" class="clean-input" placeholder="Name or Email">
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
                    <h3>Developer Setup</h3>
                    <div class="header-controls">
                        <span v-if="formData.inherit_developer_setup" class="inherited-badge">Inheriting from Parent</span>
                        <label class="inherit-toggle">
                            <input type="checkbox" v-model="formData.inherit_developer_setup" :disabled="!formData.parent">
                             <span class="toggle-track"></span>
                            <span>Inherit</span>
                        </label>
                    </div>
                </div>

                <div class="form-fields-grid" :class="{ 'is-inherited': formData.inherit_developer_setup }">
                     <div class="field-group">
                        <label>Programming Languages</label>
                        <input 
                            :value="fromArray(sv('developer_setup', 'programming_languages'))" 
                            @input="e => updateLocal('developer_setup', 'programming_languages', toArray(e.target.value))"
                            :disabled="formData.inherit_developer_setup"
                            type="text" class="clean-input" placeholder="Python, C++, Java"
                        />
                    </div>
                    <div class="field-group">
                        <label>Operating Systems</label>
                        <input 
                            :value="fromArray(sv('developer_setup', 'operating_systems'))" 
                            @input="e => updateLocal('developer_setup', 'operating_systems', toArray(e.target.value))"
                            :disabled="formData.inherit_developer_setup"
                            type="text" class="clean-input" placeholder="Linux, Windows"
                        />
                    </div>

                    <div class="field-group span-2">
                        <label>Development Environments</label>
                        <textarea 
                             :value="fromArray(sv('developer_setup', 'development_environments'))" 
                             @input="e => updateLocal('developer_setup', 'development_environments', toArray(e.target.value))"
                             :disabled="formData.inherit_developer_setup"
                             class="clean-textarea" rows="2" placeholder="List environments..."
                        ></textarea>
                    </div>

                     <div class="field-group">
                        <label>Source Control Tools</label>
                         <textarea 
                             :value="fromArray(sv('developer_setup', 'source_control_tools'))" 
                             @input="e => updateLocal('developer_setup', 'source_control_tools', toArray(e.target.value))"
                             :disabled="formData.inherit_developer_setup"
                             class="clean-textarea" rows="2"
                        ></textarea>
                    </div>
                     <div class="field-group">
                        <label>Issue Tracking Tools</label>
                         <textarea 
                             :value="fromArray(sv('developer_setup', 'issue_tracking_tools'))" 
                             @input="e => updateLocal('developer_setup', 'issue_tracking_tools', toArray(e.target.value))"
                             :disabled="formData.inherit_developer_setup"
                             class="clean-textarea" rows="2"
                        ></textarea>
                    </div>
                     <div class="field-group">
                        <label>SBOM Location</label>
                         <textarea 
                             :value="fromArray(sv('developer_setup', 'sbom_location'))" 
                             @input="e => updateLocal('developer_setup', 'sbom_location', toArray(e.target.value))"
                             :disabled="formData.inherit_developer_setup"
                             class="clean-textarea" rows="2"
                        ></textarea>
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
                    <h3>Work Locations</h3>
                    <div class="header-controls">
                        <span v-if="formData.inherit_work_location" class="inherited-badge">Inheriting from Parent</span>
                        <label class="inherit-toggle">
                            <input type="checkbox" v-model="formData.inherit_work_location" :disabled="!formData.parent">
                             <span class="toggle-track"></span>
                            <span>Inherit</span>
                        </label>
                    </div>
                </div>

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
    background: var(--md-sys-color-surface);
    overflow: hidden;
}

/* HEADER */
.form-header-persistent {
    padding: 1.5rem 2rem 1rem 2rem;
    border-bottom: 1px solid var(--md-sys-color-outline-variant);
    background: var(--md-sys-color-surface);
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
    color: var(--md-sys-color-primary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
}

.clean-input-lg {
    width: 100%;
    font-size: 24px;
    font-weight: 400;
    font-family: inherit;
    color: var(--md-sys-color-on-surface);
    border: none;
    border-bottom: 2px solid transparent;
    background: transparent;
    padding: 4px 0;
    transition: 0.2s;
}

.clean-input-lg:focus {
    outline: none;
    border-bottom-color: var(--md-sys-color-primary);
}

.clean-input-lg::placeholder {
    color: var(--md-sys-color-on-surface-variant);
    opacity: 0.5;
}

.header-meta {
    display: flex;
    gap: 2rem;
    font-size: 13px;
    color: var(--md-sys-color-on-surface-variant);
}

.meta-field {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.meta-field label {
    color: var(--md-sys-color-on-surface-variant);
}

.meta-value {
    color: var(--md-sys-color-on-surface);
    font-family: monospace;
}

.clean-select-sm {
    background: transparent;
    border: none;
    font-size: 13px;
    color: var(--md-sys-color-on-surface);
    padding: 2px;
    cursor: pointer;
}

.clean-select-sm:hover {
    background: var(--md-sys-color-surface-container-high);
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
    background: var(--md-sys-color-surface-container-low);
    display: flex;
    flex-direction: column;
    padding: 1rem 0;
    border-right: 1px solid var(--md-sys-color-outline-variant);
}

.tab-btn {
    background: transparent;
    border: none;
    text-align: left;
    padding: 12px 24px;
    font-size: 14px;
    color: var(--md-sys-color-on-surface-variant);
    cursor: pointer;
    border-left: 3px solid transparent;
    transition: 0.2s;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 12px;
}


.tab-btn:hover {
    background: var(--md-sys-color-surface-container-high);
    color: var(--md-sys-color-on-surface);
}

.tab-btn.active {
    background: var(--md-sys-color-surface-container);
    color: var(--md-sys-color-primary);
    border-left-color: var(--md-sys-color-primary);
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
    color: var(--md-sys-color-on-surface);
    font-weight: 500;
}

.tab-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    border-bottom: 1px solid var(--md-sys-color-outline-variant);
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
    color: var(--md-sys-color-secondary);
    background: var(--md-sys-color-surface-container);
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
    color: var(--md-sys-color-secondary);
    margin-bottom: 8px;
    text-transform: uppercase;
}

.clean-input, .clean-textarea {
    width: 100%;
    padding: 10px 12px;
    font-size: 14px;
    color: var(--md-sys-color-on-surface);
    background: var(--md-sys-color-surface-container-lowest);
    border: 1px solid var(--md-sys-color-outline);
    border-radius: 6px;
    font-family: inherit;
    box-sizing: border-box;
    transition: 0.2s;
}

.clean-input:focus, .clean-textarea:focus {
    outline: none;
    border-color: var(--md-sys-color-primary);
    background: var(--md-sys-color-surface);
    box-shadow: 0 0 0 3px var(--md-sys-color-primary-container);
}

.clean-input:disabled, .clean-textarea:disabled {
    background: rgba(0,0,0,0.02);
    border-color: transparent;
    color: var(--md-sys-color-on-surface-variant);
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
    color: var(--md-sys-color-secondary);
}

.inherit-toggle input {
    display: none;
}

.toggle-track {
    width: 36px;
    height: 20px;
    background: var(--md-sys-color-surface-variant);
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
    background: var(--md-sys-color-primary);
}

.inherit-toggle input:checked + .toggle-track::after {
    transform: translateX(16px);
}

.inherit-toggle input:disabled + .toggle-track {
    opacity: 0.5;
    cursor: not-allowed;
}

/* Multi-select */
.multi-select-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
    padding: 1rem;
    background: var(--md-sys-color-surface-container-lowest);
    border-radius: 8px;
    border: 1px solid var(--md-sys-color-outline-variant);
}

.help-text {
    font-size: 12px;
    color: var(--md-sys-color-secondary);
    margin-bottom: 0.5rem;
}

.empty-msg {
    font-style: italic;
    color: var(--md-sys-color-outline);
    font-size: 13px;
}

.fade-in {
    animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
}
</style>
