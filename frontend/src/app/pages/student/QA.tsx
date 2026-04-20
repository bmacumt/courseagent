import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Square, Bot, User, ChevronDown, ChevronUp, BookOpen, Loader2, Plus, MessageSquare, Trash2, Search, X, FileText, Scale, Presentation, GraduationCap, Paperclip, Stethoscope, GraduationCap as Companion, ClipboardCheck, HelpCircle } from 'lucide-react';
import * as studentApi from '../../api/student';
import type { ConversationSummary } from '../../api/types';
import { MarkdownRenderer } from '../../components/shared/MarkdownRenderer';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';

const DIAGNOSIS_PROMPT = `你是一位土木工程实验课的助教老师，负责在学生正式提交实验报告前，帮助他们发现问题并引导改进。

【你的角色】
- 像导师批改草稿，鼓励为主，不打最终分数
- 只指出问题方向，不直接帮学生写内容
- 用问句引导学生自己思考，而不是给答案

【诊断要检查这6项】
1. 实验目的 — 是否明确？假设有没有理论依据？
2. 变量设计 — 自变量/因变量/控制变量是否完整？
3. 操作步骤 — 关键参数（时间/温度/用量）是否具体？
4. 安全措施 — 有没有识别具体风险并对应防护？
5. 数据记录 — 表格完整吗？分析方法说清楚了吗？
6. 结论分析 — 结论和假设一致吗？误差来源具体吗？

【输出格式】
每次诊断按以下结构回复：

✅ 做得好的地方（1~2点）
⚠️ 需要改进的问题（按模块列出，说清楚为什么是问题）
💡 改进提示（用引导性问句，不直接给答案）
📋 优先修改清单（最多3条，最重要的先说）

【注意】
- 报告内容不足200字时，告知学生内容太少无法诊断
- 学生要求直接给答案时，回复"方向我来指，答案你来写"
- 发现安全隐患必须优先指出`;

type ModuleKey = 'diagnosis' | 'companion' | 'grading' | 'qa';

