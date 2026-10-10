import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { routeTree } from "@/routeTree.gen";
import { makeSeed } from "@/lib/seed";

// jsdom never loads the stylesheets React waits on, so skip the document head in this test.
vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<typeof import("@tanstack/react-router")>()),
  HeadContent: () => null,
  Scripts: () => null,
}));

// Render setiap halaman sebagai peran yang relevan supaya error runtime ketahuan.
const cases: [string, string, RegExp][] = [
  ["u1", "/", /Grup yang masih butuh orang/],
  ["u1", "/event/e1", /Sofa & grup patungan/],
  ["u1", "/grup/g4", /Anggota/],
  ["u2", "/grup/g7", /Bayar penuh per orang/],
  ["u1", "/grup/g5", /Vote minuman/],
  ["u1", "/pengajuan", /Pengajuanku/],
  ["u1", "/parties", /Upcoming/],
  ["u1", "/akun", /Riwayat transaksi/],
  ["u4", "/akun/verifikasi", /NIK/],
  ["hc1", "/host", /Neon Kopi Collective/],
  ["hv1", "/host", /hanya lihat/],
  ["adm1", "/admin", /Ringkasan Sofamates/],
];

describe("halaman per peran", () => {
  for (const [userId, path, text] of cases) {
    it(`${userId} membuka ${path}`, async () => {
      localStorage.setItem("sofamates-state-v3", JSON.stringify(makeSeed()));
      sessionStorage.setItem("sofamates-current-user", userId);
      const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [path] }), context: { queryClient: new QueryClient() } });
      render(<RouterProvider router={router} />);
      expect((await screen.findAllByText(text, {}, { timeout: 5000 })).length).toBeGreaterThan(0);
    });
  }
});
