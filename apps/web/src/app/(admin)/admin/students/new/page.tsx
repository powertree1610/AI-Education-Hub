import { CONSENT_TYPES } from "@platform/shared";
import { createStudentAction } from "@/actions/students";
import { CONSENT_LABELS } from "@/lib/consent-labels";

export const dynamic = "force-dynamic";

const field = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm";
const label = "block text-sm font-medium text-slate-700";

export default function NewStudentPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold">Register student</h1>
      <form action={createStudentAction} className="mt-6 space-y-8">
        <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-medium">Student</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={label}>
                Full name *
                <input name="fullName" required className={field} />
              </label>
            </div>
            <label className={label}>
              Preferred name
              <input name="preferredName" className={field} />
            </label>
            <label className={label}>
              Student code (auto if blank)
              <input name="studentCode" placeholder="ST-0002" className={field} />
            </label>
            <label className={label}>
              Date of birth *
              <input name="dob" type="date" required className={field} />
            </label>
            <label className={label}>
              Gender
              <select name="gender" className={field}>
                <option value="">—</option>
                <option>Female</option>
                <option>Male</option>
              </select>
            </label>
            <label className={label}>
              Programme
              <input name="programme" placeholder="Primary Tuition + Childcare" className={field} />
            </label>
            <label className={label}>
              School name
              <input name="schoolName" className={field} />
            </label>
            <label className={label}>
              School grade
              <input name="schoolGrade" placeholder="Standard 4" className={field} />
            </label>
            <label className={label}>
              Preferred AI language
              <select name="preferredAiLanguage" className={field}>
                <option value="English">English</option>
                <option value="Bahasa Melayu">Bahasa Melayu</option>
                <option value="Chinese">Chinese</option>
              </select>
            </label>
          </div>
        </section>

        <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-medium">Primary guardian</h2>
          <div className="grid grid-cols-2 gap-4">
            <label className={label}>
              Name
              <input name="guardianName" className={field} />
            </label>
            <label className={label}>
              Relationship
              <input name="guardianRelationship" placeholder="Mother" className={field} />
            </label>
            <label className={label}>
              Phone
              <input name="guardianPhone" className={field} />
            </label>
            <label className={label}>
              Email
              <input name="guardianEmail" type="email" className={field} />
            </label>
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-medium">Paper consents (signed form on file)</h2>
          <p className="text-sm text-slate-500">
            Tick the categories the guardian granted on the signed paper form. AI features
            are hard-gated on these — nothing works without the matching consent.
          </p>
          <div className="space-y-2">
            {CONSENT_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name={`consent_${type}`} className="h-4 w-4" />
                {CONSENT_LABELS[type]}
              </label>
            ))}
          </div>
        </section>

        <button
          type="submit"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Register
        </button>
      </form>
    </div>
  );
}
