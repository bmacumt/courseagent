import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Clock, User, CheckCircle, ChevronRight, AlertTriangle, RefreshCw } from 'lucide-react';
import * as studentApi from '../../api/student';
import type { StudentAssignment } from '../../api/types';

export default function AssignmentList() {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    studentApi.getStudentAssignments()
      .then(data => setAssignments(data))
      .catch(err => {
        console.error('获取作业列表失败:', err);
        alert('获取作业列表失败，请稍后重试');
      })
      .finally(() => setLoading(false));
  }, []);

  const formatDeadline = (d: string | null) => {
    if (!d) return null;
    const date = new Date(d);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const dateStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    if (diff < 0) return { label: `${dateStr}（已截止）`, color: '#C46B6B', isOverdue: true };
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const urgency = days <= 3 ? '#D4A843' : '#7F8C8D';
    return { label: dateStr, color: urgency, isOverdue: false };
  };

  const pending = assignments.filter(a => !a.has_submitted);
  const failed = assignments.filter(a => a.has_submitted && a.latest_status === 'failed');
  const completed = assignments.filter(a => a.has_submitted && a.latest_status !== 'failed');

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 64, color: '#A4B0BE', fontSize: 14 }}>加载中...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#2C3E50', marginBottom: 4 }}>我的作业</h1>
        <p style={{ fontSize: 13, color: '#7F8C8D' }}>共 {assignments.length} 份已发布作业</p>
      </div>

      {pending.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ width: 4, height: 16, background: '#D4A843', borderRadius: 2 }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#2C3E50' }}>待完成</span>
            <span style={{ background: '#FFF8E6', color: '#D4A843', borderRadius: 12, padding: '1px 8px', fontSize: 12 }}>{pending.length}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
            {pending.map(a => {
              const dl = formatDeadline(a.deadline);
              return (
                <div key={a.id} style={{
                  background: '#FFFFFF', borderRadius: 10, border: '1px solid #E8ECF0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden',
                  transition: 'box-shadow 0.2s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)')}
                >
                  <div style={{ height: 4, background: '#4A6FA5' }} />
                  <div style={{ padding: '18px 20px' }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#2C3E50', marginBottom: 8 }}>{a.title}</div>
                    <div style={{ fontSize: 13, color: '#7F8C8D', lineHeight: 1.6, marginBottom: 14, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {a.description}
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#A4B0BE', marginBottom: 16 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <User size={12} /> {a.teacher_name}
                      </span>
                      {dl && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: dl.color }}>
                          <Clock size={12} /> {dl.label}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => navigate(`/student/assignments/${a.id}/submit`)}
                      style={{
                        width: '100%', padding: '9px 0', border: 'none', borderRadius: 7,
                        background: '#4A6FA5', color: '#FFFFFF', cursor: 'pointer', fontSize: 14,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}
                    >
                      去答题 <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {failed.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ width: 4, height: 16, background: '#C46B6B', borderRadius: 2 }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#2C3E50' }}>评分失败</span>
            <span style={{ background: '#FFEAEA', color: '#C46B6B', borderRadius: 12, padding: '1px 8px', fontSize: 12 }}>{failed.length}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
            {failed.map(a => {
              const dl = formatDeadline(a.deadline);
              return (
                <div key={a.id} style={{
                  background: '#FFFFFF', borderRadius: 10, border: '1px solid #FFCCCC',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden',
                }}>
                  <div style={{ height: 4, background: '#C46B6B' }} />
                  <div style={{ padding: '18px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: '#2C3E50' }}>{a.title}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#FFEAEA', color: '#C46B6B', borderRadius: 4, padding: '2px 8px', fontSize: 12 }}>
                        <AlertTriangle size={11} /> 评分失败
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: '#7F8C8D', lineHeight: 1.6, marginBottom: 14, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {a.description}
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#A4B0BE', marginBottom: 16 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <User size={12} /> {a.teacher_name}
                      </span>
                      {dl && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: dl.color }}>
                          <Clock size={12} /> {dl.label}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => navigate(`/student/assignments/${a.id}/submit`)}
                      style={{
                        width: '100%', padding: '9px 0', border: 'none', borderRadius: 7,
                        background: '#D4A843', color: '#FFFFFF', cursor: 'pointer', fontSize: 14,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}
                    >
                      <RefreshCw size={14} /> 重新提交
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {completed.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ width: 4, height: 16, background: '#6B9E7A', borderRadius: 2 }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#2C3E50' }}>已完成</span>
            <span style={{ background: '#EDFAF2', color: '#6B9E7A', borderRadius: 12, padding: '1px 8px', fontSize: 12 }}>{completed.length}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
            {completed.map(a => {
              const dl = formatDeadline(a.deadline);
              return (
                <div key={a.id} style={{
                  background: '#FFFFFF', borderRadius: 10, border: '1px solid #E8ECF0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden', opacity: 0.85,
                }}>
                  <div style={{ height: 4, background: '#6B9E7A' }} />
                  <div style={{ padding: '18px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: '#2C3E50' }}>{a.title}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#EDFAF2', color: '#6B9E7A', borderRadius: 4, padding: '2px 8px', fontSize: 12 }}>
                        <CheckCircle size={11} /> 已提交
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: '#7F8C8D', lineHeight: 1.6, marginBottom: 14, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {a.description}
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#A4B0BE', marginBottom: 16 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <User size={12} /> {a.teacher_name}
                      </span>
                      {dl && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: dl.color }}>
                          <Clock size={12} /> {dl.label}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => navigate('/student/submissions')}
                      style={{
                        width: '100%', padding: '9px 0', border: '1px solid #E8ECF0', borderRadius: 7,
                        background: '#FFFFFF', color: '#7F8C8D', cursor: 'pointer', fontSize: 14,
                      }}
                    >
                      查看提交
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
