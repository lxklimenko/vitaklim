'use client'

import { useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from 'recharts'

export default function Chart({ chart7, chart30 }: any) {
  const [range, setRange] = useState<'7' | '30'>('7')

  const rawData = range === '7' ? chart7 : chart30

  const formatted = rawData?.map((d: any) => ({
    ...d,
    day: new Date(d.day).toLocaleDateString(),
    revenue: d.revenue ?? 0,
  }))

  return (
    <div className="bg-[#141414] border border-white/10 rounded-2xl p-6">
      
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setRange('7')}
          className={`px-4 py-2 rounded-xl ${
            range === '7' ? 'bg-white text-black' : 'bg-white/10'
          }`}
        >
          7 дней
        </button>

        <button
          onClick={() => setRange('30')}
          className={`px-4 py-2 rounded-xl ${
            range === '30' ? 'bg-white text-black' : 'bg-white/10'
          }`}
        >
          30 дней
        </button>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={formatted}>
          <CartesianGrid stroke="#222" />
          <XAxis dataKey="day" stroke="#888" />
          <YAxis stroke="#888" />
          <Tooltip />
          <Legend />

          <Line
            type="monotone"
            dataKey="total_generations"
            stroke="#ffffff"
            strokeWidth={2}
            name="Генерации"
          />

          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#22c55e"
            strokeWidth={2}
            name="Выручка"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}