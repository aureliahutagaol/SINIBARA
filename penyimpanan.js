// =====================================================================
// PENYIMPANAN.JS - semua urusan menyimpan & mengambil data
//
// Ada dua mode:
//   1. MODE SUPABASE : kalau SUPABASE_KEY di config.js sudah diisi.
//                      Data & login tersimpan di server, sama untuk semua petugas.
//   2. MODE DEMO     : kalau SUPABASE_KEY kosong. Data contoh, perubahan
//                      disimpan di browser ini saja (localStorage).
// Bagian lain web (app.js, admin.js) cukup memanggil fungsi-fungsi di sini.
// =====================================================================

const DATA = {
  mode: (typeof SUPABASE_KEY !== "undefined" && SUPABASE_KEY) ? "supabase" : "demo",
  pakaiContoh: true,   // true kalau yang tampil masih data contoh
  akun: [],            // daftar akun (untuk menu Kelola akun)
  riwayat: [],         // riwayat perubahan
};
const sb = DATA.mode === "supabase" ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// ---------- Ubah format: database <-> web ----------
const dariDb = (r) => ({
  nib: r.nib, nop: r.nop, kecamatan: r.kecamatan, desa: r.desa, hak: r.hak, penggunaan: r.penggunaan,
  luas: Number(r.luas), njop: r.njop == null ? null : Number(r.njop), pajak: r.pajak,
  tahunPajak: r.tahun_pajak, koordinat: r.koordinat || [],
});
const keDb = (b) => ({
  nib: b.nib, nop: b.nop || null, kecamatan: b.kecamatan, desa: b.desa, hak: b.hak, penggunaan: b.penggunaan,
  luas: b.luas, njop: b.njop ?? null, pajak: b.pajak, tahun_pajak: b.tahunPajak, koordinat: b.koordinat,
});
function cekGalat(hasil) {
  if (hasil.error) throw new Error(hasil.error.message);
  return hasil.data;
}

// =====================================================================
// MEMUAT DATA BIDANG (dipanggil sekali saat web dibuka)
// =====================================================================
const KUNCI_DEMO = "sinibara-demo-v1";
const AKUN_DEMO = [
  { email: "admin@sinibara.demo", nama: "Admin SINIBARA", peran: "admin", aktif: true },
  { email: "petugas@sinibara.demo", nama: "Petugas Lapangan", peran: "petugas", aktif: true },
];

async function muatData() {
  if (DATA.mode === "demo") {
    DATA.akun = AKUN_DEMO;
    try {
      const simpan = JSON.parse(localStorage.getItem(KUNCI_DEMO) || "null");
      if (simpan) {
        if (simpan.bidang) BIDANG.splice(0, BIDANG.length, ...simpan.bidang);
        if (simpan.akun) DATA.akun = simpan.akun;
        if (simpan.riwayat) DATA.riwayat = simpan.riwayat;
        if (simpan.pakaiContoh === false) DATA.pakaiContoh = false;
      }
    } catch (e) { console.warn("Data simpanan rusak, memakai data contoh.", e); }
    if (!DATA.pakaiContoh) susunWilayahDariBidang();
    return;
  }
  // Mode Supabase: ambil semua bidang, 1000 baris sekali ambil
  try {
    const semua = [];
    for (let dari = 0; ; dari += 1000) {
      const baris = cekGalat(await sb.from("bidang").select("*").order("nib").range(dari, dari + 999));
      semua.push(...baris);
      if (baris.length < 1000) break;
    }
    if (semua.length) {
      BIDANG.splice(0, BIDANG.length, ...semua.map(dariDb));
      DATA.pakaiContoh = false;
      susunWilayahDariBidang();
    }
  } catch (e) {
    console.error(e);
    alert("Gagal mengambil data dari database. Web menampilkan data contoh.\n\n" + e.message);
  }
}

