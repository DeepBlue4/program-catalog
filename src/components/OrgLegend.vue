<script setup>
import { ref, computed } from 'vue';
import { useProgramData } from '../composables/useProgramData';
import BaseIcon from './BaseIcon.vue';
import { mdiInformation } from '@mdi/js';
import { STATUS_COLORS } from '../styles/statusConstants';
 
const { allNodes } = useProgramData();
 
// Compute Counts
// Compute Counts
const counts = computed(() => {
  // Filter out software efforts themselves, focus on programs
  const nodes = allNodes.value.filter(n => !n.isSoftwareEffort);
   
  return {
    active: nodes.filter(n => n.expecting_software_efforts && n.softwareEfforts && n.softwareEfforts.length > 0).length,
    gap: nodes.filter(n => n.expecting_software_efforts && (!n.softwareEfforts || n.softwareEfforts.length === 0)).length,
    parent: nodes.filter(n => !n.expecting_software_efforts && n.has_descendant_expecting_software_effort).length,
    neutral: nodes.filter(n => !n.expecting_software_efforts && !n.has_descendant_expecting_software_effort).length
  };
});
 
// Help State
const activeHelp = ref(null);
 
const helpContent = {
  active: {
    title: 'Software Effort Active',
    desc: 'A program that is expecting software efforts and currently has one or more assigned.',
    context: 'These programs are actively tracking software work.'
  },
  gap: {
    title: 'Software Effort Expected (Missing)',
    desc: 'A program flagged to expect software efforts but currently has none assigned.',
    context: 'Action Required: These programs represent a gap in data or assignment.'
  },
  parent: {
    title: 'Parent of Effort',
    desc: 'A program with no direct software efforts of its own, but contains sub-programs that do.',
    context: 'These function as organizational containers or oversight for software efforts below.'
  },
  neutral: {
    title: 'Neutral Program',
    desc: 'A program not expecting software efforts and has no descendants expecting them.',
    context: 'Included primarily for organizational hierarchy and structure.'
  }
};
 
const openHelp = (type) => {
  activeHelp.value = type;
};
</script>
 
<template>
 <div class="legend-container m3-card elevated">
  <h3 class="legend-title">Program Status Key</h3>
   
  <div class="legend-item">
   <div class="visual">
     <span class="dot effort"></span>
   </div>
   <div class="text-content">
     <span class="label">Software Active</span>
     <span class="count-badge">{{ counts.active }}</span>
   </div>
   <button class="icon-btn-tiny" @click.stop="openHelp('active')">
     <BaseIcon :path="mdiInformation" :size="14" />
   </button>
  </div>
 
 
 
  <div class="legend-item">
   <div class="visual">
     <span class="dot parent"></span>
   </div>
   <div class="text-content">
     <span class="label">Software Program</span>
      <span class="count-badge">{{ counts.parent }}</span>
   </div>
   <button class="icon-btn-tiny" @click.stop="openHelp('parent')">
     <BaseIcon :path="mdiInformation" :size="14" />
   </button>
  </div>
 
  <div class="legend-item">
   <div class="visual">
     <span class="dot gap"></span>
   </div>
   <div class="text-content">
     <span class="label">Expected (Missing)</span>
     <span class="count-badge">{{ counts.gap }}</span>
   </div>
   <button class="icon-btn-tiny" @click.stop="openHelp('gap')">
     <BaseIcon :path="mdiInformation" :size="14" />
   </button>
  </div>
   
  <div class="legend-item">
   <div class="visual">
     <span class="dot neutral"></span>
   </div>
   <div class="text-content">
     <span class="label">Neutral Program</span>
      <span class="count-badge">{{ counts.neutral }}</span>
   </div>
   <button class="icon-btn-tiny" @click.stop="openHelp('neutral')">
     <BaseIcon :path="mdiInformation" :size="14" />
   </button>
  </div>
 
  <!-- Mini Modal / Popover -->
  <transition name="fade">
    <div v-if="activeHelp" class="help-popover m3-card elevated" @click.stop>
      <div class="popover-header">
        <span class="popover-title">{{ helpContent[activeHelp].title }}</span>
        <button class="close-btn" @click="activeHelp = null">&times;</button>
      </div>
      <div class="popover-body">
        <p class="main-desc">{{ helpContent[activeHelp].desc }}</p>
        <p class="sub-desc">{{ helpContent[activeHelp].context }}</p>
        <div class="stat-footer">
          Total in Tree: <strong>{{ counts[activeHelp] }}</strong>
        </div>
      </div>
    </div>
  </transition>
   
  <!-- Backdrop to close -->
  <div v-if="activeHelp" class="shim" @click="activeHelp = null"></div>
 </div>
