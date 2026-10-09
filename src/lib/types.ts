export type Role = "user" | "host_collective" | "host_venue" | "admin";
export type GroupStatus = "DP_BOOKING" | "PELUNASAN" | "LUNAS" | "SELESAI" | "BATAL";
export type VerifyStatus = "belum" | "menunggu" | "terverifikasi" | "ditolak";

export interface User {
  id: string;
  name: string;
  role: Role;
  phone: string;
  whatsapp?: string;
  ktpName?: string;
  ktpAddress?: string;
  gender?: "pria" | "wanita";
  verify: VerifyStatus;
  ktpImage?: string; // dataURL foto KTP (demo)
  selfieImage?: string; // dataURL foto muka (demo)
  referralCode: string;
  referredBy?: string; // user id
}

export interface Venue {
  id: string;
  name: string;
  area: string;
  hostId: string;
}

export interface Sofa {
  id: string;
  venueId: string;
  name: string;
  capacity: number;
  price: number;
  active: boolean;
}

export interface EventItem {
  id: string;
  title: string;
  collective: string;
  hostId: string;
  venueId: string;
  date: string; // YYYY-MM-DD (WIB)
  lineup: string;
  dpPercent: number;
  tickets: { p1: number; p2: number; p5: number };
  drinks: string[];
  cancelled: boolean;
}

export interface Member {
  userId: string;
  slotNumber?: number;
  /** Additional slots booked by the same member (multi-select). */
  extraSlots?: number[];
  dpPaid: boolean;
  dpCoveredByLeader: boolean;
  lunasPaid: boolean;
  joinedAt: number;
}

export interface Group {
  id: string;
  eventId: string;
  sofaId: string;
  leaderId: string;
  status: GroupStatus;
  slots: number;
  dpPerSlot: number;
  lunasPerSlot: number;
  members: Member[];
  leaderPaidAllDp: boolean;
  termsAcceptedAt?: number;
  emptyLunasPaid: number;
  votes: Record<string, string>;
  ratings: Record<string, { stars: number; comment: string; at: number }>;
  createdAt: number;
  cancelReason?: string;
}

export interface TicketOrder {
  id: string;
  eventId: string;
  userId: string;
  pax: 1 | 2 | 5;
  price: number;
  at: number;
  code: string;
}

export interface Notif {
  id: string;
  userId: string;
  text: string;
  at: number;
  read: boolean;
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
  now: number;
  seq: number;
  currentUserId: string;
  autoScheduler: boolean;
  users: User[];
  venues: Venue[];
  sofas: Sofa[];
  events: EventItem[];
  groups: Group[];
  tickets: TicketOrder[];
  notifs: Notif[];
  logs: LogItem[];
}
