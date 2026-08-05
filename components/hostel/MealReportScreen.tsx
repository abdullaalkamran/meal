"use client";

import { useEffect, useState } from "react";
import { Download, Printer, ShieldCheck } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { MonthNav } from "@/components/ui/MonthNav";
import { formatBDT } from "@/lib/utils/currency";
import { currentMonth, formatMonthLabel } from "@/lib/utils/date";
import {
  buildMonthlyMealReport,
  mealReportTable,
  type MemberMonthlyReport,
  type MonthlyMealReport,
} from "@/lib/reports/monthlyMealReport";
import { downloadReportCsv, printReport } from "@/lib/reports/export";
import { PrintLetterhead } from "@/components/hostel/PrintLetterhead";

const money = (n: number) => formatBDT(Math.round(n * 100) / 100);

function BalanceTag({ balance }: { balance: number }) {
  if (Math.abs(balance) < 0.005)
    return <span className="rounded-pill bg-bg px-2 py-0.5 text-[9.5px] font-extrabold text-text-secondary">Settled</span>;
  return balance > 0 ? (
    <span className="rounded-pill bg-primary-soft px-2 py-0.5 text-[9.5px] font-extrabold text-primary">
      Credit {money(balance)}
    </span>
  ) : (
    <span className="rounded-pill bg-danger-soft px-2 py-0.5 text-[9.5px] font-extrabold text-danger">
      Due {money(-balance)}
    </span>
  );
}

function MemberReportCard({ m }: { m: MemberMonthlyReport }) {
  const rows: [string, string][] = [
    ["Total meals", String(m.totalMeals)],
    ["Meal cost (avg rate × meals)", money(m.mealCost)],
    ["Shopping spent", money(m.shoppingSpent)],
    // Each rent line exactly as billed — labelled with whichever month it
    // actually covers (normally this month, but a manager can bill next
    // month's rent in advance, e.g. an "Advance rent" line), not assumed to
    // always be the report's own month.
    ...m.rentItems.map((i): [string, string] => [`· ${i.label}`, money(i.amount)]),
    ["Rent total", money(m.rent)],
    // Every billed service line by name (water, gas, cleaning, owner
    // charge, …), then the section total — same as the bill.
    ...m.serviceItems.map((i): [string, string] => [`· ${i.label}`, money(i.amount)]),
    ["Service charge total", money(m.serviceCharge)],
    ["Cook salary share", money(m.cookSalary)],
    ["Previous due", money(m.previousDue)],
    ["Bill total", money(m.billTotal)],
    ["Paid", money(m.paid)],
  ];
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <div className="truncate text-[12.5px] font-extrabold">{m.name}</div>
            {m.isManager && (
              <span className="rounded-pill bg-blue-soft px-1.5 py-0.5 text-[8.5px] font-extrabold text-blue">
                Manager
              </span>
            )}
          </div>
          <div className="text-[10px] font-semibold text-text-secondary">{m.room}</div>
        </div>
        <BalanceTag balance={m.mealBalance} />
      </div>
      <div className="flex flex-col">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between border-b border-border py-1.5 text-[10.5px] last:border-b-0"
          >
            <div className="font-bold text-text-secondary">{label}</div>
            <div className="font-extrabold">{value}</div>
          </div>
        ))}
        <div className="flex items-center justify-between pt-2 text-[11.5px]">
          <div className="font-extrabold">Outstanding on bill</div>
          <div className={`font-extrabold ${m.outstanding > 0 ? "text-danger" : "text-primary"}`}>
            {money(m.outstanding)}
          </div>
        </div>
      </div>
    </Card>
  );
}

/** Print-only payslip for a single member's report — a clean document
 * instead of the app's own rounded/badged card, shown only inside
 * `.invoice-print-area` (`scope="own"`'s print target). */
