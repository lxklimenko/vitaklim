'use client'

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

export default function Chart({ data }: any) {
  const formatted = data.map((d: any) => ({
    ...d,
    day: new Date(d.day).toLocaleDateString(),
    revenue: d.revenue ?? 0,
  }))

  return (
    <div className="bg-[#141414] border border-white/10 rounded-2xl p-6">
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