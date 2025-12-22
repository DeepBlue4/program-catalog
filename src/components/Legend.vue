<script setup>
</script>

<template>
  <div class="legend-container m3-card elevated">
    <h3 class="legend-title">Program Status Key</h3>
    <div class="legend-item">
      <span class="dot effort"></span>
      <span class="label">Software Effort</span>
    </div>
    <div class="legend-item">
      <span class="dot parent"></span>
      <span class="label">Parent of Effort</span>
    </div>
    <div class="legend-item">
      <span class="dot neutral"></span>
      <span class="label">Neutral Program</span>
    </div>
  </div>
</template>

<style scoped>
.legend-container {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 200px;
}

.legend-title {
  margin: 0 0 0.25rem 0;
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--md-sys-color-secondary);
  letter-spacing: 0.5px;
  font-weight: 500;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid transparent;
}

/* Match OrgChart M3 Styles */
.dot.effort {
  background-color: var(--md-sys-color-tertiary-container);
  border-color: var(--md-sys-color-tertiary);
}

.dot.parent {
  background-color: var(--md-sys-color-surface);
  border-color: var(--md-sys-color-primary);
  border-width: 3px;
}

.dot.neutral {
  background-color: var(--md-sys-color-primary);
  border-color: var(--md-sys-color-primary); /* Filled */
}

.label {
  font-size: 0.85rem;
  color: var(--md-sys-color-on-surface);
}
</style>

