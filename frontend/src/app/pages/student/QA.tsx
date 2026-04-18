import { useState, useRef, useEffect } from 'react';
import { Send, Trash2, Bot, User, ChevronDown, ChevronUp, BookOpen, Loader2 } from 'lucide-react';
import * as studentApi from '../../api/student';
import { MarkdownRenderer } from '../../components/shared/MarkdownRenderer';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  sources?: { index: number; text: string; source_name: string | null; chunk_index: number | null }[];
  timestamp: string;
}

export default function QA() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Record<number, boolean>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg: ChatMessage = {
      id: Date.now(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    const questionText = input.trim();
    setInput('');
    setLoading(true);

    try {
      const resp = await studentApi.askQuestion(questionText);
      const aiMsg: ChatMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: resp.answer,
        sources: resp.sources,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      console.error('提问失败:', err);
      const errorMsg: ChatMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: '抱歉，提问失败，请稍后重试。',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleSource = (msgId: number) => {
    setExpandedSources(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const formatTime = (d: string) => {
    const date = new Date(d);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const suggestedQuestions = [
    '公路建设板块包含哪些模块？',
    '隧道围岩分级的依据是什么？',
    '新奥法的核心原理是什么？',
    '公路隧道防水设计要求有哪些？',
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px - 48px)', maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#2C3E50', marginBottom: 4 }}>
            知识问答
            <span style={{ background: '#FFF8E6', color: '#D4A843', fontSize: 10, padding: '2px 8px', borderRadius: 3, fontWeight: 500, marginLeft: 8, verticalAlign: 'middle' }}>非流式响应</span>
          </h1>
          <p style={{ fontSize: 13, color: '#7F8C8D' }}>基于课程知识库，随时向 AI 提问（对话记录仅保存于当前页面）</p>
        </div>
        <button
          onClick={() => setClearConfirm(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: '1px solid #E8ECF0', borderRadius: 6, background: '#FFFFFF', color: '#7F8C8D', cursor: 'pointer', fontSize: 13 }}
        >
          <Trash2 size={14} /> 清空对话
        </button>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, overflow: 'auto', background: '#FFFFFF', borderRadius: 12, border: '1px solid #E8ECF0', padding: '20px 24px', marginBottom: 16 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <Bot size={48} color="#E8ECF0" style={{ margin: '0 auto 16px', display: 'block' }} />
            <div style={{ fontSize: 16, fontWeight: 500, color: '#A4B0BE', marginBottom: 8 }}>开始提问</div>
            <div style={{ fontSize: 13, color: '#C0C8D0', marginBottom: 32 }}>基于隧道工程课程知识库，AI 将提供准确解答并标注来源</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {suggestedQuestions.map(q => (
                <button key={q} onClick={() => setInput(q)} style={{ padding: '8px 14px', border: '1px solid #E8ECF0', borderRadius: 20, background: '#F7F8FA', color: '#7F8C8D', cursor: 'pointer', fontSize: 13 }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} style={{ marginBottom: 20, display: 'flex', gap: 12, flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
            {/* Avatar */}
            <div style={{
              width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
              background: msg.role === 'user' ? '#4A6FA5' : '#2C3A47',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {msg.role === 'user' ? <User size={16} color="white" /> : <Bot size={16} color="white" />}
            </div>

            <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {/* Bubble */}
              <div style={{
                background: msg.role === 'user' ? '#4A6FA5' : '#F7F8FA',
                color: msg.role === 'user' ? '#FFFFFF' : '#2C3E50',
                borderRadius: msg.role === 'user' ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                padding: '12px 16px',
                fontSize: 14, lineHeight: 1.7,
              }}>
                {msg.role === 'user' ? (
                  <span>{msg.content}</span>
                ) : (
                  <div style={{ color: '#2C3E50' }}>
                    <MarkdownRenderer content={msg.content} />
                  </div>
                )}
              </div>

              {/* Sources */}
              {msg.sources && msg.sources.length > 0 && (
                <div style={{ marginTop: 8, width: '100%' }}>
                  <button
                    onClick={() => toggleSource(msg.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: '#7A8F9E', fontSize: 12, padding: '4px 0' }}
                  >
                    <BookOpen size={13} />
                    {msg.sources.length} 个引用来源
                    {expandedSources[msg.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                  {expandedSources[msg.id] && msg.sources.map(src => (
                    <div key={src.index} style={{ background: '#F7F8FA', border: '1px solid #E8ECF0', borderRadius: 8, padding: '10px 14px', marginTop: 6, fontSize: 12 }}>
                      <div style={{ color: '#4A6FA5', fontWeight: 500, marginBottom: 6 }}>
                        [{src.index}] {src.source_name} · 段落 {src.chunk_index}
                      </div>
                      <div style={{ color: '#7F8C8D', lineHeight: 1.6 }}>{src.text.slice(0, 200)}...</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ fontSize: 11, color: '#A4B0BE', marginTop: 4 }}>{formatTime(msg.timestamp)}</div>
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#2C3A47', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Bot size={16} color="white" />
            </div>
            <div style={{ background: '#F7F8FA', borderRadius: '4px 12px 12px 12px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Loader2 size={15} color="#4A6FA5" className="animate-spin" />
              <span style={{ fontSize: 13, color: '#7F8C8D' }}>AI 正在检索知识库...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid #E8ECF0', padding: '12px 16px', flexShrink: 0 }}>
        {messages.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {suggestedQuestions.slice(0, 3).map(q => (
              <button key={q} onClick={() => setInput(q)} style={{ padding: '4px 10px', border: '1px solid #E8ECF0', borderRadius: 14, background: '#F7F8FA', color: '#7F8C8D', cursor: 'pointer', fontSize: 12 }}>
                {q}
              </button>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入问题，按 Enter 发送（Shift+Enter 换行）..."
            rows={2}
            style={{
              flex: 1, border: '1px solid #E8ECF0', borderRadius: 8, padding: '10px 14px',
              fontSize: 14, color: '#2C3E50', outline: 'none', resize: 'none',
              lineHeight: 1.6, fontFamily: 'inherit',
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            style={{
              width: 42, height: 42, border: 'none', borderRadius: 10,
              background: !input.trim() || loading ? '#E8ECF0' : '#4A6FA5',
              color: !input.trim() || loading ? '#A4B0BE' : '#FFFFFF',
              cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            <Send size={17} />
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={clearConfirm}
        title="清空对话"
        description="将删除所有对话记录，此操作不可撤销。"
        confirmText="确认清空"
        danger
        onConfirm={() => { setMessages([]); setClearConfirm(false); }}
        onCancel={() => setClearConfirm(false)}
      />
    </div>
  );
}
