// Tiny procedural pixel-art textures (16×16) for the blocky look. They're
// light grays on white, so a material's `color` tints them: one wood texture
// works for every desk material, one plaster texture for every paint color.
// Drawn with nearest-neighbor filtering, so the pixels stay crisp.
import { CanvasTexture, NearestFilter, RepeatWrapping, SRGBColorSpace } from 'three'

const SIZE = 16

// A tiny repeatable random number generator (same pixels on every visit).
function seededRandom(seed) {
  let value = seed
  return () => {
    value = (value * 16807) % 2147483647
    return value / 2147483647
  }
}

// How light each pixel is (0–1, where 1 = untinted), per pattern.
const PATTERNS = {
  // Horizontal grain: each row has its own shade, with a few darker knots.
  wood(random) {
    const rows = Array.from({ length: SIZE }, () => 0.86 + random() * 0.1)
    return (x, y) => {
      const knot = random() < 0.04 ? 0.08 : 0
      return rows[y] - knot - (y % 8 === 7 ? 0.08 : 0)
    }
  },
  // Plaster: almost flat, with a light speckle.
  plaster(random) {
    return () => 0.95 + random() * 0.05 - (random() < 0.08 ? 0.05 : 0)
  },
  // Square tiles with grout lines on two edges.
  tile(random) {
    return (x, y) => (x === 0 || y === 0 ? 0.78 : 0.94 + random() * 0.05)
  },
  // Carpet / rug: a noisy, checkered weave.
  carpet(random) {
    return (x, y) => ((x + y) % 2 === 0 ? 0.9 : 0.84) + random() * 0.06
  },
}

const cache = new Map()

// A shared texture for `pattern`. `repeat` is how many times it tiles across
// a 1×1 surface (set per material via texture.repeat when needed).
export function pixelTexture(pattern, seed = 3) {
  const key = `${pattern}:${seed}`
  if (cache.has(key)) return cache.get(key)

  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  const context = canvas.getContext('2d')
  const random = seededRandom(seed * 7919 + 1)
  const shade = PATTERNS[pattern](random)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const v = Math.round(Math.max(0, Math.min(1, shade(x, y))) * 255)
      context.fillStyle = `rgb(${v},${v},${v})`
      context.fillRect(x, y, 1, 1)
    }
  }

  const texture = new CanvasTexture(canvas)
  texture.magFilter = NearestFilter
  texture.minFilter = NearestFilter
  texture.generateMipmaps = false
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.colorSpace = SRGBColorSpace
  cache.set(key, texture)
  return texture
}

// A copy of a shared texture that tiles `x` × `y` times (textures share the
// pixels, so copies are cheap).
export function tiledTexture(pattern, x, y, seed) {
  const texture = pixelTexture(pattern, seed).clone()
  texture.repeat.set(x, y)
  texture.needsUpdate = true
  return texture
}
