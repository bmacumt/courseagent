import { useState, useEffect } from 'react';
import { FileText, Video, Eye, Loader2, Database } from 'lucide-react';
import * as adminApi from '../../api/admin';
import type { AdminDocumentItem } from '../../api/types';
import { Modal } from '../../components/shared/ConfirmDialog';

const docTypeConfig: Record<string, { label: string; color: string; bg: string }> = {
  laws: { label: '规范', color: '#4A6FA5', bg: '#EBF3FF' },
  book: { label: '教材', color: '#6B8F71', bg: '#EDFAF2' },
  table: { label: '表格', color: '#D4A843', bg: '#FFF8EB' },
  paper: { label: '论文', color: '#8B5CF6', bg: '#F3F0FF' },
  ppt: { label: '课件', color: '#6B8F71', bg: '#EDFAF2' },
  mooc: { label: '慕课', color: '#E85D75', bg: '#FFF0F3' },
  other: { label: '其他', color: '#7A8F9E', bg: '#F0F2F5' },
};

export default function AdminKnowledge() {
  const [docs, setDocs] = useState<AdminDocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewChunks, setPreviewChunks] = useState<{index: number; text: string; source: string}[]>([]);
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => { fetchDocs(); }, []);

  const fetchDocs = () => {
    adminApi.getAdminDocuments()
      .then(setDocs)
      .catch(() => alert('加载文档列表失败'))
      .finally(() => setLoading(false));
  };

  const handlePreview = async (doc: AdminDocumentItem) => {
    setPreviewTitle(doc.title);
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewChunks([]);
    try {
      const data = await adminApi.getAdminChunks(doc.id);
      setPreviewChunks(data.chunks);
    } catch { alert('加载分块失败'); }
    finally { setPreviewLoading(false); }
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
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#2C3E50', marginBottom: 4 }}>知识库管理</h1>
        <p style={{ fontSize: 13, color: '#7F8C8D' }}>查看所有教师上传的文档和分块情况</p>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        {(['laws','book','table','paper','ppt','mooc'] as string[]).map(type => {
          const count = docs.filter(d => d.doc_type === type).length;
          const cfg = docTypeConfig[type] || docTypeConfig.other;
          return (
            <div key={type} style={{ background: '#FFFFFF', borderRadius: 8, border: '1px solid #E8ECF0', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color }} />
              <span style={{ fontSize: 13, color: '#7F8C8D' }}>{cfg.label}</span>
              <span style={{ fontSize: 18, fontWeight: 600, color: cfg.color }}>{count}</span>
            </div>
          );
        })}
        <div style={{ background: '#FFFFFF', borderRadius: 8, border: '1px solid #E8ECF0', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: '#7F8C8D' }}>分块总数</span>
          <span style={{ fontSize: 18, fontWeight: 600, color: '#2C3E50' }}>{docs.reduce((s, d) => s + d.chunk_count, 0)}</span>
        </div>
      </div>

      <div style={{ background: '#FFFFFF', borderRadius: 10, border: '1px solid #E8ECF0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F7F8FA' }}>
              {['文档标题', '类型', '上传教师', '文件名', '分块数', '状态', '上传时间', '操作'].map(h => (
                <th key={h} style={{ padding: '12px 18px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#7F8C8D', borderBottom: '1px solid #F0F2F5' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {docs.map((doc, i) => {
              const cfg = docTypeConfig[doc.doc_type] || docTypeConfig.other;
              const isParsed = doc.parse_status === 'parsed';
              const isParsing = doc.parse_status === 'parsing';
              const isFailed = doc.parse_status === 'failed';
              return (
                <tr key={doc.id} style={{ background: i%2===1 ? '#FAFBFC' : '#FFFFFF' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F0F6FF')}
                  onMouseLeave={e => (e.currentTarget.style.background = i%2===1 ? '#FAFBFC' : '#FFFFFF')}>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        background: isParsed ? '#6B9E7A' : isParsing ? '#D4A843' : isFailed ? '#C46B6B' : '#A4B0BE' }} />
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {doc.doc_type === 'mooc' ? <Video size={15} color={cfg.color} /> : <FileText size={15} color={cfg.color} />}
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 500, color: '#2C3E50' }}>{doc.title}</span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 4, padding: '2px 8px', fontSize: 12 }}>{cfg.label}</span>
                  </td>
                  <td style={{ padding: '14px 18px', fontSize: 13, color: '#2C3E50' }}>{doc.owner_name || '—'}</td>
                  <td style={{ padding: '14px 18px', fontSize: 13, color: '#7F8C8D', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.filename}</td>
                  <td style={{ padding: '14px 18px' }}>
                    {isParsing ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Loader2 size={13} className="animate-spin" color="#D4A843" />
                        <span style={{ fontSize: 13, color: '#D4A843' }}>解析中...</span>
                      </span>
                    ) : isParsed ? (
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#2C3E50' }}>{doc.chunk_count}<span style={{ fontSize: 12, color: '#A4B0BE', marginLeft: 4, fontWeight: 400 }}>块</span></span>
                    ) : isFailed ? (
                      <span style={{ fontSize: 13, color: '#C46B6B' }}>失败</span>
                    ) : (
                      <span style={{ fontSize: 13, color: '#A4B0BE' }}>待解析</span>
                    )}
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <span style={{ background: isParsed ? '#EDFAF2' : isParsing ? '#FFF8E6' : isFailed ? '#FFEAEA' : '#F0F2F5',
                      color: isParsed ? '#6B9E7A' : isParsing ? '#D4A843' : isFailed ? '#C46B6B' : '#A4B0BE',
                      borderRadius: 4, padding: '2px 8px', fontSize: 11 }}>
                      {isParsed ? '已解析' : isParsing ? '解析中' : isFailed ? '失败' : '待解析'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 18px', fontSize: 12, color: '#A4B0BE' }}>{formatDate(doc.uploaded_at)}</td>
                  <td style={{ padding: '14px 18px' }}>
                    {isParsed && (
                      <button onClick={() => handlePreview(doc)} style={{
                        display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                        border: '1px solid #B8D4E8', borderRadius: 5, background: '#EBF3FF', color: '#4A6FA5', cursor: 'pointer', fontSize: 12,
                      }}>
                        <Eye size={13} /> 预览
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {docs.length === 0 && (
          <div style={{ textAlign: 'center', padding: 48, color: '#A4B0BE' }}>
            <Database size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }} />
            <div style={{ fontSize: 14 }}>暂无文档</div>
          </div>
        )}
      </div>

      <Modal open={previewOpen} title={`分块预览 — ${previewTitle}`}
        onClose={() => setPreviewOpen(false)} width={700} footer={null}>
        {previewLoading ? (
          <div style={{ textAlign: 'center', padding: 32, color: '#7F8C8D' }}>
            <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 12px', display: 'block' }} />加载中...
          </div>
        ) : previewChunks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: '#A4B0BE' }}>暂无分块数据</div>
        ) : (
          <div style={{ maxHeight: 500, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, color: '#7F8C8D', marginBottom: 4 }}>共 {previewChunks.length} 个分块</div>
            {previewChunks.map((c: {index: number; text: string; source: string}) => (
              <div key={c.index} style={{ background: '#F7F8FA', borderRadius: 8, padding: '12px 16px', border: '1px solid #F0F2F5' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ background: '#EBF3FF', color: '#4A6FA5', borderRadius: 4, padding: '1px 8px', fontSize: 11, fontWeight: 500 }}>#{c.index + 1}</span>
                  {c.source && <span style={{ fontSize: 11, color: '#A4B0BE' }}>{c.source}</span>}
                </div>
                <div style={{ fontSize: 13, color: '#2C3E50', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{c.text}</div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
