// Everything the app saves or loads: the local draft (localStorage) and the
// shared board (Supabase). No other file touches either.
//
// Supabase is configured with VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
// in .env.local (see supabase/README.md). Without them the planner still works;
// only the board, publishing, and signing in are unavailable.
import { createClient } from '@supabase/supabase-js'
import { DEFAULT_DESK, normalizeDesk } from '../assets/deskOptions.js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
const supabase = url && key ? createClient(url, key) : null

export const BACKEND_READY = Boolean(supabase)

const DRAFT_KEY = 'desk-maxxing:draft'
const VOTER_KEY = 'desk-maxxing:voter'
const THUMBNAILS = 'thumbnails'

// Card fields for the board (everything but the full setup).
const CARD_FIELDS = 'id, owner_id, title, description, tags, thumbnail_path, points, wins, losses, created_at, username, avatar_url'

function requireBackend() {
  if (!supabase) throw new Error('The board isn’t set up yet (see supabase/README.md).')
}

// Supabase returns { data, error }; turn errors into exceptions with the
// friendly message the database wrote.
function unwrap({ data, error }) {
  if (error) throw new Error(error.message)
  return data
}

// localStorage can throw (private mode, blocked storage), so every access is guarded.
function readLocal(name) {
  try {
    return JSON.parse(window.localStorage.getItem(name))
  } catch {
    return null
  }
}

function writeLocal(name, value) {
  try {
    window.localStorage.setItem(name, JSON.stringify(value))
  } catch {
    // Not being able to save a draft shouldn't break the planner.
  }
}

// A setup ({ desk, items }) from somewhere we don't control: fill in missing
// desk fields and drop anything that isn't an item.
export function readSetup(raw) {
  const desk = normalizeDesk({ ...DEFAULT_DESK, ...(raw?.desk || {}) })
  const items = (Array.isArray(raw?.items) ? raw.items : []).filter(
    (item) =>
      item &&
      typeof item.id === 'string' &&
      typeof item.assetId === 'string' &&
      Number.isFinite(item.position?.x) &&
      Number.isFinite(item.position?.z),
  )
  return { desk, items }
}

// ---------- Local draft ----------

export function loadDraft() {
  const draft = readLocal(DRAFT_KEY)
  return draft ? readSetup(draft) : null
}

export function saveDraft(setup) {
  writeLocal(DRAFT_KEY, setup)
}

// ---------- Signing in ----------

// Calls back with the signed-in user (or null) now and whenever it changes.
// Returns a function that stops listening.
export function onAuthChange(callback) {
  if (!supabase) {
    callback(null)
    return () => {}
  }
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(toUser(session?.user)))
  return () => data.subscription.unsubscribe()
}

function toUser(user) {
  if (!user) return null
  const meta = user.user_metadata || {}
  return {
    id: user.id,
    username: meta.user_name || meta.preferred_username || meta.name || 'desk-maxxer',
    avatarUrl: meta.avatar_url || null,
  }
}

// Goes to GitHub and comes back to the current page.
export async function signInWithGitHub() {
  requireBackend()
  unwrap(await supabase.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: window.location.href } }))
}

export async function signOut() {
  requireBackend()
  unwrap(await supabase.auth.signOut())
}

// ---------- The board ----------

function thumbnailUrl(path) {
  return path ? supabase.storage.from(THUMBNAILS).getPublicUrl(path).data.publicUrl : null
}

function toCard(row) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    description: row.description,
    tags: row.tags,
    thumbnailUrl: thumbnailUrl(row.thumbnail_path),
    thumbnailPath: row.thumbnail_path,
    points: row.points,
    wins: row.wins,
    losses: row.losses,
    createdAt: row.created_at,
    username: row.username,
    avatarUrl: row.avatar_url,
    ...(row.setup && { setup: readSetup(row.setup) }),
  }
}

// Published setups, newest or highest-ranked first, optionally only those with
// any of `tags`.
export async function listSetups({ tags = [], sort = 'top', offset = 0, limit = 24 } = {}) {
  requireBackend()
  let query = supabase.from('setup_cards').select(CARD_FIELDS)
  if (tags.length > 0) query = query.overlaps('tags', tags)
  query = sort === 'new' ? query.order('created_at', { ascending: false }) : query.order('points', { ascending: false })
  const rows = unwrap(await query.order('id').range(offset, offset + limit - 1))
  return rows.map(toCard)
}

// One setup, including the desk and its items. Null if it doesn't exist.
export async function getSetup(id) {
  requireBackend()
  const row = unwrap(await supabase.from('setup_cards').select(`${CARD_FIELDS}, setup`).eq('id', id).maybeSingle())
  return row ? toCard(row) : null
}

// Uploads the thumbnail, then saves the setup. Returns the new setup's id.
export async function publishSetup({ title, description, tags, setup, thumbnail }) {
  requireBackend()
  const { data } = await supabase.auth.getUser()
  if (!data.user) throw new Error('Sign in to publish.')

  const extension = thumbnail.type.split('/')[1] || 'png'
  const path = `${data.user.id}/${window.crypto.randomUUID()}.${extension}`
  unwrap(await supabase.storage.from(THUMBNAILS).upload(path, thumbnail, { contentType: thumbnail.type }))

  const result = await supabase
    .from('setups')
    .insert({ title, description, tags, setup, thumbnail_path: path })
    .select('id')
    .single()
  if (result.error) await supabase.storage.from(THUMBNAILS).remove([path])
  return unwrap(result).id
}

export async function deleteSetup(card) {
  requireBackend()
  unwrap(await supabase.from('setups').delete().eq('id', card.id))
  if (card.thumbnailPath) await supabase.storage.from(THUMBNAILS).remove([card.thumbnailPath])
}

// ---------- 1v1 ----------

// Signed-out voters are told apart by a random id kept in this browser.
function voterKey() {
  let id = readLocal(VOTER_KEY)
  if (typeof id !== 'string' || !/^[A-Za-z0-9-]{16,64}$/.test(id)) {
    id = window.crypto.randomUUID()
    writeLocal(VOTER_KEY, id)
  }
  return id
}

// Two setups to compare (or fewer, when there's no pair left to vote on).
export async function getMatchup(tags = []) {
  requireBackend()
  const rows = unwrap(await supabase.rpc('get_matchup', { filter_tags: tags, anon_key: voterKey() }))
  return rows.map(toCard)
}

// Returns { delta, winnerPoints, loserPoints }.
export async function castVote(winnerId, loserId) {
  requireBackend()
  return unwrap(await supabase.rpc('cast_vote', { winner: winnerId, loser: loserId, anon_key: voterKey() }))
}
