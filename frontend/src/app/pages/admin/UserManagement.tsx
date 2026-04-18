import { useState } from 'react';
import { Search, Plus, Edit2, Trash2, Upload, Download, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { mockUsers, User, Role } from '../../data/mockData';
import { ConfirmDialog, Modal } from '../../components/shared/ConfirmDialog';
import { RoleTag } from '../../components/shared/StatusTag';

const PAGE_SIZE = 8;

interface UserFormData {
  username: string;
  password: string;
  role: Role;
  real_name: string;
  student_id: string;
  class_name: string;
}

const emptyForm: UserFormData = {
  username: '', password: '', role: 'student',
  real_name: '', student_id: '', class_name: '',
};

function FormField({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#2C3E50', marginBottom: 6 }}>
        {label}{required && <span style={{ color: '#C46B6B', marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%', height: 36, padding: '0 12px', border: '1px solid #DCDFE6',
  borderRadius: 6, fontSize: 13, color: '#2C3E50', outline: 'none', boxSizing: 'border-box' as const,
};

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [classFilter, setClassFilter] = useState('');
  const [page, setPage] = useState(1);

  const [editModal, setEditModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserFormData>(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<User | null>(null);
  const [batchModal, setBatchModal] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [batchResult, setBatchResult] = useState<{ success: number; failed: { row: number; reason: string }[] } | null>(null);
  const [formError, setFormError] = useState('');

  const classes = Array.from(new Set(users.filter(u => u.class_name).map(u => u.class_name!)));

  const filtered = users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (classFilter && u.class_name !== classFilter) return false;
    if (search && !`${u.username}${u.real_name}${u.student_id}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openCreate = () => {
    setEditUser(null);
    setForm(emptyForm);
    setFormError('');
    setEditModal(true);
  };
  const openEdit = (u: User) => {
    setEditUser(u);
    setForm({ username: u.username, password: '', role: u.role, real_name: u.real_name || '', student_id: u.student_id || '', class_name: u.class_name || '' });
    setFormError('');
    setEditModal(true);
  };

  const handleSave = () => {
    if (!form.username) { setFormError('用户名不能为空'); return; }
    if (!editUser && !form.password) { setFormError('密码不能为空'); return; }
    if (editUser) {
      setUsers(users.map(u => u.id === editUser.id ? { ...u, real_name: form.real_name, class_name: form.class_name, student_id: form.student_id } : u));
    } else {
      const existing = users.find(u => u.username === form.username);
      if (existing) { setFormError('用户名已存在'); return; }
      const newUser: User = {
        id: Date.now(), username: form.username, role: form.role,
        real_name: form.real_name || null, student_id: form.student_id || null,
        class_name: form.class_name || null, created_at: new Date().toISOString(),
      };
      setUsers([newUser, ...users]);
    }
    setEditModal(false);
  };

  const handleDelete = (u: User) => {
    if (u.username === 'admin') return;
    setUsers(users.filter(x => x.id !== u.id));
    setDeleteConfirm(null);
  };

  const handleBatchImport = () => {
    const lines = csvText.trim().split('\n').filter(l => l.trim());
    const failed: { row: number; reason: string }[] = [];
    const toAdd: User[] = [];
    lines.forEach((line, i) => {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length < 3) { failed.push({ row: i + 1, reason: '字段数量不足，至少需要：用户名,密码,姓名' }); return; }
      const [uname, , realName, studentId, className] = parts;
      if (users.find(u => u.username === uname) || toAdd.find(u => u.username === uname)) {
        failed.push({ row: i + 1, reason: `用户名 ${uname} 已存在` }); return;
      }
      toAdd.push({ id: Date.now() + i, username: uname, role: 'student', real_name: realName || null, student_id: studentId || null, class_name: className || null, created_at: new Date().toISOString() });
    });
    setUsers(prev => [...toAdd, ...prev]);
    setBatchResult({ success: toAdd.length, failed });
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('zh-CN');

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#2C3E50', marginBottom: 4 }}>用户管理</h1>
          <p style={{ fontSize: 13, color: '#7F8C8D' }}>管理系统中所有用户账号，共 {users.length} 个账号</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => { setBatchResult(null); setCsvText(''); setBatchModal(true); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: '1px solid #E8ECF0', borderRadius: 6, background: '#FFFFFF', color: '#2C3E50', cursor: 'pointer', fontSize: 14 }}
          >
            <Upload size={15} /> 批量导入
          </button>
          <button
            onClick={openCreate}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: 'none', borderRadius: 6, background: '#4A6FA5', color: '#FFFFFF', cursor: 'pointer', fontSize: 14 }}
          >
            <Plus size={15} /> 新增用户
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ background: '#FFFFFF', borderRadius: 10, border: '1px solid #E8ECF0', padding: '14px 18px', marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#A4B0BE' }} />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="搜索用户名、姓名、学号..."
            style={{ ...inputStyle, paddingLeft: 36, height: 34 }}
          />
        </div>
        <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value as Role | 'all'); setPage(1); }} style={{ ...inputStyle, width: 110, height: 34, cursor: 'pointer' }}>
          <option value="all">全部角色</option>
          <option value="admin">管理员</option>
          <option value="teacher">教师</option>
          <option value="student">学生</option>
        </select>
        <select value={classFilter} onChange={e => { setClassFilter(e.target.value); setPage(1); }} style={{ ...inputStyle, width: 130, height: 34, cursor: 'pointer' }}>
          <option value="">全部班级</option>
          {classes.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span style={{ fontSize: 12, color: '#A4B0BE', marginLeft: 4 }}>共 {filtered.length} 条</span>
      </div>

      {/* Table */}
      <div style={{ background: '#FFFFFF', borderRadius: 10, border: '1px solid #E8ECF0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F7F8FA' }}>
              {['姓名', '用户名', '角色', '学号', '班级', '注册时间', '操作'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#7F8C8D', borderBottom: '1px solid #F0F2F5' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((u, i) => (
              <tr key={u.id} style={{ background: i % 2 === 1 ? '#FAFBFC' : '#FFFFFF' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F0F6FF')}
                onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 1 ? '#FAFBFC' : '#FFFFFF')}>
                <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500, color: '#2C3E50' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#EBF3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#4A6FA5', fontWeight: 600 }}>
                      {(u.real_name || u.username).charAt(0)}
                    </div>
                    {u.real_name || '—'}
                  </div>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#7F8C8D' }}>{u.username}</td>
                <td style={{ padding: '12px 16px' }}><RoleTag role={u.role} /></td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#7F8C8D' }}>{u.student_id || '—'}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#7F8C8D' }}>{u.class_name || '—'}</td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: '#A4B0BE' }}>{formatDate(u.created_at)}</td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => openEdit(u)} style={{ padding: '4px 10px', border: '1px solid #E8ECF0', borderRadius: 5, background: '#FFFFFF', color: '#4A6FA5', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Edit2 size={12} /> 编辑
                    </button>
                    {u.username !== 'admin' && (
                      <button onClick={() => setDeleteConfirm(u)} style={{ padding: '4px 10px', border: '1px solid #FFCCCC', borderRadius: 5, background: '#FFEAEA', color: '#C46B6B', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Trash2 size={12} /> 删除
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {paged.length === 0 && (
          <div style={{ textAlign: 'center', padding: 48, color: '#A4B0BE', fontSize: 14 }}>暂无数据</div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ padding: '14px 16px', borderTop: '1px solid #F0F2F5', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '4px 8px', border: '1px solid #E8ECF0', borderRadius: 5, background: page === 1 ? '#F7F8FA' : '#FFFFFF', cursor: page === 1 ? 'default' : 'pointer', color: page === 1 ? '#A4B0BE' : '#2C3E50' }}>
              <ChevronLeft size={15} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setPage(p)} style={{ width: 28, height: 28, border: '1px solid', borderColor: p === page ? '#4A6FA5' : '#E8ECF0', borderRadius: 5, background: p === page ? '#4A6FA5' : '#FFFFFF', color: p === page ? '#FFFFFF' : '#2C3E50', cursor: 'pointer', fontSize: 13 }}>{p}</button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: '4px 8px', border: '1px solid #E8ECF0', borderRadius: 5, background: page === totalPages ? '#F7F8FA' : '#FFFFFF', cursor: page === totalPages ? 'default' : 'pointer', color: page === totalPages ? '#A4B0BE' : '#2C3E50' }}>
              <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>

      {/* Edit / Create Modal */}
      <Modal
        open={editModal}
        title={editUser ? '编辑用户' : '新增用户'}
        onClose={() => setEditModal(false)}
        width={480}
        footer={
          <>
            <button onClick={() => setEditModal(false)} style={{ padding: '8px 20px', border: '1px solid #E8ECF0', borderRadius: 6, background: '#FFFFFF', color: '#2C3E50', cursor: 'pointer', fontSize: 14 }}>取消</button>
            <button onClick={handleSave} style={{ padding: '8px 20px', border: 'none', borderRadius: 6, background: '#4A6FA5', color: '#FFFFFF', cursor: 'pointer', fontSize: 14 }}>保存</button>
          </>
        }
      >
        {formError && <div style={{ background: '#FFEAEA', border: '1px solid #FFCCCC', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#C46B6B', marginBottom: 16 }}>{formError}</div>}
        <FormField label="用户名" required>
          <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} disabled={!!editUser} style={{ ...inputStyle, background: editUser ? '#F7F8FA' : '#FFFFFF' }} placeholder="登录用户名" />
        </FormField>
        {!editUser && (
          <FormField label="密码" required>
            <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} style={inputStyle} placeholder="登录密码" />
          </FormField>
        )}
        <FormField label="角色">
          <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))} disabled={!!editUser} style={{ ...inputStyle, cursor: 'pointer', background: editUser ? '#F7F8FA' : '#FFFFFF' }}>
            <option value="student">学生</option>
            <option value="teacher">教师</option>
            <option value="admin">管理员</option>
          </select>
        </FormField>
        <FormField label="真实姓名">
          <input value={form.real_name} onChange={e => setForm(f => ({ ...f, real_name: e.target.value }))} style={inputStyle} placeholder="真实姓名（选填）" />
        </FormField>
        {form.role === 'student' && (
          <>
            <FormField label="学号">
              <input value={form.student_id} onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))} style={inputStyle} placeholder="学号（选填）" />
            </FormField>
            <FormField label="班级">
              <input value={form.class_name} onChange={e => setForm(f => ({ ...f, class_name: e.target.value }))} style={inputStyle} placeholder="班级（选填）" />
            </FormField>
          </>
        )}
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteConfirm}
        title="确认删除用户"
        description={`将删除用户 "${deleteConfirm?.real_name || deleteConfirm?.username}"，此操作不可撤销。`}
        confirmText="确认删除"
        danger
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        onCancel={() => setDeleteConfirm(null)}
      />

      {/* Batch Import Modal */}
      <Modal open={batchModal} title="批量导入学生" onClose={() => setBatchModal(false)} width={560}
        footer={!batchResult ? (
          <>
            <button onClick={() => setBatchModal(false)} style={{ padding: '8px 20px', border: '1px solid #E8ECF0', borderRadius: 6, background: '#FFFFFF', color: '#2C3E50', cursor: 'pointer', fontSize: 14 }}>取消</button>
            <button onClick={handleBatchImport} style={{ padding: '8px 20px', border: 'none', borderRadius: 6, background: '#4A6FA5', color: '#FFFFFF', cursor: 'pointer', fontSize: 14 }}>开始导入</button>
          </>
        ) : (
          <button onClick={() => setBatchModal(false)} style={{ padding: '8px 20px', border: 'none', borderRadius: 6, background: '#4A6FA5', color: '#FFFFFF', cursor: 'pointer', fontSize: 14 }}>完成</button>
        )}
      >
        {!batchResult ? (
          <>
            <div style={{ fontSize: 13, color: '#7F8C8D', marginBottom: 12 }}>
              每行格式：<code style={{ background: '#F7F8FA', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>用户名,密码,姓名,学号,班级</code>
            </div>
            <div style={{ fontSize: 12, color: '#A4B0BE', marginBottom: 12 }}>示例：stu_010,123456,张三,2024010,隧道一班</div>
            <textarea
              value={csvText}
              onChange={e => setCsvText(e.target.value)}
              placeholder="请粘贴或输入学生数据，每行一条..."
              style={{ width: '100%', height: 180, border: '1px solid #DCDFE6', borderRadius: 6, padding: 12, fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace', color: '#2C3E50' }}
            />
          </>
        ) : (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1, background: '#EDFAF2', borderRadius: 8, padding: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 600, color: '#6B9E7A' }}>{batchResult.success}</div>
                <div style={{ fontSize: 13, color: '#6B9E7A' }}>导入成功</div>
              </div>
              <div style={{ flex: 1, background: '#FFEAEA', borderRadius: 8, padding: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 600, color: '#C46B6B' }}>{batchResult.failed.length}</div>
                <div style={{ fontSize: 13, color: '#C46B6B' }}>导入失败</div>
              </div>
            </div>
            {batchResult.failed.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#2C3E50', marginBottom: 8 }}>失败详情：</div>
                {batchResult.failed.map((f, i) => (
                  <div key={i} style={{ fontSize: 13, color: '#C46B6B', padding: '4px 0', borderBottom: '1px solid #FFEAEA' }}>
                    第 {f.row} 行：{f.reason}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