</template>
 
<style scoped>
.legend-container {
 padding: 1rem;
 display: flex;
 flex-direction: column;
 gap: 1rem;
 min-width: 240px;
 position: relative; /* For popover positioning */
 background: rgba(255, 255, 255, 0.95);
 backdrop-filter: blur(4px);
 border-radius: 12px;
}
 
.legend-title {
 margin: 0;
 font-size: 0.75rem;
 text-transform: uppercase;
 color: #625B71; /* secondary */
 letter-spacing: 0.5px;
 font-weight: 600;
 border-bottom: 1px solid #C4C7C5; /* outline-variant */
 padding-bottom: 0.5rem;
}
 
.legend-item {
 display: flex;
 align-items: center;
 gap: 0.75rem;
 justify-content: space-between;
}
 
.visual {
  width: 16px;
  display: flex;
  justify-content: center;
}
 
.text-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
 
.count-badge {
  background: #ECE6F0; /* surface-container-high */
  color: #49454F; /* on-surface-variant */
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
  font-weight: 600;
  min-width: 16px;
  text-align: center;
}
 
.icon-btn-tiny {
  background: transparent;
  border: none;
  color: #79747E; /* outline */
  cursor: pointer;
  font-size: 14px;
  padding: 2px;
  display: flex;
  align-items: center;
  transition: color 0.2s;
}
 
.icon-btn-tiny:hover {
  color: #005AC1; /* primary */
}
 
.dot {
 width: 12px;
 height: 12px;
 border-radius: 50%;
 border: 2px solid transparent;
}
 
/* Match OrgChart M3 Styles */
.dot.effort {
 /* Active Effort */
 background-color: v-bind('STATUS_COLORS.active.fill');
 border-color: v-bind('STATUS_COLORS.active.border');
}
 
.dot.gap {
 /* Expected but Missing */
 background-color: v-bind('STATUS_COLORS.gap.fill');
 border-color: v-bind('STATUS_COLORS.gap.border');
 border-width: 1px;
}
 
.dot.parent {
 /* Parent */
 background-color: v-bind('STATUS_COLORS.parent.fill');
 border-color: v-bind('STATUS_COLORS.parent.border');
 border-width: 1px;
}
 
.dot.neutral {
 /* Neutral */
 background-color: v-bind('STATUS_COLORS.neutral.fill');
 border-color: v-bind('STATUS_COLORS.neutral.border');
 border-width: 1px;
}
 
.label {
 font-size: 0.85rem;
 color: #1D1B20; /* on-surface */
 font-weight: 500;
}
 
/* Help Popover */
.help-popover {
  position: absolute;
  bottom: 100%; /* Appears above legend */
  left: 0;
  width: 260px;
  background: #313033; /* inverse-surface */
  color: #F4EFF4; /* inverse-on-surface */
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
  z-index: 100;
  box-shadow: 0 4px 8px rgba(0,0,0,0.2);
}
 
.popover-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  border-bottom: 1px solid rgba(255,255,255,0.2);
  padding-bottom: 4px;
}
 
.popover-title {
  font-weight: 600;
  font-size: 13px;
  color: #D0BCFF; /* inverse-primary */
}
 
.close-btn {
  background: transparent;
  border: none;
  color: #F4EFF4; /* inverse-on-surface */
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}
 
.popover-body p {
  margin: 0 0 6px 0;
  font-size: 12px;
  line-height: 1.4;
}
 
.sub-desc {
  opacity: 0.8;
  font-style: italic;
}
 
.stat-footer {
  margin-top: 8px;
  font-size: 12px;
  text-align: right;
  color: #D0BCFF; /* inverse-primary */
}
 
/* Shim for backdrop click */
.shim {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 90;
  background: transparent;
}
 
.fade-enter-active,
.fade-leave-active {
 transition: opacity 0.2s ease, transform 0.2s ease;
}
 
.fade-enter-from,
.fade-leave-to {
 opacity: 0;
 transform: translateY(10px);
}
</style>
 
