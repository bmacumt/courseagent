import { Loader2 } from 'lucide-react';
import { SubmissionStatus } from '../../data/mockData';

const statusConfig: Record<SubmissionStatus, { bg: string; color: string; label: string }> = {
  submitted: { bg: '#F0F2F5', color: '#7F8C8D', label: '已提交' },
  grading: { bg: '#EBF3FF', color: '#4A6FA5', label: 'AI 评分中' },
  graded: { bg: '#EDFAF2', color: '#6B9E7A', label: '已评分' },
  failed: { bg: '#FFEAEA', color: '#C46B6B', label: '评分失败' },
};

interface StatusTagProps {
  status: SubmissionStatus;
}

export function StatusTag({ status }: StatusTagProps) {
  const config = statusConfig[status];
  return (
    <span
      style={{
        background: config.bg,
        color: config.color,
        borderRadius: 4,
        padding: '2px 10px',
        fontSize: 12,
        fontWeight: 500,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        whiteSpace: 'nowrap',
      }}
    >
      {status === 'grading' && <Loader2 size={11} className="animate-spin" />}
      {config.label}
    </span>
  );
}

interface PublishTagProps {
  isPublished: boolean;
}

export function PublishTag({ isPublished }: PublishTagProps) {
  return (
    <span
      style={{
        background: isPublished ? '#EDFAF2' : '#F0F2F5',
        color: isPublished ? '#6B9E7A' : '#7F8C8D',
        borderRadius: 4,
        padding: '2px 10px',
        fontSize: 12,
        fontWeight: 500,
        display: 'inline-flex',
        alignItems: 'center',
      }}
    >
      {isPublished ? '已发布' : '草稿'}
    </span>
  );
}

interface RoleTagProps {
  role: 'admin' | 'teacher' | 'student';
}

export function RoleTag({ role }: RoleTagProps) {
  const config = {
    admin: { bg: '#EBF3FF', color: '#4A6FA5', label: '管理员' },
    teacher: { bg: '#EDFAF2', color: '#6B9E7A', label: '教师' },
    student: { bg: '#F0F2F5', color: '#7F8C8D', label: '学生' },
  };
  const c = config[role];
  return (
    <span
      style={{
        background: c.bg,
        color: c.color,
        borderRadius: 4,
        padding: '2px 8px',
        fontSize: 12,
        fontWeight: 500,
      }}
    >
      {c.label}
    </span>
  );
}
