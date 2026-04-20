import { useState, useEffect } from 'react';
import { ClipboardList } from 'lucide-react';
import * as adminApi from '../../api/admin';
import type { AssignmentSummary } from '../../api/types';

export default function AdminAssignments() {
  const [assignments, setAssignments] = useState<AssignmentSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAssignments(); }, []);

  const fetchAssignments = () => {
    adminApi.getAdminAssignments()
      .then(setAssignments)
      .catch(() => alert('加载作业列表失败'))
      .finally(() => setLoading(false));
  };

  const formatDate = (d: string | null) => {
    if (!d) return '';
    const date = new Date(d);
    return `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2,'0')}-${date.getDate().toString().padStart(2,'0')} ${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 48, color: '#7F8C8D' }}>加载中...</div>;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#2C3E50', marginBottom: 4 }}>作业管理</h1>
        <p style={{ fontSize: 13, color: '#7F8C8D' }}>查看所有教师发布的作业和提交情况</p>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        {[
          { label: '作业总数', value: assignments.length, color: '#4A6FA5' },
          { label: '已发布', value: assignments.filter(a => a.is_published).length, color: '#6B9E7A' },
          { label: '草稿', value: assignments.filter(a => !a.is_published).length, color: '#A4B0BE' },
          { label: '总提交数', value: assignments.reduce((s, a) => s + a.submission_count, 0), color: '#D4A843' },
        ].map(item => (
          <div key={item.label} style={{ background: '#FFFFFF', borderRadius: 8, border: '1px solid #E8ECF0', padding: '12px 20px', textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 24, fontWeight: 600, color: item.color }}>{item.value}</div>
            <div style={{ fontSize: 12, color: '#7F8C8D', marginTop: 4 }}>{item.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#FFFFFF', borderRadius: 10, border: '1px solid #E8ECF0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F7F8FA' }}>
              {['作业标题', '发布状态', '截止时间', '创建时间', '提交数', '操作'].map(h => (
                <th key={h} style={{ padding: '12px 18px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#7F8C8D', borderBottom: '1px solid #F0F2F5' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assignments.map((a, i) => (
              <tr key={a.id} style={{ background: i%2===1 ? '#FAFBFC' : '#FFFFFF' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F0F6FF')}
                onMouseLeave={e => (e.currentTarget.style.background = i%2===1 ? '#FAFBFC' : '#FFFFFF')}>
                <td style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EBF3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <ClipboardList size={15} color="#4A6FA5" />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#2C3E50' }}>{a.title}</span>
                  </div>
                </td>
                <td style={{ padding: '14px 18px' }}>
                  <span style={{ background: a.is_published ? '#EDFAF2' : '#F0F2F5', color: a.is_published ? '#6B9E7A' : '#A4B0BE', borderRadius: 4, padding: '2px 8px', fontSize: 12 }}>
                    {a.is_published ? '已发布' : '草稿'}
                  </span>
                </td>
                <td style={{ padding: '14px 18px', fontSize: 13, color: '#7F8C8D' }}>{formatDate(a.deadline) || '无截止时间'}</td>
                <td style={{ padding: '14px 18px', fontSize: 12, color: '#A4B0BE' }}>{formatDate(a.created_at)}</td>
                <td style={{ padding: '14px 18px' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#2C3E50' }}>{a.submission_count}</span>
                </td>
                <td style={{ padding: '14px 18px' }}>
                  {a.submission_count > 0 && (
                    <button onClick={() => window.location.hash = `/admin/submissions/${a.id}`} style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                      border: '1px solid #B8D4E8', borderRadius: 5, background: '#EBF3FF', color: '#4A6FA5', cursor: 'pointer', fontSize: 12,
                    }}>
                      查看提交
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {assignments.length === 0 && (
          <div style={{ textAlign: 'center', padding: 48, color: '#A4B0BE', fontSize: 14 }}>暂无作业</div>
        )}
      </div>
    </div>
  );
}
