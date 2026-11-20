import { useState } from 'react'
import { supabase } from './supabase'
import Canvas from './Canvas'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const makeCode = () =>
  Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('')

export default function App() {
  const [code, setCode] = useState<string | null>(localStorage.getItem('space-code'))
  const [input, setInput] = useState('')
  const [error, setError] = useState('')

  const enter = (c: string) => {
    localStorage.setItem('space-code', c)
    setCode(c)
  }

  const leave = () => {
    localStorage.removeItem('space-code')
    setCode(null)
  }

  const join = async () => {
    const c = input.trim().toUpperCase()
    if (!c) return
    const { data, error } = await supabase.from('spaces').select('code').eq('code', c).maybeSingle()
    if (error) return setError(error.message)
    if (!data) return setError('No space with that code')
    enter(c)
  }

  const create = async () => {
    const c = makeCode()
    const { error } = await supabase.from('spaces').insert({ code: c })
    if (error) return setError(error.message)
    enter(c)
  }

  if (code) return <Canvas code={code} onLeave={leave} />

  return (
    <div className="join">
      <input
        value={input}
        onChange={(e) => {
          setInput(e.target.value)
          setError('')
        }}
        onKeyDown={(e) => e.key === 'Enter' && join()}
        placeholder="Space code"
        maxLength={6}
        autoFocus
      />
      <button onClick={join}>Join</button>
      <span className="or">or</span>
      <button onClick={create}>New space</button>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
