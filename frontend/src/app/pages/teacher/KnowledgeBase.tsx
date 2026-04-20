import { useState, useEffect } from 'react';
import { Trash2, FileText, Loader2, CheckCircle, Plus, Database, Play, RefreshCw, Video, Eye } from 'lucide-react';
import * as teacherApi from '../../api/teacher';
import type { DocumentResponse } from '../../api/types';
import { ConfirmDialog, Modal } from '../../components/shared/ConfirmDialog';
import { FileUploader } from '../../components/shared/FileUploader';

const docTypeConfig: Record<string, { label: string; color: string; bg: string }> = {
  specification: { label: '规范', color: '#4A6FA5', bg: '#EBF3FF' },
  textbook: { label: '教材', color: '#6B8F71', bg: '#EDFAF2' },
  other: { label: '其他', color: '#7A8F9E', bg: '#F0F2F5' },
  laws: { label: '规范', color: '#4A6FA5', bg: '#EBF3FF' },
  book: { label: '教材', color: '#6B8F71', bg: '#EDFAF2' },
  table: { label: '表格', color: '#D4A843', bg: '#FFF8EB' },
  paper: { label: '论文', color: '#8B5CF6', bg: '#F3F0FF' },
  ppt: { label: '课件', color: '#6B8F71', bg: '#EDFAF2' },
  mooc: { label: '慕课', color: '#E85D75', bg: '#FFF0F3' },
};

