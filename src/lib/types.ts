// Demo model, mengikuti ERD Sofamates v1.
export type Role = "user" | "host_collective" | "host_venue" | "admin";
export type GroupStatus = "DP_BOOKING" | "PELUNASAN" | "LUNAS" | "SELESAI" | "BATAL";
export type VerifyStatus = "belum" | "menunggu" | "terverifikasi" | "ditolak";
export type EventStatus = "draft" | "terbit" | "batal" | "selesai";
export type Pax = 1 | 2 | 5;
/** anggota_grup.status_bayar */
export type PayStatus = "menunggu" | "belum_bayar" | "dp" | "lunas" | "hangus" | "refund";
export type TxKind = "dp" | "dp_penuh_ketua" | "pelunasan" | "talangan" | "tiket" | "refund";
export type TxStatus = "pending" | "berhasil" | "gagal" | "kedaluwarsa";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  phone: string;
  whatsapp?: string; // format 62xxxx (AKN-07)
  collectiveId?: string; // wajib untuk host_collective
  venueId?: string; // wajib untuk host_venue
  // verifikasi (AKN-02)
  verify: VerifyStatus;
  ktpName?: string;
  birthPlace?: string;
  birthDate?: string; // YYYY-MM-DD
  nikHash?: string; // demo: hash NIK, dipakai cek NIK ganda (AKN-05)
  nikLast4?: string;
  ktpImage?: string; // dataURL foto KTP (demo)
  selfieImage?: string; // dataURL foto muka (demo)
  verifyReason?: string;
  verifiedBy?: string;
  verifiedAt?: number;
}

export interface Collective {
  id: string;
  name: string;
  contact: string;
  bank: string;
  accountNo: string;
  accountName: string;
}

export interface Venue {
  id: string;
  name: string;
  area: string;
  address: string;
}

export interface Sofa {
  id: string;
  eventId: string;
  name: string; // kode_sofa
  capacity: number;
  price: number; // harga_sofa, termasuk paket minuman
  dp: number; // dp_sofa, minimal Rp500.000
  drinkPackage: string;
  drinks: string[]; // opsi_minuman untuk vote (VOT-01)
}

export interface TicketType {
  pax: Pax;
  price: number; // harga paket total
  quota: number;
}

export interface EventItem {
  id: string;
  title: string;
  collectiveId: string;
  venueId: string;
  date: string; // YYYY-MM-DD (WIB)
  time: string; // HH:mm WIB
  description: string;
  poster?: string;
  scheme?: "beli_putus" | "bagi_hasil";
  status: EventStatus;
  tickets: TicketType[];
}

export interface Member {
  userId: string;
  slotNumber?: number;
  /** Additional slots booked by the same member (multi-select). */
  extraSlots?: number[];
  pay: PayStatus;
  /** Batas tahan slot 30 menit selama pembayaran (U2). */
  holdUntil?: number;
  referralId?: string;
  joinedAt: number;
  leftAt?: number;
}

export interface Rating {
  from: string;
  to: string;
  stars: number;
  note: string;
  at: number;
}

export interface Group {
  id: string;
  kind: "sofa" | "tiket";
  eventId: string;
  sofaId?: string;
  ticketPax?: Pax;
  proposalId?: string;
  createdBy: string;
  leaderId?: string;
  status: GroupStatus;
  slots: number;
  dpPerSlot: number;
  lunasPerSlot: number;
  members: Member[];
  leaderPaidAllDp: boolean;
  termsAcceptedAt?: number;
  /** Slot kosong yang pelunasannya sudah ditalangi (grup DP ketua). */
  emptyLunasPaid: number;
  waLink?: string;
  votes: Record<string, string>;
  /** Pilihan ketua kalau hasil vote seri (U12). */
  drinkPick?: string;
  ratings: Rating[];
  createdAt: number;
  cancelReason?: string;
}

export interface Proposal {
  id: string;
  userId: string;
  eventId: string;
  sofaId?: string;
  ticketPax?: Pax;
  friends: number;
  referralId?: string;
  note: string;
  status: "menunggu" | "disetujui" | "ditolak";
  reason?: string;
  decidedBy?: string;
  decidedAt?: number;
  groupId?: string;
  createdAt: number;
}

export interface ReferralCode {
  id: string;
  collectiveId: string;
  code: string;
  owner: string;
  contact: string;
  active: boolean;
}

export interface Tx {
  id: string;
  userId: string; // pembayar, atau penerima untuk refund
  groupId?: string;
  memberUserId?: string; // slot yang dibayar
  eventId: string;
  ticketPax?: Pax;
  kind: TxKind;
  amount: number;
  /** Jumlah slot yang dibayar (dp/pelunasan/talangan slot kosong). */
  slots?: number[];
  status: TxStatus;
  gatewayRef: string;
  refundOf?: string;
  createdAt: number;
  paidAt?: number;
}

export interface ETicket {
  id: string;
  eventId: string;
  userId: string;
  pax: Pax;
  groupId?: string;
  txId: string;
  code: string;
  status: "aktif" | "dipakai" | "batal";
  at: number;
}

export interface Payout {
  id: string;
  eventId: string;
  collectiveId: string;
  amount: number;
  proof: string;
  by: string;
  at: number;
}

export interface Notif {
  id: string;
  userId: string;
  text: string;
  at: number;
  read: boolean;
  /** Terkirim juga via WhatsApp (simulasi, NTF-01). */
  wa: boolean;
  link?: string | undefined;
}

export interface LogItem {
  id: string;
  at: number;
  actorId: string;
  action: string;
  detail: string;
}

export interface AppState {
  version: 2;
  now: number;
  seq: number;
  currentUserId: string;
  autoScheduler: boolean;
  users: User[];
  collectives: Collective[];
  venues: Venue[];
  events: EventItem[];
  sofas: Sofa[];
  groups: Group[];
  proposals: Proposal[];
  referrals: ReferralCode[];
  txs: Tx[];
  etickets: ETicket[];
  payouts: Payout[];
  notifs: Notif[];
  logs: LogItem[];
  /** Kunci pengingat/penjadwal yang sudah dikirim, supaya tidak dobel. */
  sent: string[];
}