function MemberPayslip({ m, hostelName, month }: { m: MemberMonthlyReport; hostelName?: string; month: string }) {
  const rentLabel = m.rentItems.length ? "Room rent" : null;
  return (
    <div className="hidden rounded-card border border-border bg-card p-5 print:block print:border-0 print:p-0">
      <PrintLetterhead hostelName={hostelName} title="Monthly Report" meta={[formatMonthLabel(month), m.name]} />
      <div className="mb-4 flex flex-col gap-0.5">
        <div className="grid grid-cols-[1fr_auto] gap-2 border-b border-border pb-2 text-[9px] font-extrabold uppercase tracking-wide text-text-secondary">
          <div>Description</div>
          <div className="text-right">Amount</div>
        </div>
        <div className="border-b border-border py-1.5">
          <div className="flex items-center justify-between text-[10.5px] font-extrabold">
            <span>Meal cost</span>
            <span>{money(m.mealCost)}</span>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2 pl-2 text-[10px] text-text-secondary">
            <div>{m.totalMeals} meals eaten</div>
            <div className="text-right">{money(m.mealCost)}</div>
          </div>
          {m.shoppingSpent > 0 && (
            <div className="grid grid-cols-[1fr_auto] gap-2 pl-2 text-[10px] text-text-secondary">
              <div>Shopping spent (credit)</div>
              <div className="text-right">−{money(m.shoppingSpent)}</div>
            </div>
          )}
        </div>
        {rentLabel && (
          <div className="border-b border-border py-1.5">
            <div className="flex items-center justify-between text-[10.5px] font-extrabold">
              <span>{rentLabel}</span>
              <span>{money(m.rent)}</span>
            </div>
            {m.rentItems.map((item, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto] gap-2 pl-2 text-[10px] text-text-secondary">
                <div>{item.label}</div>
                <div className="text-right">{money(item.amount)}</div>
              </div>
            ))}
          </div>
        )}
        {m.serviceCharge > 0 && (
          <div className="border-b border-border py-1.5">
            <div className="flex items-center justify-between text-[10.5px] font-extrabold">
              <span>Service charge</span>
              <span>{money(m.serviceCharge)}</span>
            </div>
            {m.serviceItems.map((item, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto] gap-2 pl-2 text-[10px] text-text-secondary">
                <div>{item.label}</div>
                <div className="text-right">{money(item.amount)}</div>
              </div>
            ))}
          </div>
        )}
        {m.cookSalary > 0 && (
          <div className="flex items-center justify-between border-b border-border py-1.5 text-[10.5px] font-extrabold">
            <span>Cook salary</span>
            <span>{money(m.cookSalary)}</span>
          </div>
        )}
        {m.previousDue !== 0 && (
          <div className="flex items-center justify-between border-b border-border py-1.5 text-[10.5px] font-extrabold">
            <span>{m.previousDue > 0 ? "Previous balance" : "Previous credit"}</span>
            <span>{money(Math.abs(m.previousDue))}</span>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1.5 border-t border-border pt-3">
        <div className="flex justify-between text-[14px] font-extrabold">
          <span>Bill total</span>
          <span>{money(m.billTotal)}</span>
        </div>
        <div className="flex justify-between text-[11px] font-semibold text-text-secondary">
          <span>Paid</span>
          <span>{money(m.paid)}</span>
        </div>
        <div className="flex justify-between text-[12px] font-extrabold">
          <span>Outstanding</span>
          <span>{money(m.outstanding)}</span>
        </div>
      </div>
      <div className="mt-4 text-[9px] font-semibold text-text-secondary">
        Generated {new Date().toLocaleDateString()} · MyDorm
      </div>
    </div>
  );
}

/** Spreadsheet view for managers/owners: cost names across the header, member
 * names down the (sticky) left column, one account row per member, and a
 * totals row at the bottom. */
