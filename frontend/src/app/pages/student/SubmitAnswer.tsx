import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Eye, Edit3, Clock, User, AlertTriangle, CheckCircle } from 'lucide-react';
import { mockAssignments } from '../../data/mockData';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { MarkdownRenderer } from '../../components/shared/MarkdownRenderer';
import { FileUploader } from '../../components/shared/FileUploader';

type Tab = 'edit' | 'preview';

export default function SubmitAnswer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const assignmentId = parseInt(id || '1');
  const assignment = mockAssignments.find(a => a.id === assignmentId) || mockAssignments[0];

  const [activeTab, setActiveTab] = useState<Tab>('edit');
  const [content, setContent] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState('');

  const wordCount = content.trim().length;
  const hasContent = content.trim().length > 0 || uploadedFile !== null;

  const formatDeadline = (d: string | null) => {
    if (!d) return null;
    const date = new Date(d);
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const handleSubmitClick = () => {
    if (!hasContent) {
      setFormError('请输入答案内容或上传文件');
      return;
    }
    setFormError('');
    setConfirmOpen(true);
  };

  const handleConfirmSubmit = async () => {
    setConfirmOpen(false);
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 1200));
    setSubmitting(false);
    setSubmitted(true);
    setTimeout(() => navigate('/student/submissions'), 1800);
  };

  if (submitted) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16 }}>
        <CheckCircle size={56} color="#6B9E7A" />
        <div style={{ fontSize: 18, fontWeight: 600, color: '#2C3E50' }}>提交成功！</div>
        <div style={{ fontSize: 14, color: '#7F8C8D' }}>AI 正在评分中，正在跳转...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate('/student/assignments')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7F8C8D', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#2C3E50', marginBottom: 2 }}>{assignment.title}</h1>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#A4B0BE' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><User size={12} /> 张明</span>
            {assignment.deadline && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> 截止 {formatDeadline(assignment.deadline)}</span>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20 }}>
        {/* Left: Assignment detail */}
        <div>
          <div style={{ background: '#FFFFFF', borderRadius: 10, border: '1px solid #E8ECF0', padding: '20px 22px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 4, height: 16, background: '#4A6FA5', borderRadius: 2 }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#2C3E50' }}>题目说明</span>
            </div>
            <p style={{ fontSize: 13, color: '#7F8C8D', lineHeight: 1.7, marginBottom: 0 }}>{assignment.description}</p>
          </div>

          <div style={{ background: '#FFFFFF', borderRadius: 10, border: '1px solid #E8ECF0', padding: '20px 22px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 4, height: 16, background: '#D4A843', borderRadius: 2 }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#2C3E50' }}>具体题目</span>
            </div>
            <p style={{ fontSize: 14, color: '#2C3E50', lineHeight: 1.8, fontWeight: 500 }}>{assignment.question}</p>
          </div>

          <div style={{ background: '#F7F8FA', borderRadius: 10, border: '1px solid #E8ECF0', padding: '14px 18px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#7F8C8D', marginBottom: 8 }}>评分维度</div>
            {[
              { label: '准确性', weight: '30%', color: '#4A6FA5' },
              { label: '完整性', weight: '25%', color: '#6B9E7A' },
              { label: '规范性', weight: '25%', color: '#D4A843' },
              { label: '创新性', weight: '20%', color: '#7A8F9E' },
            ].map(dim => (
              <div key={dim.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: '#2C3E50' }}>{dim.label}</span>
                <span style={{ fontSize: 12, color: dim.color, fontWeight: 500 }}>{dim.weight}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Answer area */}
        <div>
          {/* Tabs */}
          <div style={{ background: '#FFFFFF', borderRadius: 10, border: '1px solid #E8ECF0', overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ display: 'flex', borderBottom: '1px solid #E8ECF0' }}>
              {([['edit', '编辑', Edit3], ['preview', '预览', Eye]] as [Tab, string, React.ElementType][]).map(([tab, label, Icon]) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    flex: 1, padding: '11px 0', border: 'none',
                    background: activeTab === tab ? '#FFFFFF' : '#F7F8FA',
                    color: activeTab === tab ? '#4A6FA5' : '#7F8C8D',
                    cursor: 'pointer', fontSize: 13, fontWeight: activeTab === tab ? 600 : 400,
                    borderBottom: activeTab === tab ? '2px solid #4A6FA5' : '2px solid transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>
            <div style={{ padding: 16, minHeight: 300 }}>
              {activeTab === 'edit' ? (
                <>
                  <textarea
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="在此输入您的答案，支持 Markdown 格式...

例如：
## 公路工程标准体系

公路工程标准体系分为**六大板块**：
1. 公路建设
2. 公路养护
..."
                    style={{
                      width: '100%', minHeight: 280, padding: '12px 14px',
                      border: '1px solid #E8ECF0', borderRadius: 8, fontSize: 13,
                      color: '#2C3E50', outline: 'none', resize: 'vertical',
                      lineHeight: 1.8, boxSizing: 'border-box', fontFamily: 'monospace',
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8, fontSize: 12, color: '#A4B0BE' }}>
                    {wordCount} 字
                  </div>
                </>
              ) : (
                <div style={{ minHeight: 280, padding: '0 4px' }}>
                  {content ? (
                    <MarkdownRenderer content={content} />
                  ) : (
                    <div style={{ color: '#A4B0BE', fontSize: 13, textAlign: 'center', paddingTop: 60 }}>暂无内容可预览</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* File upload */}
          <div style={{ background: '#FFFFFF', borderRadius: 10, border: '1px solid #E8ECF0', padding: '18px 20px', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#2C3E50', marginBottom: 12 }}>
              上传文件 <span style={{ fontSize: 12, color: '#A4B0BE', fontWeight: 400 }}>（可选，支持 .pdf .docx）</span>
            </div>
            <FileUploader
              accept=".pdf,.docx"
              maxSizeMB={10}
              onFileChange={setUploadedFile}
              description="支持 .pdf, .docx 格式，最大 10MB，与文本内容可同时提交"
            />
          </div>

          {/* Error */}
          {formError && (
            <div style={{ background: '#FFEAEA', border: '1px solid #FFCCCC', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#C46B6B', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={15} /> {formError}
            </div>
          )}

          {/* Submit button */}
          <button
            onClick={handleSubmitClick}
            disabled={submitting}
            style={{
              width: '100%', padding: '12px 0', border: 'none', borderRadius: 8,
              background: submitting ? '#A4B0BE' : '#4A6FA5', color: '#FFFFFF',
              cursor: submitting ? 'not-allowed' : 'pointer', fontSize: 15, fontWeight: 500,
            }}
          >
            {submitting ? '提交中...' : '提交答案'}
          </button>
          <p style={{ textAlign: 'center', fontSize: 12, color: '#A4B0BE', marginTop: 8 }}>
            提交后 AI 将自动评分，结果在 60 秒内返回
          </p>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="确认提交答案"
        description="提交后 AI 将自动评分。若已有提交记录，新提交将覆盖原有评分结果。"
        confirmText="确认提交"
        onConfirm={handleConfirmSubmit}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
