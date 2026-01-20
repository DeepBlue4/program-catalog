import pluginVue from 'eslint-plugin-vue'
import vueTsEslintConfig from '@vue/eslint-config-typescript'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

export default [
    {
        name: 'app/files-to-lint',
        files: ['**/*.{js,mjs,jsx,ts,tsx,vue}'],
    },

    {
        name: 'app/files-to-ignore',
        ignores: ['**/dist/**', '**/dist-ssr/**', '**/coverage/**'],
    },

    ...pluginVue.configs['flat/essential'],
    ...vueTsEslintConfig(),
    {
        rules: {
            'vue/block-lang': 'off',
            'vue/multi-word-component-names': 'off',
        }
    },
    skipFormatting,
]