function simpanDemo() {
  localStorage.setItem(KUNCI_DEMO, JSON.stringify({ bidang: BIDANG, akun: DATA.akun, riwayat: DATA.riwayat, pakaiContoh: DATA.pakaiContoh }));
}
function resetDemo() { localStorage.removeItem(KUNCI_DEMO); location.reload(); }

// =====================================================================
// LOGIN
// =====================================================================
const SANDI_DEMO = "demo123"; // hanya untuk mode demo

// Mengembalikan akun {id, email, nama, peran} atau melempar galat
async function masuk(email, sandi) {
  if (DATA.mode === "demo") {
    const akun = DATA.akun.find((a) => a.email === email && a.aktif);
    if (!akun || sandi !== SANDI_DEMO) throw new Error("Email atau kata sandi salah.");
    sessionStorage.setItem("sinibara-sesi", akun.email);
    return akun;
  }
  const hasil = await sb.auth.signInWithPassword({ email, password: sandi });
  if (hasil.error) throw new Error("Email atau kata sandi salah.");
  const profil = await ambilProfilSaya();
  if (!profil) { await sb.auth.signOut(); throw new Error("Akun ini belum aktif. Hubungi admin."); }
  return profil;
}

async function ambilProfilSaya() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb.from("profil").select("*").eq("id", user.id).maybeSingle();
  return data && data.aktif ? data : null;
}

// Cek apakah masih login dari kunjungan sebelumnya
async function sesiAwal() {
  if (DATA.mode === "demo") {
    const email = sessionStorage.getItem("sinibara-sesi");
    return DATA.akun.find((a) => a.email === email && a.aktif) || null;
  }
  const { data: { session } } = await sb.auth.getSession();
  return session ? await ambilProfilSaya() : null;
}

async function keluar() {
  if (DATA.mode === "demo") sessionStorage.removeItem("sinibara-sesi");
  else await sb.auth.signOut();
}

// =====================================================================
// BIDANG: tambah, ubah, hapus
// =====================================================================
async function dbTambahBidang(b) {
  if (DATA.mode === "supabase") cekGalat(await sb.from("bidang").insert(keDb(b)));
  BIDANG.push(b);
  if (DATA.mode === "demo") simpanDemo();
}
async function dbUbahBidang(nib, perubahan) {
  const b = BIDANG.find((x) => x.nib === nib);
  if (DATA.mode === "supabase") {
    const isi = keDb({ ...b, ...perubahan });
    delete isi.nib;
    isi.diubah = new Date().toISOString();
    const hasil = cekGalat(await sb.from("bidang").update(isi).eq("nib", nib).select("nib"));
    if (!hasil.length) throw new Error("Data tidak tersimpan. Pastikan akun Anda masih aktif.");
  }
  Object.assign(b, perubahan);
  if (DATA.mode === "demo") simpanDemo();
}
async function dbHapusBidang(nib) {
  if (DATA.mode === "supabase") {
    const hasil = cekGalat(await sb.from("bidang").delete().eq("nib", nib).select("nib"));
    if (!hasil.length) throw new Error("Data tidak terhapus. Hanya admin yang boleh menghapus.");
  }
  BIDANG.splice(BIDANG.findIndex((b) => b.nib === nib), 1);
  if (DATA.mode === "demo") simpanDemo();
}

// =====================================================================
// DATA WILAYAH DISUSUN ULANG DARI DATA BIDANG ASLI
// (dipakai setelah impor SHP, supaya daftar kecamatan & desa sesuai data)
// =====================================================================
function susunWilayahDariBidang() {
  const lama = {};
  WILAYAH.forEach((k) => k.desa.forEach((d) => (lama[k.kecamatan + "|" + d.nama] = d.jenis)));
  const kel = {};
  BIDANG.forEach((b) => {
    if (!b.koordinat || !b.koordinat.length) return;
    const kec = b.kecamatan || "Tanpa kecamatan", desa = b.desa || "Tanpa desa";
    const [lat, lng] = titikTengahKoordinat(b.koordinat);
    kel[kec] = kel[kec] || {};
    const d = (kel[kec][desa] = kel[kec][desa] || { n: 0, lat: 0, lng: 0 });
    d.n++; d.lat += lat; d.lng += lng;
  });
  const baru = Object.keys(kel).sort().map((kec) => ({
    kecamatan: kec,
    desa: Object.keys(kel[kec]).sort().map((nama) => {
      const d = kel[kec][nama];
      return { nama, jenis: lama[kec + "|" + nama] || "Desa/Kelurahan", lat: d.lat / d.n, lng: d.lng / d.n };
    }),
  }));
  if (baru.length) WILAYAH.splice(0, WILAYAH.length, ...baru);
}
function titikTengahKoordinat(k) {
  return [k.reduce((s, p) => s + p[0], 0) / k.length, k.reduce((s, p) => s + p[1], 0) / k.length];
}

