// Canonical client-side "backend" for Dynamic Bank of West.
// All state persists in localStorage; consumed by both the customer
// dashboard and the admin console so they stay in sync.

export type AccountTier = "Standard" | "Premier" | "Private" | "Business";
export type AccountStatus = "Active" | "Frozen" | "Review";

export type MtUser = {
  id: string;
  name: string;
  email: string;
  password: string; // mock only
  phone: string;
  address?: string;
  ssn: string;
  securityQ: string;
  securityA: string;
  accountNumber: string; // full mock number
  account: string; // masked (•••• ####)
  tier: AccountTier;
  status: AccountStatus;
  balance: number;           // Everyday Checking balance
  savingsBalance: number;    // Way2Save Savings balance
  savingsAccountNumber?: string; // full mock savings acct
  verified: boolean;
  profilePicture?: string; // data URL
  createdAt: string;
  enrollments?: {
    smallBusiness?: boolean;
    commercial?: boolean;
    wire?: boolean;
  };
  serviceBalances?: {
    smallBusiness?: number;
    commercial?: number;
    wire?: number;
  };
  debitFrozen?: boolean;
  dailyLimit?: number;
};

export type AccountKey = "checking" | "savings";

export type LedgerEntry = {
  id: string;
  userId: string;
  account: AccountKey;
  date: string;      // ISO
  description: string;
  amount: number;    // signed (+credit, -debit)
  balanceAfter: number;
};

export type ChatMessage = {
  id: string;
  from: "user" | "agent";
  text: string;
  ts: string;
};


export type PendingTxMethod = "Wire" | "ACH" | "Check" | "Crypto" | "Transfer";
export type PendingTxStatus = "Pending" | "Approved" | "Failed";

export type PendingTx = {
  id: string;
  userId: string;
  userName: string;
  method: PendingTxMethod;
  amount: number;
  submitted: string;
  status: PendingTxStatus;
  reference: string;
  direction: "credit" | "debit";
  memo?: string;
  recipient?: string;
  recipientBank?: string;
  recipientAcct?: string;
  routing?: string;
  resolvedAt?: string;
};

export type DepositSettings = {
  bankName: string;
  routing: string;
  beneficiary: string;
  accountNumber: string;
  swift: string;
  bankAddress: string;
  btcAddress: string;
  btcQrDataUrl: string; // base64 image
};

export const LS = {
  USERS: "mt_admin_users",
  QUEUE: "mt_admin_queue",
  DEPOSIT: "mt_admin_deposit_settings",
  CURRENT: "mt_current_user_id",
  LEDGER: "mt_account_ledger",
  CHAT: "mt_chat_threads",
} as const;

export const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What is your mother's maiden name?",
  "What was the make and model of your first car?",
  "In what city were you born?",
  "What was the name of your elementary school?",
  "What is your favorite book?",
  "What was your childhood nickname?",
];

export const DEFAULT_DEPOSIT_SETTINGS: DepositSettings = {
  bankName: "Dynamic Bank of West, N.A.",
  routing: "121000248",
  beneficiary: "DBW Corporate Deposits",
  accountNumber: "000123455678",
  swift: "DBWSUS44",
  bankAddress: "1998 Western Blvd, Los Angeles, CA 90045",
  btcAddress: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
  btcQrDataUrl: "",
};

// Legacy seed customers. Passwords enable login without registration for demo.
const seedUsers: MtUser[] = [
  {
    id: "u_1001", name: "Marcus Whitfield", email: "m.whitfield@dbwest.com", password: "password123",
    phone: "5551234567", ssn: "•••-••-4419",
    securityQ: "What is your mother's maiden name?", securityA: "smith",
    accountNumber: "778812304419", account: "•••• 4419",
    tier: "Premier", status: "Active", balance: 0, savingsBalance: 0,
    savingsAccountNumber: "778812309901", verified: true, createdAt: "2025-11-02",
  },
  {
    id: "u_1002", name: "Elena Sokolova", email: "elena.s@dbwest.com", password: "password123",
    phone: "5552341122", ssn: "•••-••-7832",
    securityQ: "What was the name of your first pet?", securityA: "boris",
    accountNumber: "778823017832", account: "•••• 7832",
    tier: "Private", status: "Active", balance: 0, savingsBalance: 0,
    savingsAccountNumber: "778823019902", verified: true, createdAt: "2025-11-11",
  },
];

// -- Read / write helpers ------------------------------------------------------

