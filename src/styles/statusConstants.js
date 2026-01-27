export const STATUS_COLORS = {
  active: {
    id: "active",
    label: "Software Program Active",
    fill: "#005AC1", // primary
    border: "#005AC1", // primary
    text: "#FFFFFF", // onPrimary (for tags)
    bg: "#005AC1", // primary (for tags)
  },
  gap: {
    id: "gap",
    label: "Expected Software Program (Missing)",
    fill: "#FFDAD6", // errorContainer
    border: "#BA1A1A", // error
    text: "#410002", // onErrorContainer
    bg: "#FFDAD6", // errorContainer (for tags)
  },
  parent: {
    id: "parent",
    label: "Parent of Software Program",
    fill: "#B3D4FF", // light blue
    border: "#0066CC", // medium blue
    text: "#003366", // dark blue text
    bg: "#B3D4FF", // light blue (for tags)
  },
  neutral: {
    id: "neutral",
    label: "Neutral Program",
    fill: "#E0E0E0", // neutral light
    border: "#BDBDBD", // neutral dark
    text: "#1D1B20", // onSurface
    bg: "#E0E0E0", // surfaceVariant (for tags)
  },
};

export const STATUS_HELP = {
  active: {
    title: "Software Assigned",
    desc: "A program that is expecting software efforts and currently has one or more assigned.",
    context: "These programs are actively tracking software work.",
  },
  gap: {
    title: "Expected (Missing)",
    desc: "A program flagged to expect software efforts but currently has none assigned.",
    context:
      "Action Required: These programs represent a gap in data or assignment.",
  },
  parent: {
    title: "Parent of Effort",
    desc: "A program that contains sub-programs with assigned software efforts.",
    context:
      "These function as organizational containers or oversight for software efforts below.",
  },
  neutral: {
    title: "Neutral Program",
    desc: "A program not expecting software efforts and has no descendants expecting them.",
    context: "Included primarily for organizational hierarchy and structure.",
  },
};

export const RAW_COLORS = {
  primary: "#005AC1",
  secondary: "#625B71",
  tertiary: "#755B00",
  tertiaryContainer: "#FFDF90",
  neutral: "#575E71",
  surface: "#FEF7FF",
  error: "#BA1A1A",
  errorContainer: "#FFDAD6",
  primaryContainer: "#D8E2FF",
};
