import { useState, useEffect } from 'react';
import { Upload, Trash2, FileText, Loader2, CheckCircle, Plus, Database } from 'lucide-react';
import * as teacherApi from '../../api/teacher';
import type { DocumentResponse } from '../../api/types';
import { ConfirmDialog, Modal } from '../../components/shared/ConfirmDialog';
import { FileUploader } from '../../components/shared/FileUploader';

const docTypeConfig: Record<string, { label: string; color: string; bg: string }> = {
  specification: { label: '规范', color: '#4A6FA5', bg: '#EBF3FF' },
  textbook: { label: '教材', color: '#6B8F71', bg: '#EDFAF2' },
  other: { label: '其他', color: '#7A8F9E', bg: '#F0F2F5' },
};

export default function KnowledgeBase() {
  const [docs, setDocs] = useState<DocumentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<DocumentResponse | null>(null);
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadType, setUploadType] = useState<string>('specification');
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [formError, setFormError] = useState('');

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
      setUploading(false);
      setUploadSuccess(true);
      setTimeout(() => {
        setUploadSuccess(false);
        setUploadModal(false);
        setUploadTitle('');
        setUploadFile(null);
        setUploadType('specification');
        fetchDocs();
      }, 1500);
    } catch (err) {
      console.error('Upload failed:', err);
      setUploading(false);
      alert('上传失败');
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
          <p style={{ fontSize: 13, color: '#7F8C8D' }}>上传课程规范文档，供 AI 评分时检索引用</p>
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
        {(['specification', 'textbook', 'other'] as string[]).map(type => {
          const count = docs.filter(d => d.doc_type === type).length;
          const cfg = docTypeConfig[type];
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
            {docs.map((doc, i) => {
              const cfg = docTypeConfig[doc.doc_type];
              return (
                <tr key={doc.id} style={{ background: i % 2 === 1 ? '#FAFBFC' : '#FFFFFF' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F0F6FF')}
                  onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 1 ? '#FAFBFC' : '#FFFFFF')}>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileText size={15} color={cfg.color} />
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 500, color: '#2C3E50' }}>{doc.title}</span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 4, padding: '2px 8px', fontSize: 12 }}>{cfg.label}</span>
                  </td>
                  <td style={{ padding: '14px 18px', fontSize: 13, color: '#7F8C8D' }}>{doc.filename}</td>
                  <td style={{ padding: '14px 18px' }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#2C3E50' }}>{doc.chunk_count}</span>
                    <span style={{ fontSize: 12, color: '#A4B0BE', marginLeft: 4 }}>块</span>
                  </td>
                  <td style={{ padding: '14px 18px', fontSize: 12, color: '#A4B0BE' }}>{formatDate(doc.uploaded_at)}</td>
                  <td style={{ padding: '14px 18px' }}>
                    <button
                      onClick={() => setDeleteTarget(doc)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', border: '1px solid #FFCCCC', borderRadius: 5, background: '#FFEAEA', color: '#C46B6B', cursor: 'pointer', fontSize: 12 }}
                    >
                      <Trash2 size={13} /> 删除
                    </button>
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
            <div style={{ fontSize: 13, color: '#7F8C8D' }}>文档已解析分块并写入知识库</div>
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
                <option value="specification">规范</option>
                <option value="textbook">教材</option>
                <option value="other">其他</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#2C3E50', marginBottom: 6 }}>PDF 文件 <span style={{ color: '#C46B6B' }}>*</span></label>
              <FileUploader accept=".pdf" maxSizeMB={50} onFileChange={setUploadFile} description="仅支持 .pdf 格式，建议文件大小不超过 50MB" />
            </div>
            {uploading && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#7F8C8D', marginBottom: 8 }}>
                  <span>MinerU 解析并分块中...</span>
                </div>
                <div style={{ height: 6, background: '#E8ECF0', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: '60%', background: '#4A6FA5', borderRadius: 3, animation: 'progress 1.5s ease-in-out infinite' }} />
                </div>
              </div>
            )}
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
    </div>
  );
}