# RENUNGAN HARIAN EL-BETHEL — Website Flipbook

Website flipbook tanpa iklan untuk publikasi bulanan Renungan Harian El-Bethel. Dibuat sebagai situs statis (HTML/CSS/JavaScript), dengan Supabase Database + Auth + Storage dan hosting Vercel.

**Alamat yang dituju:** `https://renungan.ehopindonesia.com`

## Yang sudah tersedia di kode

- Beranda publik dengan edisi terbaru dan arsip bulanan.
- Flipbook dengan animasi membalik halaman, mode 1/2 halaman responsif, tombol navigasi, lompat halaman, pembesar halaman, berbagi tautan, dan akses PDF asli.
- URL per edisi seperti `/november-2026` (termasuk `?halaman=7`).
- Admin di `/admin`: login, buat edisi, edit, terbitkan/draft, hapus entri katalog.
- Upload PDF dari komputer, atau daftar PDF yang sudah berada di Supabase Storage tanpa mengunggah ulang.
- Auto-generate thumbnail sampul dari halaman pertama PDF (jika upload lewat admin; untuk PDF lama akan dicoba juga).
- RLS database dan Storage policy supaya hanya admin terdaftar dapat menulis.
- Tanpa iklan dan tanpa layanan pihak ketiga untuk **konversi PDF ke flipbook**. Beberapa library JS/font dimuat dari CDN publik.

## URUTAN LANGKAH (ikuti dari atas ke bawah)

### A. Periksa bucket Supabase

1. Login `https://supabase.com/dashboard`, buka project **ehop-renungan**.
2. Buka **Storage → renungan-publik**. Bucket harus **Public**. Pastikan file November 2026 yang sudah diunggah masih ada, dan catat **path di dalam bucket** (misal `2026/11/renungan-el-bethel-november-2026.pdf`). Ini BUKAN Public URL panjang.
3. Klik **Edit bucket** / pengaturan bucket. Pada **Allowed MIME Types**, izinkan:
   - `application/pdf`
   - `image/jpeg`
   - `image/png`
   - `image/webp`
   Ini dibutuhkan untuk menyimpan sampul otomatis. Jika dulu bucket disetel PDF saja, ubah agar gambar juga diizinkan.
4. Periksa limit ukuran upload. PDF contoh berukuran ~8,1 MB; atur minimal 10 MB (misalnya 25 MB), selama batas global dan paket mengizinkan.

### B. Jalankan SQL dan keamanan

1. Di Supabase buka **SQL Editor → New query**.
2. Buka file [`supabase/setup.sql`](supabase/setup.sql) yang disertakan.
3. Salin seluruh SQL, tempel, lalu klik **Run**.
4. Periksa **Database → Tables**: seharusnya ada `renungan_admins` dan `renungan_editions`.
5. Periksa **Storage → Policies** dan hapus atau perketat kebijakan lama yang terlalu longgar. Semua policy yang memberi izin upload/update/delete untuk `anon` atau seluruh `authenticated` dapat membuat kebijakan admin yang baru tidak efektif karena policy Postgres biasanya digabung dengan OR.
6. Jangan pernah menaruh **secret key / service_role key** di `config.js` atau repositori publik.

### C. Buat akun editor/admin

1. Buka **Authentication → Users**.
2. Tambahkan pengguna menggunakan fitur dashboard (**Add user**, buat pengguna dengan email+password jika opsi itu tersedia; atau kirim undangan dan selesaikan penetapan password lewat tautan undangan). Pastikan email terkonfirmasi dan admin bisa login dengan email + password.
3. Salin **User UID** UUID dari pengguna tersebut.
4. Buka SQL Editor dan jalankan:

```sql
insert into public.renungan_admins (user_id)
values ('ISI-DENGAN-UUID-ADMIN-DARI-AUTH-USERS')
on conflict (user_id) do nothing;
```

**Catatan:** Ini perintah sekali untuk menunjuk admin pertama; jangan jadikan proses pemberian admin sebagai fitur signup publik.

### D. Hubungkan situs dengan proyek Supabase

1. Dalam dashboard Supabase, buka **Project Settings → API Keys** (atau **Connect** pada dashboard baru).
2. Salin **Project URL**, misalnya `https://abcdef.supabase.co`.
3. Salin **publishable key** (format modern `sb_publishable_...`) atau **anon/public key** legacy. Keduanya ditujukan untuk klien publik dan tetap wajib menggunakan RLS.
4. Buka file `config.js`, ganti kedua nilai placeholder.
5. Simpan. **JANGAN** masukkan `sb_secret_...` / `service_role` / password database.

### E. Publikasikan kode dengan GitHub dan Vercel

**Cara praktis dengan GitHub Desktop:**

1. Ekstrak ZIP kode ke folder komputer, misalnya `ehop-renungan-site`.
2. Edit `config.js` seperti tahap D.
3. Buka **GitHub Desktop** → **File → Add local repository**. Jika folder belum repo Git, pilih **Create a Repository** untuk folder yang diekstrak.
4. Commit semua berkas dan klik **Publish repository**. Pilih privat jika ingin membatasi akses kode; publishable key tetap bukan rahasia.
5. Buka `https://vercel.com/dashboard` → **Add New → Project**.
6. **Import Git Repository**, pilih repo tadi.
7. Framework Preset: **Other**; situs ini tanpa langkah build. Output adalah folder root; biarkan opsi build kosong jika Vercel mengizinkan dan ikuti deteksi proyek statis dari Vercel.
8. Klik **Deploy**.
9. Setelah berstatus Ready, buka URL `*.vercel.app` yang diberikan. Jika `config.js` benar dan SQL sudah dijalankan, halaman publik harus terbuka.
10. Login ke `https://NAMA-PROYEK.vercel.app/admin` menggunakan akun admin Supabase.

