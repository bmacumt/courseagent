export type Role = 'admin' | 'teacher' | 'student';
export type SubmissionStatus = 'submitted' | 'grading' | 'graded' | 'failed';
export type DocType = 'specification' | 'textbook' | 'other';
export type SettingCategory = 'llm' | 'embedding' | 'reranker' | 'mineru' | 'general';

export interface User {
  id: number;
  username: string;
  role: Role;
  real_name: string | null;
  student_id: string | null;
  class_name: string | null;
  created_at: string;
}

export interface Document {
  id: number;
  doc_uuid: string;
  filename: string;
  title: string;
  doc_type: DocType;
  owner_id: number;
  chunk_count: number;
  uploaded_at: string;
}

export interface Assignment {
  id: number;
  teacher_id: number;
  title: string;
  description: string;
  question: string;
  reference_answer: string | null;
  grading_criteria: string;
  deadline: string | null;
  is_published: boolean;
  created_at: string;
  submission_count: number;
}

export interface Submission {
  id: number;
  assignment_id: number;
  student_name: string;
  student_real_name: string | null;
  status: SubmissionStatus;
  submitted_at: string;
  total_score: number | null;
  has_attachment?: boolean;
}

export interface DimensionScore {
  name: string;
  label: string;
  score: number;
  weight: number;
  weighted_score: number;
  comment: string;
}

export interface Report {
  id: number;
  submission_id: number;
  total_score: number;
  max_score: number;
  dimension_scores: DimensionScore[];
  feedback: string;
  references: string[];
  regulations_found: string[];
  regulations_cited: string[];
  created_at: string;
}

export interface Setting {
  id: number;
  key: string;
  value: string;
  category: SettingCategory;
  updated_at: string;
}

export interface AdminStats {
  total_users: number;
  total_documents: number;
  total_assignments: number;
  total_submissions: number;
}

export interface QAMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: { index: number; text: string; source_name: string; chunk_index: number }[];
}

// ============ Mock Data ============

export const mockAdminStats: AdminStats = {
  total_users: 68,
  total_documents: 12,
  total_assignments: 5,
  total_submissions: 187,
};

export const mockUsers: User[] = [
  { id: 1, username: 'admin', role: 'admin', real_name: '系统管理员', student_id: null, class_name: null, created_at: '2026-04-01T08:00:00' },
  { id: 2, username: 'teacher_zhang', role: 'teacher', real_name: '张明', student_id: null, class_name: null, created_at: '2026-04-02T09:00:00' },
  { id: 3, username: 'teacher_li', role: 'teacher', real_name: '李萍', student_id: null, class_name: null, created_at: '2026-04-02T09:30:00' },
  { id: 4, username: 'stu_001', role: 'student', real_name: '王浩', student_id: '2024001', class_name: '隧道一班', created_at: '2026-04-05T10:00:00' },
  { id: 5, username: 'stu_002', role: 'student', real_name: '李梅', student_id: '2024002', class_name: '隧道一班', created_at: '2026-04-05T10:05:00' },
  { id: 6, username: 'stu_003', role: 'student', real_name: '赵强', student_id: '2024003', class_name: '隧道一班', created_at: '2026-04-05T10:10:00' },
  { id: 7, username: 'stu_004', role: 'student', real_name: '陈思', student_id: '2024004', class_name: '隧道二班', created_at: '2026-04-05T10:15:00' },
  { id: 8, username: 'stu_005', role: 'student', real_name: '刘洋', student_id: '2024005', class_name: '隧道二班', created_at: '2026-04-05T10:20:00' },
  { id: 9, username: 'stu_006', role: 'student', real_name: '周华', student_id: '2024006', class_name: '隧道二班', created_at: '2026-04-05T10:25:00' },
  { id: 10, username: 'stu_007', role: 'student', real_name: '吴雪', student_id: '2024007', class_name: '隧道一班', created_at: '2026-04-05T10:30:00' },
  { id: 11, username: 'stu_008', role: 'student', real_name: '郑阳', student_id: '2024008', class_name: '隧道一班', created_at: '2026-04-05T10:35:00' },
  { id: 12, username: 'stu_009', role: 'student', real_name: '冯磊', student_id: '2024009', class_name: '隧道二班', created_at: '2026-04-05T10:40:00' },
];

