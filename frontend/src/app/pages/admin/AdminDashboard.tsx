import { ElementType } from 'react';
import { Users, FileText, ClipboardList, BarChart3, TrendingUp, Activity } from 'lucide-react';
import { mockAdminStats, mockUsers, mockAssignments, mockSubmissions } from '../../data/mockData';

function StatCard({ icon: Icon, label, value, color, sub }: {
  icon: ElementType; label: string; value: number | string; color: string; sub?: string;
}) {
  return (
    <div style={{
      background: '#FFFFFF', borderRadius: 10, padding: '20px 24px',
      border: '1px solid #E8ECF0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      display: 'flex', alignItems: 'center', gap: 18,
    }}>
      <div style={{
        width: 50, height: 50, borderRadius: 12, background: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={24} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 600, color: '#2C3E50', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 13, color: '#7F8C8D', marginTop: 4 }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: '#A4B0BE', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const stats = mockAdminStats;
  const recentUsers = mockUsers.slice(0, 5);
  const submissionsByStatus = {
    graded: mockSubmissions.filter(s => s.status === 'graded').length,
    grading: mockSubmissions.filter(s => s.status === 'grading').length,
    submitted: mockSubmissions.filter(s => s.status === 'submitted').length,
    failed: mockSubmissions.filter(s => s.status === 'failed').length,
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#2C3E50', marginBottom: 4 }}>系统概览</h1>
        <p style={{ fontSize: 13, color: '#7F8C8D' }}>当前系统运行状态与数据概览</p>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
        <StatCard icon={Users} label="注册用户总数" value={stats.total_users} color="#4A6FA5" sub="含管理员、教师、学生" />
        <StatCard icon={FileText} label="知识库文档数" value={stats.total_documents} color="#6B8F71" sub="PDF 规范与教材" />
        <StatCard icon={ClipboardList} label="作业总数" value={stats.total_assignments} color="#D4A843" sub="含草稿与已发布" />
        <StatCard icon={BarChart3} label="提交总数" value={stats.total_submissions} color="#7A8F9E" sub="所有学生答题提交" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Recent Users */}
        <div style={{ background: '#FFFFFF', borderRadius: 10, border: '1px solid #E8ECF0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0F2F5', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={16} color="#4A6FA5" />
            <span style={{ fontSize: 15, fontWeight: 600, color: '#2C3E50' }}>最近注册用户</span>
          </div>
          <div style={{ padding: '0 20px' }}>
            {recentUsers.map((u, i) => (
              <div key={u.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
                borderBottom: i < recentUsers.length - 1 ? '1px solid #F7F8FA' : 'none',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: u.role === 'admin' ? '#EBF3FF' : u.role === 'teacher' ? '#EDFAF2' : '#F0F2F5',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 600,
                  color: u.role === 'admin' ? '#4A6FA5' : u.role === 'teacher' ? '#6B9E7A' : '#7F8C8D',
                }}>
                  {(u.real_name || u.username).charAt(0)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#2C3E50' }}>{u.real_name || u.username}</div>
                  <div style={{ fontSize: 12, color: '#7F8C8D' }}>{u.class_name || (u.role === 'teacher' ? '教师' : '管理员')}</div>
                </div>
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 3,
                  background: u.role === 'admin' ? '#EBF3FF' : u.role === 'teacher' ? '#EDFAF2' : '#F0F2F5',
                  color: u.role === 'admin' ? '#4A6FA5' : u.role === 'teacher' ? '#6B9E7A' : '#7F8C8D',
                }}>
                  {u.role === 'admin' ? '管理员' : u.role === 'teacher' ? '教师' : '学生'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Submission Stats */}
        <div style={{ background: '#FFFFFF', borderRadius: 10, border: '1px solid #E8ECF0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0F2F5', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={16} color="#4A6FA5" />
            <span style={{ fontSize: 15, fontWeight: 600, color: '#2C3E50' }}>评分状态分布</span>
          </div>
          <div style={{ padding: 20 }}>
            {[
              { label: '已评分', value: submissionsByStatus.graded, total: mockSubmissions.length, color: '#6B9E7A', bg: '#EDFAF2' },
              { label: 'AI 评分中', value: submissionsByStatus.grading, total: mockSubmissions.length, color: '#4A6FA5', bg: '#EBF3FF' },
              { label: '已提交待处理', value: submissionsByStatus.submitted, total: mockSubmissions.length, color: '#D4A843', bg: '#FFF8E6' },
              { label: '评分失败', value: submissionsByStatus.failed, total: mockSubmissions.length, color: '#C46B6B', bg: '#FFEAEA' },
            ].map((item) => (
              <div key={item.label} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: '#2C3E50' }}>{item.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: item.color }}>{item.value} 份</span>
                </div>
                <div style={{ height: 8, background: '#F0F2F5', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${(item.value / item.total) * 100}%`,
                    background: item.color, borderRadius: 4, transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ padding: '12px 20px', borderTop: '1px solid #F0F2F5', display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={14} color="#6B9E7A" />
            <span style={{ fontSize: 12, color: '#7F8C8D' }}>
              AI 评分覆盖率 <strong style={{ color: '#6B9E7A' }}>
                {Math.round((submissionsByStatus.graded / mockSubmissions.length) * 100)}%
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* System health */}
      <div style={{ marginTop: 20, background: '#FFFFFF', borderRadius: 10, border: '1px solid #E8ECF0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Activity size={16} color="#4A6FA5" />
          <span style={{ fontSize: 15, fontWeight: 600, color: '#2C3E50' }}>系统状态</span>
        </div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'LLM 服务', status: '正常', color: '#6B9E7A' },
            { label: 'Embedding 服务', status: '正常', color: '#6B9E7A' },
            { label: 'ChromaDB', status: '正常', color: '#6B9E7A' },
            { label: 'MinerU 解析', status: '正常', color: '#6B9E7A' },
          ].map((item) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
              <span style={{ fontSize: 13, color: '#2C3E50' }}>{item.label}</span>
              <span style={{ fontSize: 12, color: item.color }}>{item.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}