export default function KnowledgeBase() {
  const [docs, setDocs] = useState<DocumentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<DocumentResponse | null>(null);
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadType, setUploadType] = useState<string>('book');
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [formError, setFormError] = useState('');
  const [parsingIds, setParsingIds] = useState<Set<number>>(new Set());
  const [previewDoc, setPreviewDoc] = useState<DocumentResponse | null>(null);
  const [previewChunks, setPreviewChunks] = useState<{index: number; text: string; source: string}[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  const fetchDocs = () => {
    teacherApi.getDocuments()
      .then(setDocs)
      .catch(err => {
        console.error('Failed to load documents:', err);
        alert('加载文档列表失败');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const handleUpload = async () => {
    if (!uploadTitle.trim()) { setFormError('请填写文档标题'); return; }
    if (!uploadFile) { setFormError('请选择要上传的文件'); return; }
    setFormError('');
    setUploading(true);
    try {
      await teacherApi.uploadDocument(uploadTitle, uploadFile, uploadType);
      setUploadSuccess(true);
      setTimeout(() => {
        setUploadSuccess(false);
        setUploadModal(false);
        setUploadTitle('');
        setUploadFile(null);
        setUploadType('book');
        fetchDocs();
      }, 1000);
    } catch (err) {
      console.error('Upload failed:', err);
      setFormError('上传失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploading(false);
    }
  };

  const handleParse = async (doc: DocumentResponse) => {
    setParsingIds(prev => new Set(prev).add(doc.id));
    try {
      await teacherApi.parseDocument(doc.id);
      // Poll until done
      const poll = setInterval(() => {
        teacherApi.getDocuments().then((newDocs: DocumentResponse[]) => {
          const updated = newDocs.find((d: DocumentResponse) => d.id === doc.id);
          if (updated && updated.parse_status !== 'parsing') {
            clearInterval(poll);
            setParsingIds(prev => { const s = new Set(prev); s.delete(doc.id); return s; });
            setDocs(newDocs);
          }
        });
      }, 3000);
    } catch (err) {
      console.error('Parse failed:', err);
      setParsingIds(prev => { const s = new Set(prev); s.delete(doc.id); return s; });
      alert('解析失败: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleDelete = async (doc: DocumentResponse) => {
    try {
      await teacherApi.deleteDocument(doc.id);
      setDocs(prev => prev.filter(d => d.id !== doc.id));
    } catch (err) {
      console.error('Delete failed:', err);
      alert('删除失败');
    }
    setDeleteTarget(null);
  };

  const handlePreview = async (doc: DocumentResponse) => {
    setPreviewDoc(doc);
    setPreviewLoading(true);
    try {
      const data = await teacherApi.getDocumentChunks(doc.id);
      setPreviewChunks(data.chunks);
    } catch (err) {
      console.error('Preview failed:', err);
      alert('加载分块失败');
    } finally {
      setPreviewLoading(false);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return '';
    const date = new Date(d);
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const inputStyle = {
    width: '100%', height: 36, padding: '0 12px', border: '1px solid #DCDFE6',
    borderRadius: 6, fontSize: 13, color: '#2C3E50', outline: 'none', boxSizing: 'border-box' as const,
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#2C3E50', marginBottom: 4 }}>知识库管理</h1>
          <p style={{ fontSize: 13, color: '#7F8C8D' }}>上传课程文档或慕课音视频，供 AI 评分和问答时检索引用</p>
        </div>
        <button
          onClick={() => { setUploadModal(true); setUploadTitle(''); setUploadFile(null); setFormError(''); setUploadSuccess(false); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', border: 'none', borderRadius: 6, background: '#4A6FA5', color: '#FFFFFF', cursor: 'pointer', fontSize: 14 }}
        >
          <Plus size={15} /> 上传文档
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        {(['laws', 'book', 'table', 'paper', 'ppt', 'mooc'] as string[]).map(type => {
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

      {loading && (
        <div style={{ textAlign: 'center', padding: 48, color: '#7F8C8D', fontSize: 15 }}>加载中...</div>
      )}

      {/* Document Table */}
      <div style={{ background: '#FFFFFF', borderRadius: 10, border: '1px solid #E8ECF0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F7F8FA' }}>
              {['文档标题', '类型', '文件名', '分块数', '上传时间', '操作'].map(h => (
                <th key={h} style={{ padding: '12px 18px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#7F8C8D', borderBottom: '1px solid #F0F2F5' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {docs.map((doc: DocumentResponse, i: number) => {
              const cfg = docTypeConfig[doc.doc_type] || docTypeConfig.other;
              const isParsing = doc.parse_status === 'parsing' || parsingIds.has(doc.id);
              const isParsed = doc.parse_status === 'parsed';
              const isFailed = doc.parse_status === 'failed';
              return (
                <tr key={doc.id} style={{ background: i % 2 === 1 ? '#FAFBFC' : '#FFFFFF' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F0F6FF')}
                  onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 1 ? '#FAFBFC' : '#FFFFFF')}>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        background: isParsed ? '#6B9E7A' : isParsing ? '#D4A843' : isFailed ? '#C46B6B' : '#A4B0BE',
                        boxShadow: isParsing ? '0 0 4px #D4A843' : 'none',
                      }} />
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {doc.doc_type === 'mooc' ? <Video size={15} color={cfg.color} /> : <FileText size={15} color={cfg.color} />}
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 500, color: '#2C3E50' }}>{doc.title}</span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 4, padding: '2px 8px', fontSize: 12 }}>{cfg.label}</span>
                  </td>
                  <td style={{ padding: '14px 18px', fontSize: 13, color: '#7F8C8D' }}>{doc.filename}</td>
                  <td style={{ padding: '14px 18px' }}>
                    {isParsing ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Loader2 size={13} className="animate-spin" color="#D4A843" />
                        <span style={{ fontSize: 13, color: '#D4A843' }}>解析中...</span>
                      </span>
                    ) : isParsed ? (
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#2C3E50' }}>{doc.chunk_count}<span style={{ fontSize: 12, color: '#A4B0BE', marginLeft: 4, fontWeight: 400 }}>块</span></span>
                    ) : (
                      <span style={{ fontSize: 13, color: '#A4B0BE' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '14px 18px', fontSize: 12, color: '#A4B0BE' }}>{formatDate(doc.uploaded_at)}</td>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {!isParsed && (
                        <button
                          onClick={() => handleParse(doc)}
                          disabled={isParsing}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                            border: isParsing ? '1px solid #E8ECF0' : '1px solid #B8D4E8',
                            borderRadius: 5,
                            background: isParsing ? '#F7F8FA' : '#EBF3FF',
                            color: isParsing ? '#A4B0BE' : '#4A6FA5',
                            cursor: isParsing ? 'not-allowed' : 'pointer',
                            fontSize: 12,
                          }}
                        >
                          {isParsing ? <><Loader2 size={13} className="animate-spin" /> 解析中</> : isFailed ? <><RefreshCw size={13} /> 重新解析</> : <><Play size={13} /> 解析</>}
                        </button>
                      )}
                      {isParsed && (
                        <>
                          <button
                            onClick={() => handlePreview(doc)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                              border: '1px solid #B8D4E8', borderRadius: 5,
                              background: '#EBF3FF', color: '#4A6FA5',
                              cursor: 'pointer', fontSize: 12,
                            }}
                          >
                            <Eye size={13} /> 预览
                          </button>
                          <button
                            onClick={() => handleParse(doc)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                              border: '1px solid #E8ECF0', borderRadius: 5,
                              background: '#F7F8FA', color: '#7A8F9E',
                              cursor: 'pointer', fontSize: 12,
                            }}
                          >
                            <RefreshCw size={13} /> 重新解析
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setDeleteTarget(doc)}
                        disabled={isParsing}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                          border: '1px solid #FFCCCC', borderRadius: 5,
                          background: '#FFEAEA', color: '#C46B6B',
                          cursor: isParsing ? 'not-allowed' : 'pointer', fontSize: 12,
                          opacity: isParsing ? 0.5 : 1,
                        }}
                      >
                        <Trash2 size={13} /> 删除
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {docs.length === 0 && (
          <div style={{ textAlign: 'center', padding: 48, color: '#A4B0BE' }}>
            <Database size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }} />
            <div style={{ fontSize: 14 }}>暂无文档，点击右上角上传</div>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <Modal
        open={uploadModal}
        title="上传文档"
        onClose={() => !uploading && setUploadModal(false)}
        width={520}
        footer={!uploadSuccess ? (
          <>
            <button onClick={() => setUploadModal(false)} disabled={uploading} style={{ padding: '8px 20px', border: '1px solid #E8ECF0', borderRadius: 6, background: '#FFFFFF', color: '#2C3E50', cursor: uploading ? 'not-allowed' : 'pointer', fontSize: 14 }}>取消</button>
            <button onClick={handleUpload} disabled={uploading} style={{ padding: '8px 20px', border: 'none', borderRadius: 6, background: uploading ? '#A4B0BE' : '#4A6FA5', color: '#FFFFFF', cursor: uploading ? 'not-allowed' : 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              {uploading && <Loader2 size={14} className="animate-spin" />}
              {uploading ? '处理中...' : '上传'}
            </button>
          </>
        ) : undefined}
      >
        {uploadSuccess ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <CheckCircle size={48} color="#6B9E7A" style={{ margin: '0 auto 16px', display: 'block' }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: '#2C3E50', marginBottom: 8 }}>上传成功！</div>
            <div style={{ fontSize: 13, color: '#7F8C8D' }}>请在文档列表中点击「解析」按钮开始处理</div>
          </div>
        ) : (
          <>
            {formError && <div style={{ background: '#FFEAEA', border: '1px solid #FFCCCC', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#C46B6B', marginBottom: 16 }}>{formError}</div>}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#2C3E50', marginBottom: 6 }}>文档标题 <span style={{ color: '#C46B6B' }}>*</span></label>
              <input value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} style={inputStyle} placeholder="例：JTG 1001-2017 公路工程标准体系" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#2C3E50', marginBottom: 6 }}>文档类型</label>
              <select value={uploadType} onChange={e => setUploadType(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="laws">规范/法规</option>
                <option value="book">教材/讲义</option>
                <option value="table">表格</option>
                <option value="paper">论文</option>
                <option value="ppt">课件</option>
                <option value="mooc">慕课音视频</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#2C3E50', marginBottom: 6 }}>{uploadType === 'mooc' ? '音视频文件' : 'PDF 文件'} <span style={{ color: '#C46B6B' }}>*</span></label>
              <FileUploader
                accept={uploadType === 'mooc' ? '.mp4,.avi,.mov,.mkv,.webm,.mp3,.wav,.aac,.flac,.ogg,.m4a,.wma' : '.pdf'}
                maxSizeMB={uploadType === 'mooc' ? 500 : 50}
                onFileChange={setUploadFile}
                description={uploadType === 'mooc' ? '支持音视频格式 (mp4/avi/mov/mkv/webm/mp3/wav/aac/flac/ogg/m4a/wma)，建议不超过 500MB' : '仅支持 .pdf 格式，建议文件大小不超过 50MB'}
              />
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="确认删除文档"
        description={`将删除文档"${deleteTarget?.title}"，关联的向量数据也将同步清除，此操作不可撤销。`}
        confirmText="确认删除"
        danger
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Preview Modal */}
      <Modal
        open={!!previewDoc}
        title={`分块预览 — ${previewDoc?.title || ''}`}
        onClose={() => { setPreviewDoc(null); setPreviewChunks([]); }}
        width={700}
        footer={null}
      >
        {previewLoading ? (
          <div style={{ textAlign: 'center', padding: 32, color: '#7F8C8D' }}>
            <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 12px', display: 'block' }} />
            加载中...
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