export const mockDocuments: Document[] = [
  { id: 1, doc_uuid: 'uuid-001', filename: 'JTG_1001-2017.pdf', title: 'JTG 1001-2017 公路工程标准体系', doc_type: 'specification', owner_id: 2, chunk_count: 11, uploaded_at: '2026-04-08T10:00:00' },
  { id: 2, doc_uuid: 'uuid-002', filename: 'JTG_D70-2004.pdf', title: 'JTG D70-2004 公路隧道设计规范', doc_type: 'specification', owner_id: 2, chunk_count: 34, uploaded_at: '2026-04-09T14:00:00' },
  { id: 3, doc_uuid: 'uuid-003', filename: 'JTG_F60-2009.pdf', title: 'JTG F60-2009 公路隧道施工技术规范', doc_type: 'specification', owner_id: 2, chunk_count: 28, uploaded_at: '2026-04-10T09:30:00' },
  { id: 4, doc_uuid: 'uuid-004', filename: 'tunnel_textbook_v3.pdf', title: '隧道工程学（第三版）', doc_type: 'textbook', owner_id: 2, chunk_count: 156, uploaded_at: '2026-04-11T11:00:00' },
];

export const mockAssignments: Assignment[] = [
  {
    id: 1,
    teacher_id: 2,
    title: '公路工程标准体系概述',
    description: '请阐述公路工程标准体系的总体框架结构，包括各板块的划分及其相互关系。',
    question: '请阐述公路工程标准体系的总体框架结构，包括板块和模块的划分，以及各板块在公路工程建设中的作用。',
    reference_answer: '公路工程标准体系分为六大板块：公路建设、公路养护、公路管理、公路运输、公路科研、综合类。公路建设板块包含勘测、设计、试验、检测、施工、监理、项目管理、造价共8个模块...',
    grading_criteria: '{"dimensions":[{"name":"accuracy","label":"准确性","weight":0.3,"description":"内容是否正确"},{"name":"completeness","label":"完整性","weight":0.25,"description":"是否覆盖要点"},{"name":"compliance","label":"规范性","weight":0.25,"description":"是否正确引用规范"},{"name":"innovation","label":"创新性","weight":0.2,"description":"是否有独立思考"}]}',
    deadline: '2026-05-01T23:59:59',
    is_published: true,
    created_at: '2026-04-15T10:00:00',
    submission_count: 42,
  },
  {
    id: 2,
    teacher_id: 2,
    title: '隧道围岩分级方法',
    description: '请分析公路隧道围岩分级的原则和方法，并说明不同围岩级别的特征。',
    question: '根据JTG D70-2004，公路隧道围岩分为几级？各级围岩的主要特征是什么？其分级依据有哪些？',
    reference_answer: null,
    grading_criteria: '{"dimensions":[{"name":"accuracy","label":"准确性","weight":0.3},{"name":"completeness","label":"完整性","weight":0.25},{"name":"compliance","label":"规范性","weight":0.25},{"name":"innovation","label":"创新性","weight":0.2}]}',
    deadline: '2026-05-10T23:59:59',
    is_published: true,
    created_at: '2026-04-16T14:00:00',
    submission_count: 28,
  },
  {
    id: 3,
    teacher_id: 2,
    title: '新奥法施工原理',
    description: '请详细说明新奥法（NATM）的基本原理及其在公路隧道施工中的应用。',
    question: '新奥法的核心理念是什么？与传统矿山法相比有哪些优势？在公路隧道施工中如何应用新奥法的原则？',
    reference_answer: null,
    grading_criteria: '{"dimensions":[{"name":"accuracy","label":"准确性","weight":0.3},{"name":"completeness","label":"完整性","weight":0.25},{"name":"compliance","label":"规范性","weight":0.25},{"name":"innovation","label":"创新性","weight":0.2}]}',
    deadline: null,
    is_published: false,
    created_at: '2026-04-17T09:00:00',
    submission_count: 0,
  },
];