**Alternatif GitHub web:** buat repositori kosong di GitHub lalu gunakan **Add file → Upload files** untuk isi folder hasil ekstrak. Pastikan struktur `supabase/` dan `assets/` tidak hilang.

### F. Daftarkan PDF November 2026 yang sudah ada di Storage

1. Buka `https://NAMA-PROYEK.vercel.app/admin` dan login.
2. Isi **Bulan: November**, **Tahun: 2026**.
3. Judul: `Renungan Harian El-Bethel`.
4. Tema: `Setia di Setiap Masa`.
5. **Kosongkan** kolom "Upload PDF baru".
6. Pada "Gunakan path PDF yang sudah ada di Storage", masukkan **path sebenarnya** persis seperti pada tahap A. Jangan masukkan Public URL lengkap.
7. Pilih gambar sampul yang tersedia dalam ZIP di `assets/sampul-november-2026.jpg` (atau biarkan kosong agar dicoba otomatis).
8. Centang **Publikasikan edisi**, lalu klik **Simpan edisi**.
9. Kembali ke beranda, klik edisi terbaru. Periksa flipbook dari komputer dan HP.
10. URL bulan pertama nantinya berakhir dengan `/november-2026`.

**Penting:** Path file PDF yang sudah kamu unggah sebelumnya mungkin berbeda dari contoh; lihat di Supabase Storage. Tidak ada nilai URL atau key Supabase yang diisi otomatis dalam paket ini.

### G. Hubungkan domain `renungan.ehopindonesia.com`

1. Buka project **Vercel → Settings → Domains**.
2. Add domain `renungan.ehopindonesia.com`.
3. Vercel akan memberikan target DNS yang spesifik untuk project ini.
4. Pada pengelola DNS `ehopindonesia.com`, tambah record **CNAME** dengan Host/Name `renungan` dan Target **persis sesuai instruksi Vercel**. Jangan asal menggunakan contoh target dari tutorial lain.
5. Hindari konflik record A/CNAME lain untuk hostname `renungan`.
6. Tunggu sampai status domain **Valid Configuration / Ready** dan HTTPS aktif.
7. Supabase **Authentication → URL Configuration**: Set `Site URL` menjadi `https://renungan.ehopindonesia.com` dan tambahkan URL redirect jika akan memakai login link/invitation/password-reset, misalnya `https://renungan.ehopindonesia.com/**`.
8. Tes `https://renungan.ehopindonesia.com`, `https://renungan.ehopindonesia.com/november-2026`, dan `https://renungan.ehopindonesia.com/admin`.

## Rutinitas setiap bulan

Login di `/admin` → isi bulan/tahun/judul/tema → pilih PDF → secara otomatis dibuat cover dari halaman 1 → centang Publikasikan → Simpan. Link baru `/desember-2026`, dan edisi November tetap ada di arsip.

Untuk revisi: tekan **Edit** pada bulan yang sama, pilih PDF baru, simpan. Path PDF baru dibuat unik untuk mencegah cache usang; URL `/<bulan>-<tahun>` tetap sama.

## Keamanan & catatan teknis

- **Public bucket** berarti siapa pun yang memiliki URL PDF dapat membacanya bahkan jika entri database masih Draft. Simpan dokumen rahasia dalam bucket privat lain; jangan unggah draft rahasia di bucket ini.
- Admin diproteksi **Supabase Auth + RLS**. Menyembunyikan halaman `/admin` saja bukan mekanisme keamanan.
- Jika pernah membuat policy `ALLOW ALL` untuk Storage, hapus atau batasi policy itu; policy baru tidak otomatis membatalkan policy lama.
- File November 2026 sebesar ~8,1 MB melebihi ambang 6 MB yang **direkomendasikan** Supabase untuk upload standar. Paket ini memakai **TUS resumable upload** untuk berkas di atas 6 MB dan API upload standar untuk berkas kecil, mengikuti [panduan Supabase](https://supabase.com/docs/guides/storage/uploads/resumable-uploads). PDF yang sudah diunggah di Storage tidak perlu upload ulang.
- Pembacaan flipbook menggunakan PDF.js, halaman yang berada di sekitar posisi baca dirender lebih dahulu (lazy render) untuk mengurangi beban memori; tiap halaman diperbesar lewat tombol **Perbesar**.
- Website statis/SPA belum menghasilkan **Open Graph thumbnail berbeda untuk setiap bulan**. Preview WhatsApp saat membagikan `/november-2026` bisa menampilkan metadata generik. Ini dapat ditambahkan kemudian melalui SSR atau endpoint OG khusus di Vercel.
- Menghapus edisi dari admin hanya menghapus **record katalog**, bukan PDF di Storage, agar tidak kehilangan berkas asli. Bersihkan file yang tak terpakai secara manual jika diperlukan.
- Library JavaScript dan Google Fonts memerlukan koneksi CDN. Tidak ada skrip iklan. Jika ingin benar-benar independen dari CDN, library dapat di-*vendoring* ke host sendiri pada versi berikutnya.
- Tidak tersedia halaman self-signup: pembuatan user dan pemberian hak admin dikelola di Supabase Dashboard.
- Situs ini perlu pengujian final di deployment milik pengguna; kode sudah diperiksa sintaks statis, tetapi koneksi ke Supabase pribadi dan deployment domain belum dapat diverifikasi dari paket lokal.
