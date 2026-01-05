export const STATUS_COLORS = {
    active: {
        id: 'active',
        label: 'Software Effort Active',
        fill: '#005AC1',   // primary
        border: '#005AC1', // primary
        text: '#FFFFFF',   // onPrimary (for tags)
        bg: '#005AC1'      // primary (for tags)
    },
    gap: {
        id: 'gap',
        label: 'Expected (Missing)',
        fill: '#FFDAD6',   // errorContainer
        border: '#BA1A1A', // error
        text: '#410002',   // onErrorContainer
        bg: '#FFDAD6'      // errorContainer (for tags)
    },
    parent: {
        id: 'parent',
        label: 'Parent of Effort',
        fill: '#D8E2FF',   // primaryContainer
        border: '#005AC1', // primary
        text: '#001D35',   // onPrimaryContainer
        bg: '#D8E2FF'      // primaryContainer (for tags)
    },
    neutral: {
        id: 'neutral',
        label: 'Neutral Program',
        fill: '#E0E0E0',   // neutral light
        border: '#BDBDBD', // neutral dark
        text: '#1D1B20',   // onSurface
        bg: '#E0E0E0'      // surfaceVariant (for tags)
    }
};

export const RAW_COLORS = {
    primary: '#005AC1',
    secondary: '#625B71',
    tertiary: '#755B00',
    tertiaryContainer: '#FFDF90',
    neutral: '#575E71',
    surface: '#FEF7FF',
    error: '#BA1A1A',
    errorContainer: '#FFDAD6',
    primaryContainer: '#D8E2FF'
};
