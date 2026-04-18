import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Download, ExternalLink, Paperclip } from 'lucide-react';
import { mockSubmissions, mockAssignments } from '../../data/mockData';
import { StatusTag } from '../../components/shared/StatusTag';

export default function Submissions() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const assignmentId = parseInt(id || '1');
  const assignment = mockAssignments.find(a => a.id === assignmentId) || mockAssignments[0];
  const submissions = mockSubmissions.filter(s => s.assignment_id === assignmentId);

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

  const statusLabel: Record<string, string> = {
    graded: '已评分',
    grading: '评分中',
    submitted: '已提交',
    failed: '评分失败',
  };

  const handleExportCSV = () => {
    const header = ['姓名', '用户名', '提交时间', '状态', '总分', '有附件'];
    const rows = submissions.map(sub => [
      sub.student_real_name || sub.student_name,
      sub.student_name,
      new Date(sub.submitted_at).toLocaleString('zh-CN'),
      statusLabel[sub.status] || sub.status,
      sub.total_score !== null ? String(sub.total_score) : '—',
      sub.has_attachment ? '是' : '否',
    ]);
    const csvContent = [header, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    const bom = '\uFEFF'; // UTF-8 BOM for Excel compatibility
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${assignment.title}_成绩.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = (studentName: string, submissionId: number) => {
    // Mock PDF: generate a simple text-based placeholder as a .pdf blob
    const content = `评分报告\n作业：${assignment.title}\n学生：${studentName}\n提交ID：${submissionId}\n\n（此为演示模式下的模拟附件，真实环境将下载学生上传的原始PDF文件）`;
    const blob = new Blob([content], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${studentName}_作业附件_${submissionId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate('/teacher/assignments')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7F8C8D', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#2C3E50', marginBottom: 2 }}>{assignment.title}</h1>
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
                    <button
                      onClick={() => handleDownloadPDF(sub.student_real_name || sub.student_name, sub.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#4A6FA5', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      <Paperclip size={13} /> 下载PDF
                    </button>
                  )}
                </td>
                <td style={{ padding: '14px 18px' }}>
                  {sub.status === 'graded' && (
                    <button
                      onClick={() => navigate(`/teacher/reports/${sub.id}`)}
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