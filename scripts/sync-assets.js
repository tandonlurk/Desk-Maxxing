// Copies the item models from ../local-assets (built there with
// `node local-assets/build-models.mjs`) into the app:
//   - every GLB into public/models/
//   - the catalog into src/assets/deskObjects.json, adding each model's body
//     color as `baseColor` (the color the in-app color picker repaints)
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'

const app = new URL('../', import.meta.url)
const source = new URL('../local-assets/', app)

// GLB = 12-byte header, then a JSON chunk (4-byte length, 4-byte type, data).
function readGltfJson(glb) {
  const length = glb.readUInt32LE(12)
  return JSON.parse(glb.subarray(20, 20 + length).toString())
}

// glTF stores colors in linear space; the app works in sRGB hex.
function linearToHex(channels) {
  const toByte = (c) => {
    const srgb = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055
    return Math.round(Math.min(1, Math.max(0, srgb)) * 255)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${channels.slice(0, 3).map(toByte).join('')}`
}

// The body color is the color of the model's first part.
function baseColorOf(gltf) {
  const root = gltf.nodes[gltf.scenes[0].nodes[0]]
  const firstPart = gltf.nodes[root.children[0]]
  const material = gltf.materials[gltf.meshes[firstPart.mesh].primitives[0].material]
  return linearToHex(material.pbrMetallicRoughness.baseColorFactor)
}

const catalog = JSON.parse(await readFile(new URL('desk-objects.json', source)))
await mkdir(new URL('public/models/', app), { recursive: true })

for (const entry of catalog.objects) {
  const from = new URL(entry.modelPath, source)
  await copyFile(from, new URL(`public/${entry.modelPath}`, app))
  entry.baseColor = baseColorOf(readGltfJson(await readFile(from)))
}

await writeFile(new URL('src/assets/deskObjects.json', app), `${JSON.stringify(catalog, null, 2)}\n`)
console.log(`sync-assets: copied ${catalog.objects.length} models from local-assets.`)
