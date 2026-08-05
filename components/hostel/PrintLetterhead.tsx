/** Document header for printed/PDF financial documents (bills, payslips,
 * reports) — the same masthead shape as the store's OrderInvoice, so every
 * printable document in the app reads as one consistent paper trail instead
 * of a screenshot of the app's own colorful cards. */
export function PrintLetterhead({
  hostelName,
  title,
  meta,
}: {
  hostelName?: string;
  title: string;
  /** Right-aligned lines under the title — doc number, date, member name. */
  meta: string[];
}) {
  return (
    <div className="mb-4 flex items-start justify-between border-b border-border pb-4">
      <div>
        <div className="text-[16px] font-extrabold text-primary">MyDorm</div>
        <div className="text-[9.5px] font-semibold text-text-secondary">{hostelName ?? "Hostel"}</div>
      </div>
      <div className="text-right">
        <div className="text-[11px] font-extrabold">{title}</div>
        {meta.map((m, i) => (
          <div key={i} className="text-[9.5px] font-semibold text-text-secondary">
            {m}
          </div>
        ))}
      </div>
    </div>
  );
}
