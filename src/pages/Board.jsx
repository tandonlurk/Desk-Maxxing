import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Segmented from '../components/Segmented.jsx'
import TagPicker from '../components/TagPicker.jsx'
import SetupCard from '../components/SetupCard.jsx'
import Versus from '../components/Versus.jsx'
import { TackIcon } from '../components/TackButton.jsx'
import { BACKEND_READY, listSetups, topOfWeek } from '../data/storage.js'

const MODES = [
  { id: 'browse', name: 'Browse' },
  { id: 'week', name: 'Top this week' },
  { id: '1v1', name: '1v1' },
]

const SORTS = [
  { id: 'tacks', name: 'Most tacked' },
  { id: 'new', name: 'New' },
  { id: 'top', name: '1v1 pts' },
]

const PAGE_SIZE = 24

// The inspiration board: everyone's published setups, filtered by tags and
// ranked by thumbtacks. "Top this week" counts only this week's tacks.
// 1v1 mode shows two at a time to vote on, which earns 1v1 points.
// Mode, tags, and sort live in the URL so a filtered board can be shared.
export default function Board() {
  const [params, setParams] = useSearchParams()
  const mode = MODES.some((m) => m.id === params.get('mode')) ? params.get('mode') : 'browse'
  const sort = SORTS.some((s) => s.id === params.get('sort')) ? params.get('sort') : 'tacks'
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
        <Segmented label="Board mode" options={MODES} value={mode} onChange={(id) => setParam('mode', id === 'browse' ? null : id)} />
        {mode === 'browse' && (
          <Segmented label="Sort" options={SORTS} value={sort} onChange={(id) => setParam('sort', id === 'tacks' ? null : id)} />
        )}
      </div>

      {mode === 'week' ? (
        <TopOfWeek />
      ) : (
        <>
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
        </>
      )}
    </div>
  )
}

// This week's most-tacked setups, ranked.
function TopOfWeek() {
  const [cards, setCards] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let ignore = false
    topOfWeek(PAGE_SIZE)
      .then((found) => !ignore && setCards(found))
      .catch((err) => !ignore && setError(err.message))
    return () => {
      ignore = true
    }
  }, [])

  if (error) return <p className="inspector-warning">{error}</p>
  if (!cards) return <p className="hint">Counting tacks…</p>
  return (
    <>
      <p className="week-intro">
        <TackIcon size={20} /> Tack the setups you love. The most tacked since Monday rise to the top, and it starts over
        every week.
      </p>
      {cards.length === 0 ? (
        <div className="board-empty panel">
          <h2>No tacks yet this week</h2>
          <p>
            Go <Link to="/explore">browse</Link> and tack your favorites.
          </p>
        </div>
      ) : (
        <div className="masonry">
          {cards.map((card, index) => (
            <SetupCard key={card.id} card={card} index={index} rank={index + 1} />
          ))}
        </div>
      )}
    </>
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
          Be the first: build a desk in the <Link to="/plan">planner</Link> and hit Publish.
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
