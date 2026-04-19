import { useState, useRef, useEffect, useCallback } from 'react';
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
  researchLog?: string[];
}

export default function QA() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Record<number, boolean>>({});
  const [deepResearch, setDeepResearch] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, streaming, scrollToBottom]);

  const handleSend = () => {
    if (!input.trim() || loading) return;
    const questionText = input.trim();

    const userMsg: ChatMessage = {
      id: Date.now(),
      role: 'user',
      content: questionText,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const aiMsgId = Date.now() + 1;
    const aiMsg: ChatMessage = {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      sources: undefined,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, aiMsg]);

    const controller = studentApi.streamQuestion(questionText, {
      onSources: (sources) => {
        const formatted = sources.map((s: any) => ({
          index: s.index,
          text: (s.text || '').slice(0, 500),
          source_name: s.metadata?.source || null,
          chunk_index: s.metadata?.chunk_index ?? null,
        }));
        setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, sources: formatted } : m));
        setLoading(false);
        setStreaming(true);
      },
      onToken: (token) => {
        setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, content: m.content + token } : m));
      },
      onDone: () => {
        setLoading(false);
        setStreaming(false);
        abortRef.current = null;
      },
      onError: (err) => {
        setMessages(prev => prev.map(m =>
          m.id === aiMsgId ? { ...m, content: m.content || `抱歉，提问失败：${err}` } : m
        ));
        setLoading(false);
        setStreaming(false);
        abortRef.current = null;
      },
      onResearchStatus: (status) => {
        const logLine = formatResearchStatus(status);
        if (logLine) {
          setMessages(prev => prev.map(m =>
            m.id === aiMsgId
              ? { ...m, researchLog: [...(m.researchLog || []), logLine] }
              : m
          ));
        }
      },
    }, deepResearch);
    abortRef.current = controller;
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

  const isActive = loading || streaming;

  function formatResearchStatus(status: studentApi.ResearchStatusEvent): string {
    switch (status.phase) {
      case 'start':
        return `开始深度研究（最大深度: ${status.max_depth}）`;
      case 'searching':
        return `正在检索: "${(status.query || '').slice(0, 30)}" (深度 ${status.depth})`;
      case 'retrieved':
        return `找到 ${status.new_chunks} 个新片段（共 ${status.total_chunks} 个）`;
      case 'checking':
        return '检查信息充分性...';
      case 'sufficiency':
        return status.sufficient ? '信息充分，准备生成回答' : `信息不足: ${status.reasoning || ''}`;
      case 'sub_queries':
        return `生成子查询: ${(status.queries || []).join('; ')}`;
      default:
        return '';
    }
  }

  const [expandedResearch, setExpandedResearch] = useState<Record<number, boolean>>({});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px - 48px)', maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#2C3E50', marginBottom: 4 }}>
            知识问答
            <span style={{ background: '#EDFAF2', color: '#6B9E7A', fontSize: 10, padding: '2px 8px', borderRadius: 3, fontWeight: 500, marginLeft: 8, verticalAlign: 'middle' }}>流式响应</span>
            <span
              onClick={() => setDeepResearch(!deepResearch)}
              style={{
                background: deepResearch ? '#4A6FA5' : '#F0F0F0',
                color: deepResearch ? '#FFFFFF' : '#999',
                fontSize: 10, padding: '2px 8px', borderRadius: 3, fontWeight: 500,
                marginLeft: 6, verticalAlign: 'middle', cursor: 'pointer',
                userSelect: 'none', transition: 'all 0.2s',
              }}
            >
              {deepResearch ? '深度研究 ON' : '深度研究'}
            </span>
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
                ) : msg.content ? (
                  <div style={{ color: '#2C3E50' }}>
                    <MarkdownRenderer content={msg.content} />
                    {streaming && msg.id === messages[messages.length - 1]?.id && (
                      <span style={{
                        display: 'inline-block', width: 2, height: 16, background: '#4A6FA5',
                        marginLeft: 2, verticalAlign: 'text-bottom',
                        animation: 'blink 1s step-end infinite',
                      }} />
                    )}
                  </div>
                ) : null}
              </div>

              {/* Research Log */}
              {msg.researchLog && msg.researchLog.length > 0 && (
                <div style={{ marginTop: 8, width: '100%' }}>
                  <button
                    onClick={() => setExpandedResearch(prev => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: '#7A8F9E', fontSize: 12, padding: '4px 0' }}
                  >
                    🔍 研究过程 ({msg.researchLog.length} 步)
                    {expandedResearch[msg.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                  {expandedResearch[msg.id] && (
                    <div style={{ background: '#F7F8FA', border: '1px solid #E8ECF0', borderRadius: 8, padding: '10px 14px', marginTop: 4, fontSize: 11, color: '#999', lineHeight: 1.6 }}>
                      {msg.researchLog.map((line, i) => (
                        <div key={i} style={{ marginBottom: 2 }}>{i + 1}. {line}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

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

        {loading && !streaming && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#2C3A47', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Bot size={16} color="white" />
            </div>
            <div style={{ background: '#F7F8FA', borderRadius: '4px 12px 12px 12px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Loader2 size={15} color="#4A6FA5" className="animate-spin" />
              <span style={{ fontSize: 13, color: '#7F8C8D' }}>
                {deepResearch ? 'AI 正在进行深度研究...' : 'AI 正在检索知识库...'}
              </span>
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
            disabled={!input.trim() || isActive}
            style={{
              width: 42, height: 42, border: 'none', borderRadius: 10,
              background: !input.trim() || isActive ? '#E8ECF0' : '#4A6FA5',
              color: !input.trim() || isActive ? '#A4B0BE' : '#FFFFFF',
              cursor: !input.trim() || isActive ? 'not-allowed' : 'pointer',
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
