// The real item library: the starter models from local-assets/ (see its README).
//
// deskObjects.json is a copy of local-assets/desk-objects.json with each
// model's body color (`baseColor`) added. The GLBs themselves live in
// public/models/ and are already in cm, centered on x/z, sitting on y = 0,
// facing +z, at their exact catalog size.
import { useGLTF } from '@react-three/drei'
import GlbItem from '../scene/GlbItem.jsx'
import catalog from './deskObjects.json'

const modelUrl = (entry) => `${import.meta.env.BASE_URL}${entry.modelPath}`

// Alternate colors offered next to each model's own color.
const PALETTE = [
  { name: 'Charcoal', value: '#292e3d' },
  { name: 'Cream', value: '#eeeae1' },
  { name: 'Mint', value: '#88bea9' },
  { name: 'Pink', value: '#d992aa' },
  { name: 'Oak', value: '#b98762' },
]

// Things on the floor instead of the desk.
const FLOOR_ITEMS = new Set(['desktop-tower'])

// Snap spots for items whose category words would otherwise mislead the
// keyword guess in src/scene/spots.js (e.g. "Computers & displays" reads as a monitor).
const SPOTS = {
  'laptop-open': ['front-center', 'front-left', 'back-left', 'return'],
  'laptop-closed': ['front-center', 'front-left', 'back-left', 'return'],
  tablet: ['front-left', 'front-corner-left'],
  'mini-pc': ['back-corner-right', 'back-corner-left', 'back-right', 'back-left'],
  'desktop-tower': ['beside-right', 'beside-left', 'under-right', 'under-left'],
  'mouse-pad': ['front-right', 'front-left'],
}

function colorOptions(baseColor) {
  return [
    { name: 'Original', value: baseColor },
    ...PALETTE.filter((color) => color.value !== baseColor),
  ]
}

export const ASSETS = catalog.objects.map((entry) => {
  const { width, height, depth } = entry.dimensionsCm
  return {
    id: entry.id,
    name: entry.name,
    category: entry.category,
    placement: FLOOR_ITEMS.has(entry.id) ? 'floor' : 'desk',
    size: { width, depth, height },
    colorOptions: colorOptions(entry.baseColor),
    price: null,
    buyLinks: [],
    vendor: null,
    ...(SPOTS[entry.id] && { spots: SPOTS[entry.id] }),
    modelUrl: modelUrl(entry),
    baseColor: entry.baseColor,
    Model: GlbItem,
  }
})

// The models are small (~1.7 MB total), so fetch them all up front; then
// items appear instantly when dropped in.
for (const entry of catalog.objects) useGLTF.preload(modelUrl(entry))
