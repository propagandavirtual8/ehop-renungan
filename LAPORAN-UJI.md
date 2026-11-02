# Pemulihan dan perbaikan Renungan El-Bethel

Tanggal: 2 November 2026 (WIB).

## Status yang diverifikasi

- Sumber terbaru: `propagandavirtual8/ehop-renungan`, baseline commit `640dd96`.
- ZIP asli `ehop-renungan-flipbook-starter.zip` ditemukan di Downloads. Perbaikan TUS dari percakapan lama sudah terpasang di GitHub: `index.html` memakai bundle browser `tus-js-client@4.3.1`, bukan impor ESM yang dapat memilih implementasi Node.
- Proyek Vercel: `ehop-renungan`, produksi awal `dpl_4nbyxYertvzutiPsK9ED91FTfAJN`, status READY.
- Alamat aktif: https://ehop-renungan.vercel.app . Domain `renungan.ehopindonesia.com` belum terdaftar pada proyek Vercel dan belum memiliki resolusi DNS dari pemeriksaan sesi ini.
- Edisi November 2026 sudah terbit. PDF publik 8.119.517 byte, 34 halaman; PDF dan sampul menjawab HTTP 200.
- Browser membaca katalog, membuka PDF November, berpindah ke halaman 2, dan membuka formulir login admin; tidak ada error JavaScript tak tertangani. Pemeriksaan produksi hanya melakukan pembacaan.
- Konfigurasi menggunakan publishable key. Nilai key, password, dan token admin tidak dimasukkan dalam laporan maupun paket patch.

## Perbaikan lanjutan

1. Fingerprint TUS kini membedakan proyek, bucket, pengguna, path objek, serta identitas berkas. Unggahan yang tertinggal tidak dilanjutkan ke objek edisi lain.
2. Berkas yang sudah dirujuk oleh edisi tersimpan tidak dihapus ketika pemuatan ulang daftar gagal.
3. Formulir, tombol edit/hapus, dan logout dikunci selama penyimpanan. Nilai formulir disalin sebelum proses asinkron agar tetap konsisten.
4. Validasi bulan ganda, judul, path Storage, dan dua sumber PDF dilakukan sebelum mengunggah.
5. PDF diverifikasi sebelum sampul diunggah. Mengganti PDF dengan file/path lain memperbarui sampul otomatis.
6. Pekerjaan PDF dibersihkan ketika pemeriksaan gagal. Kegagalan pembersihan berkas baru diberitahukan kepada admin.
7. Pembaruan metadata meminta ID hasil simpan; respons tanpa baris tidak dinyatakan berhasil.

## Pengujian browser

Jalankan `pnpm install --frozen-lockfile`, lalu `pnpm test`. Pengujian memakai Chrome, library Supabase browser, PDF.js, PageFlip, dan TUS browser sebenarnya. Supabase diganti layanan tiruan; tidak ada login atau penulisan produksi.

Sebelas skenario:

1. Login, memakai path Storage, sampul pilihan, publikasi, katalog.
2. Pembaca PDF dan lompat halaman pada layar ponsel.
3. PDF lebih dari 7 MB melalui TUS; byte hasil unggahan sama persis.
4. PDF kecil melalui unggahan biasa; draft tidak tampil di katalog publik.
5. Unggahan TUS terputus: pengulangan dengan path baru tidak memakai objek lama.
6. Metadata gagal: hapus hanya PDF/sampul baru yang sudah berhasil diunggah.
7. Sampul gagal: bersihkan PDF baru.
8. Daftar gagal dimuat setelah commit: pertahankan semua berkas yang tersimpan.
9. Bulan ganda dan dua sumber PDF ditolak sebelum unggah.
10. Edit PDF mengganti sampul, mempertahankan berkas lama, dan mengunci kontrol.
11. URL penuh dan PDF rusak ditolak sebelum unggah.

Untuk pemeriksaan produksi baca-saja: `pnpm test:live`. `LIVE_URL` dapat diisi untuk target pratinjau. Skrip tidak login, mengunggah, atau mengubah data.

## Batas verifikasi dan langkah publikasi

- Upload dengan akun admin sebenarnya ke Supabase produksi belum dijalankan. Hak RLS, MIME bucket, batas ukuran, dan sesi admin produksi belum dibuktikan melalui unggahan nyata. Kode SQL lama tidak diubah atau dijalankan ulang.
- Unggahan TUS yang terputus dapat meninggalkan sesi sementara; perbaikan tidak menghapus PDF November maupun berkas lama.
- Versi perbaikan disiapkan pada branch terpisah. Produksi belum diganti sampai versi pratinjau ditinjau.
- Domain perlu ditambahkan pada proyek Vercel dan DNS `renungan` diarahkan ke target yang diberikan Vercel. Jangan menebak target DNS atau mengubah record domain lain.

Rujukan: [Supabase resumable uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads), [instalasi bundle browser TUS](https://github.com/tus/tus-js-client/blob/main/docs/installation.md).

## Hasil akhir sesi

Sebelas uji browser lulus. Commit lokal: d567976 pada branch fix/admin-pdf-upload. Push GitHub tertahan oleh autentikasi Git Credential Manager pada komputer ini.

Pratinjau Vercel READY: https://ehop-renungan-fymr07qsr-propagandavirtual8-5450.vercel.app . Deployment: dpl_6u723V1JReNY2QdPGamttZPxUPqB. Ini deployment preview, bukan pengganti produksi. Upload admin nyata belum dilakukan.

