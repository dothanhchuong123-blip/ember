import { useId, useState } from 'react'
import { MAX_QUESTION_CHARS } from '../ask'
import './ask-box.css'

// C6 Ask box: free-text question → /api/ask, with a saved-answer fallback handled by the parent.
// Code written with SI assistance (Claude Code) during the event; see AI-USE.md.

const EXAMPLES = [
  'Would acrylic plastic burn in a Moon habitat?',
  'What is known about fuel droplets in an airplane cabin?',
  'Which gas flame tests are closest to hospital oxygen?',
]

export function AskBox({ busy, onAsk }: { busy: boolean; onAsk: (question: string) => void }) {
  const [text, setText] = useState('')
  const inputId = useId()
  const hintId = useId()
  const question = text.trim()

  return (
    <form className="ask-box" aria-busy={busy}
      onSubmit={(event) => {
        event.preventDefault()
        if (question && !busy) onAsk(question)
      }}>
      <label htmlFor={inputId}>Ask your own question</label>
      <div className="ask-row">
        <input id={inputId} type="text" value={text} maxLength={MAX_QUESTION_CHARS} autoComplete="off"
          placeholder="Name a place and a material" aria-describedby={hintId}
          onChange={(event) => setText(event.target.value)} />
        <button type="submit" className="button ask-submit" disabled={!question || busy}>
          {busy ? 'Looking…' : 'Ask'}
        </button>
      </div>
      <p id={hintId} className="ask-hint">
        Answers use only the NASA records and sources on this page. If the live service is off, you get the closest saved answer.
      </p>
      <ul className="ask-examples" aria-label="Example questions">
        {EXAMPLES.map((example) => (
          <li key={example}>
            <button type="button" disabled={busy} onClick={() => { setText(example); onAsk(example) }}>{example}</button>
          </li>
        ))}
      </ul>
    </form>
  )
}
