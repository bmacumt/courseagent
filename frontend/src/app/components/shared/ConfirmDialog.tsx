import { ReactNode } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 12,
          padding: 28,
          width: 420,
          maxWidth: '90vw',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: danger ? '#FFEAEA' : '#EBF3FF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <AlertTriangle size={20} color={danger ? '#C46B6B' : '#4A6FA5'} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#2C3E50', marginBottom: 6 }}>{title}</div>
            {description && <div style={{ fontSize: 14, color: '#7F8C8D', lineHeight: 1.6 }}>{description}</div>}
          </div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7F8C8D', padding: 4, flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 20px', borderRadius: 6, border: '1px solid #E8ECF0',
              background: '#FFFFFF', color: '#2C3E50', cursor: 'pointer', fontSize: 14,
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 20px', borderRadius: 6, border: 'none',
              background: danger ? '#C46B6B' : '#4A6FA5',
              color: '#FFFFFF', cursor: 'pointer', fontSize: 14,
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// Generic modal wrapper
interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  footer?: ReactNode;
}

export function Modal({ open, title, onClose, children, width = 560, footer }: ModalProps) {
  if (!open) return null;
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#FFFFFF', borderRadius: 12, width, maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #E8ECF0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#2C3E50' }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7F8C8D', padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: 24, overflow: 'auto', flex: 1 }}>
          {children}
        </div>
        {footer && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid #E8ECF0', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
