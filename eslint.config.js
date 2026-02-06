//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'
import reactPlugin from 'eslint-plugin-react'

export default [
  ...tanstackConfig,
  {
    ignores: [
      'eslint.config.js',
      'prettier.config.js',
      '.output/**',
      'node_modules/**',
    ],
  },
  {
    plugins: {
      react: reactPlugin,
    },
    rules: {
      // 禁止未使用的变量/导入，支持自动修复（删除未使用的声明）
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: true,
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
        },
      ],
      // 允许自动修复未使用的变量
      'no-unused-vars': [
        'error',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: true,
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
        },
      ],
      // 禁止使用特定的 HTML 标签，避免默认样式污染布局
      'react/forbid-elements': [
        'error',
        {
          forbid: ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span'],
        },
      ],
    },
  },
]
