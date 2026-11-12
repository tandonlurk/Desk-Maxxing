// Everything the app saves or loads: the local draft (localStorage) and the
// shared board (Supabase). No other file touches either.
//
// Supabase is configured with VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
// in .env.local (see supabase/README.md). Without them the planner still works;
// only the board, publishing, and signing in are unavailable.
import { createClient } from '@supabase/supabase-js'
import { normalizeSetup } from '../assets/setupShape.js'
import { DEFAULT_RULES, readRules } from '../assets/challengeRules.js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
const supabase = url && key ? createClient(url, key) : null

export const BACKEND_READY = Boolean(supabase)

const DRAFT_KEY = 'desk-maxxing:draft'
const ROOM_DRAFT_KEY = (code) => `desk-maxxing:draft:room:${code}`
const BG_KEY = 'desk-maxxing:bg'
const VOTER_KEY = 'desk-maxxing:voter'
const THUMBNAILS = 'thumbnails'

// Card fields for the board (everything but the full setup).
const CARD_FIELDS =
  'id, owner_id, title, description, tags, thumbnail_path, points, wins, losses, created_at, username, avatar_url, tacks, room_id, tacked_by_me'
const ROOM_FIELDS =
  'id, code, owner_id, title, brief, wishlist, thumbnail_path, winner_id, created_at, username, avatar_url, entry_count'

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

// A setup ({ room, desk, items, wallItems }) from somewhere we don't control:
// fill in anything missing and drop anything that isn't an item.
export function readSetup(raw) {
  return normalizeSetup(raw)
}

// ---------- Local draft ----------

// Your own planner draft, or (with a room code) your entry in progress for
// that room.
export function loadDraft(roomCode = null) {
  const draft = readLocal(roomCode ? ROOM_DRAFT_KEY(roomCode) : DRAFT_KEY)
  return draft ? readSetup(draft) : null
}

export function saveDraft(setup, roomCode = null) {
  writeLocal(roomCode ? ROOM_DRAFT_KEY(roomCode) : DRAFT_KEY, setup)
}

// The page backdrop the user picked (an id from assets/backgrounds.js).
export function loadBackground() {
  const id = readLocal(BG_KEY)
  return typeof id === 'string' ? id : 'sky'
}

export function saveBackground(id) {
  writeLocal(BG_KEY, id)
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
    // Guests signed in with just a nickname (no GitHub account linked yet).
    isGuest: Boolean(user.is_anonymous),
  }
}

// Play as a guest: just a nickname, no account. (Supabase anonymous
// sign-in; the nickname becomes the profile's username.)
export async function signInAsGuest(nickname) {
  requireBackend()
  const name = nickname.trim()
  if (!name) throw new Error('Pick a name first.')
  unwrap(await supabase.auth.signInAnonymously({ options: { data: { user_name: name } } }))
}

// Change your name (shown on everything you've published).
export async function rename(nickname) {
  requireBackend()
  const name = unwrap(await supabase.rpc('set_username', { name: nickname }))
  unwrap(await supabase.auth.updateUser({ data: { user_name: name } }))
  return name
}

// Guests can keep their account (and everything they made) by linking
// GitHub. Goes to GitHub and comes back here.
export async function linkGitHub() {
  requireBackend()
  unwrap(await supabase.auth.linkIdentity({ provider: 'github', options: { redirectTo: window.location.href } }))
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
    tacks: row.tacks ?? 0,
    tackedByMe: Boolean(row.tacked_by_me),
    roomId: row.room_id ?? null,
    ...(row.setup && { setup: readSetup(row.setup) }),
  }
}

// Published setups, newest or highest-ranked first, optionally only those with
// any of `tags`.
export async function listSetups({ tags = [], sort = 'top', offset = 0, limit = 24 } = {}) {
  requireBackend()
  let query = supabase.from('setup_cards').select(CARD_FIELDS)
  if (tags.length > 0) query = query.overlaps('tags', tags)
  const orderBy = { new: 'created_at', tacks: 'tacks' }[sort] || 'points'
  query = query.order(orderBy, { ascending: false })
  const rows = unwrap(await query.order('id').range(offset, offset + limit - 1))
  return rows.map(toCard)
}

