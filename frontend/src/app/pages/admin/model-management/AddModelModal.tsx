import { useState, useEffect } from 'react';
import { Modal } from '../../../components/shared/ConfirmDialog';
import type { ModelProviderResponse, AvailableProvider } from '../../../api/types';
import * as modelsApi from '../../../api/models';

const TYPE_OPTIONS = [
  { value: 'chat', label: '聊天' },
  { value: 'embedding', label: '嵌入' },
  { value: 'rerank', label: '重排序' },
  { value: 'asr', label: '语音识别' },
];

interface Props {
  open: boolean;
  provider: ModelProviderResponse | null;
  onClose: () => void;
  onAdded: () => void;
}

export default function AddModelModal({ open, provider, onClose, onAdded }: Props) {
  const [available, setAvailable] = useState<AvailableProvider[]>([]);
  const [modelType, setModelType] = useState('chat');
  const [modelName, setModelName] = useState('');
  const [maxTokens, setMaxTokens] = useState(4096);
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [useCustom, setUseCustom] = useState(false);

  useEffect(() => {
    if (open) {
      modelsApi.getAvailableProviders().then(setAvailable).catch(() => {});
      reset();
    }
  }, [open]);

  const reset = () => {
    setModelType('chat');
    setModelName('');
    setMaxTokens(4096);
    setIsDefault(false);
    setUseCustom(false);
    setSaving(false);
  };

  const currentProviderInfo = available.find(p => p.provider_type === provider?.provider_type);
  const suggestedModels = (currentProviderInfo?.models || []).filter(m => m.type === modelType);

  const handleSelectSuggested = (name: string, tokens: number) => {
    setModelName(name);
    setMaxTokens(tokens);
    setUseCustom(false);
  };

  const handleSave = async () => {
    if (!provider || !modelName || !modelType) return;
    setSaving(true);
    try {
      await modelsApi.addModel(provider.id, {
        model_name: modelName,
        model_type: modelType,
        max_tokens: maxTokens,
        is_default: isDefault,
      });
      onAdded();
      onClose();
      reset();
    } catch (e) {
      alert('添加模型失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={`添加模型 — ${provider?.name || ''}`}
      onClose={onClose}
      width={500}
      footer={
        <>
          <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 6, border: '1px solid #E8ECF0', background: '#FFFFFF', color: '#2C3E50', cursor: 'pointer', fontSize: 14 }}>
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!modelName || !modelType || saving}
            style={{
              padding: '8px 20px', borderRadius: 6, border: 'none',
              background: (!modelName || !modelType || saving) ? '#C4D3E3' : '#4A6FA5',
              color: '#FFFFFF', cursor: (!modelName || !modelType || saving) ? 'not-allowed' : 'pointer', fontSize: 14,
            }}
          >
            {saving ? '添加中...' : '添加'}
          </button>
        </>
      }
    >
      {/* Model type */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 13, fontWeight: 500, color: '#2C3E50', display: 'block', marginBottom: 6 }}>
          模型类型 <span style={{ color: '#C46B6B' }}>*</span>
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          {TYPE_OPTIONS.map(t => (
            <button
              key={t.value}
              onClick={() => { setModelType(t.value); setModelName(''); setUseCustom(false); }}
              style={{
                padding: '6px 16px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
                border: modelType === t.value ? '1px solid #4A6FA5' : '1px solid #E8ECF0',
                background: modelType === t.value ? '#EBF3FF' : '#FFFFFF',
                color: modelType === t.value ? '#4A6FA5' : '#2C3E50',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Suggested models */}
      {suggestedModels.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: '#2C3E50', display: 'block', marginBottom: 6 }}>
            推荐模型
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {suggestedModels.map(m => (
              <button
                key={m.name}
                onClick={() => handleSelectSuggested(m.name, m.max_tokens)}
                style={{
                  padding: '6px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
                  border: modelName === m.name && !useCustom ? '1px solid #4A6FA5' : '1px solid #E8ECF0',
                  background: modelName === m.name && !useCustom ? '#EBF3FF' : '#FFFFFF',
                  color: modelName === m.name && !useCustom ? '#4A6FA5' : '#2C3E50',
                }}
              >
                {m.name}
              </button>
            ))}
            <button
              onClick={() => { setUseCustom(true); setModelName(''); }}
              style={{
                padding: '6px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
                border: '1px dashed #E8ECF0', background: '#F7F8FA', color: '#7F8C8D',
              }}
            >
              自定义...
            </button>
          </div>
        </div>
      )}

      {/* Model name input */}
      {(useCustom || suggestedModels.length === 0) && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: '#2C3E50', display: 'block', marginBottom: 6 }}>
            模型名称 <span style={{ color: '#C46B6B' }}>*</span>
          </label>
          <input
            type="text"
            value={modelName}
            onChange={e => setModelName(e.target.value)}
            placeholder="例如: gpt-4o, bge-large-zh-v1.5"
            style={{
              width: '100%', height: 36, padding: '0 12px', border: '1px solid #E8ECF0',
              borderRadius: 6, fontSize: 13, color: '#2C3E50', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
      )}

      {/* Max tokens */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 13, fontWeight: 500, color: '#2C3E50', display: 'block', marginBottom: 6 }}>
          最大 Tokens
        </label>
        <input
          type="number"
          value={maxTokens}
          onChange={e => setMaxTokens(parseInt(e.target.value) || 4096)}
          style={{
            width: '100%', height: 36, padding: '0 12px', border: '1px solid #E8ECF0',
            borderRadius: 6, fontSize: 13, color: '#2C3E50', outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Default toggle */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
        <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} />
        <span style={{ fontSize: 13, color: '#2C3E50' }}>设为该类型的默认模型</span>
      </label>
    </Modal>
  );
}
