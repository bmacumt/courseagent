import { ElementType } from 'react';
import { useNavigate } from 'react-router';
import { ClipboardList, CheckCircle, Loader2, Star, ChevronRight, Clock, BookOpen } from 'lucide-react';
import { mockAssignments, studentSubmissionsList } from '../../data/mockData';
import { StatusTag } from '../../components/shared/StatusTag';

function StatCard({ icon: Icon, label, value, color, onClick }: {
  icon: ElementType; label: string; value: number | string; color: string; onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#FFFFFF', borderRadius: 10, padding: '20px 24px',
        border: '1px solid #E8ECF0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        display: 'flex', alignItems: 'center', gap: 16,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.2s',
      }}
      onMouseEnter={e => onClick && (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)')}
    >
      <div style={{ width: 48, height: 48, borderRadius: 12, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={22} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 600, color: '#2C3E50', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 13, color: '#7F8C8D', marginTop: 4 }}>{label}</div>
      </div>
    </div>
  );
}

export default function StudentDashboard() {
  const navigate = useNavigate();
  const publishedAssignments = mockAssignments.filter(a => a.is_published);
  const pendingCount = publishedAssignments.filter((_, i) => i > 0).length; // simulate
  const completedCount = 1;
  const gradingCount = 0;
  const latestGraded = studentSubmissionsList.find(s => s.status === 'graded');

  const formatDeadline = (d: string | null) => {
    if (!d) return null;
    const date = new Date(d);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    if (diff < 0) return { label: '已截止', color: '#C46B6B' };
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return { label: '今日截止', color: '#D4A843' };
    if (days <= 3) return { label: `${days} 天后截止`, color: '#D4A843' };
    return { label: `${days} 天后截止`, color: '#A4B0BE' };
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#2C3E50', marginBottom: 4 }}>学习概览</h1>
        <p style={{ fontSize: 13, color: '#7F8C8D' }}>欢迎回来！查看您的学习进度</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        <StatCard icon={ClipboardList} label="待完成作业" value={pendingCount} color="#D4A843" onClick={() => navigate('/student/assignments')} />
        <StatCard icon={CheckCircle} label="已完成作业" value={completedCount} color="#6B9E7A" onClick={() => navigate('/student/submissions')} />
        <StatCard icon={Loader2} label="评分中" value={gradingCount} color="#4A6FA5" />
        <StatCard
          icon={Star}
          label="最新评分"
          value={latestGraded ? `${latestGraded.total_score} 分` : '—'}
          color="#D4A843"
          onClick={latestGraded ? () => navigate(`/student/reports/${latestGraded.id}`) : undefined}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Assignments */}
        <div style={{ background: '#FFFFFF', borderRadius: 10, border: '1px solid #E8ECF0' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0F2F5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClipboardList size={16} color="#4A6FA5" />
              <span style={{ fontSize: 15, fontWeight: 600, color: '#2C3E50' }}>最新作业</span>
            </div>
            <button onClick={() => navigate('/student/assignments')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4A6FA5', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
              全部 <ChevronRight size={14} />
            </button>
          </div>
          <div style={{ padding: '0 20px' }}>
            {publishedAssignments.slice(0, 3).map((a, i) => {
              const deadline = formatDeadline(a.deadline);
              const hasSubmitted = i === 0;
              return (
                <div key={a.id} style={{ padding: '14px 0', borderBottom: i < 2 ? '1px solid #F7F8FA' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#2C3E50', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</div>
                      {deadline && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: deadline.color }}>
                          <Clock size={11} /> {deadline.label}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => navigate(hasSubmitted ? '/student/submissions' : `/student/assignments/${a.id}/submit`)}
                      style={{
                        padding: '4px 12px', border: hasSubmitted ? '1px solid #E8ECF0' : 'none',
                        borderRadius: 5, background: hasSubmitted ? '#FFFFFF' : '#4A6FA5',
                        color: hasSubmitted ? '#7F8C8D' : '#FFFFFF', cursor: 'pointer', fontSize: 12, flexShrink: 0,
                      }}
                    >
                      {hasSubmitted ? '已提交' : '去答题'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* My submissions */}
        <div style={{ background: '#FFFFFF', borderRadius: 10, border: '1px solid #E8ECF0' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0F2F5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BookOpen size={16} color="#6B8F71" />
              <span style={{ fontSize: 15, fontWeight: 600, color: '#2C3E50' }}>我的提交</span>
            </div>
            <button onClick={() => navigate('/student/submissions')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4A6FA5', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
              全部 <ChevronRight size={14} />
            </button>
          </div>
          <div style={{ padding: '0 20px' }}>
            {studentSubmissionsList.length > 0 ? studentSubmissionsList.map((sub, i) => (
              <div key={sub.id} style={{ padding: '14px 0', borderBottom: i < studentSubmissionsList.length - 1 ? '1px solid #F7F8FA' : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#2C3E50', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.assignment_title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <StatusTag status={sub.status} />
                  </div>
                </div>
                {sub.status === 'graded' && (
                  <button
                    onClick={() => navigate(`/student/reports/${sub.id}`)}
                    style={{ padding: '4px 10px', border: '1px solid #E8ECF0', borderRadius: 5, background: '#FFFFFF', color: '#4A6FA5', cursor: 'pointer', fontSize: 12 }}
                  >
                    查看报告
                  </button>
                )}
              </div>
            )) : (
              <div style={{ padding: '32px 0', textAlign: 'center', color: '#A4B0BE', fontSize: 14 }}>还没有提交记录</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}