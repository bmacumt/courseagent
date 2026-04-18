import { useState, useEffect, useCallback } from 'react';
import { Save, CheckCircle, Edit2, X } from 'lucide-react';
import * as adminApi from '../../api/admin';
import type { SettingItem } from '../../api/types';

type SettingCategory = 'llm' | 'embedding' | 'reranker' | 'mineru' | 'general';

const categories: { key: SettingCategory; label: string; desc: string }[] = [
  { key: 'llm', label: 'LLM 配置', desc: '大语言模型接口配置' },
  { key: 'embedding', label: 'Embedding', desc: '向量嵌入模型配置' },
  { key: 'reranker', label: 'Reranker', desc: '重排序模型配置' },
  { key: 'mineru', label: 'MinerU', desc: 'PDF 解析服务配置' },
  { key: 'general', label: '通用配置', desc: '系统通用参数设置' },
];

const keyLabels: Record<string, string> = {
  llm_model: '模型名称',
  llm_api_key: 'API Key',
  llm_base_url: 'Base URL',
  llm_temperature: '温度参数',
  llm_max_tokens: '最大 Token 数',
  embedding_api_key: 'API Key',
  embedding_base_url: 'Base URL',
  embedding_model: '嵌入模型',
  embedding_dimension: '向量维度',
  embedding_batch_size: '批处理大小',
  reranker_api_key: 'API Key',
  reranker_base_url: 'Base URL',
  reranker_model: '重排序模型',
  reranker_top_k: 'Top-K 数量',
  mineru_api_token: 'API Token',
  mineru_base_url: 'Base URL',
  mineru_chunk_size: '分块大小',
  mineru_chunk_overlap: '分块重叠',
  access_token_expire_minutes: 'Token 有效期 (分钟)',
  max_file_size_mb: '最大文件大小 (MB)',
  rag_retrieval_top_k: 'RAG 检索 Top-K',
};

