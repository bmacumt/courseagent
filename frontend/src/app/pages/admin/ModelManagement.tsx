import { useState, useEffect, useCallback } from 'react';
import { Plus, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import * as modelsApi from '../../api/models';
import * as adminApi from '../../api/admin';
import type { ModelProviderResponse, SettingItem } from '../../api/types';
import SystemDefaults from './model-management/SystemDefaults';
import ProviderCard from './model-management/ProviderCard';
import AddProviderModal from './model-management/AddProviderModal';
import EditProviderModal from './model-management/EditProviderModal';
import AddModelModal from './model-management/AddModelModal';

export default function ModelManagement() {
  const [providers, setProviders] = useState<ModelProviderResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ModelProviderResponse | null>(null);
  const [addingModelFor, setAddingModelFor] = useState<ModelProviderResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedSettings, setAdvancedSettings] = useState<Record<string, SettingItem[]>>({});

  const loadProviders = useCallback(async () => {
    try {
      const data = await modelsApi.getProviders();
      setProviders(data);
    } catch (e) {
      console.error('Failed to load providers:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAdvancedSettings = useCallback(async () => {
    try {
      const data = await adminApi.getSettings();
      const filtered: Record<string, SettingItem[]> = {};
      for (const [cat, items] of Object.entries(data)) {
        if (cat === 'mineru' || cat === 'general') {
          filtered[cat] = items as SettingItem[];
        }
      }
      setAdvancedSettings(filtered);
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  }, []);

  useEffect(() => { loadProviders(); loadAdvancedSettings(); }, [loadProviders, loadAdvancedSettings]);

  const handleDelete = async () => {
    if (deleteTarget === null) return;
    try {
      await modelsApi.deleteProvider(deleteTarget);
      loadProviders();
    } catch (e) {
      alert('删除失败');
    } finally {
      setDeleteTarget(null);
    }
  };

  const categoryLabels: Record<string, { label: string; icon: string }> = {
    mineru: { label: 'MinerU 解析服务', icon: '📄' },
    general: { label: '通用配置', icon: '⚙️' },
  };

  const settingLabels: Record<string, string> = {
    mineru_api_token: 'API Token',
    mineru_base_url: 'Base URL',
    mineru_chunk_size: '分块大小',
    mineru_chunk_overlap: '分块重叠',
    access_token_expire_minutes: 'Token 有效期 (分钟)',
    max_file_size_mb: '最大文件大小 (MB)',
    rag_retrieval_top_k: 'RAG 检索 Top-K',
  };

  const [editingSetting, setEditingSetting] = useState<Record<string, boolean>>({});
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const saveSetting = async (s: SettingItem) => {
    try {
      await adminApi.updateSetting(s.key, editValues[s.key]);
      loadAdvancedSettings();
      setEditingSetting(e => ({ ...e, [s.key]: false }));
    } catch (e) {
      alert('保存失败');
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 48, color: '#A4B0BE' }}>加载中...</div>;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#2C3E50', marginBottom: 4 }}>模型管理</h1>
        <p style={{ fontSize: 13, color: '#7F8C8D' }}>配置 AI 模型提供商，设置系统默认模型</p>
      </div>

      {/* System defaults */}
      <SystemDefaults providers={providers} onUpdated={loadProviders} />

      {/* Provider cards */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#2C3E50', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 4, height: 18, background: '#4A6FA5', borderRadius: 2 }} />
          已配置的提供商
        </div>
        <button
          onClick={() => setShowAddProvider(true)}
          style={{
            padding: '7px 16px', borderRadius: 6, border: 'none',
            background: '#4A6FA5', color: '#FFFFFF', cursor: 'pointer',
            fontSize: 13, display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          <Plus size={14} /> 添加提供商
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {providers.map(p => (
          <ProviderCard
            key={p.id}
            provider={p}
            onUpdated={loadProviders}
            onDelete={id => setDeleteTarget(id)}
            onEdit={p => setEditingProvider(p)}
            onAddModel={p => setAddingModelFor(p)}
          />
        ))}
        {providers.length === 0 && (
          <div style={{ background: '#FFFFFF', borderRadius: 10, border: '1px solid #E8ECF0', padding: 32, textAlign: 'center', color: '#A4B0BE', fontSize: 13 }}>
            暂无已配置的提供商，点击上方「添加提供商」开始配置
          </div>
        )}
      </div>

      {/* Advanced settings (collapsible) */}
      <div style={{ background: '#FFFFFF', borderRadius: 10, border: '1px solid #E8ECF0', overflow: 'hidden', marginBottom: 24 }}>
        <button
          onClick={() => setAdvancedOpen(!advancedOpen)}
          style={{
            width: '100%', padding: '14px 20px', border: 'none', background: 'transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600, color: '#2C3E50', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 4, height: 18, background: '#D4A843', borderRadius: 2 }} />
            解析服务与高级设置
          </div>
          {advancedOpen ? <ChevronUp size={16} color="#7F8C8D" /> : <ChevronDown size={16} color="#7F8C8D" />}
        </button>

        {advancedOpen && (
          <div style={{ padding: '0 20px 20px' }}>
            {Object.entries(advancedSettings).map(([cat, items]) => (
              <div key={cat} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#2C3E50', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {categoryLabels[cat]?.icon} {categoryLabels[cat]?.label || cat}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {items.map(s => (
                    <div key={s.key} style={{ background: '#F7F8FA', borderRadius: 8, padding: '10px 14px' }}>
                      <div style={{ fontSize: 12, color: '#7F8C8D', marginBottom: 4 }}>
                        {settingLabels[s.key] || s.key}
                      </div>
                      {editingSetting[s.key] ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input
                            type="text"
                            value={editValues[s.key] || ''}
                            onChange={e => setEditValues(v => ({ ...v, [s.key]: e.target.value }))}
                            style={{
                              flex: 1, height: 30, padding: '0 8px', border: '1px solid #4A6FA5',
                              borderRadius: 4, fontSize: 12, outline: 'none',
                            }}
                          />
                          <button onClick={() => saveSetting(s)} style={{ padding: '0 8px', border: 'none', borderRadius: 4, background: '#4A6FA5', color: '#FFF', fontSize: 12, cursor: 'pointer' }}>
                            保存
                          </button>
                          <button onClick={() => setEditingSetting(e => ({ ...e, [s.key]: false }))} style={{ padding: '0 8px', border: '1px solid #E8ECF0', borderRadius: 4, background: '#FFF', fontSize: 12, cursor: 'pointer' }}>
                            取消
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => { setEditingSetting(e => ({ ...e, [s.key]: true })); setEditValues(v => ({ ...v, [s.key]: s.value })); }}
                          style={{ fontSize: 13, color: '#2C3E50', cursor: 'pointer', fontFamily: 'monospace' }}
                        >
                          {s.key.includes('key') || s.key.includes('token') ? '••••••••' : s.value}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <AddProviderModal open={showAddProvider} onClose={() => setShowAddProvider(false)} onAdded={loadProviders} />
      <EditProviderModal open={!!editingProvider} provider={editingProvider} onClose={() => setEditingProvider(null)} onUpdated={loadProviders} />
      <AddModelModal open={!!addingModelFor} provider={addingModelFor} onClose={() => setAddingModelFor(null)} onAdded={loadProviders} />
      <ConfirmDialog
        open={deleteTarget !== null}
        title="确认删除"
        description="删除提供商将同时删除其下所有模型配置，此操作不可恢复。"
        confirmText="删除"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
