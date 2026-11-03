# Revisi 3 November 2026

Latar flipbook normal sejajar dengan tema dan tombol fullscreen. Mode fullscreen tetap sebesar layar.

Pratinjau: https://ehop-renungan-g1juuewo8-propagandavirtual8-5450.vercel.app

Thumbnail tautan menggunakan Open Graph yang dibuat di server melalui api/page.js. Beranda memakai edisi terbit terbaru; URL per bulan memakai judul, tema, dan sampul edisi tersebut. Data dibaca dari Supabase memakai publishable key yang sudah ada dalam config.js. Tidak memerlukan service-role key.

Pemasangan: salin seluruh isi ZIP revisi ke akar repository, termasuk folder api, vercel.json dan package.json. Pertahankan config.js yang sudah ada. Vercel harus membangun fungsi Node; hosting statis saja tidak menjalankan metadata dinamis ini. Setelah deployment produksi berhasil, bagikan URL edisi seperti https://renungan.ehopindonesia.com/november-2026 . URL pratinjau yang dilindungi login Vercel bukan alamat untuk menguji kartu WhatsApp publik.

Tunggu pratinjau muncul saat menempelkan URL ke WhatsApp sebelum menekan Kirim. Hasil tampilan kartu ditentukan WhatsApp; cache atau pengaturan privasi pratinjau tautan dapat memengaruhi kemunculannya. Pesan lama tidak dijamin berubah. Uji dengan pesan baru setelah deployment produksi. Pengiriman ke WhatsApp belum diuji langsung dalam sesi ini.

Metadata diuji dengan permintaan HTML tanpa JavaScript, termasuk edisi terbit, beranda, escaping teks dan edisi tidak ditemukan (404). Tampilan dan fullscreen diuji dalam browser desktop/HP.

Referensi: https://ogp.me/