// One setup, including the desk and its items. Null if it doesn't exist.
export async function getSetup(id) {
  requireBackend()
  const row = unwrap(await supabase.from('setup_cards').select(`${CARD_FIELDS}, setup`).eq('id', id).maybeSingle())
  return row ? toCard(row) : null
}

async function currentUserId(message = 'Sign in to publish.') {
  const { data } = await supabase.auth.getUser()
  if (!data.user) throw new Error(message)
  return data.user.id
}

// Uploads a picture into your own folder. Returns its path.
async function uploadThumbnail(userId, thumbnail) {
  const extension = thumbnail.type.split('/')[1] || 'png'
  const path = `${userId}/${window.crypto.randomUUID()}.${extension}`
  unwrap(await supabase.storage.from(THUMBNAILS).upload(path, thumbnail, { contentType: thumbnail.type }))
  return path
}

// Uploads the thumbnail, then saves the setup. Returns the new setup's id.
// With a `roomId`, it's your entry for that room: submitting again updates
// your entry instead of making a second one.
export async function publishSetup({ title, description, tags, setup, thumbnail, roomId = null }) {
  requireBackend()
  const userId = await currentUserId()
  const path = await uploadThumbnail(userId, thumbnail)
  const fields = { title, description, tags, setup, thumbnail_path: path }

  const existing = roomId
    ? unwrap(
        await supabase.from('setups').select('id, thumbnail_path').eq('room_id', roomId).eq('owner_id', userId).maybeSingle(),
      )
    : null

  const result = existing
    ? await supabase.from('setups').update(fields).eq('id', existing.id).select('id').single()
    : await supabase
        .from('setups')
        .insert({ ...fields, ...(roomId && { room_id: roomId }) })
        .select('id')
        .single()
  if (result.error) {
    await supabase.storage.from(THUMBNAILS).remove([path])
    unwrap(result)
  }
  if (existing?.thumbnail_path) await supabase.storage.from(THUMBNAILS).remove([existing.thumbnail_path])
  return result.data.id
}

export async function deleteSetup(card) {
  requireBackend()
  unwrap(await supabase.from('setups').delete().eq('id', card.id))
  if (card.thumbnailPath) await supabase.storage.from(THUMBNAILS).remove([card.thumbnailPath])
}

// ---------- Thumbtacks ----------

// Tack a setup, or take your tack back. Returns { tacked, tacks }.
export async function toggleTack(setupId) {
  requireBackend()
  return unwrap(await supabase.rpc('toggle_tack', { target: setupId }))
}

// This week's most-tacked setups, each with `weekTacks`.
export async function topOfWeek(limit = 24) {
  requireBackend()
  const ranking = unwrap(await supabase.rpc('top_of_week', { lim: limit }))
  if (ranking.length === 0) return []
  const rows = unwrap(
    await supabase
      .from('setup_cards')
      .select(CARD_FIELDS)
      .in(
        'id',
        ranking.map((entry) => entry.setup_id),
      ),
  )
  const byId = new Map(rows.map((row) => [row.id, row]))
  return ranking
    .filter((entry) => byId.has(entry.setup_id))
    .map((entry) => ({ ...toCard(byId.get(entry.setup_id)), weekTacks: entry.week_tacks }))
}

// ---------- Challenge rooms ----------

function toRoom(row) {
  return {
    id: row.id,
    code: row.code,
    ownerId: row.owner_id,
    title: row.title,
    brief: row.brief,
    wishlist: readWishlist(row.wishlist),
    thumbnailUrl: thumbnailUrl(row.thumbnail_path),
    thumbnailPath: row.thumbnail_path,
    winnerId: row.winner_id,
    createdAt: row.created_at,
    username: row.username,
    avatarUrl: row.avatar_url,
    entryCount: row.entry_count ?? 0,
    rules: readRules(row.rules),
    ...(row.base && { base: readSetup(row.base) }),
  }
}