const moduleList: { key: ModuleKey; label: string; icon: typeof Stethoscope; active: boolean }[] = [
  { key: 'diagnosis', label: '报告诊断', icon: Stethoscope, active: true },
  { key: 'companion', label: '全程学伴', icon: Companion, active: false },
  { key: 'grading', label: '课业评分', icon: ClipboardCheck, active: false },
  { key: 'qa', label: '专业问答', icon: HelpCircle, active: false },
];

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
  const [expandedResearch, setExpandedResearch] = useState<Record<number, boolean>>({});

  // Knowledge base toggles (display only, backend always uses all)
  const kbCategories = [
    { key: 'regulation', label: '国家规范', icon: Scale },
    { key: 'textbook', label: '专业教材', icon: BookOpen },
    { key: 'courseware', label: '课程课件', icon: Presentation },
    { key: 'paper', label: '科研论文', icon: GraduationCap },
  ] as const;
  const [kbEnabled, setKbEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(kbCategories.map(c => [c.key, true]))
  );
  const toggleKb = (key: string) => setKbEnabled(prev => ({ ...prev, [key]: !prev[key] }));

  // Module mode
  const [activeModule, setActiveModule] = useState<ModuleKey | null>(null);
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [reportText, setReportText] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Conversation state
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [deleteConvTarget, setDeleteConvTarget] = useState<ConversationSummary | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, streaming, scrollToBottom]);

  // Load conversation list
  const fetchConversations = useCallback(() => {
    studentApi.getConversations()
      .then(setConversations)
      .catch(() => {});
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // Load a conversation
  const loadConversation = async (convId: number) => {
    try {
      const conv = await studentApi.getConversation(convId);
      setActiveConvId(convId);
      const loaded: ChatMessage[] = [];
      for (const m of conv.messages) {
        loaded.push({
          id: Date.now() + loaded.length,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          timestamp: m.created_at || new Date().toISOString(),
        });
      }
      setMessages(loaded);
      setExpandedSources({});
      setExpandedResearch({});
    } catch {
      alert('加载对话失败');
    }
  };

  // New conversation
  const newConversation = () => {
    setActiveConvId(null);
    setMessages([]);
    setExpandedSources({});
    setExpandedResearch({});
  };

  // Delete conversation
  const handleDeleteConv = async (conv: ConversationSummary) => {
    try {
      await studentApi.deleteConversation(conv.id);
      setConversations(prev => prev.filter(c => c.id !== conv.id));
      if (activeConvId === conv.id) {
        newConversation();
      }
    } catch {
      alert('删除失败');
    }
    setDeleteConvTarget(null);
  };

  const isActive = loading || streaming;

  const handleSend = async () => {
    if (isActive) return;

    // Diagnosis mode: need file or text
    let questionText = input.trim();
    let systemPrompt: string | undefined;

    if (activeModule === 'diagnosis') {
      // Parse uploaded file if present
      let fileContent = reportText;
      if (reportFile && !reportText) {
        try {
          fileContent = await studentApi.parseReport(reportFile);
          setReportText(fileContent);
        } catch (e: any) {
          alert(e.message || '文件解析失败');
          return;
        }
      }
      if (!fileContent && !questionText) return;
      questionText = fileContent ? (questionText ? `${fileContent}\n\n学生补充说明：${questionText}` : fileContent) : questionText;
      systemPrompt = DIAGNOSIS_PROMPT;
      setReportFile(null);
      setReportText('');
    } else {
      if (!questionText) return;
    }

    // Create conversation if needed
    let convId = activeConvId;
    if (!convId) {
      try {
        const conv = await studentApi.createConversation(questionText.slice(0, 50));
        convId = conv.id;
        setActiveConvId(convId);
        fetchConversations();
      } catch {
        alert('创建对话失败');
        return;
      }
    }

    const userMsg: ChatMessage = {
      id: Date.now(),
      role: 'user',
      content: activeModule === 'diagnosis' ? (input.trim() || '(上传报告文件)') : questionText,
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

    // Build history from previous messages (last 10)
    const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));

    let fullAnswer = '';
    const controller = studentApi.streamQuestion(questionText, {
      onSources: (sources) => {
        const formatted = sources.map((s: any) => ({
          index: s.index,
          text: (s.text || '').slice(0, 500),
          source_name: s.metadata?.source || null,
          chunk_index: s.metadata?.chunk_index ?? null,
        }));
        setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, sources: formatted } : m));
      },
      onToken: (token) => {
        fullAnswer += token;
        setStreaming(true);
        setLoading(false);
        setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, content: m.content + token } : m));
      },
      onDone: () => {
        setLoading(false);
        setStreaming(false);
        abortRef.current = null;
        fetchConversations();
        // Save messages to DB after streaming completes
        if (convId && questionText && fullAnswer) {
          studentApi.saveMessages(convId, questionText, fullAnswer).catch(() => {});
        }
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
    }, deepResearch, convId, history, systemPrompt);
    abortRef.current = controller;
  };

  const handleStop = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setLoading(false);
      setStreaming(false);
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

  const formatConvTime = (d: string | null) => {
    if (!d) return '';
    const date = new Date(d);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    return `${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  };

  const suggestedQuestions = [
    '公路建设板块包含哪些模块？',
    '隧道围岩分级的依据是什么？',
    '新奥法的核心原理是什么？',
    '公路隧道防水设计要求有哪些？',
  ];

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

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px - 48px)', gap: 0 }}>
      {/* Main chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: 52, flexShrink: 0, borderBottom: '1px solid #F0F2F5' }}>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 600, color: '#2C3E50', display: 'inline' }}>
              知识问答
            </h1>
            <span style={{ background: '#EDFAF2', color: '#6B9E7A', fontSize: 10, padding: '2px 8px', borderRadius: 3, fontWeight: 500, marginLeft: 8, verticalAlign: 'middle' }}>流式响应</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {messages.length > 0 && (
              <button
                onClick={() => setClearConfirm(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', border: '1px solid #E8ECF0', borderRadius: 6, background: '#FFFFFF', color: '#7F8C8D', cursor: 'pointer', fontSize: 12 }}
              >
                <Trash2 size={13} /> 清空对话
              </button>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', paddingTop: 80 }}>
              <Bot size={48} color="#E8ECF0" style={{ margin: '0 auto 16px', display: 'block' }} />
              <div style={{ fontSize: 17, fontWeight: 500, color: '#A4B0BE', marginBottom: 8 }}>开始提问</div>
              <div style={{ fontSize: 13, color: '#C0C8D0', marginBottom: 32 }}>基于课程知识库，AI 将提供准确解答并标注来源</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {suggestedQuestions.map(q => (
                  <button key={q} onClick={() => setInput(q)} style={{ padding: '8px 16px', border: '1px solid #E8ECF0', borderRadius: 20, background: '#F7F8FA', color: '#7F8C8D', cursor: 'pointer', fontSize: 14 }}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} style={{ marginBottom: 20, display: 'flex', gap: 12, flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                background: msg.role === 'user' ? '#4A6FA5' : '#2C3A47',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {msg.role === 'user' ? <User size={16} color="white" /> : <Bot size={16} color="white" />}
              </div>

              <div style={{ maxWidth: '70%', display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  background: msg.role === 'user' ? '#4A6FA5' : '#F7F8FA',
                  color: msg.role === 'user' ? '#FFFFFF' : '#2C3E50',
                  borderRadius: msg.role === 'user' ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                  padding: '12px 16px',
                  fontSize: 15, lineHeight: 1.7,
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
                      研究过程 ({msg.researchLog.length} 步)
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
                <span style={{ fontSize: 14, color: '#7F8C8D' }}>
                  {deepResearch ? 'AI 正在进行深度研究...' : 'AI 正在检索知识库...'}
                </span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div style={{ padding: '12px 24px 16px', flexShrink: 0, borderTop: '1px solid #F0F2F5' }}>
          {/* Module selector */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#2C3E50', marginBottom: 6 }}>功能模块</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {moduleList.map(mod => {
                const isActive = activeModule === mod.key;
                const Icon = mod.icon;
                return (
                  <button
                    key={mod.key}
                    onClick={() => {
                      if (!mod.active) return;
                      setActiveModule(prev => prev === mod.key ? null : mod.key);
                      setReportFile(null);
                      setReportText('');
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '5px 12px', borderRadius: 16,
                      border: isActive ? '1px solid #4A6FA5' : mod.active ? '1px solid #E0E3E8' : '1px solid #F0F2F5',
                      background: isActive ? '#4A6FA5' : mod.active ? '#FFFFFF' : '#FAFBFC',
                      color: isActive ? '#FFFFFF' : mod.active ? '#7F8C8D' : '#D0D5DD',
                      cursor: mod.active ? 'pointer' : 'default',
                      fontSize: 12, fontWeight: 500, transition: 'all 0.15s',
                      opacity: mod.active ? 1 : 0.5,
                    }}
                  >
                    <Icon size={14} />
                    {mod.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Knowledge base toggles */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#2C3E50', marginBottom: 6 }}>参考知识库</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {kbCategories.map(cat => {
                const on = kbEnabled[cat.key];
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.key}
                    onClick={() => toggleKb(cat.key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '5px 12px', borderRadius: 16,
                      border: on ? '1px solid #4A6FA5' : '1px solid #E0E3E8',
                      background: on ? '#EBF3FF' : '#FFFFFF',
                      color: on ? '#4A6FA5' : '#A4B0BE',
                      cursor: 'pointer', fontSize: 12, fontWeight: 500,
                      transition: 'all 0.15s',
                    }}
                  >
                    <Icon size={14} />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>
          {messages.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {suggestedQuestions.slice(0, 3).map(q => (
                <button key={q} onClick={() => setInput(q)} style={{ padding: '4px 10px', border: '1px solid #E8ECF0', borderRadius: 14, background: '#F7F8FA', color: '#7F8C8D', cursor: 'pointer', fontSize: 12 }}>
                  {q}
                </button>
              ))}
            </div>
          )}
          {/* Diagnosis file indicator */}
          {activeModule === 'diagnosis' && reportFile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '6px 10px', background: '#EBF3FF', borderRadius: 8, border: '1px solid #B8D4E8' }}>
              <FileText size={14} color="#4A6FA5" />
              <span style={{ fontSize: 13, color: '#4A6FA5', flex: 1 }}>{reportFile.name}</span>
              <button onClick={() => { setReportFile(null); setReportText(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A4B0BE', padding: 0 }}>
                <X size={14} />
              </button>
            </div>
          )}
          <div style={{
            display: 'flex', gap: 10, alignItems: 'flex-end',
            background: '#FFFFFF', border: activeModule === 'diagnosis' ? '2px solid #4A6FA5' : '1px solid #E0E3E8',
            borderRadius: 14,
            padding: '10px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}>
            {/* Paperclip for diagnosis mode */}
            {activeModule === 'diagnosis' && (
              <>
                <input
                  ref={fileInputRef}
                  type="file" accept=".pdf,.docx"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) { setReportFile(f); setReportText(''); }
                    e.target.value = '';
                  }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 36, height: 36, border: '2px solid #4A6FA5', borderRadius: 10,
                    background: reportFile ? '#4A6FA5' : '#EBF3FF',
                    color: reportFile ? '#FFFFFF' : '#4A6FA5',
                    cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s',
                  }}
                  title="上传报告文件"
                >
                  <Paperclip size={16} />
                </button>
              </>
            )}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={activeModule === 'diagnosis' ? '请输入待诊断的报告（或上传文件）...' : '输入问题，按 Enter 发送...'}
              rows={1}
              style={{
                flex: 1, border: 'none', padding: '6px 0',
                fontSize: 15, color: '#2C3E50', outline: 'none', resize: 'none',
                lineHeight: 1.6, fontFamily: 'inherit', background: 'transparent',
                minHeight: 28, maxHeight: 120,
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {/* Deep research toggle */}
              <button
                onClick={() => setDeepResearch(!deepResearch)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 14px', borderRadius: 20,
                  background: deepResearch ? '#4A6FA5' : '#F0F2F5',
                  color: deepResearch ? '#FFFFFF' : '#7F8C8D',
                  border: deepResearch ? 'none' : 'none',
                  cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  transition: 'all 0.2s', whiteSpace: 'nowrap',
                }}
              >
                <Search size={14} />
                {deepResearch ? '深度研究' : '深度研究'}
              </button>

              {/* Send / Stop button */}
              {isActive ? (
                <button
                  onClick={handleStop}
                  style={{
                    width: 38, height: 38, border: 'none', borderRadius: 10,
                    background: '#E74C3C', color: '#FFFFFF',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Square size={15} />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  style={{
                    width: 38, height: 38, border: 'none', borderRadius: 10,
                    background: input.trim() ? '#4A6FA5' : '#E8ECF0',
                    color: input.trim() ? '#FFFFFF' : '#A4B0BE',
                    cursor: input.trim() ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Send size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right sidebar - conversation history */}
      <div style={{
        width: 260, borderLeft: '1px solid #F0F2F5', display: 'flex', flexDirection: 'column',
        background: '#FAFBFC', flexShrink: 0,
      }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #F0F2F5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#2C3E50' }}>对话历史</span>
          <button
            onClick={newConversation}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', border: '1px solid #D0D5DD', borderRadius: 6, background: '#FFFFFF', color: '#4A6FA5', cursor: 'pointer', fontSize: 12 }}
          >
            <Plus size={13} /> 新对话
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
          {conversations.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: '#A4B0BE', fontSize: 13 }}>
              <MessageSquare size={24} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.4 }} />
              暂无历史对话
            </div>
          )}
          {conversations.map(conv => (
            <div
              key={conv.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 12px', borderRadius: 8, marginBottom: 4,
                background: activeConvId === conv.id ? '#EBF3FF' : 'transparent',
                cursor: 'pointer', transition: 'background 0.15s',
                border: activeConvId === conv.id ? '1px solid #B8D4E8' : '1px solid transparent',
              }}
              onClick={() => loadConversation(conv.id)}
              onMouseEnter={e => { if (activeConvId !== conv.id) e.currentTarget.style.background = '#F0F2F5'; }}
              onMouseLeave={e => { if (activeConvId !== conv.id) e.currentTarget.style.background = 'transparent'; }}
            >
              <MessageSquare size={14} color={activeConvId === conv.id ? '#4A6FA5' : '#A4B0BE'} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: activeConvId === conv.id ? '#4A6FA5' : '#2C3E50', fontWeight: activeConvId === conv.id ? 500 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {conv.title}
                </div>
                <div style={{ fontSize: 11, color: '#A4B0BE', marginTop: 2 }}>{formatConvTime(conv.updated_at || conv.created_at)}</div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setDeleteConvTarget(conv); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A4B0BE', padding: 2, flexShrink: 0, opacity: 0.5 }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#C46B6B'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.color = '#A4B0BE'; }}
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <ConfirmDialog
        open={clearConfirm}
        title="清空对话"
        description="将清空当前对话内容，此操作不可撤销。"
        confirmText="确认清空"
        danger
        onConfirm={() => { setMessages([]); setClearConfirm(false); }}
        onCancel={() => setClearConfirm(false)}
      />

      <ConfirmDialog
        open={!!deleteConvTarget}
        title="删除对话"
        description={`将删除对话"${deleteConvTarget?.title}"，此操作不可撤销。`}
        confirmText="确认删除"
        danger
        onConfirm={() => deleteConvTarget && handleDeleteConv(deleteConvTarget)}
        onCancel={() => setDeleteConvTarget(null)}
      />
    </div>
  );
}
