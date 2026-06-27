'use strict';

// Flat ESLint config (ESLint 9+/10). Self-contained — no plugin dependencies.
module.exports = [
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: {
                // Browser
                document: 'readonly',
                window: 'readonly',
                // Node (test runner + module export guard)
                module: 'writable',
                require: 'readonly',
                console: 'readonly',
                process: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': ['error', { args: 'after-used' }],
            'no-undef': 'error',
            'no-var': 'error',
            'prefer-const': 'error',
            'eqeqeq': ['error', 'smart'],
            'no-implicit-globals': 'error',
            'no-shadow': 'error',
            'curly': ['error', 'multi-line'],
        },
    },
    {
        // Test runner and config are Node CommonJS modules (module-scoped, not global).
        files: ['**/*.test.js', 'eslint.config.js'],
        languageOptions: {
            sourceType: 'commonjs',
        },
    },
    {
        ignores: ['node_modules/**'],
    },
];
