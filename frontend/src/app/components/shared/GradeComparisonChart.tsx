import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { GradeComparisonItem } from '../../api/types';

interface Props {
  data: GradeComparisonItem[];
}

export default function GradeComparisonChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 48, color: '#A4B0BE', fontSize: 14 }}>
        暂无评分数据
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5" />
        <XAxis dataKey="grade" tick={{ fontSize: 12, fill: '#2C3E50' }} />
        <YAxis
          yAxisId="left"
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: '#4A6FA5' }}
          label={{ value: '平均分', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#4A6FA5' } }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: '#C46B6B' }}
          label={{ value: '低分率 (%)', angle: 90, position: 'insideRight', style: { fontSize: 12, fill: '#C46B6B' } }}
          tickFormatter={(v: number) => `${v}%`}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E8ECF0' }}
          formatter={(value: number, name: string) => {
            if (name === '平均分') return [value.toFixed(1), name];
            return [`${value.toFixed(1)}%`, name];
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar yAxisId="left" dataKey="avg_score" name="平均分" fill="#4A6FA5" radius={[3, 3, 0, 0]} barSize={32} />
        <Bar yAxisId="right" dataKey="low_rate" name="低分率" fill="#C46B6B" radius={[3, 3, 0, 0]} barSize={32} />
      </BarChart>
    </ResponsiveContainer>
  );
}