export const mockSubmissions: Submission[] = [
  { id: 1, assignment_id: 1, student_name: 'stu_001', student_real_name: '王浩', status: 'graded', submitted_at: '2026-04-18T14:00:00', total_score: 85.5, has_attachment: false },
  { id: 2, assignment_id: 1, student_name: 'stu_002', student_real_name: '李梅', status: 'graded', submitted_at: '2026-04-18T15:30:00', total_score: 72.0, has_attachment: true },
  { id: 3, assignment_id: 1, student_name: 'stu_003', student_real_name: '赵强', status: 'graded', submitted_at: '2026-04-18T16:00:00', total_score: 91.5, has_attachment: false },
  { id: 4, assignment_id: 1, student_name: 'stu_004', student_real_name: '陈思', status: 'grading', submitted_at: '2026-04-18T16:30:00', total_score: null, has_attachment: false },
  { id: 5, assignment_id: 1, student_name: 'stu_005', student_real_name: '刘洋', status: 'submitted', submitted_at: '2026-04-18T17:00:00', total_score: null, has_attachment: true },
  { id: 6, assignment_id: 1, student_name: 'stu_006', student_real_name: '周华', status: 'graded', submitted_at: '2026-04-18T17:30:00', total_score: 68.0, has_attachment: false },
  { id: 7, assignment_id: 1, student_name: 'stu_007', student_real_name: '吴雪', status: 'failed', submitted_at: '2026-04-18T18:00:00', total_score: null, has_attachment: false },
  { id: 8, assignment_id: 1, student_name: 'stu_008', student_real_name: '郑阳', status: 'graded', submitted_at: '2026-04-18T18:30:00', total_score: 79.0, has_attachment: false },
];

export const mockReport: Report = {
  id: 1,
  submission_id: 1,
  total_score: 85.5,
  max_score: 100,
  dimension_scores: [
    { name: 'accuracy', label: '准确性', score: 90, weight: 0.3, weighted_score: 27.0, comment: '内容准确，公路工程标准体系的框架结构描述正确，各板块划分清晰，技术要点表述规范，与JTG 1001-2017规定的体系一致。' },
    { name: 'completeness', label: '完整性', score: 85, weight: 0.25, weighted_score: 21.25, comment: '基本覆盖了主要要点，包含了六大板块的介绍，但对公路建设板块内8个模块的详细描述略显简略，建议进一步补充各模块的具体内容。' },
    { name: 'compliance', label: '规范性', score: 80, weight: 0.25, weighted_score: 20.0, comment: '正确引用了JTG 1001-2017规范，规范引用格式基本正确，但部分条文编号略有偏差，需注意引用格式的标准性。' },
    { name: 'innovation', label: '创新性', score: 85, weight: 0.2, weighted_score: 17.0, comment: '有一定的独立思考，结合实际工程案例进行了分析，体现了对课程内容的深入理解和应用能力。' },
  ],
  feedback: '## 综合评语\n\n该答案**整体表现良好**，对公路工程标准体系的框架结构有较为清晰的理解和把握。\n\n### 主要优点\n- 正确识别并描述了六大板块的划分\n- 对公路建设板块的模块划分描述基本准确\n- 规范引用意识较强，体现了对行业标准的重视\n\n### 改进建议\n1. 建议进一步完善各板块之间相互关系的论述\n2. 规范引用时注意条文编号的准确性，建议查阅原文核实\n3. 可以结合实际工程案例进行更深入的对比分析\n\n继续保持！',
  references: ['JTG 1001-2017 3.2', 'JTG 1001-2017 4.1'],
  regulations_found: ['JTG 1001-2017 第3.2条 公路建设板块包含勘测、设计等8个模块', 'JTG 1001-2017 第4.1条 公路养护标准体系框架'],
  regulations_cited: ['JTG 1001-2017'],
  created_at: '2026-04-18T14:01:00',
};

