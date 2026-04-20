import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Download, Eye, ExternalLink, FileText, Loader2, AlertTriangle } from 'lucide-react';
import * as adminApi from '../../api/admin';
import type { SubmissionSummary, AssignmentSummary, SubmissionDetail, ReportResponse } from '../../api/types';
import { StatusTag } from '../../components/shared/StatusTag';
import { Modal } from '../../components/shared/ConfirmDialog';
import { MarkdownRenderer } from '../../components/shared/MarkdownRenderer';

export default function AdminSubmissions() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const assignmentId = parseInt(id || '0');
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [assignments, setAssignments] = useState<AssignmentSummary[]>([]);
  const [currentAssignment, setCurrentAssignment] = useState<AssignmentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<SubmissionDetail | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      adminApi.getAdminSubmissions(assignmentId),
      adminApi.getAdminAssignments(),
    ]).then(([subs, assigns]) => {
      setSubmissions(subs);
      setAssignments(assigns);
      setCurrentAssignment(assigns.find(a => a.id === assignmentId) || null);
    }).catch(() => alert('加载数据失败'))
    .finally(() => setLoading(false));
  }, [assignmentId]);

  const graded = submissions.filter(s => s.status === 'graded');
  const avgScore = graded.length > 0
    ? (graded.reduce((sum, s) => sum + (s.total_score || 0), 0) / graded.length).toFixed(1)
    : '—';

  const formatTime = (d: string | null) => {
    if (!d) return '';
    const date = new Date(d);
    return `${date.getMonth()+1}/${date.getDate()} ${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;
  };

  const getScoreColor = (score: number | null) => {
    if (!score) return '#A4B0BE';
    if (score >= 80) return '#6B9E7A';
    if (score >= 60) return '#4A6FA5';
    return '#C46B6B';
  };

  const handlePreview = async (sub: SubmissionSummary) => {
    setPreviewLoading(true);
    setPreview(null);
    try {
      const detail = await adminApi.getAdminSubmissionDetail(sub.id);
      setPreview(detail);
    } catch { alert('加载详情失败'); }
    finally { setPreviewLoading(false); }
  };

  const handleReport = async (reportId: number) => {
    setReportLoading(true);
    setReport(null);
    try {
      const r = await adminApi.getAdminReport(reportId);
      setReport(r);
    } catch { alert('加载报告失败'); }
    finally { setReportLoading(false); }
  };

  const handleDownload = async (sub: SubmissionSummary) => {
    const token = localStorage.getItem('tunnel_auth_token');
    const resp = await fetch(`/api/admin/submissions/${sub.id}/attachment`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) { alert('下载失败'); return; }
    const blob = await resp.blob();
    const disposition = resp.headers.get('content-disposition');
    let filename = sub.attachment_filename || 'attachment';
    if (disposition) {
      const utf8 = disposition.match(/filename\*=UTF-8''(.+?)(?:;|$)/i);
      if (utf8) filename = decodeURIComponent(utf8[1]);
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 48, color: '#7F8C8D' }}>加载中...</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate('/admin/assignments')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7F8C8D', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#2C3E50', marginBottom: 2 }}>{currentAssignment?.title || '提交列表'}</h1>
          <p style={{ fontSize: 13, color: '#7F8C8D' }}>共 {submissions.length} 份提交</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
        {[
          { label: '提交数', value: submissions.length, color: '#4A6FA5' },
          { label: '已评分', value: graded.length, color: '#6B9E7A' },
          { label: '平均分', value: avgScore, color: '#D4A843' },
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
              {['学生姓名', '学号', '班级', '提交时间', '状态', '总分', '附件', '操作'].map(h => (
                <th key={h} style={{ padding: '12px 18px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#7F8C8D', borderBottom: '1px solid #F0F2F5' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {submissions.map((sub, i) => (
              <tr key={sub.id} style={{ background: i%2===1 ? '#FAFBFC' : '#FFFFFF' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F0F6FF')}
                onMouseLeave={e => (e.currentTarget.style.background = i%2===1 ? '#FAFBFC' : '#FFFFFF')}>
                <td style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#EBF3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#4A6FA5', fontWeight: 600 }}>
                      {(sub.student_real_name || sub.student_name || '?').charAt(0)}
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#2C3E50' }}>{sub.student_real_name || sub.student_name}</span>
                  </div>
                </td>
                <td style={{ padding: '14px 18px', fontSize: 13, color: '#7F8C8D' }}>{sub.student_id_field || '—'}</td>
                <td style={{ padding: '14px 18px', fontSize: 13, color: '#7F8C8D' }}>{sub.class_name || '—'}</td>
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
                    <button onClick={() => handleDownload(sub)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#4A6FA5', background: 'none', border: '1px solid #E8ECF0', cursor: 'pointer', padding: '4px 8px', borderRadius: 5 }}>
                      <Download size={13} /> {sub.attachment_filename || '下载'}
                    </button>
                  )}
                </td>
                <td style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => handlePreview(sub)} disabled={previewLoading} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', border: '1px solid #E8ECF0', borderRadius: 5, background: '#FFFFFF', color: '#4A6FA5', cursor: 'pointer', fontSize: 13 }}>
                      <Eye size={13} /> 查看
                    </button>
                    {sub.status === 'graded' && sub.report_id && (
                      <button onClick={() => handleReport(sub.report_id!)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', border: '1px solid #E8ECF0', borderRadius: 5, background: '#FFFFFF', color: '#4A6FA5', cursor: 'pointer', fontSize: 13 }}>
                        <ExternalLink size={13} /> 报告
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {submissions.length === 0 && (
          <div style={{ textAlign: 'center', padding: 48, color: '#A4B0BE', fontSize: 14 }}>暂无提交记录</div>
        )}
      </div>

      {/* Preview Modal */}
      <Modal open={!!preview} title={preview ? `${preview.student_real_name || preview.student_name} 的提交` : ''}
        onClose={() => setPreview(null)} width={680}>
        {preview && (
          <div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 13, color: '#7F8C8D' }}>
              {preview.student_id_field && <span>学号: {preview.student_id_field}</span>}
              {preview.class_name && <span>班级: {preview.class_name}</span>}
              <span>状态: {preview.status}</span>
              {preview.submitted_at && <span>提交于: {formatTime(preview.submitted_at)}</span>}
            </div>
            {preview.content && (
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#2C3E50', marginBottom: 8 }}>提交内容</div>
                <div style={{ background: '#F7F8FA', borderRadius: 8, border: '1px solid #E8ECF0', padding: '16px 20px', maxHeight: 500, overflow: 'auto' }}>
                  <MarkdownRenderer content={preview.content} />
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Report Modal */}
      <Modal open={!!report} title={report ? `评分报告 — ${report.student_real_name || ''}` : ''}
        onClose={() => setReport(null)} width={700}>
        {reportLoading ? (
          <div style={{ textAlign: 'center', padding: 32, color: '#7F8C8D' }}>
            <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 12px', display: 'block' }} />加载中...
          </div>
        ) : report && (
          <div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              <div style={{ background: '#F7F8FA', borderRadius: 8, padding: '16px 20px', textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: 28, fontWeight: 600, color: getScoreColor(report.total_score) }}>{report.total_score}</div>
                <div style={{ fontSize: 12, color: '#7F8C8D' }}>总分 / {report.max_score}</div>
              </div>
              {report.assignment_title && (
                <div style={{ background: '#F7F8FA', borderRadius: 8, padding: '16px 20px', flex: 2, display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#2C3E50' }}>作业: {report.assignment_title}</span>
                </div>
              )}
            </div>
            {report.dimension_scores.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#2C3E50', marginBottom: 8 }}>维度评分</div>
                {report.dimension_scores.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #F0F2F5' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#2C3E50', width: 80 }}>{d.label}</span>
                    <div style={{ flex: 1, height: 6, background: '#F0F2F5', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(d.score / (d.weight * 100)) * 100}%`, background: d.score / (d.weight * 100) >= 0.8 ? '#6B9E7A' : d.score / (d.weight * 100) >= 0.6 ? '#4A6FA5' : '#C46B6B', borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#2C3E50', width: 50, textAlign: 'right' }}>{d.score}/{d.weight * 100}</span>
                  </div>
                ))}
              </div>
            )}
            {report.feedback && (
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#2C3E50', marginBottom: 8 }}>评语</div>
                <div style={{ background: '#F7F8FA', borderRadius: 8, border: '1px solid #E8ECF0', padding: '16px 20px', fontSize: 13, color: '#2C3E50', lineHeight: 1.7 }}>
                  <MarkdownRenderer content={report.feedback} />
                </div>
              </div>
            )}
            {report.manipulation_warning?.detected && (
              <div style={{
                background: report.manipulation_warning.severity === 'high' ? '#FFF5F5' : '#FFFBEB',
                border: `1px solid ${report.manipulation_warning.severity === 'high' ? '#FEB2B2' : '#FDE68A'}`,
                borderRadius: 8, padding: '12px 16px', marginTop: 16, display: 'flex', gap: 10,
              }}>
                <AlertTriangle size={18} color={report.manipulation_warning.severity === 'high' ? '#C46B6B' : '#D4A843'} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#C46B6B', marginBottom: 4 }}>
                    诱导性语句检测（{report.manipulation_warning.severity === 'high' ? '严重' : report.manipulation_warning.severity === 'medium' ? '中等' : '轻微'}）
                  </div>
                  {report.manipulation_warning.fragments.map((f, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#7F8C8D', fontStyle: 'italic' }}>"{f}"</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
