"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function ActivityChart({ data }: { data: Array<{ date: string; runs: number; daily: number }> }) {
  return (
    <div className="relative">
      <div className="chart-sweep absolute inset-0 z-0" aria-hidden="true" />
      <div className="relative z-10">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#e86f3a" stopOpacity={0.55} />
                <stop offset="95%" stopColor="#e86f3a" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="activityStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#c64a1f" />
                <stop offset="55%" stopColor="#e86f3a" />
                <stop offset="100%" stopColor="#ffb088" />
              </linearGradient>
              <filter id="activityGlow" x="-20%" y="-50%" width="140%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <CartesianGrid stroke="#24281f" strokeDasharray="1 0" />
            <XAxis dataKey="date" stroke="#8d877e" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis stroke="#8d877e" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={28} />
            <Tooltip
              contentStyle={{
                background: "#101311",
                border: "1px solid #3a2a1f",
                color: "#f4f1e8",
                boxShadow: "0 0 18px rgba(233,120,72,0.25)",
                fontSize: "0.78rem",
              }}
              cursor={{ stroke: "#e86f3a", strokeWidth: 1.5, strokeDasharray: "4 3", opacity: 0.85 }}
            />
            <Area
              type="monotone"
              dataKey="runs"
              stroke="url(#activityStroke)"
              strokeWidth={2.4}
              fill="url(#activityFill)"
              filter="url(#activityGlow)"
              isAnimationActive
              animationDuration={1200}
              animationEasing="ease-out"
              activeDot={{ r: 5, fill: "#e86f3a", stroke: "#fff6ed", strokeWidth: 1.5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function MiniBarChart({ data }: { data: Array<{ day: string; runs: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="miniBarFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffb088" />
            <stop offset="55%" stopColor="#e86f3a" />
            <stop offset="100%" stopColor="#7d371f" />
          </linearGradient>
        </defs>
        <XAxis dataKey="day" stroke="#8d877e" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{
            background: "#101311",
            border: "1px solid #3a2a1f",
            color: "#f4f1e8",
            fontSize: "0.76rem",
          }}
          cursor={{ fill: "rgba(233,120,72,0.08)" }}
        />
        <Bar
          dataKey="runs"
          fill="url(#miniBarFill)"
          radius={[2, 2, 0, 0]}
          isAnimationActive
          animationDuration={900}
          animationEasing="ease-out"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
