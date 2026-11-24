// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'
import betterTailwindcss from 'eslint-plugin-better-tailwindcss'
import { getDefaultAttributes } from 'eslint-plugin-better-tailwindcss/api/defaults'
import eslintConfigPrettier from 'eslint-config-prettier/flat'

export default withNuxt(
  betterTailwindcss.configs['correctness-error'],
  {
    rules: {
      'vue/block-order': ['error', {
        order: ['template', 'script', 'style']
      }],
      'better-tailwindcss/no-unknown-classes': ['error', {
        ignore: ['^(game-|board-|monster-|spawn-|spell-|pixel-|empty-mark$|eyebrow$|turn-|play-area$|control-|swipe-hint$|legend-dot|merge-note$)']
      }]
    },
    settings: {
      'better-tailwindcss': {
        entryPoint: 'app/assets/css/main.css',
        attributes: [
          ...getDefaultAttributes(),
          ['^v-bind:ui$', [{ match: 'objectValues' }]]
        ]
      }
    }
  },
  eslintConfigPrettier
)
