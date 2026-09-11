import { isId } from './consultations';

export const replyLimits = { subject: 160, body: 6000 } as const;
export const defaultReplySubject = '【沖縄介護センター】説明会への参加相談について';
export interface ReplyInput { id: string; subject: string; body: string }
export interface ConsultationReply extends ReplyInput {
  createdAt: string;
  from: string;
  to: string;
  replyTo: string;
  sentBy: string;
  status: 'pending' | 'accepted' | 'failed' | 'uncertain' | 'test';
  acceptedAt: string | null;
  canRetry: boolean;
}
export interface ReplySettings {
  available: boolean;
  localTest: boolean;
  from: string;
  replyTo: string;
}
export interface ReplyList {
  items: ConsultationReply[];
  nextCursor: string | null;
  settings: ReplySettings;
}
export function parseReply(value: unknown): ReplyInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some(key => !['id', 'subject', 'body'].includes(key)) || !isId(v.id)
    || typeof v.subject !== 'string' || typeof v.body !== 'string'
    || !v.subject.trim() || v.subject.length > replyLimits.subject || /[\x00-\x1f\x7f]/.test(v.subject)
    || !v.body.trim() || v.body.length > replyLimits.body || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v.body)) return null;
  return { id: v.id.toLowerCase(), subject: v.subject.trim(), body: v.body.replace(/\r\n?/g, '\n').trim() };
}
