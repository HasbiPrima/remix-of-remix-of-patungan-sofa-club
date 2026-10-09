# Remix of Remix of Patungan Sofa Club

Buat website Sofamates versi frontend-only (React, TypeScript, Tailwind, dan shadcn/ui) tanpa database atau backend, untuk patungan sofa dan tiket event collective di club wilayah DIY, dalam Bahasa Indonesia dan mobile-first, dengan empat peran demo (User, Host Collective, Host Venue, dan Admin) yang hak aksesnya dicek di setiap aksi; alur grup sofa berjalan lewat status DP BOOKING, PELUNASAN, LUNAS, SELESAI, dan BATAL dengan batas otomatis H-14, H-7, dan H-3 pukul 23.59 WIB, rumus DP dan pelunasan per slot dibulatkan ke atas ke Rp1.000, ketua boleh membayar seluruh DP setelah menyetujui S&K, pembayaran dan waktu disimulasikan lewat modal payment dan panel dev yang bisa memajukan tanggal dan menjalankan penjadwal, serta mencakup verifikasi akun simulasi, tiket 1, 2, dan 5 orang, vote minuman, rating H+1 sampai H+3, kode referral tanpa komisi, notifikasi dalam website, panel admin dengan log aktivitas, dan data dummy untuk semua peran.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/897adde3-d190-41d0-8e40-f64a5b6273b7).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
