import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ShareRoom } from '../components/ChallengeDialog.jsx'
import { BACKEND_READY, getRoom } from '../data/storage.js'

// /r/:code/share: where you land right after making a challenge room.
export default function SharePage() {
  const { code } = useParams()
  const [title, setTitle] = useState('')

  useEffect(() => {
    if (!BACKEND_READY) return
    let ignore = false
    getRoom(code)
      .then((room) => !ignore && room && setTitle(room.title))
      .catch(() => {})
    return () => {
      ignore = true
    }
  }, [code])

  return (
    <div className="share-page">
      <ShareRoom code={code} title={title} page />
    </div>
  )
}
