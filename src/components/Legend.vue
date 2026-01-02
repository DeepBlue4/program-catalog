<script setup>
</script>

<template>
  <div class="legend-container m3-card elevated">
    <h3 class="legend-title">Program Status Key</h3>
    <div class="legend-item">
      <span class="dot effort"></span>
      <span class="label">Program with Efforts</span>
    </div>
    <div class="legend-item">
      <span class="dot parent"></span>
      <span class="label">Parent Program</span>
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
  /* Program with Efforts -> Blue Dot */
  background-color: var(--md-sys-color-primary);
  border-color: var(--md-sys-color-primary);
}

.dot.parent {
  /* Parent -> Outlined Blue */
  background-color: var(--md-sys-color-surface);
  border-color: var(--md-sys-color-primary);
  border-width: 2px;
}

.dot.neutral {
  /* Neutral -> Light Grey */
  background-color: #E0E0E0;
  border-color: #BDBDBD;
  border-width: 1px;
}

.label {
  font-size: 0.85rem;
  color: var(--md-sys-color-on-surface);
}
</style>