function MembersTable({
  members,
  serviceLabels,
}: {
  members: MemberMonthlyReport[];
  serviceLabels: string[];
}) {
  const cols: { header: string; value: (m: MemberMonthlyReport) => number; money?: boolean }[] = [
    { header: "Total meals", value: (m) => m.totalMeals },
    { header: "Meal cost", value: (m) => m.mealCost, money: true },
    { header: "Shopping spent", value: (m) => m.shoppingSpent, money: true },
    { header: "Meal credit/due", value: (m) => m.mealBalance, money: true },
    { header: "Rent", value: (m) => m.rent, money: true },
    // One column per billed service item (water, gas, cleaning, owner
    // charge, …) — exactly the lines added on the bill generation page.
    ...serviceLabels.map((label) => ({
      header: label,
      value: (m: MemberMonthlyReport) =>
        m.serviceItems.find((i) => i.label === label)?.amount ?? 0,
      money: true,
    })),
    { header: "Service total", value: (m) => m.serviceCharge, money: true },
    { header: "Cook salary", value: (m) => m.cookSalary, money: true },
    { header: "Previous due", value: (m) => m.previousDue, money: true },
    { header: "Bill total", value: (m) => m.billTotal, money: true },
    { header: "Paid", value: (m) => m.paid, money: true },
    { header: "Outstanding", value: (m) => m.outstanding, money: true },
  ];
  const sum = (fn: (m: MemberMonthlyReport) => number) =>
    members.reduce((acc, m) => acc + fn(m), 0);

  const balanceCell = (v: number) =>
    Math.abs(v) < 0.005 ? (
      <span className="text-text-secondary">—</span>
    ) : v > 0 ? (
      <span className="text-primary">+{money(v)}</span>
    ) : (
      <span className="text-danger">−{money(-v)}</span>
    );

  const cell = (c: (typeof cols)[number], m: MemberMonthlyReport) => {
    const v = c.value(m);
    if (c.header === "Meal credit/due") return balanceCell(v);
    if (c.header === "Outstanding" && v > 0) return <span className="text-danger">{money(v)}</span>;
    return c.money ? money(v) : String(v);
  };

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-card shadow-chip print:rounded-none print:border-0 print:shadow-none">
      <table className="w-full min-w-max border-collapse text-left">
        <thead>
          <tr className="bg-bg print:bg-transparent">
            <th className="sticky left-0 z-10 bg-bg px-3 py-2.5 text-[9.5px] font-extrabold uppercase tracking-wide text-text-secondary print:static print:bg-transparent print:border print:border-border">
              Member
            </th>
            {cols.map((c) => (
              <th
                key={c.header}
                className="whitespace-nowrap px-3 py-2.5 text-right text-[9.5px] font-extrabold uppercase tracking-wide text-text-secondary print:border print:border-border"
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.userId} className="border-t border-border">
              <td className="sticky left-0 z-10 bg-card px-3 py-2.5 print:static print:bg-transparent print:border print:border-border">
                <div className="flex items-center gap-1.5 whitespace-nowrap text-[11px] font-extrabold">
                  {m.name}
                  {m.isManager && (
                    <span className="rounded-pill bg-blue-soft px-1.5 py-0.5 text-[8px] font-extrabold text-blue">
                      Mgr
                    </span>
                  )}
                </div>
                <div className="text-[9px] font-semibold text-text-secondary">{m.room}</div>
              </td>
              {cols.map((c) => (
                <td
                  key={c.header}
                  className="whitespace-nowrap px-3 py-2.5 text-right text-[10.5px] font-bold print:border print:border-border"
                >
                  {cell(c, m)}
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-t-2 border-border bg-bg print:bg-transparent">
            <td className="sticky left-0 z-10 bg-bg px-3 py-2.5 text-[10.5px] font-extrabold print:static print:bg-transparent print:border print:border-border">
              Total
            </td>
            {cols.map((c) => (
              <td
                key={c.header}
                className="whitespace-nowrap px-3 py-2.5 text-right text-[10.5px] font-extrabold print:border print:border-border"
              >
                {c.header === "Meal credit/due"
                  ? balanceCell(sum(c.value))
                  : c.money
                    ? money(sum(c.value))
                    : String(sum(c.value))}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Monthly meal-settlement report. `scope="all"` (manager & owner) shows every
 * member; `scope="own"` (student) shows only the viewer's row. */
export function MealReportScreen({ scope }: { scope: "all" | "own" }) {
  const { user, activeHostelId } = useSession();
  const [month, setMonth] = useState(currentMonth());
  const [report, setReport] = useState<MonthlyMealReport | null>(null);

  useEffect(() => {
    if (!activeHostelId) return;
    let cancelled = false;
    buildMonthlyMealReport(activeHostelId, month).then((r) => {
      if (!cancelled) setReport(r);
    });
    return () => {
      cancelled = true;
    };
  }, [activeHostelId, month]);

  const visibleMembers =
    report?.members.filter((m) => scope === "all" || m.userId === user?.id) ?? [];

  const exportTable = () =>
    report ? mealReportTable(report, scope === "own" ? user?.id : undefined) : null;

  const summary = report
    ? [
        { label: "Total shopping", value: money(report.totalShopping) },
        { label: "Total meals", value: String(report.totalMeals) },
        { label: "Avg meal rate", value: money(report.avgMealRate) },
        { label: "Total due", value: money(report.totalDue), tone: report.totalDue > 0 ? "text-danger" : "" },
        { label: "Total credit to pay out", value: money(report.totalCredit), tone: "text-primary" },
      ]
    : [];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="text-[17.5px] font-extrabold tracking-tight">Monthly report</div>
        <div className="text-[10.5px] font-semibold text-text-secondary">
          {report?.hostelName}
          {scope === "own" ? " · your meal settlement" : " · meal settlement, all members"}
        </div>
      </div>

      <MonthNav value={month} onChange={setMonth} />

      <div className={`${scope === "own" ? "invoice-print-area" : "report-print-area"} flex flex-col gap-5`}>
        {scope === "own" ? (
          // Print-only payslip — a clean document instead of the on-screen
          // card, shown only inside .invoice-print-area (portrait).
          visibleMembers.map((m) => (
            <MemberPayslip key={m.userId} m={m} hostelName={report?.hostelName} month={month} />
          ))
        ) : (
          <div className="hidden print:block">
            <PrintLetterhead
              hostelName={report?.hostelName}
              title="Monthly Meal Settlement Report"
              meta={[formatMonthLabel(month)]}
            />
          </div>
        )}

        <div className={scope === "own" ? "print:hidden" : ""}>
        <Card className="print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <div className="mb-3 text-[13.5px] font-extrabold">
            {formatMonthLabel(month)} · hostel summary
          </div>
          <div className="flex flex-col">
            {summary.map((s) => (
              <div
                key={s.label}
                className="flex items-center justify-between border-b border-border py-2 text-[11px] last:border-b-0"
              >
                <div className="font-bold text-text-secondary">{s.label}</div>
                <div className={`font-extrabold ${s.tone ?? ""}`}>{s.value}</div>
              </div>
            ))}
          </div>
          {report && !report.billsGenerated && (
            <div className="mt-3 rounded-btn bg-orange-soft px-3 py-2 text-[10px] font-bold text-orange print:hidden">
              Bills for {formatMonthLabel(month)} haven&rsquo;t been generated yet — rent and
              service charge below are the standing amounts, and outstanding shows 0 until then.
            </div>
          )}
          {scope === "all" && (
            <div className="mt-3 rounded-btn bg-bg px-3 py-2 text-[10px] font-semibold text-text-secondary print:hidden">
              The manager collects from members with a meal <b>due</b> and pays out members with a
              meal <b>credit</b> (shopping spend above their eaten cost).
            </div>
          )}
        </Card>

        {visibleMembers.length === 0 ? (
          <Card className="text-center text-[11.5px] font-semibold text-text-secondary">
            No report rows for this month.
          </Card>
        ) : scope === "all" ? (
          <MembersTable members={visibleMembers} serviceLabels={report?.serviceItemLabels ?? []} />
        ) : (
          <div className="flex flex-col gap-2.5">
            {visibleMembers.map((m) => (
              <MemberReportCard key={m.userId} m={m} />
            ))}
          </div>
        )}
        </div>
      </div>

      <div className="flex gap-2.5">
        <Button
          fullWidth
          variant="secondary"
          onClick={() => {
            const t = exportTable();
            if (t) downloadReportCsv(t, `meal-report-${month}${scope === "own" ? `-${user?.name ?? "me"}` : ""}`);
          }}
        >
          <span className="flex items-center justify-center gap-1.5">
            <Icon icon={Download} size={14} /> Download CSV
          </span>
        </Button>
        <Button fullWidth variant="secondary" onClick={printReport}>
          <span className="flex items-center justify-center gap-1.5">
            <Icon icon={Printer} size={14} /> Print / PDF
          </span>
        </Button>
      </div>

      <div className="flex items-start gap-2 rounded-btn bg-bg px-3 py-2.5 text-[10px] font-semibold text-text-secondary">
        <Icon icon={ShieldCheck} size={14} className="mt-0.5 shrink-0 text-primary" />
        For data security, generate this report at the end of every month and keep a printed
        copy — the app&rsquo;s records can change after settlement.
      </div>
    </div>
  );
}
