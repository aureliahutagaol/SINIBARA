// =====================================================================
// DATA CONTOH SIPETA
// Semua data di file ini PALSU, hanya untuk mencoba tampilan web.
// Nanti data ini diganti dengan data asli dari database (Supabase).
// =====================================================================

// Daftar kecamatan di Kabupaten Batu Bara, dengan contoh desa/kelurahan
// lat/lng = perkiraan titik tengah desa (untuk data contoh)
const WILAYAH = [
  { kecamatan: "Lima Puluh", desa: [
    { nama: "Lima Puluh Kota", jenis: "Kelurahan", lat: 3.1690, lng: 99.4150 },
    { nama: "Perupuk", jenis: "Desa", lat: 3.2140, lng: 99.4380 } ] },
  { kecamatan: "Air Putih", desa: [
    { nama: "Indrapura", jenis: "Kelurahan", lat: 3.2090, lng: 99.3420 },
    { nama: "Pematang Panjang", jenis: "Desa", lat: 3.1800, lng: 99.3150 } ] },
  { kecamatan: "Sei Suka", desa: [
    { nama: "Kuala Tanjung", jenis: "Desa", lat: 3.3550, lng: 99.4520 },
    { nama: "Sei Suka Deras", jenis: "Desa", lat: 3.2950, lng: 99.3900 } ] },
  { kecamatan: "Medang Deras", desa: [
    { nama: "Pagurawan", jenis: "Desa", lat: 3.3010, lng: 99.4810 },
    { nama: "Medang", jenis: "Desa", lat: 3.2720, lng: 99.4610 } ] },
  { kecamatan: "Talawi", desa: [
    { nama: "Labuhan Ruku", jenis: "Kelurahan", lat: 3.1990, lng: 99.5280 },
    { nama: "Mesjid Lama", jenis: "Desa", lat: 3.2130, lng: 99.5050 } ] },
  { kecamatan: "Tanjung Tiram", desa: [
    { nama: "Tanjung Tiram", jenis: "Kelurahan", lat: 3.2190, lng: 99.5640 },
    { nama: "Bagan Arya", jenis: "Desa", lat: 3.2050, lng: 99.5900 } ] },
  { kecamatan: "Sei Balai", desa: [
    { nama: "Sei Balai", jenis: "Desa", lat: 3.1150, lng: 99.5600 } ] },
  { kecamatan: "Nibung Hangus", desa: [
    { nama: "Simpang Dolok", jenis: "Desa", lat: 3.1320, lng: 99.5080 } ] },
  { kecamatan: "Datuk Lima Puluh", desa: [
    { nama: "Pematang Tengah", jenis: "Desa", lat: 3.1400, lng: 99.4300 } ] },
  { kecamatan: "Lima Puluh Pesisir", desa: [
    { nama: "Gambus Laut", jenis: "Desa", lat: 3.2400, lng: 99.4700 } ] },
  { kecamatan: "Datuk Tanah Datar", desa: [
    { nama: "Petatal", jenis: "Desa", lat: 3.1100, lng: 99.3700 } ] },
  { kecamatan: "Laut Tador", desa: [
    { nama: "Laut Tador", jenis: "Desa", lat: 3.1050, lng: 99.3200 } ] },
];

// ---------------------------------------------------------------------
// Membuat bidang tanah contoh secara otomatis (supaya peta ada isinya)
// ---------------------------------------------------------------------
const JENIS_HAK = ["Hak Milik", "Hak Milik", "Hak Milik", "Hak Guna Bangunan", "Hak Pakai", "Hak Guna Usaha"];
const PENGGUNAAN = ["Permukiman", "Sawah", "Kebun Sawit", "Kebun Karet", "Tambak", "Perdagangan"];

// Angka acak yang selalu sama setiap kali dibuka (supaya data contoh tetap)
let seed = 12;
function acak() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
function pilih(arr) { return arr[Math.floor(acak() * arr.length)]; }
function angka(panjang) { let s = ""; for (let i = 0; i < panjang; i++) s += Math.floor(acak() * 10); return s; }

const BIDANG = [];
WILAYAH.forEach((kec, iKec) => {
  kec.desa.forEach((desa, iDesa) => {
    for (let i = 0; i < 12; i++) {
      // susun bidang seperti petak 4 x 3 di sekitar titik desa
      const baris = Math.floor(i / 4), kolom = i % 4;
      const ukuran = 0.0016;
      const lat0 = desa.lat + (baris - 1.5) * ukuran * 1.1;
      const lng0 = desa.lng + (kolom - 2) * ukuran * 1.1;
      const geser = () => (acak() - 0.5) * ukuran * 0.15;
      const koordinat = [
        [lat0 + geser(), lng0 + geser()],
        [lat0 + geser(), lng0 + ukuran + geser()],
        [lat0 + ukuran + geser(), lng0 + ukuran + geser()],
        [lat0 + ukuran + geser(), lng0 + geser()],
      ];
      const kodeKec = String(iKec + 1).padStart(2, "0");
      const kodeDesa = String(iDesa + 1).padStart(2, "0");
      const urut = String(BIDANG.length + 1).padStart(5, "0");
      BIDANG.push({
        nib: "02" + kodeKec + kodeDesa + "01" + urut + angka(1),
        // sekitar 15% bidang contoh belum terhubung ke NOP (nop = null)
        nop: acak() < 0.15 ? null : `12.19.${String(iKec + 1).padStart(3, "0")}.${String(iDesa + 1).padStart(3, "0")}.${angka(3)}-${angka(4)}.0`,
        kecamatan: kec.kecamatan,
        desa: desa.nama,
        hak: pilih(JENIS_HAK),
        penggunaan: pilih(PENGGUNAAN),
        luas: Math.round(150 + acak() * 2400),          // meter persegi
        njop: Math.round((80 + acak() * 420)) * 1000,    // rupiah per m2
        pajak: acak() < 0.72 ? "Lunas" : "Belum Lunas",   // (diabaikan kalau tidak punya NOP)
        tahunPajak: 2026,
        koordinat,
      });
    }
  });
});

// Bidang tanpa NOP tidak punya status pajak
BIDANG.forEach((b) => { if (!b.nop) { b.pajak = "Tanpa NOP"; b.njop = null; } });

// Contoh kasus "satu NOP dipakai di dua bidang" (untuk daftar perlu ditindaklanjuti)
(() => {
  const ada = BIDANG.filter((b) => b.nop);
  ada[5].nop = ada[4].nop;
})();