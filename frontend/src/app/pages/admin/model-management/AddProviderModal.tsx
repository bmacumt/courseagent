import { useState, useEffect } from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';
import { Modal } from '../../../components/shared/ConfirmDialog';
import type { AvailableProvider } from '../../../api/types';
import * as modelsApi from '../../../api/models';

interface Props {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

export default function AddProviderModal({ open, onClose, onAdded }: Props) {
  const [providers, setProviders] = useState<AvailableProvider[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      modelsApi.getAvailableProviders().then(setProviders).catch(() => {});
      reset();
    }
  }, [open]);

  const reset = () => {
    setSelected('');
    setApiKey('');
    setBaseUrl('');
    setVerifying(false);
    setVerified(false);
    setSaving(false);
  };

  const current = providers.find(p => p.provider_type === selected);

  const handleSelect = (type: string) => {
    const p = providers.find(pp => pp.provider_type === type);
    setSelected(type);
    setBaseUrl(p?.default_base_url || '');
    setVerified(false);
  };

  const handleVerify = async () => {
    if (!selected || !apiKey) return;
    setVerifying(true);
    try {
      const prov = await modelsApi.addProvider({ provider_type: selected, api_key: apiKey, base_url: baseUrl || undefined });
      const result = await modelsApi.verifyProvider(prov.id);
      if (result.valid) {
        setVerified(true);
      } else {
        alert('验证失败: ' + (result.error || '未知错误'));
        await modelsApi.deleteProvider(prov.id);
      }
    } catch (e: any) {
      alert('验证请求失败: ' + (e?.message || e));
    } finally {
      setVerifying(false);
    }
  };

  const handleSave = async () => {
    if (!selected || !apiKey) return;
    setSaving(true);
    try {
      if (!verified) {
        await modelsApi.addProvider({ provider_type: selected, api_key: apiKey, base_url: baseUrl || undefined });
      }
      onAdded();
      onClose();
      reset();
    } catch (e) {
      alert('添加失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="添加模型提供商"
      onClose={onClose}
      width={520}
      footer={
        <>
          <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 6, border: '1px solid #E8ECF0', background: '#FFFFFF', color: '#2C3E50', cursor: 'pointer', fontSize: 14 }}>
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!selected || !apiKey || saving}
            style={{
              padding: '8px 20px', borderRadius: 6, border: 'none',
              background: (!selected || !apiKey || saving) ? '#C4D3E3' : '#4A6FA5',
              color: '#FFFFFF', cursor: (!selected || !apiKey || saving) ? 'not-allowed' : 'pointer', fontSize: 14,
            }}
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </>
      }
    >
      {/* Step 1: Select provider */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 13, fontWeight: 500, color: '#2C3E50', display: 'block', marginBottom: 8 }}>
          选择提供商
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {providers.map(p => (
            <button
              key={p.provider_type}
              onClick={() => handleSelect(p.provider_type)}
              style={{
                padding: '6px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
                border: selected === p.provider_type ? '1px solid #4A6FA5' : '1px solid #E8ECF0',
                background: selected === p.provider_type ? '#EBF3FF' : '#FFFFFF',
                color: selected === p.provider_type ? '#4A6FA5' : '#2C3E50',
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: API Key */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 13, fontWeight: 500, color: '#2C3E50', display: 'block', marginBottom: 6 }}>
          API Key <span style={{ color: '#C46B6B' }}>*</span>
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={e => { setApiKey(e.target.value); setVerified(false); }}
          placeholder="输入 API Key"
          style={{
            width: '100%', height: 36, padding: '0 12px', border: '1px solid #E8ECF0',
            borderRadius: 6, fontSize: 13, color: '#2C3E50', outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Step 3: Base URL */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 13, fontWeight: 500, color: '#2C3E50', display: 'block', marginBottom: 6 }}>
          Base URL
        </label>
        <input
          type="text"
          value={baseUrl}
          onChange={e => { setBaseUrl(e.target.value); setVerified(false); }}
          placeholder={current?.default_base_url || 'https://api.example.com/v1'}
          style={{
            width: '100%', height: 36, padding: '0 12px', border: '1px solid #E8ECF0',
            borderRadius: 6, fontSize: 13, color: '#2C3E50', outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Verify button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={handleVerify}
          disabled={!selected || !apiKey || verifying}
          style={{
            padding: '7px 16px', borderRadius: 6, border: '1px solid #E8ECF0',
            background: '#FFFFFF', color: '#4A6FA5', cursor: 'pointer', fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 5,
            opacity: (!selected || !apiKey || verifying) ? 0.5 : 1,
          }}
        >
          {verifying ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
          {verifying ? '验证中...' : '验证连通性'}
        </button>
        {verified && (
          <span style={{ fontSize: 13, color: '#6B9E7A', display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle size={14} /> 验证通过
          </span>
        )}
      </div>

      {/* Provider info */}
      {current && (
        <div style={{ marginTop: 16, padding: '12px 16px', background: '#F7F8FA', borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: '#7F8C8D', marginBottom: 4 }}>支持的模型类型：{current.supported_types.join('、')}</div>
          <div style={{ fontSize: 12, color: '#7F8C8D' }}>推荐模型：{current.models.map(m => m.name).join('、')}</div>
        </div>
      )}
    </Modal>
  );
}
