import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Ícones do app instalável a partir de public/icon.svg (fundo preto, moldura dourada).
const fundo = { resizeOptions: { background: '#080b09' } }

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: { ...minimal2023Preset.maskable, ...fundo },
    apple: { ...minimal2023Preset.apple, ...fundo },
  },
  images: ['public/icon.svg'],
})
