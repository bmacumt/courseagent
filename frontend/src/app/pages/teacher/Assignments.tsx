import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Edit2, Trash2, Send, Users, Clock, ChevronDown, ChevronUp, Minus } from 'lucide-react';
import * as teacherApi from '../../api/teacher';
import type { AssignmentSummary } from '../../api/types';
import { ConfirmDialog, Modal } from '../../components/shared/ConfirmDialog';
import { PublishTag } from '../../components/shared/StatusTag';

type AssignmentItem = AssignmentSummary & {
  description?: string;
  question?: string;
  reference_answer?: string | null;
  grading_criteria?: string;
};

interface Dimension { name: string; label: string; weight: number; description: string; }

const defaultDimensions: Dimension[] = [
  { name: 'objective', label: '实验目的', weight: 0.15, description: '实验目的表述是否明确、具体，是否与研究问题紧密关联' },
  { name: 'hypothesis', label: '假设合理性', weight: 0.15, description: '提出的假设是否有科学依据，逻辑是否自洽，是否可检验' },
  { name: 'variables', label: '变量控制', weight: 0.20, description: '自变量、因变量的识别和控制是否合理，是否考虑了干扰变量' },
  { name: 'methodology', label: '方法可行性', weight: 0.20, description: '实验方法是否科学可行，步骤是否完整，工具和材料选择是否恰当' },
  { name: 'safety', label: '安全风险', weight: 0.15, description: '是否识别并评估了实验中的安全风险，防护措施是否到位' },
  { name: 'data_plan', label: '数据方案', weight: 0.10, description: '数据采集方案是否合理，样本量是否充足，分析方法是否适当' },
  { name: 'conclusion', label: '结论逻辑', weight: 0.05, description: '结论是否基于数据得出，推理是否严密，是否存在过度推断' },
];

const inputStyle = {
  width: '100%', height: 36, padding: '0 12px', border: '1px solid #DCDFE6',
  borderRadius: 6, fontSize: 13, color: '#2C3E50', outline: 'none', boxSizing: 'border-box' as const,
};

const textareaStyle = {
  width: '100%', padding: '10px 12px', border: '1px solid #DCDFE6',
  borderRadius: 6, fontSize: 13, color: '#2C3E50', outline: 'none',
  boxSizing: 'border-box' as const, resize: 'vertical' as const, lineHeight: 1.6,
};

function FormField({ label, children, required, hint }: { label: string; children: React.ReactNode; required?: boolean; hint?: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#2C3E50', marginBottom: 6 }}>
        {label}{required && <span style={{ color: '#C46B6B', marginLeft: 2 }}>*</span>}
        {hint && <span style={{ fontSize: 11, color: '#A4B0BE', fontWeight: 400, marginLeft: 6 }}>({hint})</span>}
      </label>
      {children}
    </div>
  );
}