export const mockSettings: Record<string, Setting[]> = {
  llm: [
    { id: 1, key: 'llm_model', value: 'deepseek-chat', category: 'llm', updated_at: '2026-04-18T10:00:00' },
    { id: 2, key: 'llm_api_key', value: 'sk-****************************', category: 'llm', updated_at: '2026-04-18T10:00:00' },
    { id: 3, key: 'llm_base_url', value: 'https://api.deepseek.com/v1', category: 'llm', updated_at: '2026-04-18T10:00:00' },
    { id: 4, key: 'llm_temperature', value: '0.3', category: 'llm', updated_at: '2026-04-18T10:00:00' },
    { id: 5, key: 'llm_max_tokens', value: '4096', category: 'llm', updated_at: '2026-04-18T10:00:00' },
  ],
  embedding: [
    { id: 6, key: 'embedding_model', value: 'BAAI/bge-large-zh-v1.5', category: 'embedding', updated_at: '2026-04-18T10:00:00' },
    { id: 7, key: 'embedding_dimension', value: '1024', category: 'embedding', updated_at: '2026-04-18T10:00:00' },
    { id: 8, key: 'embedding_batch_size', value: '32', category: 'embedding', updated_at: '2026-04-18T10:00:00' },
  ],
  reranker: [
    { id: 9, key: 'reranker_model', value: 'BAAI/bge-reranker-large', category: 'reranker', updated_at: '2026-04-18T10:00:00' },
    { id: 10, key: 'reranker_top_k', value: '5', category: 'reranker', updated_at: '2026-04-18T10:00:00' },
  ],
  mineru: [
    { id: 11, key: 'mineru_backend', value: 'pipeline', category: 'mineru', updated_at: '2026-04-18T10:00:00' },
    { id: 12, key: 'mineru_chunk_size', value: '512', category: 'mineru', updated_at: '2026-04-18T10:00:00' },
    { id: 13, key: 'mineru_chunk_overlap', value: '50', category: 'mineru', updated_at: '2026-04-18T10:00:00' },
  ],
  general: [
    { id: 14, key: 'access_token_expire_minutes', value: '60', category: 'general', updated_at: '2026-04-18T10:00:00' },
    { id: 15, key: 'max_file_size_mb', value: '10', category: 'general', updated_at: '2026-04-18T10:00:00' },
    { id: 16, key: 'rag_retrieval_top_k', value: '10', category: 'general', updated_at: '2026-04-18T10:00:00' },
  ],
};

export const mockQAHistory: QAMessage[] = [
  {
    id: 1,
    role: 'user',
    content: '公路建设板块包含哪些模块？',
    timestamp: '2026-04-18T10:00:00',
  },
  {
    id: 2,
    role: 'assistant',
    content: '根据 **JTG 1001-2017** 的规定，公路建设板块共包含以下 **8个模块**：\n\n1. **勘测** — 工程地质勘察与测量\n2. **设计** — 路线、结构、附属设施设计\n3. **试验** — 材料与工艺试验\n4. **检测** — 工程质量检测\n5. **施工** — 工程施工技术与管理\n6. **监理** — 工程建设监理\n7. **项目管理** — 工程项目综合管理\n8. **造价** — 工程估算、概算、预算、结算\n\n这8个模块涵盖了公路建设从前期准备到竣工验收的全过程标准需求。',
    sources: [
      { index: 1, text: '公路建设板块包含勘测、设计、试验、检测、施工、监理、项目管理、造价共8个模块，形成完整的公路工程建设标准体系...', source_name: 'JTG 1001-2017.pdf', chunk_index: 3 },
    ],
    timestamp: '2026-04-18T10:00:05',
  },
];

export const credentialsMap: Record<string, { role: Role; real_name: string; id: number; username: string }> = {
  'admin': { role: 'admin', real_name: '系统管理员', id: 1, username: 'admin' },
  'teacher': { role: 'teacher', real_name: '张明', id: 2, username: 'teacher_zhang' },
  'student': { role: 'student', real_name: '王浩', id: 4, username: 'stu_001' },
};

export const studentSubmissionsList: (Submission & { assignment_title: string })[] = [
  { id: 1, assignment_id: 1, assignment_title: '公路工程标准体系概述', student_name: 'stu_001', student_real_name: '王浩', status: 'graded', submitted_at: '2026-04-18T14:00:00', total_score: 85.5, has_attachment: false },
];
