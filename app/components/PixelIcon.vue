<template>
  <svg
    class="pixel-icon"
    :viewBox="`0 0 ${icon.size} ${icon.size}`"
    shape-rendering="crispEdges"
    aria-hidden="true"
  >
    <path
      v-for="layer in icon.layers"
      :key="layer.tone"
      :class="layer.tone"
      :d="layer.path"
    />
  </svg>
</template>

<script lang="ts">
/**
 * Hand-drawn icons on a square pixel grid. `#` is the icon colour (the current
 * text colour), `o` the dark outline, `+` a highlight, `-` a shadow and `.` empty.
 */
const ICONS = {
  heart: [
    '..ooo..ooo..',
    '.o###oo###o.',
    'o#++######-o',
    'o#+#######-o',
    'o#########-o',
    'o########--o',
    '.o######--o.',
    '..o####--o..',
    '...o##--o...',
    '....o#-o....',
    '.....oo.....',
    '............'
  ],
  star: [
    '.....oo.....',
    '....o##o....',
    '....o+#o....',
    'oooo+###oooo',
    'o#+#######-o',
    '.o#######-o.',
    '..o#####-o..',
    '..o#####-o..',
    '.o###oo##-o.',
    '.o##o..o#-o.',
    'o##o....o#-o',
    'ooo......ooo'
  ],
  sword: [
    '........oooo',
    '.......o++#o',
    '......o+###o',
    '.....o+###o.',
    '.oo.o+###o..',
    'o##o+###o...',
    'o###o##o....',
    '.o####o.....',
    '..o###oo....',
    '.o#oo###o...',
    'o#o..o##o...',
    'oo....ooo...'
  ],
  crown: [
    '............',
    '.o...oo...o.',
    'o#o.o##o.o#o',
    'o#o.o##o.o#o',
    'o##o####o##o',
    'o#+#######-o',
    'o#+#######-o',
    'o#########-o',
    'oooooooooooo',
    'o#+######--o',
    'oooooooooooo',
    '............'
  ],
  plus: [
    '..###..',
    '..###..',
    '#######',
    '#######',
    '#######',
    '..###..',
    '..###..'
  ],
  chevrons: [
    '..........',
    '##...##...',
    '.##...##..',
    '..##...##.',
    '...##...##',
    '...##...##',
    '..##...##.',
    '.##...##..',
    '##...##...',
    '..........'
  ],
  crosshair: [
    '....#....',
    '..#####..',
    '.#..#..#.',
    '.#.....#.',
    '###.#.###',
    '.#.....#.',
    '.#..#..#.',
    '..#####..',
    '....#....'
  ],
  arrows: [
    '.....##.....',
    '....####....',
    '...######...',
    '..#......#..',
    '.##......##.',
    '###......###',
    '###......###',
    '.##......##.',
    '..#......#..',
    '...######...',
    '....####....',
    '.....##.....'
  ],
  counter: [
    '............',
    '...#........',
    '..##........',
    '.#########..',
    '##########..',
    '.#########..',
    '..##....###.',
    '...#....###.',
    '........###.',
    '..#########.',
    '..########..',
    '............'
  ]
} satisfies Record<string, string[]>

export type PixelIconName = keyof typeof ICONS

const LAYERS = [
  { tone: 'pixel-icon-fill', cells: '#+-' },
  { tone: 'pixel-icon-ink', cells: 'o' },
  { tone: 'pixel-icon-light', cells: '+' },
  { tone: 'pixel-icon-shade', cells: '-' }
]

/** Traces every horizontal run of the given cell characters as a one-pixel-high rectangle. */
function buildPath(rows: readonly string[], cells: string): string {
  let path = ''

  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (!cells.includes(row[x] ?? '.')) continue

      let width = 1
      while (cells.includes(row[x + width] ?? '.')) width++
      path += `M${x} ${y}h${width}v1h-${width}z`
      x += width - 1
    }
  })

  return path
}

const RENDERED = Object.fromEntries(
  Object.entries(ICONS).map(([name, rows]) => [name, {
    size: rows.length,
    layers: LAYERS
      .map(({ tone, cells }) => ({ tone, path: buildPath(rows, cells) }))
      .filter(layer => layer.path)
  }])
) as Record<PixelIconName, { size: number, layers: { tone: string, path: string }[] }>
</script>

<script setup lang="ts">
const props = defineProps<{ name: PixelIconName }>()

const icon = computed(() => RENDERED[props.name])
</script>

<style>
.pixel-icon {
  display: inline-block;
  width: 1em;
  height: 1em;
  flex: 0 0 auto;
  fill: currentcolor;
}

.pixel-icon-ink {
  fill: var(--pixel-icon-ink, #17171f);
}

.pixel-icon-light {
  fill: #fff;
  fill-opacity: 0.6;
}

.pixel-icon-shade {
  fill: #000;
  fill-opacity: 0.25;
}
</style>
