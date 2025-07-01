import pluginVue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import stylisticTs from '@stylistic/eslint-plugin';
import tseslint from 'typescript-eslint';
export default tseslint.config(
    {
        ignores: [
            '**/dist/',
        ],
    },
    ...tseslint.configs.recommended,
    ...pluginVue.configs['flat/recommended'],
    {
        files: ['**/*.{js,ts,jsx,tsx,vue}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
        },
    },
    {
        files: ['**/*.{ts,tsx,vue}'],
        languageOptions: {
            parser: tseslint.parser,
        },
    },
    {
        files: ['**/*.vue'],
        languageOptions: {
            parser: vueParser,
            parserOptions: {
                parser: tseslint.parser,  // parse TS inside VUE
            },
        },
    },
    {
        name: 'sinkahome-config',
        plugins: {
            'stylistic': stylisticTs,
        },
        files: ['**/*.ts', '**/*.mjs', '**/*.vue', '**/*.js'],
        rules: {
            ...tseslint.configs.strictTypeChecked[0].rules,
            '@typescript-eslint/no-explicit-any': 'off',
            'semi': ['error', 'always'],
            'stylistic/indent': [
                'error',
                4
            ],
            'vue/html-indent': ['error', 4, {
                'attribute': 1,
                'baseIndent': 1,
                'closeBracket': 0,
                'alignAttributesVertically': true,
                'ignores': []
            }],
            'stylistic/quotes': [
                'error',
                'single',
                {
                    'avoidEscape': true
                }
            ],
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    'args': 'all',
                    'argsIgnorePattern': '^_',
                    'caughtErrors': 'all',
                    'caughtErrorsIgnorePattern': '^_',
                    'destructuredArrayIgnorePattern': '^_',
                    'varsIgnorePattern': '^_',
                    'ignoreRestSiblings': true
                }
            ],
            'no-restricted-syntax': 'off',
            'no-console': 'warn',
            'stylistic/member-delimiter-style': [
                'error',
                {
                    'multiline': {
                        'delimiter': 'semi',
                        'requireLast': true
                    },
                    'singleline': {
                        'delimiter': 'semi',
                        'requireLast': true
                    }
                }
            ],
            '@typescript-eslint/no-empty-object-type': 'off'
        }
    }
);