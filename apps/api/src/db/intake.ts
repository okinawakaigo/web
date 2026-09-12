import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import type { ConsultationInput } from '@okinawa-care/contracts';
import { consultations } from './schema';

/** Fields the applicant submitted. Status, notes and notification state stay with the admin repository. */
export type Submitted = Omit<ConsultationInput, 'consent'>;
export const submittedFields = {
  id: consultations.id, name: consultations.name, email: consultations.email, role: consultations.role,
  ageGroup: consultations.ageGroup, gender: consultations.gender, availability: consultations.availability,
  questions: consultations.questions, source: consultations.source, medium: consultations.medium,
};

/** The recruit site can file a consultation and read back the one it just filed. Nothing else. */
export function intakeRepository(binding: D1Database) {
  const db = drizzle(binding);
  return {
    checkAvailable: () => db.select({ id: consultations.id }).from(consultations).limit(1).all(),

    async create(input: ConsultationInput, createdAt: string) {
      const { consent: _consent, ...values } = input;
      await db.insert(consultations).values({ ...values, createdAt })
        .onConflictDoNothing({ target: consultations.id }).run();
    },

    find: (id: string): Promise<Submitted | undefined> => db.select(submittedFields)
      .from(consultations).where(eq(consultations.id, id)).get(),
  };
}