export function loadUsers(): MtUser[] {
  if (typeof window === "undefined") return seedUsers;
  const raw = localStorage.getItem(LS.USERS);
  if (!raw) {
    localStorage.setItem(LS.USERS, JSON.stringify(seedUsers));
    return seedUsers;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<MtUser>[];
    // Normalize legacy shapes that only had name/email/tier/status/balance
    return parsed.map((u, i) => ({
      id: u.id ?? `u_${1000 + i}`,
      name: u.name ?? "Customer",
      email: u.email ?? `customer${i}@dbwest.com`,
      password: u.password ?? "password123",
      phone: u.phone ?? "",
      address: u.address ?? "",
      ssn: u.ssn ?? "•••-••-••••",
      securityQ: u.securityQ ?? SECURITY_QUESTIONS[0],
      securityA: u.securityA ?? "",
      accountNumber: u.accountNumber ?? Math.random().toString().slice(2, 14),
      account: u.account ?? "•••• " + Math.floor(1000 + Math.random() * 9000),
      tier: (u.tier as AccountTier) ?? "Standard",
      status: (u.status as AccountStatus) ?? "Active",
      balance: typeof u.balance === "number" ? u.balance : 0,
      savingsBalance: typeof u.savingsBalance === "number" ? u.savingsBalance : 0,
      savingsAccountNumber: u.savingsAccountNumber ?? Math.random().toString().slice(2, 14),
      verified: u.verified ?? true,
      profilePicture: u.profilePicture,
      createdAt: u.createdAt ?? new Date().toISOString().slice(0, 10),
      enrollments: u.enrollments ?? { smallBusiness: false, commercial: false, wire: false },
      serviceBalances: u.serviceBalances ?? { smallBusiness: 0, commercial: 0, wire: 0 },
      debitFrozen: u.debitFrozen ?? false,
      dailyLimit: typeof u.dailyLimit === "number" ? u.dailyLimit : 2500,

    }));
  } catch {
    return seedUsers;
  }
}

export function saveUsers(users: MtUser[]) {
  localStorage.setItem(LS.USERS, JSON.stringify(users));
  window.dispatchEvent(new CustomEvent("mt:users-changed"));
}

export function upsertUser(user: MtUser) {
  const all = loadUsers();
  const idx = all.findIndex((u) => u.id === user.id);
  if (idx === -1) all.unshift(user);
  else all[idx] = user;
  saveUsers(all);
}

export function loadQueue(): PendingTx[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(LS.QUEUE);
  if (!raw) return [];
  try { return JSON.parse(raw) as PendingTx[]; } catch { return []; }
}

export function saveQueue(q: PendingTx[]) {
  localStorage.setItem(LS.QUEUE, JSON.stringify(q));
  window.dispatchEvent(new CustomEvent("mt:queue-changed"));
}

export function pushToQueue(tx: PendingTx) {
  const q = loadQueue();
  q.unshift(tx);
  saveQueue(q);
}

export function loadDepositSettings(): DepositSettings {
  if (typeof window === "undefined") return DEFAULT_DEPOSIT_SETTINGS;
  const raw = localStorage.getItem(LS.DEPOSIT);
  if (!raw) return DEFAULT_DEPOSIT_SETTINGS;
  try {
    return { ...DEFAULT_DEPOSIT_SETTINGS, ...(JSON.parse(raw) as Partial<DepositSettings>) };
  } catch {
    return DEFAULT_DEPOSIT_SETTINGS;
  }
}

export function saveDepositSettings(s: DepositSettings) {
  localStorage.setItem(LS.DEPOSIT, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent("mt:deposit-settings-changed"));
}

export function currentUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LS.CURRENT);
}

export function setCurrentUserId(id: string | null) {
  if (id) localStorage.setItem(LS.CURRENT, id);
  else localStorage.removeItem(LS.CURRENT);
  window.dispatchEvent(new CustomEvent("mt:current-user-changed"));
}

export function currentUser(): MtUser | null {
  const id = currentUserId();
  if (!id) return null;
  return loadUsers().find((u) => u.id === id) ?? null;
}

// -- Generators ---------------------------------------------------------------

export function genAccountNumber(): string {
  // 12-digit realistic-looking account number
  let out = "";
  for (let i = 0; i < 12; i++) out += Math.floor(Math.random() * 10);
  return out;
}

export function maskAccount(full: string): string {
  return "•••• " + full.slice(-4);
}

export function genOTP(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function genRef(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

export function fmtCurrency(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// Cross-tab / cross-view live update hook helper.
export function onStoreChange(cb: () => void): () => void {
  const evts = ["mt:users-changed", "mt:queue-changed", "mt:deposit-settings-changed", "mt:current-user-changed", "storage"];
  evts.forEach((e) => window.addEventListener(e, cb));
  return () => evts.forEach((e) => window.removeEventListener(e, cb));
}

// Read file as data URL (for profile pic + BTC QR upload).
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
