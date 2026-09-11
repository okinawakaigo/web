export const roles = ['ヘルパー', 'ケアマネジャー', '相談員', 'その他'] as const;
export const ageGroups = ['20歳未満', '20代', '30代', '40代', '50代', '60歳以上', '回答しない'] as const;
export const genders = ['女性', '男性', 'その他', '回答しない'] as const;
export const statuses = ['未対応', '連絡済み', '日程確定', '対応完了'] as const;
export type Status = typeof statuses[number];
export interface ConsultationInput {
  id: string;
  name: string;
  email: string;
  role: typeof roles[number];
  ageGroup: string;
  gender: string;
  availability: string;
  questions: string;
  source: string;
  medium: string;
  consent: true;
}
export interface Consultation extends Omit<ConsultationInput, 'consent'> {
  createdAt: string;
  status: Status;
  note: string;
  revision: number;
  notification: 'pending' | 'sent' | 'failed' | 'unconfigured';
}
export type ConsultationSummary = Pick<Consultation, 'id' | 'createdAt' | 'name' | 'role' | 'status' | 'notification'>;
export interface ConsultationList {
  items: ConsultationSummary[];
  hasMore: boolean;
  total: number;
  counts: Record<Status, number>;
}
export const isId = (value: unknown): value is string => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function parseConsultation(value: unknown): ConsultationInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const keys = ['id', 'name', 'email', 'role', 'ageGroup', 'gender', 'availability', 'questions', 'source', 'medium', 'consent', 'turnstileToken'];
  if (Object.keys(v).some(key => !keys.includes(key)) || !isId(v.id) || v.consent !== true) return null;
  const limits = { name: 100, email: 254, role: 30, ageGroup: 20, gender: 20, availability: 1000, questions: 2000, source: 30, medium: 30 };
  for (const [key, limit] of Object.entries(limits)) {
    if (typeof v[key] !== 'string' || (v[key] as string).length > limit || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v[key] as string)) return null;
  }
  if (!(v.name as string).trim() || /[\r\n]/.test(v.name as string)
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v.email as string).trim())
    || !roles.includes(v.role as typeof roles[number])
    || (v.ageGroup !== '' && !ageGroups.includes(v.ageGroup as typeof ageGroups[number]))
    || (v.gender !== '' && !genders.includes(v.gender as typeof genders[number]))) return null;
  return {
    id: v.id.toLowerCase(), name: (v.name as string).trim(), email: (v.email as string).trim(),
    role: v.role as ConsultationInput['role'], ageGroup: v.ageGroup as string, gender: v.gender as string,
    availability: (v.availability as string).trim(), questions: (v.questions as string).trim(),
    source: v.source as string, medium: v.medium as string, consent: true,
  };
}
