import { useState } from 'react';
import { Settings, Trash2, CheckCircle, Loader2, ChevronDown, ChevronUp, Eye, EyeOff, Plus } from 'lucide-react';
import type { ModelProviderResponse, ModelConfigResponse } from '../../../api/types';
import * as modelsApi from '../../../api/models';

const TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  chat: { label: '聊天', color: '#4A6FA5', bg: '#EBF3FF' },
  embedding: { label: '嵌入', color: '#6B9E7A', bg: '#EDFAF2' },
  rerank: { label: '重排序', color: '#D4A843', bg: '#FFF8E6' },
};

interface Props {
  provider: ModelProviderResponse;
  onUpdated: () => void;
  onDelete: (id: number) => void;
  onEdit: (provider: ModelProviderResponse) => void;
  onAddModel: (provider: ModelProviderResponse) => void;
}

export default function ProviderCard({ provider, onUpdated, onDelete, onEdit, onAddModel }: Props) {
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ valid: boolean; error: string | null; tested: string[] } | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const handleVerify = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const result = await modelsApi.verifyProvider(provider.id);
      setVerifyResult(result);
    } catch (e) {
      setVerifyResult({ valid: false, error: '验证请求失败', tested: [] });
    } finally {
      setVerifying(false);
    }
  };

  const handleToggleModel = async (model: ModelConfigResponse) => {
    try {
      await modelsApi.toggleModel(model.id);
      onUpdated();
    } catch (e) {
      console.error('Toggle failed:', e);
    }
  };

  const handleDeleteModel = async (model: ModelConfigResponse) => {
    if (!confirm(`确认删除模型 ${model.model_name}？`)) return;
    try {
      await modelsApi.deleteModel(provider.id, model.id);
      onUpdated();
    } catch (e) {
      console.error('Delete model failed:', e);
      alert('删除模型失败');
    }
  };

  return (
    <div style={{
      background: '#FFFFFF', borderRadius: 10, border: '1px solid #E8ECF0',
      overflow: 'hidden', opacity: provider.enabled ? 1 : 0.6,
    }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0F2F5', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8, background: '#EBF3FF',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 600, color: '#4A6FA5', flexShrink: 0,
        }}>
          {provider.name.charAt(0)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#2C3E50' }}>{provider.name}</div>
          <div style={{ fontSize: 12, color: '#A4B0BE', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <span>{provider.base_url}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {/* API Key */}
          <span style={{ fontSize: 12, color: '#7F8C8D', display: 'flex', alignItems: 'center', gap: 3, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            🔑 {showKey ? provider.api_key_full : provider.api_key}
          </span>
          <button onClick={() => setShowKey(!showKey)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A4B0BE', padding: 2 }}>
            {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
          {/* Verify badge */}
          {verifyResult && (
            <span style={{ background: verifyResult.valid ? '#EDFAF2' : '#FFEAEA', color: verifyResult.valid ? '#6B9E7A' : '#C46B6B', fontSize: 10, padding: '2px 8px', borderRadius: 3, fontWeight: 500 }}>
              {verifyResult.valid ? '已验证' : '验证失败'}
            </span>
          )}
          {verifying && <Loader2 size={14} color="#4A6FA5" className="animate-spin" />}
          <button onClick={handleVerify} disabled={verifying} style={{ padding: '4px 10px', border: '1px solid #E8ECF0', borderRadius: 5, background: '#FFFFFF', color: '#4A6FA5', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle size={12} /> 验证
          </button>
          <button onClick={() => onEdit(provider)} style={{ padding: '4px 10px', border: '1px solid #E8ECF0', borderRadius: 5, background: '#FFFFFF', color: '#7F8C8D', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Settings size={12} /> 编辑
          </button>
          <button onClick={() => onDelete(provider.id)} style={{ padding: '4px 10px', border: '1px solid #FFCCCC', borderRadius: 5, background: '#FFEAEA', color: '#C46B6B', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Trash2 size={12} /> 删除
          </button>
          <button onClick={() => setExpanded(!expanded)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A4B0BE', padding: 2 }}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Verify error */}
      {verifyResult && !verifyResult.valid && verifyResult.error && (
        <div style={{ padding: '8px 20px', background: '#FFF5F5', fontSize: 12, color: '#C46B6B', borderBottom: '1px solid #F0F2F5' }}>
          {verifyResult.error}
        </div>
      )}

      {/* Models */}
      {expanded && (
        <div style={{ padding: '12px 20px' }}>
          {provider.models.length > 0 ? provider.models.map(m => {
            const tc = TYPE_LABELS[m.model_type] || { label: m.model_type, color: '#7F8C8D', bg: '#F0F2F5' };
            return (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F7F8FA' }}>
                <span style={{ background: tc.bg, color: tc.color, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 500 }}>{tc.label}</span>
                <span style={{ fontSize: 13, color: '#2C3E50', fontWeight: 500, flex: 1 }}>{m.model_name}</span>
                <span style={{ fontSize: 11, color: '#A4B0BE' }}>{m.max_tokens.toLocaleString()} tokens</span>
                {m.is_default && <span style={{ background: '#FFF8E6', color: '#D4A843', fontSize: 10, padding: '1px 6px', borderRadius: 3, fontWeight: 500 }}>默认</span>}
                {!m.enabled && <span style={{ background: '#F0F2F5', color: '#A4B0BE', fontSize: 10, padding: '1px 6px', borderRadius: 3 }}>已禁用</span>}
                <button onClick={() => handleToggleModel(m)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: m.enabled ? '#6B9E7A' : '#A4B0BE', fontSize: 12 }}>
                  {m.enabled ? '●' : '○'}
                </button>
                <button onClick={() => handleDeleteModel(m)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C46B6B', padding: 0 }}>
                  <Trash2 size={12} />
                </button>
              </div>
            );
          }) : (
            <div style={{ fontSize: 13, color: '#A4B0BE', padding: '8px 0' }}>暂无模型配置</div>
          )}
          <button onClick={() => onAddModel(provider)} style={{ marginTop: 8, padding: '5px 12px', border: '1px dashed #E8ECF0', borderRadius: 6, background: '#F7F8FA', color: '#7F8C8D', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Plus size={13} /> 添加模型
          </button>
        </div>
      )}
    </div>
  );
}
