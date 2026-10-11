// TEMPORARY stand-ins so placement can be built and tested before the real
// item library (src/assets/registry.js) exists. Once registry.js is added,
// src/assets/library.js uses it instead and this file can be deleted.
//
// Sizes are in cm: width (x), depth (z), height (y).

const placeholder = (fields) => ({ price: null, buyLinks: [], vendor: null, ...fields })

export const PLACEHOLDER_ITEMS = [
  placeholder({
    id: 'placeholder-monitor',
    name: 'Monitor',
    category: 'Placeholders',
    placement: 'desk',
    size: { width: 61, depth: 20, height: 45 },
    colorOptions: ['#2c2d36', '#f4f4ef'],
  }),
  placeholder({
    id: 'placeholder-keyboard',
    name: 'Keyboard',
    category: 'Placeholders',
    placement: 'desk',
    size: { width: 44, depth: 14, height: 3 },
    colorOptions: ['#f4f4ef', '#2c2d36', '#ff9cc9'],
  }),
  placeholder({
    id: 'placeholder-mouse',
    name: 'Mouse',
    category: 'Placeholders',
    placement: 'desk',
    size: { width: 6, depth: 11, height: 4 },
    colorOptions: ['#f4f4ef', '#2c2d36'],
  }),
  placeholder({
    id: 'placeholder-desk-mat',
    name: 'Desk mat',
    category: 'Placeholders',
    placement: 'desk',
    size: { width: 80, depth: 30, height: 0.4 },
    colorOptions: ['#3b4a6b', '#c9a27e', '#86e3bb'],
  }),
  placeholder({
    id: 'placeholder-lamp',
    name: 'Desk lamp',
    category: 'Placeholders',
    placement: 'desk',
    size: { width: 15, depth: 15, height: 40 },
    colorOptions: ['#ffc93c', '#f4f4ef'],
  }),
  placeholder({
    id: 'placeholder-mug',
    name: 'Mug',
    category: 'Placeholders',
    placement: 'desk',
    size: { width: 9, depth: 9, height: 10 },
    colorOptions: ['#ff6b9a', '#f4f4ef', '#4fd1a5'],
  }),
  placeholder({
    id: 'placeholder-chair',
    name: 'Office chair',
    category: 'Placeholders',
    placement: 'floor',
    size: { width: 62, depth: 62, height: 110 },
    colorOptions: ['#2c2d36', '#ff9cc9'],
  }),
  placeholder({
    id: 'placeholder-pc-tower',
    name: 'PC tower',
    category: 'Placeholders',
    placement: 'floor',
    size: { width: 21, depth: 45, height: 47 },
    colorOptions: ['#2c2d36', '#f4f4ef'],
  }),
  placeholder({
    id: 'placeholder-rug',
    name: 'Rug',
    category: 'Placeholders',
    placement: 'floor',
    size: { width: 160, depth: 120, height: 1 },
    colorOptions: ['#e8b4a0', '#a3c9a8', '#f2e3c6'],
  }),
]