// =====================================================================
// IMPOR BIDANG DARI SHP / GEOJSON
//   mode "ganti"   : semua data lama diganti (hanya mode demo)
//   mode "gabung"  : bidang dengan NIB sama diperbarui, NIB baru ditambahkan
// =====================================================================
async function dbImporBidang(daftar, mode) {
  if (DATA.mode === "supabase") {
    for (let i = 0; i < daftar.length; i += 500) {
      cekGalat(await sb.from("bidang").upsert(daftar.slice(i, i + 500).map(keDb), { onConflict: "nib" }));
    }
    return;
  }
  if (mode === "ganti") {
    BIDANG.splice(0, BIDANG.length, ...daftar);
  } else {
    daftar.forEach((b) => {
      const i = BIDANG.findIndex((x) => x.nib === b.nib);
      if (i >= 0) BIDANG[i] = { ...BIDANG[i], ...b }; else BIDANG.push(b);
    });
  }
  DATA.pakaiContoh = false;
  simpanDemo();
}

// Admin: memasukkan data contoh ke database yang masih kosong
async function dbUnggahContoh() {
  for (let i = 0; i < BIDANG.length; i += 500) {
    cekGalat(await sb.from("bidang").insert(BIDANG.slice(i, i + 500).map(keDb)));
  }
}

// =====================================================================
// RIWAYAT
// =====================================================================
async function dbCatat(pengguna, aksi, nib, detail) {
  const catatan = { waktu: new Date().toISOString(), oleh: pengguna.nama, aksi, nib: nib || "", detail: detail || "" };
  if (DATA.mode === "supabase") {
    const hasil = await sb.from("riwayat").insert({ oleh: catatan.oleh, aksi, nib: catatan.nib, detail: catatan.detail });
    if (hasil.error) console.warn("Riwayat gagal dicatat:", hasil.error.message);
  }
  DATA.riwayat.unshift(catatan);
  DATA.riwayat = DATA.riwayat.slice(0, 500);
  if (DATA.mode === "demo") simpanDemo();
}
async function dbAmbilRiwayat() {
  if (DATA.mode === "supabase") {
    DATA.riwayat = cekGalat(await sb.from("riwayat").select("waktu, oleh, aksi, nib, detail").order("waktu", { ascending: false }).limit(300));
  }
  return DATA.riwayat;
}

// =====================================================================
// AKUN (khusus admin)
// =====================================================================
async function dbAmbilAkun() {
  if (DATA.mode === "supabase") DATA.akun = cekGalat(await sb.from("profil").select("*").order("dibuat"));
  return DATA.akun;
}
async function dbUbahAkun(email, perubahan) {
  const a = DATA.akun.find((x) => x.email === email);
  if (DATA.mode === "supabase") {
    const hasil = cekGalat(await sb.from("profil").update(perubahan).eq("id", a.id).select("id"));
    if (!hasil.length) throw new Error("Perubahan akun gagal disimpan.");
  }
  Object.assign(a, perubahan);
  if (DATA.mode === "demo") simpanDemo();
}
// Mode demo saja. Di mode Supabase, akun baru dibuat lewat dashboard Supabase.
async function dbTambahAkunDemo(akun) {
  DATA.akun.push(akun);
  simpanDemo();
}