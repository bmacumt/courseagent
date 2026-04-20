import { useState } from 'react';
import type { ModelConfigResponse, ModelProviderResponse, ModelType } from '../../../api/types';
import * as modelsApi from '../../../api/models';

const TYPE_LABELS: Record<string, string> = { chat: '聊天', embedding: '嵌入', rerank: '重排序', asr: '语音识别' };

interface Props {
  providers: ModelProviderResponse[];
  onUpdated: () => void;
}

export default function SystemDefaults({ providers, onUpdated }: Props) {
  const [saving, setSaving] = useState<string | null>(null);

  const enabledModels = providers
    .filter(p => p.enabled)
    .flatMap(p => p.models.filter(m => m.enabled));

  const getDefault = (type: ModelType): ModelConfigResponse | undefined =>
    enabledModels.find(m => m.model_type === type && m.is_default) ||
    enabledModels.find(m => m.model_type === type);

  const handleChange = async (type: ModelType, modelId: number) => {
    setSaving(type);
    try {
      await modelsApi.setDefaultModel({ model_type: type, model_id: modelId });
      onUpdated();
    } catch (e) {
      console.error('Failed to set default:', e);
      alert('设置默认模型失败');
    } finally {
      setSaving(null);
    }
  };

  const types: { type: ModelType; label: string }[] = [
    { type: 'chat', label: '聊天模型' },
    { type: 'embedding', label: '嵌入模型' },
    { type: 'rerank', label: '重排序模型' },
    { type: 'asr', label: '语音识别模型' },
  ];

  return (
    <div style={{ background: '#FFFFFF', borderRadius: 10, border: '1px solid #E8ECF0', padding: '20px 24px', marginBottom: 20 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#2C3E50', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 4, height: 18, background: '#4A6FA5', borderRadius: 2 }} />
        系统默认模型
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
        {types.map(({ type, label }) => {
          const current = getDefault(type);
          const options = enabledModels.filter(m => m.model_type === type);
          return (
            <div key={type} style={{ background: '#F7F8FA', borderRadius: 8, padding: '12px 16px' }}>
              <div style={{ fontSize: 12, color: '#7F8C8D', marginBottom: 6 }}>{label}</div>
              <select
                value={current?.id || ''}
                onChange={e => handleChange(type, parseInt(e.target.value))}
                disabled={saving === type || options.length === 0}
                style={{
                  width: '100%', height: 34, padding: '0 10px', border: '1px solid #E8ECF0',
                  borderRadius: 6, fontSize: 13, color: '#2C3E50', outline: 'none',
                  cursor: options.length > 0 ? 'pointer' : 'not-allowed',
                }}
              >
                {options.length === 0 && <option value="">暂无可选模型</option>}
                {options.map(m => {
                  const provider = providers.find(p => p.id === m.provider_id);
                  return (
                    <option key={m.id} value={m.id}>
                      {provider?.name} / {m.model_name}
                    </option>
                  );
                })}
              </select>
              {saving === type && <span style={{ fontSize: 11, color: '#4A6FA5', marginLeft: 4 }}>保存中...</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
