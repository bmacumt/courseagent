import { useState } from 'react';
import { Modal } from '../../../components/shared/ConfirmDialog';
import type { ModelProviderResponse } from '../../../api/types';
import * as modelsApi from '../../../api/models';

interface Props {
  open: boolean;
  provider: ModelProviderResponse | null;
  onClose: () => void;
  onUpdated: () => void;
}

export default function EditProviderModal({ open, provider, onClose, onUpdated }: Props) {
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const handleClose = () => {
    setApiKey('');
    setBaseUrl('');
    onClose();
  };

  const handleSave = async () => {
    if (!provider) return;
    setSaving(true);
    try {
      const data: { api_key?: string; base_url?: string } = {};
      if (apiKey) data.api_key = apiKey;
      if (baseUrl) data.base_url = baseUrl;
      await modelsApi.updateProvider(provider.id, data);
      onUpdated();
      handleClose();
    } catch (e) {
      alert('更新失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={`编辑 ${provider?.name || ''}`}
      onClose={handleClose}
      width={480}
      footer={
        <>
          <button onClick={handleClose} style={{ padding: '8px 20px', borderRadius: 6, border: '1px solid #E8ECF0', background: '#FFFFFF', color: '#2C3E50', cursor: 'pointer', fontSize: 14 }}>
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 20px', borderRadius: 6, border: 'none',
              background: saving ? '#C4D3E3' : '#4A6FA5', color: '#FFFFFF',
              cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14,
            }}
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </>
      }
    >
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 13, fontWeight: 500, color: '#2C3E50', display: 'block', marginBottom: 6 }}>
          API Key
        </label>
        <div style={{ fontSize: 12, color: '#A4B0BE', marginBottom: 6 }}>
          当前: {provider?.api_key}
        </div>
        <input
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder="留空则不修改"
          style={{
            width: '100%', height: 36, padding: '0 12px', border: '1px solid #E8ECF0',
            borderRadius: 6, fontSize: 13, color: '#2C3E50', outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 13, fontWeight: 500, color: '#2C3E50', display: 'block', marginBottom: 6 }}>
          Base URL
        </label>
        <div style={{ fontSize: 12, color: '#A4B0BE', marginBottom: 6 }}>
          当前: {provider?.base_url}
        </div>
        <input
          type="text"
          value={baseUrl}
          onChange={e => setBaseUrl(e.target.value)}
          placeholder="留空则不修改"
          style={{
            width: '100%', height: 36, padding: '0 12px', border: '1px solid #E8ECF0',
            borderRadius: 6, fontSize: 13, color: '#2C3E50', outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>
    </Modal>
  );
}
