import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { User, Loader2, TrendingUp, BarChart3 } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts';
import * as teacherApi from '../../api/teacher';
import type { StudentListItem, AssignmentSummary, ScoreDistributionResponse } from '../../api/types';
import ScoreDistributionChart from '../../components/shared/ScoreDistributionChart';

export default function TeacherStudents() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showChart, setShowChart] = useState(false);
  const [assignments, setAssignments] = useState<AssignmentSummary[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<number | ''>('');
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [distData, setDistData] = useState<ScoreDistributionResponse | null>(null);
  const [distLoading, setDistLoading] = useState(false);

  const loadDistribution = useCallback(async () => {
    setDistLoading(true);
    try {
      const params: { assignment_id?: number; grade?: string } = {};
      if (selectedAssignment) params.assignment_id = selectedAssignment as number;
      if (selectedGrade) params.grade = selectedGrade;
      const data = await teacherApi.getTeacherScoreDistribution(params);
      setDistData(data);
    } catch {
      setDistData(null);
    } finally {
      setDistLoading(false);
    }
  }, [selectedAssignment, selectedGrade]);

  useEffect(() => {
    teacherApi.getTeacherStudents().then(setStudents).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (showChart) {
      teacherApi.getAssignments().then(setAssignments);
      loadDistribution();
    }
  }, [showChart, loadDistribution]);

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#2C3E50' }}>学伴分析</h1>
        <button
          onClick={() => setShowChart(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            border: `1px solid ${showChart ? '#4A6FA5' : '#E8ECF0'}`, borderRadius: 6,
            background: showChart ? '#EBF3FF' : '#FFFFFF', color: '#4A6FA5',
            cursor: 'pointer', fontSize: 13,
          }}
        >
          <BarChart3 size={15} /> {showChart ? '收起分布图' : '成绩分布'}
        </button>
      </div>

      {showChart && (
        <div style={{ background: '#FFFFFF', borderRadius: 10, border: '1px solid #E8ECF0', padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#2C3E50' }}>成绩分布</span>
            <select
              value={selectedAssignment}
              onChange={e => setSelectedAssignment(e.target.value ? Number(e.target.value) : '')}
              style={{ padding: '6px 12px', border: '1px solid #E8ECF0', borderRadius: 6, fontSize: 13, color: '#2C3E50', cursor: 'pointer' }}
            >
              <option value="">全部作业</option>
              {assignments.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
            </select>
            <select
              value={selectedGrade}
              onChange={e => setSelectedGrade(e.target.value)}
              style={{ padding: '6px 12px', border: '1px solid #E8ECF0', borderRadius: 6, fontSize: 13, color: '#2C3E50', cursor: 'pointer' }}
            >
              <option value="">全部年级</option>
              {Array.from(new Set(students.filter(s => s.grade).map(s => s.grade!))).sort().map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          {distLoading ? (
            <div style={{ textAlign: 'center', padding: 32, color: '#A4B0BE' }}>加载中...</div>
          ) : distData ? (
            <ScoreDistributionChart data={distData} />
          ) : (
            <div style={{ textAlign: 'center', padding: 32, color: '#A4B0BE' }}>暂无数据</div>
          )}
        </div>
      )}

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
                    {s.grade && `${s.grade} · `}{s.class_name && `${s.class_name} · `}{s.submission_count} 份提交
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
