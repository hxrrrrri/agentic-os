"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function ActivityChart({ data }: { data: Array<{ date: string; runs: number; daily: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#e86f3a" stopOpacity={0.45} />
            <stop offset="95%" stopColor="#e86f3a" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#24281f" strokeDasharray="1 0" />
        <XAxis dataKey="date" stroke="#6f6a61" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
        <YAxis stroke="#6f6a61" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={26} />
        <Tooltip contentStyle={{ background: "#101311", border: "1px solid #2a302c", color: "#f4f1e8" }} />
        <Area type="monotone" dataKey="runs" stroke="#e86f3a" strokeWidth={2} fill="url(#activityFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function MiniBarChart({ data }: { data: Array<{ day: string; runs: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={112}>
      <BarChart data={data}>
        <XAxis dataKey="day" stroke="#6f6a61" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ background: "#101311", border: "1px solid #2a302c", color: "#f4f1e8" }} />
        <Bar dataKey="runs" fill="#e86f3a" radius={0} />
      </BarChart>
    </ResponsiveContainer>
  );
}
