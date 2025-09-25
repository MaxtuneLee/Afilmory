// @ts-check
import { globalIgnores } from 'eslint/config'
import { defineConfig } from 'eslint-config-hyoban'

export default defineConfig(
  {
    formatting: false,
    lessOpinionated: true,
    preferESM: false,
    react: true,
    tailwindCSS: true,
  },

  {
    settings: {
      tailwindcss: {
        whitelist: ['center'],
      },
    },
    rules: {
      'unicorn/prefer-math-trunc': 'off',
      'unicorn/no-static-only-class': 'off',
      '@eslint-react/no-clone-element': 0,
      // TailwindCSS v4 not support
      'tailwindcss/no-custom-classname': 0,
      '@eslint-react/hooks-extra/no-direct-set-state-in-use-effect': 0,
      // NOTE: Disable this temporarily
      'react-compiler/react-compiler': 0,
      'no-restricted-syntax': 0,
      'no-restricted-globals': [
        'error',
        {
          name: 'location',
          message:
            "Since you don't use the same router instance in electron and browser, you can't use the global location to get the route info. \n\n" +
            'You can use `useLocaltion` or `getReadonlyRoute` to get the route info.',
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },

  {
    files: ['**/*.tsx'],
    rules: {
      '@stylistic/jsx-self-closing-comp': 'error',
    },
  },

  globalIgnores(['dist']),
)
