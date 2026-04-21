import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { RefreshCw, Download, Paperclip, ExternalLink, Info, RotateCcw } from 'lucide-react';
import * as studentApi from '../../api/student';
import type { SubmissionSummary } from '../../api/types';
import { StatusTag } from '../../components/shared/StatusTag';

export default function MySubmissions() {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [pollingInfo, setPollingInfo] = useState('');
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchSubmissions = useCallback(async () => {
    try {
      const data = await studentApi.getStudentSubmissions();
      setSubmissions(data);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('获取提交列表失败:', err);
    }
  }, []);

  useEffect(() => {
    fetchSubmissions()
      .catch(err => {
        console.error('获取提交列表失败:', err);
        alert('获取提交列表失败，请稍后重试');
      })
      .finally(() => setLoading(false));
  }, [fetchSubmissions]);

  // Polling for grading submissions
  useEffect(() => {
    const gradingItems = submissions.filter(s => s.status === 'grading');
    if (gradingItems.length === 0) {
      setPollingInfo('');
      return;
    }

    setPollingInfo('检测到评分中的记录，每 5 秒自动刷新...');
    const interval = setInterval(() => {
      fetchSubmissions();
    }, 5000);

    return () => clearInterval(interval);
  }, [submissions, fetchSubmissions]);

  const handleRefresh = () => {
    fetchSubmissions();
  };

  const handleDownloadAttachment = (submissionId: number) => {
    studentApi.downloadAttachment(submissionId).catch(() => alert('下载失败'));
  };

  const formatTime = (d: string | null) => {
    if (!d) return '—';
    const date = new Date(d);
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const getScoreColor = (score: number | null) => {
    if (!score) return '#A4B0BE';
    if (score >= 80) return '#6B9E7A';
    if (score >= 60) return '#4A6FA5';
    return '#C46B6B';
  };

  const getScoreBg = (score: number | null) => {
    if (!score) return 'transparent';
    if (score >= 80) return '#EDFAF2';
    if (score >= 60) return '#EBF3FF';
    return '#FFEAEA';
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 64, color: '#A4B0BE', fontSize: 14 }}>加载中...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#2C3E50', marginBottom: 4 }}>我的提交</h1>
          <p style={{ fontSize: 13, color: '#7F8C8D' }}>查看所有提交记录和评分结果</p>
        </div>
        <button
          onClick={handleRefresh}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: '1px solid #E8ECF0', borderRadius: 6, background: '#FFFFFF', color: '#2C3E50', cursor: 'pointer', fontSize: 13 }}
        >
          <RefreshCw size={14} /> 刷新
        </button>
      </div>

      {pollingInfo && (
        <div style={{ background: '#EBF3FF', border: '1px solid #C3D9F4', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#4A6FA5', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <RefreshCw size={14} className="animate-spin" />
          {pollingInfo}
          <span style={{ color: '#A4B0BE', marginLeft: 'auto', fontSize: 12 }}>
            最后刷新 {lastRefresh.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      )}

      {submissions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 64, color: '#A4B0BE' }}>
          <div style={{ fontSize: 14, marginBottom: 8 }}>还没有提交记录</div>
          <button onClick={() => navigate('/student/assignments')} style={{ padding: '8px 20px', border: 'none', borderRadius: 6, background: '#4A6FA5', color: '#FFFFFF', cursor: 'pointer', fontSize: 13 }}>
            去完成作业
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {submissions.map(sub => (
            <div key={sub.id} style={{
              background: '#FFFFFF', borderRadius: 10, border: '1px solid #E8ECF0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '18px 22px',
              display: 'flex', alignItems: 'center', gap: 20,
            }}>
              {/* Score circle */}
              {sub.total_score !== null ? (
                <div style={{
                  width: 60, height: 60, borderRadius: '50%',
                  background: getScoreBg(sub.total_score),
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, border: `2px solid ${getScoreColor(sub.total_score)}30`,
                }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: getScoreColor(sub.total_score), lineHeight: 1 }}>{sub.total_score}</div>
                  <div style={{ fontSize: 10, color: '#A4B0BE' }}>分</div>
                </div>
              ) : (
                <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#F7F8FA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '2px solid #E8ECF0' }}>
                  <span style={{ fontSize: 11, color: '#A4B0BE' }}>—</span>
                </div>
              )}

              {/* Main info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#2C3E50', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sub.assignment_title}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: '#A4B0BE', flexWrap: 'wrap' }}>
                  <span>提交于 {formatTime(sub.submitted_at)}</span>
                  {sub.has_attachment && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#7A8F9E' }}>
                      <Paperclip size={12} /> 含附件
                    </span>
                  )}
                </div>
              </div>

              {/* Status */}
              <StatusTag status={sub.status} />

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {sub.status === 'failed' && (
                  <button
                    onClick={() => navigate(`/student/assignments/${sub.assignment_id}/submit`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', border: 'none', borderRadius: 6, background: '#D4A843', color: '#FFFFFF', cursor: 'pointer', fontSize: 13 }}
                  >
                    <RotateCcw size={13} /> 重新提交
                  </button>
                )}
                {sub.has_attachment && (
                  <button
                    onClick={() => handleDownloadAttachment(sub.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', border: '1px solid #E8ECF0', borderRadius: 6, background: '#FFFFFF', color: '#7F8C8D', cursor: 'pointer', fontSize: 12 }}
                  >
                    <Download size={13} /> 附件
                  </button>
                )}
                {sub.status === 'graded' && sub.report_id && (
                  <button
                    onClick={() => navigate(`/student/reports/${sub.report_id}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', border: 'none', borderRadius: 6, background: '#4A6FA5', color: '#FFFFFF', cursor: 'pointer', fontSize: 13 }}
                  >
                    <ExternalLink size={13} /> 查看报告
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Polling tip */}
      <div style={{ marginTop: 20, padding: '12px 16px', background: '#F7F8FA', borderRadius: 8, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <Info size={14} color="#7A8F9E" style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12, color: '#7F8C8D', lineHeight: 1.6 }}>
          <strong>评分说明：</strong>提交后 AI 通常在 60 秒内完成评分。"AI 评分中"状态的记录每 5 秒自动刷新。
          如超过 60 秒仍未完成，可能需要更长时间，请稍后手动刷新查看。
        </div>
      </div>
    </div>
  );
}