export default function SystemSettings() {
  const [activeTab, setActiveTab] = useState<SettingCategory>('llm');
  const [settings, setSettings] = useState<Record<string, SettingItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const loadSettings = useCallback(async () => {
    try {
      const data = await adminApi.getSettings();
      setSettings(data);
    } catch (e) {
      console.error('Failed to load settings:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const currentSettings = settings[activeTab] || [];

  const startEdit = (s: SettingItem) => {
    setEditing(e => ({ ...e, [s.key]: true }));
    setEditValues(v => ({ ...v, [s.key]: s.value }));
  };

  const cancelEdit = (s: SettingItem) => {
    setEditing(e => ({ ...e, [s.key]: false }));
  };

  const saveItem = async (s: SettingItem) => {
    const newVal = editValues[s.key];
    try {
      const updated = await adminApi.updateSetting(s.key, newVal);
      setSettings(prev => ({
        ...prev,
        [activeTab]: (prev[activeTab] || []).map(item =>
          item.key === s.key ? updated : item
        ),
      }));
      setEditing(e => ({ ...e, [s.key]: false }));
      setSaved(sv => ({ ...sv, [s.key]: true }));
      setTimeout(() => setSaved(sv => ({ ...sv, [s.key]: false })), 2000);
    } catch (e) {
      console.error('Failed to save setting:', e);
      alert('保存失败');
    }
  };

  const isSecret = (key: string) => key.includes('key') || key.includes('password');

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    const date = new Date(d);
    return `${date.toLocaleDateString('zh-CN')} ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 48, color: '#A4B0BE' }}>加载中...</div>;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#2C3E50', marginBottom: 4 }}>系统配置</h1>
        <p style={{ fontSize: 13, color: '#7F8C8D' }}>配置各模块参数，修改后即时生效</p>
      </div>

      <div style={{ display: 'flex', gap: 20 }}>
        {/* Tab sidebar */}
        <div style={{ width: 180, flexShrink: 0 }}>
          <div style={{ background: '#FFFFFF', borderRadius: 10, border: '1px solid #E8ECF0', overflow: 'hidden' }}>
            {categories.map(cat => (
              <button
                key={cat.key}
                onClick={() => setActiveTab(cat.key)}
                style={{
                  display: 'block', width: '100%', padding: '14px 16px', textAlign: 'left',
                  border: 'none', cursor: 'pointer',
                  background: activeTab === cat.key ? '#EBF3FF' : '#FFFFFF',
                  borderLeft: activeTab === cat.key ? '3px solid #4A6FA5' : '3px solid transparent',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 500, color: activeTab === cat.key ? '#4A6FA5' : '#2C3E50' }}>{cat.label}</div>
                <div style={{ fontSize: 11, color: '#A4B0BE', marginTop: 2 }}>{cat.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Settings list */}
        <div style={{ flex: 1 }}>
          <div style={{ background: '#FFFFFF', borderRadius: 10, border: '1px solid #E8ECF0' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0F2F5' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#2C3E50' }}>
                {categories.find(c => c.key === activeTab)?.label}
              </div>
              <div style={{ fontSize: 12, color: '#7F8C8D', marginTop: 2 }}>
                {categories.find(c => c.key === activeTab)?.desc}
              </div>
            </div>

            <div style={{ padding: '8px 0' }}>
              {currentSettings.map((s, i) => (
                <div key={s.key} style={{
                  padding: '14px 20px',
                  borderBottom: i < currentSettings.length - 1 ? '1px solid #F7F8FA' : 'none',
                  display: 'flex', alignItems: 'center', gap: 16,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#2C3E50', marginBottom: 2 }}>
                      {keyLabels[s.key] || s.key}
                    </div>
                    <div style={{ fontSize: 11, color: '#A4B0BE' }}>
                      key: <code style={{ fontFamily: 'monospace' }}>{s.key}</code>
                      {' · '}更新于 {formatDate(s.updated_at)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>
                    {editing[s.key] ? (
                      <>
                        <input
                          type="text"
                          value={editValues[s.key]}
                          onChange={e => setEditValues(v => ({ ...v, [s.key]: e.target.value }))}
                          style={{
                            width: 240, height: 32, padding: '0 10px',
                            border: '1px solid #4A6FA5', borderRadius: 6,
                            fontSize: 13, color: '#2C3E50', outline: 'none', fontFamily: 'monospace',
                            boxShadow: '0 0 0 3px rgba(74,111,165,0.1)',
                          }}
                        />
                        <button
                          onClick={() => saveItem(s)}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', border: 'none', borderRadius: 6, background: '#4A6FA5', color: '#FFFFFF', cursor: 'pointer', fontSize: 13 }}
                        >
                          <Save size={13} /> 保存
                        </button>
                        <button
                          onClick={() => cancelEdit(s)}
                          style={{ padding: '5px 8px', border: '1px solid #E8ECF0', borderRadius: 6, background: '#FFFFFF', color: '#7F8C8D', cursor: 'pointer' }}
                        >
                          <X size={13} />
                        </button>
                      </>
                    ) : (
                      <>
                        <code style={{
                          display: 'inline-block', background: '#F7F8FA', border: '1px solid #E8ECF0',
                          borderRadius: 6, padding: '4px 12px', fontSize: 13,
                          color: '#2C3E50', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {isSecret(s.key) ? '••••••••••••••••' : s.value}
                        </code>
                        {saved[s.key] ? (
                          <CheckCircle size={16} color="#6B9E7A" />
                        ) : (
                          <button
                            onClick={() => startEdit(s)}
                            style={{ padding: '5px 10px', border: '1px solid #E8ECF0', borderRadius: 6, background: '#FFFFFF', color: '#4A6FA5', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}
                          >
                            <Edit2 size={13} /> 修改
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
              {currentSettings.length === 0 && (
                <div style={{ textAlign: 'center', padding: 32, color: '#A4B0BE', fontSize: 13 }}>暂无配置项</div>
              )}
            </div>
          </div>

          <div style={{ marginTop: 12, fontSize: 12, color: '#A4B0BE', display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle size={13} color="#6B9E7A" />
            配置修改后即时保存，无需重启服务
          </div>
        </div>
      </div>
    </div>
  );
}
