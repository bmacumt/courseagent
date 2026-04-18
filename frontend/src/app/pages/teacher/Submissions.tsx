import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Download, ExternalLink, Paperclip } from 'lucide-react';
import * as teacherApi from '../../api/teacher';
import type { SubmissionSummary, AssignmentSummary } from '../../api/types';
import { StatusTag } from '../../components/shared/StatusTag';

export default function Submissions() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const assignmentId = parseInt(id || '1');
  const [assignment, setAssignment] = useState<AssignmentSummary | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      teacherApi.getSubmissions(assignmentId),
      teacherApi.getAssignments(),
    ])
      .then(([subs, assigns]) => {
        setSubmissions(subs);
        setAssignment(assigns.find(a => a.id === assignmentId) || assigns[0] || null);
      })
      .catch(err => {
        console.error('Failed to load submissions:', err);
        alert('加载提交数据失败');
      })
      .finally(() => setLoading(false));
  }, [assignmentId]);

  const graded = submissions.filter(s => s.status === 'graded');
  const avgScore = graded.length > 0
    ? (graded.reduce((sum, s) => sum + (s.total_score || 0), 0) / graded.length).toFixed(1)
    : '—';

  const formatTime = (d: string) => {
    const date = new Date(d);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const getScoreColor = (score: number | null) => {
    if (!score) return '#A4B0BE';
    if (score >= 80) return '#6B9E7A';
    if (score >= 60) return '#4A6FA5';
    return '#C46B6B';
  };

  const handleExportCSV = () => {
    window.open(teacherApi.getExportCsvUrl(assignmentId));
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 64, color: '#7F8C8D', fontSize: 15 }}>加载中...</div>;
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate('/teacher/assignments')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7F8C8D', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#2C3E50', marginBottom: 2 }}>{assignment?.title || ''}</h1>
          <p style={{ fontSize: 13, color: '#7F8C8D' }}>提交列表 · 共 {submissions.length} 份提交</p>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <button
            onClick={handleExportCSV}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: '1px solid #E8ECF0', borderRadius: 6, background: '#FFFFFF', color: '#2C3E50', cursor: 'pointer', fontSize: 13 }}
          >
            <Download size={14} /> 导出成绩 CSV
          </button>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
        {[
          { label: '提交数', value: submissions.length, color: '#4A6FA5' },
          { label: '已评分', value: graded.length, color: '#6B9E7A' },
          { label: '平均分', value: avgScore, color: '#D4A843' },
          { label: '评分中', value: submissions.filter(s => s.status === 'grading').length, color: '#7A8F9E' },
        ].map(item => (
          <div key={item.label} style={{ background: '#FFFFFF', borderRadius: 8, border: '1px solid #E8ECF0', padding: '12px 20px', textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 24, fontWeight: 600, color: item.color }}>{item.value}</div>
            <div style={{ fontSize: 12, color: '#7F8C8D', marginTop: 4 }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: '#FFFFFF', borderRadius: 10, border: '1px solid #E8ECF0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F7F8FA' }}>
              {['学生姓名', '提交时间', '状态', '总分', '附件', '操作'].map(h => (
                <th key={h} style={{ padding: '12px 18px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#7F8C8D', borderBottom: '1px solid #F0F2F5' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {submissions.map((sub, i) => (
              <tr key={sub.id} style={{ background: i % 2 === 1 ? '#FAFBFC' : '#FFFFFF', cursor: sub.status === 'graded' ? 'pointer' : 'default' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F0F6FF')}
                onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 1 ? '#FAFBFC' : '#FFFFFF')}>
                <td style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#EBF3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#4A6FA5', fontWeight: 600 }}>
                      {(sub.student_real_name || sub.student_name).charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#2C3E50' }}>{sub.student_real_name || sub.student_name}</div>
                      <div style={{ fontSize: 12, color: '#A4B0BE' }}>{sub.student_name}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '14px 18px', fontSize: 13, color: '#7F8C8D' }}>{formatTime(sub.submitted_at)}</td>
                <td style={{ padding: '14px 18px' }}><StatusTag status={sub.status} /></td>
                <td style={{ padding: '14px 18px' }}>
                  {sub.total_score !== null ? (
                    <span style={{ fontSize: 16, fontWeight: 600, color: getScoreColor(sub.total_score) }}>{sub.total_score}</span>
                  ) : (
                    <span style={{ color: '#A4B0BE', fontSize: 13 }}>—</span>
                  )}
                </td>
                <td style={{ padding: '14px 18px' }}>
                  {sub.has_attachment && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#A4B0BE' }}>
                      <Paperclip size={13} />
                      <span style={{ background: '#FFF8E6', color: '#D4A843', fontSize: 10, padding: '1px 6px', borderRadius: 3, fontWeight: 500 }}>后端接口未开发</span>
                    </span>
                  )}
                </td>
                <td style={{ padding: '14px 18px' }}>
                  {sub.status === 'graded' && sub.report_id && (
                    <button
                      onClick={() => navigate(`/teacher/reports/${sub.report_id}`)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', border: '1px solid #E8ECF0', borderRadius: 5, background: '#FFFFFF', color: '#4A6FA5', cursor: 'pointer', fontSize: 13 }}
                    >
                      <ExternalLink size={13} /> 评分报告
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {submissions.length === 0 && (
          <div style={{ textAlign: 'center', padding: 48, color: '#A4B0BE', fontSize: 14 }}>暂无提交记录</div>
        )}
      </div>
    </div>
  );
}