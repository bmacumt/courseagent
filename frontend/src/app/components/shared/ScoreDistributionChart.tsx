import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { ScoreDistributionResponse } from '../../api/types';

const COLORS = ['#4A6FA5', '#6B9E7A', '#D4A843', '#C46B6B', '#7A8F9E'];

interface Props {
  data: ScoreDistributionResponse;
}

export default function ScoreDistributionChart({ data }: Props) {
  const chartData = useMemo(() => {
    const ranges = Array.from({ length: 10 }, (_, i) => `${i * 10}-${(i + 1) * 10}`);
    return ranges.map(range => {
      const entry: Record<string, string | number> = { range };
      for (const g of data.grades) {
        const bucket = data.buckets.find(b => b.range === range && b.grade === g);
        entry[g] = bucket ? bucket.count : 0;
      }
      return entry;
    });
  }, [data]);

  if (data.grades.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 48, color: '#A4B0BE', fontSize: 14 }}>
        暂无成绩数据
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5" />
        <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#7F8C8D' }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#7F8C8D' }} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E8ECF0' }}
          formatter={(value: number, name: string) => [`${value} 人`, name]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {data.grades.map((g, i) => (
          <Bar key={g} dataKey={g} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
