import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, TrendingUp, Award, BookOpen, AlertTriangle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import * as studentApi from '../../api/student';
import * as teacherApi from '../../api/teacher';
import * as adminApi from '../../api/admin';
import type { StudentProfileResponse } from '../../api/types';
import { MarkdownRenderer } from '../../components/shared/MarkdownRenderer';

export default function StudentProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StudentProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedDim, setExpandedDim] = useState<string | null>(null);

  const isOtherView = !!id;

  useEffect(() => {
    const load = async () => {
      try {
        let data: StudentProfileResponse;
        if (id) {
          // Determine role from path
          const path = window.location.pathname;
          if (path.startsWith('/admin/')) {
            data = await adminApi.getAdminStudentProfile(parseInt(id));
          } else {
            data = await teacherApi.getTeacherStudentProfile(parseInt(id));
          }
        } else {
          data = await studentApi.getStudentProfile();
        }
        setProfile(data);
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 64, color: '#7F8C8D' }}><Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 12px', display: 'block' }} />加载中...</div>;
  }

  if (!profile || profile.graded_submissions === 0) {
    return (
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        {isOtherView && (
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7F8C8D', padding: '8px 0', marginBottom: 16 }}>
            <ArrowLeft size={20} />
          </button>
        )}
        <div style={{ textAlign: 'center', padding: 80 }}>
          <Award size={48} color="#E8ECF0" style={{ margin: '0 auto 16px', display: 'block' }} />
          <div style={{ fontSize: 17, fontWeight: 500, color: '#A4B0BE', marginBottom: 8 }}>暂无评分数据</div>
          <div style={{ fontSize: 13, color: '#C0C8D0' }}>完成更多作业后即可生成能力画像</div>
        </div>
      </div>
    );
  }

  const radarData = profile.dimension_averages.map(d => ({
    dimension: d.label,
    score: Math.round(d.avg_score),
    fullMark: 100,
  }));

  const getScoreColor = (s: number) => s >= 80 ? '#6B9E7A' : s >= 60 ? '#4A6FA5' : s >= 40 ? '#D4A843' : '#C46B6B';

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        {isOtherView && (
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7F8C8D', padding: 4 }}>
            <ArrowLeft size={20} />
          </button>
        )}
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#2C3E50', marginBottom: 2 }}>
            {isOtherView ? `${profile.real_name || profile.student_name} 的能力画像` : '我的能力画像'}
          </h1>
          {isOtherView && (
            <p style={{ fontSize: 13, color: '#7F8C8D' }}>
              {profile.grade && `${profile.grade} · `}{profile.class_name && `${profile.class_name} · `}已提交 {profile.graded_submissions} 份作业
            </p>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        {[
          { label: '总提交数', value: profile.total_submissions, color: '#4A6FA5', icon: BookOpen },
          { label: '已评分数', value: profile.graded_submissions, color: '#6B9E7A', icon: Award },
          { label: '平均分', value: profile.average_score.toFixed(1), color: getScoreColor(profile.average_score), icon: TrendingUp },
        ].map(item => (
          <div key={item.label} style={{ background: '#FFFFFF', borderRadius: 10, border: '1px solid #E8ECF0', padding: '16px 20px', flex: 1, textAlign: 'center' }}>
            <item.icon size={18} color={item.color} style={{ margin: '0 auto 6px', display: 'block' }} />
            <div style={{ fontSize: 24, fontWeight: 600, color: item.color }}>{item.value}</div>
            <div style={{ fontSize: 12, color: '#7F8C8D', marginTop: 4 }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Radar chart */}
        <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid #E8ECF0', padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ width: 4, height: 18, background: '#4A6FA5', borderRadius: 2 }} />
            <span style={{ fontSize: 15, fontWeight: 600, color: '#2C3E50' }}>能力雷达图</span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#E8ECF0" />
              <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12, fill: '#7F8C8D' }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Radar name="能力值" dataKey="score" stroke="#4A6FA5" fill="#4A6FA5" fillOpacity={0.2} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Right column: weak areas + advice */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Weak areas */}
          <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid #E8ECF0', padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <AlertTriangle size={16} color="#C46B6B" />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#2C3E50' }}>薄弱环节</span>
            </div>
            {profile.weak_dimensions.length > 0 ? profile.weak_dimensions.map(w => (
              <div key={w.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F7F8FA' }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#2C3E50', width: 80 }}>{w.label}</span>
                <div style={{ flex: 1, height: 6, background: '#F0F2F5', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${w.avg_score}%`, background: getScoreColor(w.avg_score), borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: getScoreColor(w.avg_score) }}>{w.avg_score}</span>
              </div>
            )) : (
              <div style={{ fontSize: 13, color: '#6B9E7A' }}>各维度表现均衡，无突出薄弱项</div>
            )}
          </div>

          {/* AI advice */}
          <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid #E8ECF0', padding: '20px 24px', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 4, height: 18, background: '#6B9E7A', borderRadius: 2 }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#2C3E50' }}>AI 学习建议</span>
            </div>
            <div style={{ background: '#F7F8FA', borderRadius: 8, padding: '14px 16px', fontSize: 13, lineHeight: 1.8 }}>
              <MarkdownRenderer content={profile.learning_advice} />
            </div>
          </div>
        </div>
      </div>

      {/* Score trend */}
      {profile.score_trend.length > 1 && (
        <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid #E8ECF0', padding: '20px 24px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ width: 4, height: 18, background: '#D4A843', borderRadius: 2 }} />
            <span style={{ fontSize: 15, fontWeight: 600, color: '#2C3E50' }}>成绩趋势</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={profile.score_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#7F8C8D' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#7F8C8D' }} />
              <Tooltip formatter={(v: number) => [`${v}`, '分数']} />
              <Line type="monotone" dataKey="score" stroke="#4A6FA5" strokeWidth={2} dot={{ fill: '#4A6FA5', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Dimension history */}
      {profile.dimension_history.length > 0 && (
        <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid #E8ECF0', padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ width: 4, height: 18, background: '#4A6FA5', borderRadius: 2 }} />
            <span style={{ fontSize: 15, fontWeight: 600, color: '#2C3E50' }}>各维度历史得分</span>
          </div>
          {profile.dimension_history.map(dim => {
            const isOpen = expandedDim === dim.name;
            const avg = dim.scores.length > 0 ? Math.round(dim.scores.reduce((s, x) => s + x.score, 0) / dim.scores.length) : 0;
            return (
              <div key={dim.name} style={{ borderBottom: '1px solid #F0F2F5' }}>
                <button
                  onClick={() => setExpandedDim(isOpen ? null : dim.name)}
                  style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer', gap: 10 }}
                >
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#2C3E50', width: 80 }}>{dim.label}</span>
                  <div style={{ flex: 1, height: 6, background: '#F0F2F5', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${avg}%`, background: getScoreColor(avg), borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: getScoreColor(avg), width: 40, textAlign: 'right' }}>{avg}</span>
                  {isOpen ? <ChevronUp size={14} color="#7F8C8D" /> : <ChevronDown size={14} color="#7F8C8D" />}
                </button>
                {isOpen && (
                  <div style={{ padding: '0 0 10px 90px' }}>
                    {dim.scores.map((s, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, fontSize: 12, color: '#7F8C8D', padding: '3px 0' }}>
                        <span>{s.date}</span>
                        <span style={{ color: getScoreColor(s.score), fontWeight: 500 }}>{s.score} 分</span>
                        <span style={{ color: '#A4B0BE' }}>{s.assignment_title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
