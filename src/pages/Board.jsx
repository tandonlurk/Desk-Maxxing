import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Segmented from '../components/Segmented.jsx'
import TagPicker from '../components/TagPicker.jsx'
import SetupCard from '../components/SetupCard.jsx'
import Versus from '../components/Versus.jsx'
import { BACKEND_READY, listSetups } from '../data/storage.js'

const MODES = [
  { id: 'browse', name: 'Browse' },
  { id: '1v1', name: '1v1' },
]

const SORTS = [
  { id: 'top', name: 'Top' },
  { id: 'new', name: 'New' },
]

const PAGE_SIZE = 24

// The inspiration board: everyone's published setups, filtered by tags.
// 1v1 mode shows two at a time to vote on, which is what ranks them.
// Mode, tags, and sort live in the URL so a filtered board can be shared.
export default function Board() {
  const [params, setParams] = useSearchParams()
  const mode = params.get('mode') === '1v1' ? '1v1' : 'browse'
  const sort = params.get('sort') === 'new' ? 'new' : 'top'
  const tags = (params.get('tags') || '').split(',').filter(Boolean)

  function setParam(name, value) {
    const next = new URLSearchParams(params)
    if (value) next.set(name, value)
    else next.delete(name)
    setParams(next, { replace: true })
  }

  if (!BACKEND_READY) {
    return (
      <div className="board">
        <div className="board-empty panel">
          <h2>The board isn&apos;t connected yet</h2>
          <p>It needs a Supabase project. Follow supabase/README.md, then restart the dev server.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="board">
      <div className="board-head">
        <h1>Inspiration board</h1>
        <Segmented label="Board mode" options={MODES} value={mode} onChange={(id) => setParam('mode', id === '1v1' ? id : null)} />
        {mode === 'browse' && (
          <Segmented label="Sort" options={SORTS} value={sort} onChange={(id) => setParam('sort', id === 'new' ? id : null)} />
        )}
      </div>

      <div className="board-tags">
        <span className="toolbar-label">{mode === '1v1' ? 'Match me up on' : 'Show'}</span>
        <TagPicker selected={tags} onChange={(next) => setParam('tags', next.join(','))} label="Filter by tags" />
        {tags.length > 0 && (
          <button type="button" className="btn btn-small" onClick={() => setParam('tags', null)}>
            Clear
          </button>
        )}
      </div>

      {mode === '1v1' ? <Versus tags={tags} /> : <Browse tags={tags} sort={sort} />}
    </div>
  )
}

function Browse({ tags, sort }) {
  const [cards, setCards] = useState([])
  const [status, setStatus] = useState('loading') // loading | ready | more | error
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState(null)
  const tagsKey = tags.join(',')

  useEffect(() => {
    let ignore = false
    setStatus('loading')
    listSetups({ tags: tagsKey ? tagsKey.split(',') : [], sort, limit: PAGE_SIZE })
      .then((page) => {
        if (ignore) return
        setCards(page)
        setHasMore(page.length === PAGE_SIZE)
        setStatus('ready')
      })
      .catch((err) => {
        if (ignore) return
        setError(err.message)
        setStatus('error')
      })
    return () => {
      ignore = true
    }
  }, [tagsKey, sort])

  async function loadMore() {
    setStatus('more')
    try {
      const page = await listSetups({ tags, sort, offset: cards.length, limit: PAGE_SIZE })
      setCards((list) => [...list, ...page])
      setHasMore(page.length === PAGE_SIZE)
      setStatus('ready')
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  if (status === 'error') return <p className="inspector-warning">{error}</p>
  if (status === 'loading') return <p className="hint">Loading setups…</p>
  if (cards.length === 0) {
    return (
      <div className="board-empty panel">
        <h2>{tags.length > 0 ? 'Nothing with those tags yet' : 'No setups yet'}</h2>
        <p>
          Be the first: build a desk in the <Link to="/">planner</Link> and hit Publish.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="masonry">
        {cards.map((card, index) => (
          <SetupCard key={card.id} card={card} index={index % PAGE_SIZE} />
        ))}
      </div>
      {hasMore && (
        <button type="button" className="btn load-more" onClick={loadMore} disabled={status === 'more'}>
          {status === 'more' ? 'Loading…' : 'Load more'}
        </button>
      )}
    </>
  )
}
