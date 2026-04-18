import { useState, useRef, DragEvent } from 'react';
import { Upload, X, FileText } from 'lucide-react';

interface FileUploaderProps {
  accept?: string;
  maxSizeMB?: number;
  onFileChange?: (file: File | null) => void;
  description?: string;
}

export function FileUploader({
  accept = '.pdf,.docx',
  maxSizeMB = 10,
  onFileChange,
  description = '支持 .pdf, .docx 格式，文件大小不超过 10MB',
}: FileUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = (f: File): string => {
    const ext = f.name.split('.').pop()?.toLowerCase() || '';
    const allowedExts = accept.split(',').map((a) => a.trim().replace('.', '').toLowerCase());
    if (!allowedExts.includes(ext)) return `文件格式不支持，请上传 ${accept} 格式`;
    if (f.size > maxSizeMB * 1024 * 1024) return `文件大小超过 ${maxSizeMB}MB 限制`;
    return '';
  };

  const handleFile = (f: File) => {
    const err = validate(f);
    if (err) {
      setError(err);
      return;
    }
    setError('');
    setFile(f);
    onFileChange?.(f);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleRemove = () => {
    setFile(null);
    setError('');
    onFileChange?.(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div>
      {!file ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? '#4A6FA5' : '#DCDFE6'}`,
            borderRadius: 8,
            background: dragging ? '#F0F6FF' : '#FAFBFC',
            height: 200,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <Upload size={32} color={dragging ? '#4A6FA5' : '#A4B0BE'} />
          <div style={{ fontSize: 14, color: dragging ? '#4A6FA5' : '#7F8C8D', fontWeight: 500 }}>
            拖拽文件到此处，或<span style={{ color: '#4A6FA5' }}>点击上传</span>
          </div>
          <div style={{ fontSize: 12, color: '#A4B0BE' }}>{description}</div>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>
      ) : (
        <div style={{
          border: '1px solid #E8ECF0',
          borderRadius: 8,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: '#FAFBFC',
        }}>
          <div style={{ width: 36, height: 36, background: '#EBF3FF', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FileText size={18} color="#4A6FA5" />
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#2C3E50', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
            <div style={{ fontSize: 12, color: '#7F8C8D' }}>{formatSize(file.size)}</div>
          </div>
          <button
            onClick={handleRemove}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7F8C8D', padding: 4, flexShrink: 0 }}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {error && <div style={{ fontSize: 12, color: '#C46B6B', marginTop: 6 }}>{error}</div>}
    </div>
  );
}
