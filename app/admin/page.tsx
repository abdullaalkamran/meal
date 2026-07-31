"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BedDouble,
  ChevronRight,
  Mail,
  Megaphone,
  Package,
  Settings,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { SmtpSettingsSheet } from "@/components/admin/SmtpSettingsSheet";
import { CreatePlatformAccountSheet } from "@/components/admin/CreatePlatformAccountSheet";
import { repo, type Bill, type Hostel, type Order, type User } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";
import { currentMonth, today } from "@/lib/utils/date";

export default function AdminDashboardPage() {
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [billsByHostel, setBillsByHostel] = useState<Bill[]>([]);
  const [mealsToday, setMealsToday] = useState(0);
  const [orders, setOrders] = useState<Order[]>([]);
  const [leadCount, setLeadCount] = useState(0);
  const [smtpOpen, setSmtpOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const { toast } = useToast();

  const load = () => {
    (async () => {
      const [hs, us, allOrders, leads] = await Promise.all([
        repo.hostels.listAll(),
        repo.users.listAll(),
        repo.orders.listAll(),
        repo.studyLeads.listAll(),
      ]);
      setHostels(hs);
      setAllUsers(us);
      setOrders(allOrders);
      setLeadCount(leads.length);
      const [billLists, mealDays] = await Promise.all([
        Promise.all(hs.map((h) => repo.bills.listByHostel(h.id, currentMonth()))),
        Promise.all(hs.map((h) => repo.meals.getMealDay(h.id, today()))),
      ]);
      setBillsByHostel(billLists.flat());
      setMealsToday(
        mealDays.reduce(
          (sum, day) =>
            sum +
            Object.values(day.entries).reduce(
              (s, e) =>
                s +
                ((e.breakfast.on ? 1 : 0) + e.breakfast.guestCount) +
                ((e.lunch.on ? 1 : 0) + e.lunch.guestCount) +
                ((e.dinner.on ? 1 : 0) + e.dinner.guestCount),
              0
            ),
          0
        )
      );
    })();
  };
  useEffect(load, []);

  const activeHostels = hostels.filter((h) => !h.suspended).length;
  const owners = allUsers.filter((u) => u.role === "owner").length;
  const members = allUsers.filter((u) => u.role === "student" || u.role === "manager").length;
  const revenue = billsByHostel.reduce((sum, b) => sum + b.paid, 0);
  const outstanding = billsByHostel.reduce((sum, b) => sum + (b.grandTotal - b.paid), 0);
  const platformTeam = allUsers.filter((u) =>
    ["superadmin", "marketing", "service"].includes(u.role)
  );

  // Platform e-commerce revenue — delivered orders are realized money; the
  // rest of the pipeline is shown separately.
  const deliveredOrders = orders.filter((o) => o.status === "delivered");
  const storeRevenue = deliveredOrders.reduce((sum, o) => sum + o.total, 0);
  const pipelineOrders = orders.filter((o) => o.status === "placed" || o.status === "confirmed");

  const tiles = [
    { label: "Active hostels", value: String(activeHostels), sub: `${hostels.length} total`, color: "text-primary" },
    { label: "Owners", value: String(owners), sub: "", color: "text-blue" },
    { label: "Members", value: String(members), sub: "students + managers", color: "" },
    { label: "Meals today", value: String(mealsToday), sub: "across hostels", color: "text-orange" },
    { label: "Revenue · Jul", value: formatBDT(revenue), sub: "collected", color: "text-primary", wide: true },
    { label: "Outstanding", value: formatBDT(outstanding), sub: "unpaid", color: "text-danger", wide: true },
    { label: "Store revenue", value: formatBDT(storeRevenue), sub: `${deliveredOrders.length} delivered orders`, color: "text-primary", wide: true },
    { label: "Order pipeline", value: String(pipelineOrders.length), sub: `${orders.length} orders total · ${leadCount} study leads`, color: "text-blue", wide: true },
  ];

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div>
        <div className="text-[17.5px] font-extrabold tracking-tight">Platform overview</div>
        <div className="text-[10.5px] font-semibold text-text-secondary">All hostels · MyDorm</div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {tiles.map((t) => (
          <Card key={t.label} className={t.wide ? "" : ""}>
            <div className="text-[9.5px] font-bold text-text-secondary">{t.label}</div>
            <div className={`mt-1 text-[16px] font-extrabold ${t.color}`}>{t.value}</div>
            {t.sub && <div className="text-[9px] font-semibold text-text-secondary">{t.sub}</div>}
          </Card>
        ))}
      </div>

      <div>
        <div className="mb-2 text-[13.5px] font-extrabold">Manage</div>
        <div className="flex flex-col gap-2">
          <Link href="/admin/hostels">
            <Card className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-primary">
                <Icon icon={BedDouble} size={17} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11.5px] font-extrabold">Hostels directory</div>
                <div className="text-[9.5px] font-semibold text-text-secondary">{hostels.length} hostels</div>
              </div>
              <Icon icon={ChevronRight} size={15} className="text-text-secondary" />
            </Card>
          </Link>
          <Link href="/admin/users">
            <Card className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-soft text-blue">
                <Icon icon={Users} size={17} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11.5px] font-extrabold">All users</div>
                <div className="text-[9.5px] font-semibold text-text-secondary">{allUsers.length} accounts</div>
              </div>
              <Icon icon={ChevronRight} size={15} className="text-text-secondary" />
            </Card>
          </Link>
          <Link href="/admin/services">
            <Card className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7C6CF6]/10 text-[#7C6CF6]">
                <Icon icon={Settings} size={17} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11.5px] font-extrabold">Quick services</div>
                <div className="text-[9.5px] font-semibold text-text-secondary">
                  Enable/disable home-page tiles by region
                </div>
              </div>
              <Icon icon={ChevronRight} size={15} className="text-text-secondary" />
            </Card>
          </Link>
          <button type="button" onClick={() => setCreateOpen(true)} className="text-left">
            <Card className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-primary">
                <Icon icon={UserPlus} size={17} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11.5px] font-extrabold">Create platform account</div>
                <div className="text-[9.5px] font-semibold text-text-secondary">Marketing or Service Manager</div>
              </div>
              <Icon icon={ChevronRight} size={15} className="text-text-secondary" />
            </Card>
          </button>
          <Link href="/admin/users">
            <Card className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7C6CF6]/10 text-[#7C6CF6]">
                <Icon icon={UserCog} size={17} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11.5px] font-extrabold">Service permissions</div>
                <div className="text-[9.5px] font-semibold text-text-secondary">
                  Service types + regions per manager
                </div>
              </div>
              <Icon icon={ChevronRight} size={15} className="text-text-secondary" />
            </Card>
          </Link>
          <button type="button" onClick={() => setSmtpOpen(true)} className="text-left">
            <Card className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-soft text-orange">
                <Icon icon={Mail} size={17} />
              </div>
              <div className="min-w-0 flex-1 text-[11.5px] font-extrabold">Email (SMTP) settings</div>
              <Icon icon={ChevronRight} size={15} className="text-text-secondary" />
            </Card>
          </button>
        </div>
      </div>

      <div>
        <div className="mb-2 text-[13.5px] font-extrabold">Platform team</div>
        <div className="flex flex-col gap-2">
          {platformTeam.map((u) => (
            <Card key={u.id} className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7C6CF6]/10 text-[#7C6CF6]">
                <Icon icon={u.role === "marketing" ? Megaphone : u.role === "service" ? Package : Users} size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11.5px] font-extrabold">{u.name}</div>
                <div className="text-[9.5px] font-semibold text-text-secondary capitalize">{u.role}</div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <SmtpSettingsSheet open={smtpOpen} onClose={() => setSmtpOpen(false)} />
      <CreatePlatformAccountSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(name) => {
          toast(`${name}'s account created`);
          load();
        }}
      />
    </div>
  );
}
