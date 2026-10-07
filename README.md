# Dashboard Yudisium FMIPA UNTAN

Dashboard publik data peserta yudisium (Next.js 14, App Router) + panel admin untuk ganti link spreadsheet dan label periode.
Tiap periode baru: login `/admin`, tempel link spreadsheet baru, isi periode dan tahun ajar, Simpan. Selesai.

## Fitur
- Kartu ringkasan, grafik per prodi, tabel dengan cari, filter prodi/predikat, dan urut kolom
- **Export Excel** (.xlsx) sesuai hasil filter yang sedang tampil
- Data diambil dari Google Sheets (server-side), duplikat NIM otomatis diambil yang terbaru
- Admin: `/admin` (login dari Environment Variables, session cookie, logout)
- Klik nama peserta untuk menampilkan **foto** (kolom "Foto Latar Biru") di kartu "Peserta per program studi"
- Link spreadsheet **tidak dikirim ke browser pengunjung**

## Menjalankan lokal
```bash
npm install
cp .env.example .env.local   # isi ADMIN_USERNAME, ADMIN_PASSWORD, SESSION_SECRET
npm run dev
```
Buka http://localhost:3000 dan http://localhost:3000/admin.
Lokal tanpa Redis, pengaturan disimpan di `.data/settings.json`.

## Deploy ke Vercel
1. Push folder ini ke GitHub, lalu **Add New Project** di Vercel dan pilih repo-nya.
2. Sebelum Deploy, buka **Environment Variables** dan isi:

| Nama | Isi |
|---|---|
| `ADMIN_USERNAME` | username admin |
| `ADMIN_PASSWORD` | password admin (yang kuat) |
| `SESSION_SECRET` | string acak min. 32 karakter. Buat dengan `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `SESSION_MINUTES` | (opsional) lama sesi, default 30 |
| `DEFAULT_SHEET_URL`, `DEFAULT_PERIODE`, `DEFAULT_TAHUN_AJAR` | (opsional) nilai awal sebelum admin menyimpan apa pun |

3. **Aktifkan penyimpanan** (wajib supaya tombol Simpan di admin berfungsi, karena Vercel tidak punya disk permanen):
   Project di Vercel, tab **Storage**, **Create Database**, pilih **Upstash (Redis)**, ikuti langkah, lalu **Connect to Project**.
   Variabel `UPSTASH_REDIS_REST_URL` dan `UPSTASH_REDIS_REST_TOKEN` (atau `KV_REST_API_URL` dan `KV_REST_API_TOKEN`) otomatis terisi. Setelah itu **Redeploy**.
4. Buka `https://domain-kamu.vercel.app/admin`, login, isi link spreadsheet, periode, tahun ajar, lalu Simpan.

## Syarat spreadsheet
- Share: **Anyone with the link, Viewer**
- Link harus memuat sheet jawaban form (ada `gid=...`)
- Baris pertama adalah header. Kolom dikenali dari namanya, jadi urutan bebas: `Nama`, `NIM`, `Program Studi`, `Judul Tugas Akhir`, `IPK`, `Skor TOEFL/TUTEP`, `Predikat Kelulusan`
- Kolom lain (data orang tua, link upload, dll) diabaikan dan tidak pernah ditampilkan

## Foto peserta
Foto diambil dari kolom yang headernya diawali kata `Foto` (link Google Drive hasil upload Google Form).
Supaya bisa tampil, folder tempat Google Form menyimpan file upload harus dibagikan **Anyone with the link: Viewer**
(Drive > folder jawaban form > Share). Kalau tidak, muncul pesan "Foto tidak bisa ditampilkan".
Foto ini ikut tampil ke semua pengunjung dashboard, jadi pertimbangkan dulu sebelum membuka akses folder.

## Perilaku login
- Username dan password hanya dari Environment Variables, tidak ada di kode
- Cookie `httpOnly`, `SameSite=Strict`, `Secure` di production, tanpa tanggal kedaluwarsa (hilang saat browser ditutup) dan kedaluwarsa di server sesuai `SESSION_MINUTES`
- **Refresh**, **Back/Forward**, atau pindah dari halaman admin = otomatis logout, jadi harus login lagi
- Halaman admin dan API dikirim dengan `Cache-Control: no-store`
- 5 kali salah password dalam 15 menit akan diblokir sementara (per instance server)

## Catatan
- Dashboard ini publik: siapa pun yang punya URL bisa melihat nama, NIM, IPK. Kalau perlu dibatasi, bilang saja supaya ditambah proteksi.
- Export Excel memakai paket `xlsx` (SheetJS) hanya untuk menulis file, tidak untuk membaca file dari pengguna.
