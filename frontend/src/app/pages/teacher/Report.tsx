import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, BookOpen, Quote, Calendar, AlertTriangle } from 'lucide-react';
import * as teacherApi from '../../api/teacher';
import type { ReportResponse } from '../../api/types';
import { ScoreCircle } from '../../components/shared/ScoreCircle';
import { DimensionBar } from '../../components/shared/DimensionBar';
import { MarkdownRenderer } from '../../components/shared/MarkdownRenderer';

export default function TeacherReport() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const reportId = parseInt(id || '1');
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    teacherApi.getReport(reportId)
      .then(rpt => {
        setReport(rpt);
      })
      .catch(err => {
        console.error('Failed to load report:', err);
      })
      .finally(() => setLoading(false));
  }, [reportId]);

  const formatTime = (d: string | null) => d ? new Date(d).toLocaleString('zh-CN') : '';

  const getScoreLevel = (score: number) => {
    if (score >= 90) return { label: '优秀', color: '#6B9E7A' };
    if (score >= 80) return { label: '良好', color: '#4A6FA5' };
    if (score >= 70) return { label: '中等', color: '#D4A843' };
    if (score >= 60) return { label: '及格', color: '#D4A843' };
    return { label: '不及格', color: '#C46B6B' };
  };

  if (loading || !report) {
    return <div style={{ textAlign: 'center', padding: 64, color: '#7F8C8D', fontSize: 15 }}>加载中...</div>;
  }

  const level = getScoreLevel(report.total_score);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7F8C8D', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#2C3E50', marginBottom: 2 }}>评分报告</h1>
          <p style={{ fontSize: 13, color: '#7F8C8D' }}>
            {report.student_real_name || ''} · {report.assignment_title || ''}
          </p>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: '#A4B0BE', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Calendar size={13} />
          {formatTime(report.created_at)}
        </div>
      </div>

      {/* Score overview */}
      <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid #E8ECF0', padding: '28px 32px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 48 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <ScoreCircle score={report.total_score} maxScore={report.max_score} size={140} />
          <div style={{ textAlign: 'center' }}>
            <span style={{ background: `${level.color}18`, color: level.color, borderRadius: 20, padding: '4px 16px', fontSize: 14, fontWeight: 500 }}>{level.label}</span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#2C3E50', marginBottom: 16 }}>维度得分</div>
          {report.dimension_scores.map(dim => (
            <DimensionBar key={dim.name} dimension={dim} />
          ))}
        </div>
      </div>

      {/* Manipulation Warning */}
      {report.manipulation_warning?.detected && (
        <div style={{
          background: report.manipulation_warning.severity === 'high' ? '#FFF5F5' : '#FFFBEB',
          border: `1px solid ${report.manipulation_warning.severity === 'high' ? '#FEB2B2' : '#FDE68A'}`,
          borderRadius: 10, padding: '16px 20px', marginBottom: 20, display: 'flex', gap: 12,
        }}>
          <AlertTriangle size={20} color={report.manipulation_warning.severity === 'high' ? '#C46B6B' : '#D4A843'} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#C46B6B', marginBottom: 6 }}>
              检测到诱导性语句（{report.manipulation_warning.severity === 'high' ? '严重' : report.manipulation_warning.severity === 'medium' ? '中等' : '轻微'}）— 请教师酌情处理
            </div>
            {report.manipulation_warning.fragments.length > 0 && (
              <div style={{ marginBottom: 6 }}>
                {report.manipulation_warning.fragments.map((f, i) => (
                  <div key={i} style={{ fontSize: 13, color: '#7F8C8D', fontStyle: 'italic', padding: '2px 0' }}>
                    "{f}"
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize: 13, color: '#7F8C8D' }}>{report.manipulation_warning.comment}</div>
          </div>
        </div>
      )}

      {/* Feedback */}
      <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid #E8ECF0', padding: '24px 28px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ width: 4, height: 18, background: '#4A6FA5', borderRadius: 2 }} />
          <span style={{ fontSize: 15, fontWeight: 600, color: '#2C3E50' }}>AI 综合评语</span>
        </div>
        <div style={{ background: '#F7F8FA', borderRadius: 8, padding: '16px 20px' }}>
          <MarkdownRenderer content={report.feedback} />
        </div>
      </div>

      {/* References */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid #E8ECF0', padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <BookOpen size={16} color="#6B9E7A" />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#2C3E50' }}>已引用规范</span>
            <span style={{ fontSize: 12, color: '#A4B0BE' }}>（{report.regulations_cited.length} 条）</span>
          </div>
          {report.regulations_cited.length > 0 ? report.regulations_cited.map((ref, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: i < report.regulations_cited.length - 1 ? '1px solid #F7F8FA' : 'none' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#6B9E7A', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: '#2C3E50' }}>{ref}</span>
            </div>
          )) : <span style={{ fontSize: 13, color: '#A4B0BE' }}>未检测到规范引用</span>}
        </div>

        <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid #E8ECF0', padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Quote size={16} color="#4A6FA5" />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#2C3E50' }}>相关规范条文</span>
            <span style={{ fontSize: 12, color: '#A4B0BE' }}>（RAG 检索到）</span>
          </div>
          {report.regulations_found.map((ref, i) => (
            <div key={i} style={{ padding: '6px 0', borderBottom: i < report.regulations_found.length - 1 ? '1px solid #F7F8FA' : 'none' }}>
              <div style={{ fontSize: 13, color: '#2C3E50', lineHeight: 1.5 }}>{ref}</div>
            </div>
          ))}
        </div>
      </div>

      {/* References list */}
      {report.references.length > 0 && (
        <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid #E8ECF0', padding: '20px 24px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#2C3E50', marginBottom: 12 }}>参考文献</div>
          {report.references.map((ref, i) => (
            <div key={i} style={{ fontSize: 13, color: '#7F8C8D', padding: '3px 0' }}>
              [{i + 1}] {ref}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
