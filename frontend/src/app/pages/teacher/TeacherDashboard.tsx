import { ElementType } from 'react';
import { useNavigate } from 'react-router';
import { Database, ClipboardList, FileText, Users, ChevronRight, Clock } from 'lucide-react';
import { mockDocuments, mockAssignments } from '../../data/mockData';
import { PublishTag } from '../../components/shared/StatusTag';

function StatCard({ icon: Icon, label, value, color, sub }: { icon: ElementType; label: string; value: number | string; color: string; sub?: string }) {
  return (
    <div style={{ background: '#FFFFFF', borderRadius: 10, padding: '20px 24px', border: '1px solid #E8ECF0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={22} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 600, color: '#2C3E50', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 13, color: '#7F8C8D', marginTop: 4 }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: '#A4B0BE', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const publishedCount = mockAssignments.filter(a => a.is_published).length;
  const draftCount = mockAssignments.filter(a => !a.is_published).length;
  const totalSubmissions = mockAssignments.reduce((sum, a) => sum + a.submission_count, 0);

  const formatDate = (d: string) => {
    const date = new Date(d);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const formatDeadline = (d: string | null) => {
    if (!d) return '无截止时间';
    const date = new Date(d);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    if (diff < 0) return '已截止';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return '今日截止';
    return `${days} 天后截止`;
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#2C3E50', marginBottom: 4 }}>教学概览</h1>
        <p style={{ fontSize: 13, color: '#7F8C8D' }}>课程教学情况总览</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
        <StatCard icon={Database} label="知识库文档数" value={mockDocuments.length} color="#6B8F71" sub="已上传处理完成" />
        <StatCard icon={ClipboardList} label="已发布作业" value={publishedCount} color="#4A6FA5" sub={`${draftCount} 份草稿`} />
        <StatCard icon={FileText} label="收到提交总数" value={totalSubmissions} color="#D4A843" sub="所有作业提交汇总" />
        <StatCard icon={Users} label="参与学生数" value={42} color="#7A8F9E" sub="至少提交一次" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Recent Assignments */}
        <div style={{ background: '#FFFFFF', borderRadius: 10, border: '1px solid #E8ECF0' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0F2F5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClipboardList size={16} color="#4A6FA5" />
              <span style={{ fontSize: 15, fontWeight: 600, color: '#2C3E50' }}>最近作业</span>
            </div>
            <button onClick={() => navigate('/teacher/assignments')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4A6FA5', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
              查看全部 <ChevronRight size={14} />
            </button>
          </div>
          <div style={{ padding: '0 20px' }}>
            {mockAssignments.map((a, i) => (
              <div key={a.id} style={{ padding: '14px 0', borderBottom: i < mockAssignments.length - 1 ? '1px solid #F7F8FA' : 'none', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#2C3E50', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</span>
                    <PublishTag isPublished={a.is_published} />
                  </div>
                  <div style={{ fontSize: 12, color: '#A4B0BE', display: 'flex', gap: 12 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Users size={11} /> {a.submission_count} 份提交
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: a.deadline && new Date(a.deadline) < new Date() ? '#C46B6B' : '#A4B0BE' }}>
                      <Clock size={11} /> {formatDeadline(a.deadline)}
                    </span>
                  </div>
                </div>
                {a.is_published && (
                  <button
                    onClick={() => navigate('/teacher/assignments')}
                    style={{ padding: '4px 10px', border: '1px solid #E8ECF0', borderRadius: 5, background: '#FFFFFF', color: '#4A6FA5', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}
                  >
                    查看
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Knowledge Base */}
        <div style={{ background: '#FFFFFF', borderRadius: 10, border: '1px solid #E8ECF0' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0F2F5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Database size={16} color="#6B8F71" />
              <span style={{ fontSize: 15, fontWeight: 600, color: '#2C3E50' }}>知识库文档</span>
            </div>
            <button onClick={() => navigate('/teacher/knowledge')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4A6FA5', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
              管理 <ChevronRight size={14} />
            </button>
          </div>
          <div style={{ padding: '0 20px' }}>
            {mockDocuments.map((doc, i) => {
              const typeLabel: Record<string, { label: string; color: string }> = {
                specification: { label: '规范', color: '#4A6FA5' },
                textbook: { label: '教材', color: '#6B8F71' },
                other: { label: '其他', color: '#7A8F9E' },
              };
              const t = typeLabel[doc.doc_type];
              return (
                <div key={doc.id} style={{ padding: '12px 0', borderBottom: i < mockDocuments.length - 1 ? '1px solid #F7F8FA' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#2C3E50', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</span>
                    <span style={{ background: `${t.color}18`, color: t.color, borderRadius: 3, padding: '1px 6px', fontSize: 11, flexShrink: 0 }}>{t.label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#A4B0BE' }}>
                    {doc.chunk_count} 个分块 · 上传于 {formatDate(doc.uploaded_at)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}