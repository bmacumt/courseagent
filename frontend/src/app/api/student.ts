import client from './client';
import type {
  StudentAssignment,
  AssignmentDetail,
  SubmissionSummary,
  SubmitResult,
  ReportResponse,
  QAResponse,
} from './types';

// Assignments
export async function getStudentAssignments(): Promise<StudentAssignment[]> {
  const res = await client.get<StudentAssignment[]>('/student/assignments');
  return res.data;
}

export async function getStudentAssignment(id: number): Promise<AssignmentDetail> {
  const res = await client.get<AssignmentDetail>(`/student/assignments/${id}`);
  return res.data;
}

// Submit
export async function submitAnswer(assignmentId: number, content?: string, file?: File): Promise<SubmitResult> {
  const form = new FormData();
  if (content) form.append('content', content);
  if (file) form.append('file', file);
  const res = await client.post<SubmitResult>(`/student/assignments/${assignmentId}/submit`, form);
  return res.data;
}

// Submissions
export async function getStudentSubmissions(): Promise<SubmissionSummary[]> {
  const res = await client.get<SubmissionSummary[]>('/student/submissions');
  return res.data;
}

export async function downloadAttachment(submissionId: number): Promise<void> {
  const token = localStorage.getItem('tunnel_auth_token');
  const resp = await fetch(`${client.defaults.baseURL}/student/submissions/${submissionId}/attachment`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) { throw new Error('下载失败'); }
  const blob = await resp.blob();
  const filename = parseFilename(resp.headers.get('content-disposition'));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function parseFilename(disposition: string | null): string {
  if (!disposition) return 'attachment';
  const utf8 = disposition.match(/filename\*=UTF-8''(.+?)(?:;|$)/i);
  if (utf8) return decodeURIComponent(utf8[1]);
  const ascii = disposition.match(/filename="?(.+?)"?(?:;|$)/i);
  if (ascii) return ascii[1].replace(/^"|"$/g, '');
  return 'attachment';
}

// Reports
export async function getStudentReport(reportId: number): Promise<ReportResponse> {
  const res = await client.get<ReportResponse>(`/student/reports/${reportId}`);
  return res.data;
}

// QA
export async function askQuestion(question: string): Promise<QAResponse> {
  const res = await client.post<QAResponse>('/student/qa', { question });
  return res.data;
}

export interface SSECallbacks {
  onSources: (sources: any[]) => void;
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
}

export function streamQuestion(question: string, cb: SSECallbacks): AbortController {
  const controller = new AbortController();
  const token = localStorage.getItem('tunnel_auth_token');

  fetch(`${client.defaults.baseURL}/student/qa/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ question }),
    signal: controller.signal,
  })
    .then(async (resp) => {
      if (!resp.ok) {
        cb.onError(`请求失败: ${resp.status}`);
        return;
      }
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = '';
      let currentData = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7);
          } else if (line.startsWith('data: ')) {
            currentData = line.slice(6);
          } else if (line === '' && currentEvent && currentData) {
            try {
              if (currentEvent === 'sources') cb.onSources(JSON.parse(currentData));
              else if (currentEvent === 'token') cb.onToken(JSON.parse(currentData).content);
              else if (currentEvent === 'done') cb.onDone();
            } catch {}
            currentEvent = '';
            currentData = '';
          }
        }
      }
      if (currentEvent === 'done' || !currentEvent) cb.onDone();
    })
    .catch((e) => {
      if (e.name !== 'AbortError') cb.onError(e.message || '连接失败');
    });

  return controller;
}
