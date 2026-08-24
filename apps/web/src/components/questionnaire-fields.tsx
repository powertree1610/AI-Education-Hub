/** Shared building blocks for the three intake forms (M3). Server components. */

const RATINGS = ["advanced", "good", "average", "needs_support", "unsure"] as const;

export function SubjectRatingsGrid({
  subjects,
  legend,
}: {
  subjects: { id: string; name: string }[];
  legend: string;
}) {
  return (
    <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="font-medium">{legend}</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500">
            <th className="py-1 pr-2 font-medium">Subject</th>
            {RATINGS.map((r) => (
              <th key={r} className="px-1 py-1 text-center font-medium">
                {r.replace("_", " ")}
              </th>
            ))}
            <th className="py-1 pl-2 font-medium">Note</th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((subject) => (
            <tr key={subject.id} className="border-t border-slate-100">
              <td className="py-1.5 pr-2">{subject.name}</td>
              {RATINGS.map((r) => (
                <td key={r} className="px-1 py-1.5 text-center">
                  <input type="radio" name={`rating_${subject.id}`} value={r} />
                </td>
              ))}
              <td className="py-1.5 pl-2">
                <input
                  name={`note_${subject.id}`}
                  className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-slate-400">Leave a row blank if the subject doesn&apos;t apply.</p>
    </section>
  );
}

export function TraitInputs({
  traits,
  legend,
}: {
  traits: { id: string; label: string; traitGroup: string; valueType: "checkbox" | "scale_1_5" }[];
  legend: string;
}) {
  return (
    <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="font-medium">{legend}</h2>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {traits.map((trait) =>
          trait.valueType === "checkbox" ? (
            <label key={trait.id} className="flex items-center gap-2">
              <input type="checkbox" name={`trait_${trait.id}`} className="h-4 w-4" />
              {trait.label} <span className="text-xs text-slate-400">({trait.traitGroup})</span>
            </label>
          ) : (
            <label key={trait.id} className="flex items-center justify-between gap-2">
              <span>
                {trait.label} <span className="text-xs text-slate-400">({trait.traitGroup})</span>
              </span>
              <select
                name={`trait_${trait.id}`}
                defaultValue=""
                className="rounded border border-slate-300 px-2 py-1 text-xs"
              >
                <option value="">—</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          ),
        )}
      </div>
    </section>
  );
}

export function InterestPicker({
  interests,
  legend,
}: {
  interests: { id: string; name: string }[];
  legend: string;
}) {
  return (
    <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="font-medium">{legend}</h2>
      <div className="grid grid-cols-3 gap-2 text-sm">
        {interests.map((interest) => (
          <label key={interest.id} className="flex items-center gap-2">
            <input type="checkbox" name={`interest_${interest.id}`} className="h-4 w-4" />
            {interest.name}
          </label>
        ))}
      </div>
      <label className="block text-sm font-medium text-slate-700">
        Others (comma-separated)
        <input
          name="freeInterests"
          placeholder="Dinosaurs, K-pop"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </label>
    </section>
  );
}
