import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Download, ExternalLink, Eye, FileText, X } from 'lucide-react';
import * as teacherApi from '../../api/teacher';
import type { SubmissionSummary, AssignmentSummary, SubmissionDetail } from '../../api/types';
import { StatusTag } from '../../components/shared/StatusTag';
import { Modal } from '../../components/shared/ConfirmDialog';
import { MarkdownRenderer } from '../../components/shared/MarkdownRenderer';

export default function Submissions() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const assignmentId = parseInt(id || '1');
  const [assignment, setAssignment] = useState<AssignmentSummary | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<SubmissionDetail | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewPdf, setPreviewPdf] = useState<string | null>(null);

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
    teacherApi.exportCsv(assignmentId).catch(() => alert('导出失败'));
  };

  const handlePreview = async (sub: SubmissionSummary) => {
    setPreviewLoading(true);
    setPreview(null);
    setPreviewPdf(null);
    try {
      const detail = await teacherApi.getSubmissionDetail(sub.id);
      setPreview(detail);
      // If attachment is PDF, fetch blob for iframe preview
      if (detail.has_attachment && detail.attachment_filename?.toLowerCase().endsWith('.pdf')) {
        try {
          const { blob } = await teacherApi.fetchAttachmentBlob(sub.id);
          setPreviewPdf(URL.createObjectURL(blob));
        } catch {}
      }
    } catch {
      alert('加载提交详情失败');
    } finally {
      setPreviewLoading(false);
    }
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
              <tr key={sub.id} style={{ background: i % 2 === 1 ? '#FAFBFC' : '#FFFFFF' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F0F6FF')}
                onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 1 ? '#FAFBFC' : '#FFFFFF')}>
                <td style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#EBF3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#4A6FA5', fontWeight: 600 }}>
                      {(sub.student_real_name || sub.student_name).charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#2C3E50' }}>{sub.student_real_name || sub.student_name}</div>
                      <div style={{ fontSize: 12, color: '#A4B0BE' }}>{sub.student_name}{sub.student_id_field ? ` · ${sub.student_id_field}` : ''}</div>
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
                      onClick={() => teacherApi.downloadAttachment(sub.id).catch(() => alert('下载失败'))}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#4A6FA5', background: 'none', border: '1px solid #E8ECF0', cursor: 'pointer', padding: '4px 8px', borderRadius: 5 }}
                    >
                      <Download size={13} /> {sub.attachment_filename || '下载附件'}
                    </button>
                  )}
                </td>
                <td style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => handlePreview(sub)}
                      disabled={previewLoading}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', border: '1px solid #E8ECF0', borderRadius: 5, background: '#FFFFFF', color: '#4A6FA5', cursor: 'pointer', fontSize: 13 }}
                    >
                      <Eye size={13} /> 查看
                    </button>
                    {sub.status === 'graded' && sub.report_id && (
                      <button
                        onClick={() => navigate(`/teacher/reports/${sub.report_id}`)}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', border: '1px solid #E8ECF0', borderRadius: 5, background: '#FFFFFF', color: '#4A6FA5', cursor: 'pointer', fontSize: 13 }}
                      >
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
      <Modal
        open={!!preview}
        title={preview ? `${preview.student_real_name || preview.student_name} 的提交` : ''}
        onClose={() => {
          if (previewPdf) URL.revokeObjectURL(previewPdf);
          setPreview(null); setPreviewPdf(null);
        }}
        width={previewPdf ? 900 : 680}
      >
        {preview && (
          <div>
            {/* Student info */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 13, color: '#7F8C8D' }}>
              {preview.student_id_field && <span>学号: {preview.student_id_field}</span>}
              {preview.grade && <span>年级: {preview.grade}</span>}
              {preview.class_name && <span>班级: {preview.class_name}</span>}
              <span>状态: {preview.status}</span>
              {preview.submitted_at && <span>提交于: {formatTime(preview.submitted_at)}</span>}
            </div>

            {/* PDF preview */}
            {previewPdf && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#2C3E50', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={15} /> PDF 附件预览
                </div>
                <iframe
                  src={previewPdf}
                  style={{ width: '100%', height: 500, border: '1px solid #E8ECF0', borderRadius: 8 }}
                  title="PDF Preview"
                />
              </div>
            )}

            {/* Text content */}
            {preview.content && (
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#2C3E50', marginBottom: 8 }}>
                  提交内容
                </div>
                <div style={{
                  background: '#F7F8FA', borderRadius: 8, border: '1px solid #E8ECF0',
                  padding: '16px 20px', maxHeight: previewPdf ? 300 : 500, overflow: 'auto',
                }}>
                  <MarkdownRenderer content={preview.content} />
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
