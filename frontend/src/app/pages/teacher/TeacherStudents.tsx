import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { User, Loader2, TrendingUp } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts';
import * as teacherApi from '../../api/teacher';
import type { StudentListItem } from '../../api/types';

export default function TeacherStudents() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    teacherApi.getTeacherStudents().then(setStudents).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 64, color: '#7F8C8D' }}><Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 12px', display: 'block' }} />加载中...</div>;
  }

  if (students.length === 0) {
    return (
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#2C3E50', marginBottom: 24 }}>学伴分析</h1>
        <div style={{ textAlign: 'center', padding: 80 }}>
          <User size={48} color="#E8ECF0" style={{ margin: '0 auto 16px', display: 'block' }} />
          <div style={{ fontSize: 17, fontWeight: 500, color: '#A4B0BE', marginBottom: 8 }}>暂无学生数据</div>
          <div style={{ fontSize: 13, color: '#C0C8D0' }}>发布作业并有学生提交后，即可查看学情分析</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: '#2C3E50', marginBottom: 24 }}>学伴分析</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {students.map(s => {
          const radarData = s.dimension_averages.map(d => ({
            dimension: d.label,
            score: Math.round(d.avg_score),
            fullMark: 100,
          }));
          const getScoreColor = (v: number) => v >= 80 ? '#6B9E7A' : v >= 60 ? '#4A6FA5' : v >= 40 ? '#D4A843' : '#C46B6B';
          return (
            <div
              key={s.student_id}
              onClick={() => navigate(`/teacher/students/${s.student_id}/profile`)}
              style={{
                background: '#FFFFFF', borderRadius: 12, border: '1px solid #E8ECF0',
                padding: '16px 20px', cursor: 'pointer', transition: 'box-shadow 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', background: '#4A6FA5',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: 14, fontWeight: 600, flexShrink: 0,
                }}>
                  {(s.real_name || s.username).charAt(0)}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#2C3E50', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.real_name || s.username}
                  </div>
                  <div style={{ fontSize: 12, color: '#7F8C8D' }}>
                    {s.class_name && `${s.class_name} · `}{s.submission_count} 份提交
                  </div>
                </div>
              </div>

              {radarData.length > 0 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#E8ECF0" />
                    <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 9, fill: '#7F8C8D' }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar dataKey="score" stroke="#4A6FA5" fill="#4A6FA5" fillOpacity={0.15} strokeWidth={1.5} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#C0C8D0' }}>
                  暂无评分数据
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #F0F2F5', paddingTop: 10, marginTop: 4 }}>
                <span style={{ fontSize: 12, color: '#7F8C8D' }}>平均分</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: getScoreColor(s.average_score) }}>
                  <TrendingUp size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  {s.average_score > 0 ? s.average_score.toFixed(1) : '-'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
