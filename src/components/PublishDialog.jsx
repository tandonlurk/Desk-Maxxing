import { useEffect, useState } from 'react'
import TagPicker from './TagPicker.jsx'
import { MAX_TAGS } from '../assets/tags.js'
import { useAuth } from '../hooks/useAuth.js'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js'
import { BACKEND_READY, publishSetup, signInWithGitHub } from '../data/storage.js'
import { playSfx } from '../sfx.js'

// Share the current setup on the board: a picture of the 3D view (exactly as
// the camera shows it now), a title, a description, and tags.
export default function PublishDialog({ setup, takePicture, onPublished, onClose }) {
  const user = useAuth()
  const [picture, setPicture] = useState(null) // { blob, url }
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  // Wait two frames so the scene has redrawn (e.g. without the selection outline).
  useEffect(() => {
    let url = null
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(async () => {
        try {
          const blob = await takePicture()
          url = URL.createObjectURL(blob)
          setPicture({ blob, url })
        } catch (err) {
          setError(err.message)
        }
      })
    })
    return () => {
      cancelAnimationFrame(frame)
      if (url) URL.revokeObjectURL(url)
    }
  }, [takePicture])

  useKeyboardShortcuts((event) => {
    if (event.key === 'Escape' && !busy) onClose()
  })

  async function publish(event) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const id = await publishSetup({
        title: title.trim(),
        description: description.trim(),
        tags,
        setup,
        thumbnail: picture.blob,
      })
      playSfx('publish')
      onPublished(id)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  async function signIn() {
    try {
      await signInWithGitHub()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="modal-backdrop" onPointerDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <form className="modal panel" onSubmit={publish} aria-labelledby="publish-title">
        <div className="inspector-head">
          <h2 id="publish-title">Publish your setup</h2>
          <button type="button" className="icon-btn" onClick={onClose} disabled={busy} aria-label="Close">
            ×
          </button>
        </div>

        <div className="publish-preview">
          {picture ? <img src={picture.url} alt="Thumbnail of your setup" /> : <span>Taking a picture…</span>}
        </div>
        <p className="hint">This picture is your thumbnail. Want a different angle? Close this, move the camera, and publish again.</p>

        {!BACKEND_READY ? (
          <p className="notice">Publishing needs the backend, which isn&apos;t set up yet (see supabase/README.md).</p>
        ) : user === null ? (
          <div className="notice">
            <p>Sign in to publish. Your desk is saved, so you&apos;ll come right back to it.</p>
            <button type="button" className="btn btn-accent" onClick={signIn}>
              Sign in with GitHub
            </button>
          </div>
        ) : (
          <>
            <label className="field">
              <span className="field-label">Title</span>
              <input
                className="input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={60}
                placeholder="My cozy corner"
                required
                autoFocus
              />
            </label>
            <label className="field">
              <span className="field-label">Description (optional)</span>
              <textarea
                className="input"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={280}
                rows={2}
                placeholder="What makes it work for you?"
              />
            </label>
            <div className="field">
              <span className="field-label">
                Tags ({tags.length}/{MAX_TAGS}): help people find it and match it up in 1v1s
              </span>
              <TagPicker selected={tags} onChange={setTags} max={MAX_TAGS} label="Tags" />
            </div>
          </>
        )}

        {error && <p className="inspector-warning">{error}</p>}

        {BACKEND_READY && user && (
          <button type="submit" className="btn btn-accent" disabled={busy || !picture || !title.trim()}>
            {busy ? 'Publishing…' : 'Publish to the board'}
          </button>
        )}
      </form>
    </div>
  )
}