// [{ assetId, label, qty }]: assetId is a library item, or null for a
// free-text wish like "somewhere for my guitar".
export function readWishlist(raw) {
  return (Array.isArray(raw) ? raw : [])
    .filter((wish) => wish && typeof wish.label === 'string' && wish.label.trim())
    .map((wish) => ({
      assetId: typeof wish.assetId === 'string' ? wish.assetId : null,
      label: wish.label.trim().slice(0, 60),
      qty: Math.min(9, Math.max(1, Math.round(Number(wish.qty) || 1))),
    }))
    .slice(0, 30)
}

// Start a challenge: your current setup becomes the base. Returns the room's code.
export async function createRoom({ title, brief, wishlist, base, thumbnail, rules = DEFAULT_RULES }) {
  requireBackend()
  const userId = await currentUserId('Pick a name (or sign in) to start a challenge.')
  const path = await uploadThumbnail(userId, thumbnail)
  const result = await supabase
    .from('rooms')
    .insert({ title, brief, wishlist: readWishlist(wishlist), base, thumbnail_path: path, rules: readRules(rules) })
    .select('code')
    .single()
  if (result.error) await supabase.storage.from(THUMBNAILS).remove([path])
  return unwrap(result).code
}

// One room, including its base. Null if there's no room with that code.
export async function getRoom(code) {
  requireBackend()
  const row = unwrap(
    await supabase.from('room_cards').select(`${ROOM_FIELDS}, base, rules`).eq('code', code.toLowerCase()).maybeSingle(),
  )
  return row ? toRoom(row) : null
}

// Just a room's code and title, for "made for …" links.
export async function getRoomLink(roomId) {
  requireBackend()
  return unwrap(await supabase.from('rooms').select('code, title').eq('id', roomId).maybeSingle())
}

// Remember that you're in this room (shows up under My rooms).
export async function joinRoom(roomId) {
  requireBackend()
  unwrap(await supabase.from('room_members').upsert({ room_id: roomId }, { onConflict: 'room_id,user_id', ignoreDuplicates: true }))
}

// The entries in a room, most tacked first.
export async function listEntries(roomId) {
  requireBackend()
  const rows = unwrap(
    await supabase
      .from('setup_cards')
      .select(CARD_FIELDS)
      .eq('room_id', roomId)
      .order('tacks', { ascending: false })
      .order('created_at'),
  )
  return rows.map(toCard)
}

// The creator picks the winning entry (or null to un-pick).
export async function crownEntry(roomId, setupId) {
  requireBackend()
  unwrap(await supabase.from('rooms').update({ winner_id: setupId }).eq('id', roomId))
}

// Rooms you made, then rooms you joined, newest first.
export async function listMyRooms() {
  requireBackend()
  const userId = await currentUserId('Pick a name (or sign in) to see your rooms.')
  const joined = unwrap(await supabase.from('room_members').select('room_id').eq('user_id', userId))
  const ids = joined.map((row) => row.room_id)
  const [mine, others] = await Promise.all([
    supabase.from('room_cards').select(ROOM_FIELDS).eq('owner_id', userId).order('created_at', { ascending: false }),
    ids.length > 0
      ? supabase.from('room_cards').select(ROOM_FIELDS).in('id', ids).neq('owner_id', userId).order('created_at', { ascending: false })
      : { data: [], error: null },
  ])
  return { created: unwrap(mine).map(toRoom), joined: unwrap(others).map(toRoom) }
}

export async function deleteRoom(room) {
  requireBackend()
  unwrap(await supabase.from('rooms').delete().eq('id', room.id))
  if (room.thumbnailPath) await supabase.storage.from(THUMBNAILS).remove([room.thumbnailPath])
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