export default function Assignments() {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [formModal, setFormModal] = useState(false);
  const [editTarget, setEditTarget] = useState<AssignmentItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<AssignmentItem | null>(null);
  const [publishConfirm, setPublishConfirm] = useState<AssignmentItem | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [question, setQuestion] = useState('');
  const [refAnswer, setRefAnswer] = useState('');
  const [deadline, setDeadline] = useState('');
  const [useCustomDims, setUseCustomDims] = useState(false);
  const [dimensions, setDimensions] = useState<Dimension[]>(defaultDimensions);
  const [formError, setFormError] = useState('');

  const fetchAssignments = () => {
    teacherApi.getAssignments()
      .then(data => setAssignments(data as AssignmentItem[]))
      .catch(err => {
        console.error('Failed to load assignments:', err);
        alert('加载作业列表失败');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  const openCreate = () => {
    setEditTarget(null);
    setTitle(''); setDescription(''); setQuestion(''); setRefAnswer(''); setDeadline('');
    setUseCustomDims(false); setDimensions(defaultDimensions); setFormError('');
    setFormModal(true);
  };

  const openEdit = (a: AssignmentItem) => {
    setEditTarget(a);
    setTitle(a.title); setDescription(a.description || ''); setQuestion(a.question || '');
    setRefAnswer(a.reference_answer || ''); setDeadline(a.deadline ? a.deadline.slice(0, 16) : '');
    setUseCustomDims(false); setDimensions(defaultDimensions); setFormError('');
    setFormModal(true);
  };

  const weightTotal = dimensions.reduce((s, d) => s + d.weight, 0);

  const handleSave = async () => {
    if (!title.trim()) { setFormError('请填写作业标题'); return; }
    if (!description.trim()) { setFormError('请填写题目描述'); return; }
    if (!question.trim()) { setFormError('请填写具体题目'); return; }
    if (useCustomDims && Math.abs(weightTotal - 1) > 0.01) { setFormError(`权重合计必须等于 1.0，当前为 ${weightTotal.toFixed(2)}`); return; }
    setFormError('');
    const criteria = {
      dimensions: useCustomDims ? dimensions : defaultDimensions,
    };
    const data = {
      title,
      description,
      question,
      reference_answer: refAnswer || null,
      grading_criteria: criteria,
      deadline: deadline ? `${deadline}:00` : null,
    };
    try {
      if (editTarget) {
        await teacherApi.updateAssignment(editTarget.id, data);
      } else {
        await teacherApi.createAssignment(data);
      }
      setFormModal(false);
      fetchAssignments();
    } catch (err) {
      console.error('Save assignment failed:', err);
      alert('保存作业失败');
    }
  };

  const handlePublish = async (a: AssignmentItem) => {
    try {
      await teacherApi.publishAssignment(a.id);
      fetchAssignments();
    } catch (err) {
      console.error('Publish assignment failed:', err);
      alert('发布作业失败');
    }
    setPublishConfirm(null);
  };

  const handleDelete = async (a: AssignmentItem) => {
    try {
      await teacherApi.deleteAssignment(a.id);
      setAssignments(prev => prev.filter(x => x.id !== a.id));
    } catch (err) {
      console.error('Delete assignment failed:', err);
      alert('删除作业失败');
    }
    setDeleteConfirm(null);
  };

  const updateDim = (i: number, field: keyof Dimension, value: string | number) => {
    setDimensions(prev => prev.map((d, idx) => idx === i ? { ...d, [field]: value } : d));
  };

  const formatDeadline = (d: string | null) => {
    if (!d) return null;
    const date = new Date(d);
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const isOverdue = (d: string | null) => d && new Date(d) < new Date();

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#2C3E50', marginBottom: 4 }}>作业管理</h1>
          <p style={{ fontSize: 13, color: '#7F8C8D' }}>创建和管理课程作业，发布后学生可见</p>
        </div>
        <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', border: 'none', borderRadius: 6, background: '#4A6FA5', color: '#FFFFFF', cursor: 'pointer', fontSize: 14 }}>
          <Plus size={15} /> 创建作业
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 64, color: '#7F8C8D', fontSize: 15 }}>加载中...</div>
      )}

      {/* Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
        {assignments.map(a => (
          <div key={a.id} style={{ background: '#FFFFFF', borderRadius: 10, border: '1px solid #E8ECF0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #F7F8FA' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#2C3E50', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</div>
                  <div style={{ fontSize: 13, color: '#7F8C8D', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.description}</div>
                </div>
                <PublishTag isPublished={a.is_published} />
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#A4B0BE' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Users size={12} /> {a.submission_count} 份提交
                </span>
                {a.deadline && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: isOverdue(a.deadline) ? '#C46B6B' : '#A4B0BE' }}>
                    <Clock size={12} /> {formatDeadline(a.deadline)}
                    {isOverdue(a.deadline) && ' (已截止)'}
                  </span>
                )}
              </div>
            </div>
            <div style={{ padding: '12px 20px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {a.is_published ? (
                <>
                  <button
                    onClick={() => navigate(`/teacher/assignments/${a.id}/submissions`)}
                    style={{ flex: 1, padding: '6px 0', border: 'none', borderRadius: 6, background: '#4A6FA5', color: '#FFFFFF', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                  >
                    <Users size={13} /> 查看提交
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => openEdit(a)} style={{ flex: 1, padding: '6px 0', border: '1px solid #E8ECF0', borderRadius: 6, background: '#FFFFFF', color: '#2C3E50', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <Edit2 size={13} /> 编辑
                  </button>
                  <button onClick={() => setPublishConfirm(a)} style={{ flex: 1, padding: '6px 0', border: 'none', borderRadius: 6, background: '#6B9E7A', color: '#FFFFFF', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <Send size={13} /> 发布
                  </button>
                  <button onClick={() => setDeleteConfirm(a)} style={{ padding: '6px 12px', border: '1px solid #FFCCCC', borderRadius: 6, background: '#FFEAEA', color: '#C46B6B', cursor: 'pointer', fontSize: 13 }}>
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {assignments.length === 0 && (
        <div style={{ textAlign: 'center', padding: 64, color: '#A4B0BE' }}>
          <div style={{ fontSize: 14, marginBottom: 16 }}>还没有作业，点击右上角创建</div>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal open={formModal} title={editTarget ? '编辑作业' : '创建作业'} onClose={() => setFormModal(false)} width={680}
        footer={
          <>
            <button onClick={() => setFormModal(false)} style={{ padding: '8px 20px', border: '1px solid #E8ECF0', borderRadius: 6, background: '#FFFFFF', color: '#2C3E50', cursor: 'pointer', fontSize: 14 }}>取消</button>
            <button onClick={handleSave} style={{ padding: '8px 20px', border: 'none', borderRadius: 6, background: '#4A6FA5', color: '#FFFFFF', cursor: 'pointer', fontSize: 14 }}>保存为草稿</button>
          </>
        }
      >
        {formError && <div style={{ background: '#FFEAEA', border: '1px solid #FFCCCC', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#C46B6B', marginBottom: 16 }}>{formError}</div>}
        <FormField label="作业标题" required>
          <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} placeholder="简洁明确的作业标题" />
        </FormField>
        <FormField label="题目描述" required hint="展示给学生">
          <textarea value={description} onChange={e => setDescription(e.target.value)} style={{ ...textareaStyle, height: 80 }} placeholder="向学生展示的题目描述，说明本次作业的背景和要求" />
        </FormField>
        <FormField label="具体题目" required hint="传给 AI 评分">
          <textarea value={question} onChange={e => setQuestion(e.target.value)} style={{ ...textareaStyle, height: 100 }} placeholder="精确的作答题目，AI 将基于此题目进行评分" />
        </FormField>
        <FormField label="参考答案" hint="选填，仅供 AI 评分参考">
          <textarea value={refAnswer} onChange={e => setRefAnswer(e.target.value)} style={{ ...textareaStyle, height: 80 }} placeholder="标准参考答案，不展示给学生" />
        </FormField>
        <FormField label="截止时间" hint="选填">
          <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} style={inputStyle} />
        </FormField>

        {/* Grading criteria */}
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: '#2C3E50' }}>评分标准</label>
          <div style={{ display: 'flex', gap: 16, marginTop: 8, marginBottom: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
              <input type="radio" checked={!useCustomDims} onChange={() => setUseCustomDims(false)} /> 默认（实验目的/假设合理性/变量控制/方法可行性/安全风险/数据方案/结论逻辑）
            </label>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, marginBottom: 12 }}>
            <input type="radio" checked={useCustomDims} onChange={() => setUseCustomDims(true)} /> 自定义维度
          </label>
          {useCustomDims && (
            <div style={{ border: '1px solid #E8ECF0', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr 40px', gap: 0, background: '#F7F8FA', padding: '8px 12px', fontSize: 12, fontWeight: 600, color: '#7F8C8D' }}>
                <span>维度名称</span><span>权重</span><span>评分说明</span><span></span>
              </div>
              {dimensions.map((d, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr 40px', gap: 8, padding: '8px 12px', borderTop: '1px solid #F0F2F5', alignItems: 'center' }}>
                  <input value={d.label} onChange={e => updateDim(i, 'label', e.target.value)} style={{ ...inputStyle, height: 32 }} placeholder="维度名称" />
                  <input type="number" min="0" max="1" step="0.05" value={d.weight} onChange={e => updateDim(i, 'weight', parseFloat(e.target.value))} style={{ ...inputStyle, height: 32 }} />
                  <input value={d.description} onChange={e => updateDim(i, 'description', e.target.value)} style={{ ...inputStyle, height: 32 }} placeholder="说明" />
                  <button onClick={() => setDimensions(prev => prev.filter((_, j) => j !== i))} style={{ background: '#FFEAEA', border: '1px solid #FFCCCC', borderRadius: 5, cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C46B6B' }}>
                    <Minus size={13} />
                  </button>
                </div>
              ))}
              <div style={{ padding: '8px 12px', borderTop: '1px solid #F0F2F5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button onClick={() => setDimensions(prev => [...prev, { name: `dim_${prev.length}`, label: '新维度', weight: 0, description: '' }])}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', border: '1px solid #E8ECF0', borderRadius: 5, background: '#FFFFFF', color: '#4A6FA5', cursor: 'pointer', fontSize: 13 }}>
                  <Plus size={13} /> 添加维度
                </button>
                <span style={{ fontSize: 13, color: Math.abs(weightTotal - 1) > 0.01 ? '#C46B6B' : '#6B9E7A', fontWeight: 500 }}>
                  权重合计：{weightTotal.toFixed(2)}
                  {Math.abs(weightTotal - 1) <= 0.01 ? ' ✓' : ' (需 = 1.0)'}
                </span>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!publishConfirm}
        title="确认发布作业"
        description={`发布后学生将看到"${publishConfirm?.title}"，发布后不可再编辑。确认发布？`}
        confirmText="确认发布"
        onConfirm={() => publishConfirm && handlePublish(publishConfirm)}
        onCancel={() => setPublishConfirm(null)}
      />

      <ConfirmDialog
        open={!!deleteConfirm}
        title="确认删除作业"
        description={`将删除草稿作业"${deleteConfirm?.title}"，此操作不可撤销。`}
        confirmText="确认删除"
        danger
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
