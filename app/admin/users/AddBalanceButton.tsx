'use client'

import { useState } from 'react'

export default function AddBalanceButton({ userId }: { userId: string }) {
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const handleAdd = async () => {
    const num = parseInt(amount)
    if (!num || num <= 0) return
    setLoading(true)
    const res = await fetch('/api/admin/add-balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, amount: num, message })
    })
    if (res.ok) {
      setSuccess(true)
      setAmount('')
      setMessage('')
      setExpanded(false)
      setTimeout(() => setSuccess(false), 2000)
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="🍌"
          className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[12px] text-white focus:outline-none"
        />
        <button
          onClick={() => setExpanded(!expanded)}
          className="px-2 py-1 rounded-lg text-[12px] bg-white/5 hover:bg-white/10 text-white/40 transition"
          title="Добавить сообщение"
        >
          ✉️
        </button>
        <button
          onClick={handleAdd}
          disabled={loading || !amount}
          className={`px-2 py-1 rounded-lg text-[12px] font-medium transition ${
            success ? 'bg-green-500/20 text-green-400' : 'bg-white/5 hover:bg-white/10 text-white/60 disabled:opacity-30'
          }`}
        >
          {success ? '✓' : loading ? '...' : '+'}
        </button>
      </div>

      {expanded && (
        <input
          type="text"
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Сообщение пользователю..."
          className="w-48 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none placeholder:text-white/20"
        />
      )}
    </div>
  )
}
