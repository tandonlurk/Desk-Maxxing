// Serves the app's index.html for /r/:code with link-preview tags filled in
// from that challenge room, so a pasted link shows "Fix my setup" (not the
// generic site title) in iMessage, Discord, Slack, etc. Crawlers don't run
// JavaScript, so the tags have to be in the HTML we send.
const escape = (text) =>
  String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

async function lookupRoom(code) {
  const base = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!base || !key || !/^[a-z0-9]{6}$/i.test(code)) return null
  const query = `code=eq.${code.toLowerCase()}&select=title,brief,thumbnail_path,username&limit=1`
  const response = await fetch(`${base}/rest/v1/room_cards?${query}`, { headers: { apikey: key } })
  if (!response.ok) return null
  const [room] = await response.json()
  return room ?? null
}

export default async function handler(req, res) {
  const origin = `https://${req.headers.host}`
  const code = String(req.query.code || '')
  const page = await fetch(`${origin}/index.html`)
  let html = await page.text()

  try {
    const room = await lookupRoom(code)
    if (room) {
      const base = process.env.VITE_SUPABASE_URL
      const image = room.thumbnail_path
        ? `${base}/storage/v1/object/public/thumbnails/${room.thumbnail_path}`
        : `${origin}/og-image.png`
      const description = `@${room.username} needs your help: "${room.title}". Tap to redesign their desk.`
      const tags = [
        ['og:title', 'Fix my setup'],
        ['og:description', description],
        ['og:image', image],
        ['og:url', `${origin}/r/${code}`],
        ['og:type', 'website'],
      ]
        .map(([name, value]) => `<meta property="${name}" content="${escape(value)}" />`)
        .concat([
          '<meta name="twitter:card" content="summary_large_image" />',
          '<meta name="twitter:title" content="Fix my setup" />',
          `<meta name="twitter:description" content="${escape(description)}" />`,
          `<meta name="twitter:image" content="${escape(image)}" />`,
        ])
        .join('\n    ')
      // Drop the generic tags, then add the room's.
      html = html
        .replace(/<title>.*?<\/title>/s, '<title>Fix my setup</title>')
        .replace(/\s*<meta (property="og:[^>]*|name="twitter:[^>]*)\/>/g, '')
        .replace('</head>', `    ${tags}\n  </head>`)
    }
  } catch {
    // Fall through with the plain page.
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
  res.status(200).send(html)
}
