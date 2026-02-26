'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts'

export default function UsersChart({ data }: any) {
  const formatted = data.map((d: any) => ({
    ...d,
    day: new Date(d.day).toLocaleDateString(),
  }))

  return (
    <div className="bg-[#141414] border border-white/10 rounded-2xl p-6">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={formatted}>
          <CartesianGrid stroke="#222" />
          <XAxis dataKey="day" stroke="#888" />
          <YAxis stroke="#888" />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="active_users"
            stroke="#3b82f6"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}