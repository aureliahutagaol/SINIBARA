// =====================================================================
// ADMIN.JS - login petugas dan halaman kerja admin/petugas
// =====================================================================
// Dua peran:
//   admin   -> semua fitur, termasuk hapus bidang dan kelola akun
//   petugas -> tambah & ubah bidang, impor/ekspor, lihat riwayat
// Semua penyimpanan data lewat fungsi di penyimpanan.js
// =====================================================================

let pengguna = null; // akun yang sedang login
const isAdmin = () => pengguna && pengguna.peran === "admin";
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const waktuIndo = (iso) => new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const POLA_NOP = /^\d{2}\.\d{2}\.\d{3}\.\d{3}\.\d{3}-\d{4}\.\d$/;

// Menjalankan aksi yang menyimpan ke database, dan menampilkan pesan kalau gagal
async function coba(aksi) {
  document.body.classList.add("sibuk");
  try { await aksi(); return true; }
  catch (e) { console.error(e); alert("Gagal: " + e.message); return false; }
  finally { document.body.classList.remove("sibuk"); }
}
const catat = (aksi, nib, detail) => dbCatat(pengguna, aksi, nib, detail);

// =====================================================================
// 1. LOGIN & KELUAR
// =====================================================================
function perbaruiTombolHeader() {
  $("btnLogin").textContent = pengguna ? "👤 Panel " + (isAdmin() ? "Admin" : "Petugas") : "Login Petugas";
}

$("btnLogin").onclick = () => {
  if (pengguna) { location.hash = "#admin"; return; }
  $("loginSalah").hidden = true;
  $("modalLogin").hidden = false;
  $("loginEmail").focus();
};
$("btnTutupLogin").onclick = () => ($("modalLogin").hidden = true);

$("formLogin").onsubmit = async (e) => {
  e.preventDefault();
  const tombol = $("formLogin").querySelector("[type=submit]");
  tombol.disabled = true; tombol.textContent = "Memeriksa…";
  try {
    pengguna = await masuk($("loginEmail").value.trim().toLowerCase(), $("loginSandi").value);
    $("modalLogin").hidden = true;
    $("formLogin").reset();
    perbaruiTombolHeader();
    location.hash = "#admin";
    bukaHalaman();
  } catch (err) {
    $("loginSalah").textContent = err.message;
    $("loginSalah").hidden = false;
  } finally {
    tombol.disabled = false; tombol.textContent = "Masuk";
  }
};

$("btnKeluar").onclick = async () => {
  await keluar();
  pengguna = null;
  perbaruiTombolHeader();
  location.hash = "#beranda";
};

// Dipanggil app.js saat web mulai: cek apakah masih login
async function mulaiAdmin() {
  $("infoDemo").hidden = DATA.mode !== "demo";
  pengguna = await sesiAwal();
  perbaruiTombolHeader();
}

// =====================================================================
// 2. TAMPILAN PANEL
// =====================================================================
let tabAktif = "ringkasan";

function tampilkanAdmin() {
  if (!pengguna) { location.hash = "#beranda"; $("btnLogin").click(); return; }
  document.body.classList.toggle("mode-admin", isAdmin());
  $("adminProfil").innerHTML = `<div class="avatar">${esc((pengguna.nama || "?")[0].toUpperCase())}</div>
    <div><b>${esc(pengguna.nama)}</b><span class="peran peran-${pengguna.peran}">${pengguna.peran === "admin" ? "Admin" : "Petugas"}</span></div>`;
  bukaTab(tabAktif);
}

document.querySelectorAll(".admin-menu [data-tab]").forEach((b) => (b.onclick = () => bukaTab(b.dataset.tab)));

async function bukaTab(nama) {
  if (nama === "akun" && !isAdmin()) nama = "ringkasan";
  tabAktif = nama;
  document.querySelectorAll(".admin-menu [data-tab]").forEach((b) => b.classList.toggle("aktif", b.dataset.tab === nama));
  document.querySelectorAll(".admin-isi .tab").forEach((t) => (t.hidden = t.id !== "tab-" + nama));
  $("hitungTindak").textContent = daftarTindak().length || "";
  try {
    await ({ ringkasan: isiRingkasan, tindak: isiTindak, kelola: isiKelola, impor: isiImpor, riwayat: isiRiwayat, akun: isiAkun })[nama]();
  } catch (e) {
    console.error(e);
    $("tab-" + nama).innerHTML = `<div class="panel">Gagal memuat: ${esc(e.message)}</div>`;
  }
}

// Bidang yang perlu dicek: belum punya NOP, atau satu NOP dipakai lebih dari satu bidang
function daftarTindak() {
  const hitung = {};
  BIDANG.forEach((b) => { if (b.nop) hitung[b.nop] = (hitung[b.nop] || 0) + 1; });
  return BIDANG.filter((b) => !b.nop || hitung[b.nop] > 1)
    .map((b) => ({ b, masalah: !b.nop ? "Belum terhubung NOP" : `NOP dipakai di ${hitung[b.nop]} bidang` }));
}

// Kotak pemberitahuan kalau database masih kosong (mode Supabase)
function kotakDatabaseKosong() {
  if (!(DATA.mode === "supabase" && DATA.pakaiContoh)) return "";
  return `<div class="panel kosong-db">
    <h2>📦 Database masih kosong</h2>
    <p class="sub kecil">Yang tampil di web sekarang adalah data contoh. ${isAdmin()
      ? `Klik tombol di bawah untuk memasukkan ${ribuan(BIDANG.length)} bidang contoh ke database, supaya semua fitur bisa dicoba. Nanti bisa diganti data asli.</p>
         <button class="btn utama" onclick="unggahContoh()">Masukkan data contoh ke database</button>`
      : `Minta admin memasukkan data terlebih dahulu.</p>`}
  </div>`;
}
async function unggahContoh() {
  if (!confirm(`Masukkan ${BIDANG.length} bidang contoh ke database?`)) return;
  if (await coba(async () => { await dbUnggahContoh(); await catat("Mengunggah data contoh", "", BIDANG.length + " bidang"); })) {
    alert("Berhasil! Halaman akan dimuat ulang.");
    location.reload();
  }
}
// Di mode Supabase, data contoh belum ada di database, jadi belum bisa diubah
function bolehUbah() {
  if (DATA.mode === "supabase" && DATA.pakaiContoh) { alert("Masukkan data ke database terlebih dahulu (lihat menu Ringkasan)."); return false; }
  return true;
}

// ---------- Tab: Ringkasan ----------
async function isiRingkasan() {
  const riwayat = await dbAmbilRiwayat();
  const seminggu = Date.now() - 7 * 864e5;
  const ubahMinggu = riwayat.filter((r) => new Date(r.waktu) > seminggu).length;
  const tindak = daftarTindak();
  const jam = new Date().getHours();
  const salam = jam < 11 ? "Selamat pagi" : jam < 15 ? "Selamat siang" : jam < 18 ? "Selamat sore" : "Selamat malam";
  $("tab-ringkasan").innerHTML = `
    <h1>${salam}, ${esc((pengguna.nama || "").split(" ")[0])} 👋</h1>
    <p class="sub">Ini ringkasan pekerjaan data pertanahan hari ini.</p>
    ${kotakDatabaseKosong()}
    <div class="kartu-statistik">
      <div class="kartu"><div class="label">Total bidang</div><div class="nilai">${ribuan(BIDANG.length)}</div><div class="ket">di ${WILAYAH.length} kecamatan</div></div>
      <div class="kartu peringatan"><div class="label">Perlu ditindaklanjuti</div><div class="nilai">${tindak.length}</div><div class="ket">bidang tanpa NOP / NOP ganda</div></div>
      <div class="kartu"><div class="label">Terhubung NOP</div><div class="nilai">${BIDANG.length ? Math.round(BIDANG.filter((b) => b.nop).length / BIDANG.length * 100) : 0}%</div><div class="ket">dari seluruh bidang</div></div>
      <div class="kartu"><div class="label">Perubahan 7 hari</div><div class="nilai">${ubahMinggu}</div><div class="ket">oleh semua petugas</div></div>
    </div>
    <div class="grid-dua">
      <div class="panel">
        <h2>Aksi cepat</h2>
        <div class="aksi-cepat">
          <button class="btn utama" onclick="bukaTab('kelola'); bukaFormBidang()">＋ Tambah bidang</button>
          <button class="btn" onclick="bukaTab('tindak')">⚠️ Cek ${tindak.length} bidang bermasalah</button>
          <button class="btn" onclick="bukaTab('impor')">📥 Impor Excel NIB/NOP</button>
          <button class="btn" onclick="eksporExcel()">📤 Ekspor semua ke Excel</button>
        </div>
      </div>
      <div class="panel">
        <h2>Aktivitas terakhir</h2>
        ${riwayat.length ? `<ul class="aktivitas">${riwayat.slice(0, 5).map((r) => `
          <li><b>${esc(r.oleh)}</b> ${esc(r.aksi.toLowerCase())} ${r.nib ? "NIB " + esc(r.nib) : ""}<span>${waktuIndo(r.waktu)}</span></li>`).join("")}</ul>`
          : `<p class="sub">Belum ada perubahan.</p>`}
      </div>
    </div>
    ${DATA.mode === "demo" ? `<p class="sub kecil">Mode demo: perubahan disimpan di browser ini saja. <a href="#" onclick="if(confirm('Kembalikan semua data ke data contoh awal?')) resetDemo(); return false;">Kembalikan data contoh</a></p>`
      : `<p class="sub kecil">🟢 Tersambung ke database Supabase.</p>`}`;
}

// ---------- Tab: Perlu ditindaklanjuti ----------
function isiTindak() {
  const daftar = daftarTindak();
  $("tab-tindak").innerHTML = `
    <h1>Perlu ditindaklanjuti</h1>
    <p class="sub">Bidang yang belum terhubung NOP, atau NOP-nya tercatat di lebih dari satu bidang. Periksa dan perbaiki datanya.</p>
    ${daftar.length ? `<div class="tabel-gulir"><table class="tabel"><thead><tr><th>NIB</th><th>NOP</th><th>Lokasi</th><th>Masalah</th><th></th></tr></thead><tbody>
      ${daftar.map(({ b, masalah }) => `<tr><td>${b.nib}</td><td>${esc(b.nop) || "-"}</td><td>${esc(b.desa)}, ${esc(b.kecamatan)}</td>
        <td><span class="lencana ${b.nop ? "abu" : "belum"}">${masalah}</span></td>
        <td class="aksi"><button class="btn kecil utama" onclick="bukaFormBidang('${b.nib}')">Perbaiki</button>
        <button class="btn kecil" onclick="lihatBidang('${b.nib}')">Peta</button></td></tr>`).join("")}
    </tbody></table></div>` : `<div class="panel">🎉 Semua bidang sudah beres. Tidak ada yang perlu ditindaklanjuti.</div>`}`;
}

// ---------- Tab: Kelola data bidang ----------
let halamanKe = 1;
const PER_HALAMAN = 15;
function isiKelola() {
  if ($("saringKec").options.length <= 1) {
    WILAYAH.forEach((k) => $("saringKec").add(new Option(k.kecamatan, k.kecamatan)));
    ["saringTeks", "saringKec", "saringNop"].forEach((id) => ($(id).oninput = () => { halamanKe = 1; gambarTabelKelola(); }));
    $("btnTambahBidang").onclick = () => bukaFormBidang();
  }
  gambarTabelKelola();
}

function gambarTabelKelola() {
  const q = angkaSaja($("saringTeks").value), kec = $("saringKec").value, st = $("saringNop").value;
  const data = BIDANG.filter((b) => (!kec || b.kecamatan === kec) &&
    (!st || (st === "ada" ? b.nop : !b.nop)) &&
    (!q || b.nib.includes(q) || angkaSaja(b.nop).includes(q)));
  const jmlHal = Math.max(1, Math.ceil(data.length / PER_HALAMAN));
  halamanKe = Math.min(halamanKe, jmlHal);
  const potong = data.slice((halamanKe - 1) * PER_HALAMAN, halamanKe * PER_HALAMAN);

  $("tabelKelola").innerHTML = `<thead><tr><th>NIB</th><th>NOP</th><th>Kecamatan / Desa</th><th>Hak</th><th>Luas (m²)</th><th>Pajak</th><th></th></tr></thead><tbody>` +
    potong.map((b) => `<tr><td>${b.nib}</td><td>${esc(b.nop) || '<span class="lencana belum">Belum ada</span>'}</td>
      <td>${esc(b.kecamatan)}<br><small>${esc(b.desa)}</small></td><td>${esc(b.hak)}</td><td>${ribuan(b.luas)}</td>
      <td><span class="lencana ${kelasPajak(b.pajak)}">${b.pajak}</span></td>
      <td class="aksi"><button class="btn kecil" onclick="bukaFormBidang('${b.nib}')">✏️ Ubah</button>
      <button class="btn kecil bahaya khusus-admin" onclick="hapusBidang('${b.nib}')">🗑️</button></td></tr>`).join("") +
    (potong.length ? "" : `<tr><td colspan="7" class="kosong">Tidak ada data yang cocok.</td></tr>`) + `</tbody>`;

  $("halamanTabel").innerHTML = `<span>${ribuan(data.length)} bidang · halaman ${halamanKe} dari ${jmlHal}</span>
    <button class="btn kecil" ${halamanKe <= 1 ? "disabled" : ""} onclick="halamanKe--; gambarTabelKelola()">‹ Sebelumnya</button>
    <button class="btn kecil" ${halamanKe >= jmlHal ? "disabled" : ""} onclick="halamanKe++; gambarTabelKelola()">Berikutnya ›</button>`;
}

// ---------- Form tambah / ubah bidang ----------
let nibDiubah = null;
function isiPilihan(sel, daftar, nilai) {
  sel.innerHTML = daftar.map((d) => `<option ${d === nilai ? "selected" : ""}>${esc(d)}</option>`).join("");
}
function isiPilihanDesa(kec, nilai) {
  const k = WILAYAH.find((x) => x.kecamatan === kec);
  isiPilihan($("fDesa"), k ? k.desa.map((d) => d.nama) : [], nilai);
}
$("fKecamatan").onchange = () => isiPilihanDesa($("fKecamatan").value);

function bukaFormBidang(nib) {
  if (!bolehUbah()) return;
  const b = nib ? BIDANG.find((x) => x.nib === nib) : null;
  nibDiubah = nib || null;
  $("judulFormBidang").textContent = b ? "Ubah data bidang" : "Tambah bidang baru";
  $("fNib").value = b ? b.nib : "";
  $("fNib").readOnly = !!b; // NIB tidak boleh diubah
  $("fNop").value = b ? b.nop || "" : "";
  isiPilihan($("fKecamatan"), WILAYAH.map((k) => k.kecamatan), b && b.kecamatan);
  isiPilihanDesa($("fKecamatan").value, b && b.desa);
  isiPilihan($("fHak"), Object.keys(WARNA.hak), b && b.hak);
  isiPilihan($("fGuna"), Object.keys(WARNA.penggunaan), b && b.penggunaan);
  $("fLuas").value = b ? b.luas : "";
  $("fPajak").value = b && b.pajak !== "Tanpa NOP" ? b.pajak : "Belum Lunas";
  $("catatanKoordinat").hidden = !!b;
  $("modalBidang").hidden = false;
}
$("btnBatalBidang").onclick = () => ($("modalBidang").hidden = true);

$("formBidang").onsubmit = async (e) => {
  e.preventDefault();
  const nop = $("fNop").value.trim() || null;
  if (nop && !POLA_NOP.test(nop)) { alert("Format NOP harus seperti: 12.19.001.001.123-4567.0"); return; }
  const baru = {
    nop, kecamatan: $("fKecamatan").value, desa: $("fDesa").value, hak: $("fHak").value,
    penggunaan: $("fGuna").value, luas: +$("fLuas").value, pajak: nop ? $("fPajak").value : "Tanpa NOP",
  };

  let berhasil;
  if (nibDiubah) {
    const b = BIDANG.find((x) => x.nib === nibDiubah);
    const beda = Object.keys(baru).filter((k) => b[k] !== baru[k]).map((k) => `${k}: ${b[k] ?? "-"} → ${baru[k] ?? "-"}`);
    if (!beda.length) { $("modalBidang").hidden = true; return; }
    berhasil = await coba(async () => { await dbUbahBidang(nibDiubah, baru); await catat("Mengubah", nibDiubah, beda.join("; ")); });
  } else {
    const nib = $("fNib").value.trim();
    if (BIDANG.some((x) => x.nib === nib)) { alert("NIB " + nib + " sudah terdaftar."); return; }
    const d = WILAYAH.find((k) => k.kecamatan === baru.kecamatan).desa.find((x) => x.nama === baru.desa);
    const s = 0.0006; // kotak sementara di tengah desa
    const bidangBaru = { nib, ...baru, njop: null, tahunPajak: new Date().getFullYear(),
      koordinat: [[d.lat, d.lng], [d.lat, d.lng + s], [d.lat + s, d.lng + s], [d.lat + s, d.lng]] };
    berhasil = await coba(async () => { await dbTambahBidang(bidangBaru); await catat("Menambah", nib, `${baru.desa}, ${baru.kecamatan}`); });
  }
  if (berhasil) { $("modalBidang").hidden = true; segarkanSemua(); }
};

async function hapusBidang(nib) {
  if (!isAdmin() || !bolehUbah()) return;
  if (!confirm(`Hapus bidang NIB ${nib}? Tindakan ini tidak bisa dibatalkan.`)) return;
  if (await coba(async () => { await dbHapusBidang(nib); await catat("Menghapus", nib, ""); })) segarkanSemua();
}

// Setelah data berubah: gambar ulang peta & tab yang sedang dibuka
function segarkanSemua() {
  REKAP = rekapKecamatan();
  if (typeof peta !== "undefined" && peta) gambarBidang();
  bukaTab(tabAktif);
}

// ---------- Tab: Impor & ekspor ----------
function isiImpor() {
  $("tab-impor").innerHTML = `
    <h1>Impor &amp; ekspor</h1>
    <div class="grid-dua">
      <div class="panel">
        <h2>📥 Impor NOP dari Excel</h2>
        <p class="sub kecil">File Excel (.xlsx) atau .csv dengan kolom <b>NIB</b> dan <b>NOP</b>. NOP pada bidang dengan NIB yang sama akan diperbarui.</p>
        <label class="unggah"><input type="file" id="fileImpor" accept=".xlsx,.xls,.csv"><span>Pilih file…</span></label>
        <button class="btn kecil" onclick="unduhTemplate()">Unduh contoh template</button>
        <div id="hasilImpor"></div>
      </div>
      <div class="panel">
        <h2>📤 Ekspor ke Excel</h2>
        <p class="sub kecil">Unduh data bidang untuk laporan. Nama pemegang hak dan NIK tidak ikut karena memang tidak disimpan.</p>
        <div class="aksi-cepat">
          <button class="btn utama" onclick="eksporExcel()">Semua bidang</button>
          <button class="btn" onclick="eksporExcel(true)">Hanya yang perlu ditindaklanjuti</button>
        </div>
      </div>
    </div>
    <div class="panel">
      <h2>🗺️ Impor peta bidang (SHP / GeoJSON)</h2>
      <p class="sub kecil">Pilih file <b>.zip</b> yang berisi .shp, .shx, .dbf, dan .prj, atau file <b>.geojson</b> hasil ekspor QGIS.
        Bentuk bidang dari file akan menggantikan kotak-kotak data contoh.</p>
      <label class="unggah"><input type="file" id="fileShp" accept=".zip,.geojson,.json"><span>Pilih file SHP (.zip) atau GeoJSON…</span></label>
      <button class="btn kecil" onclick="unduhContohGeojson()">Unduh contoh GeoJSON (untuk mencoba)</button>
      <div id="hasilShp"></div>
    </div>`;
  $("fileImpor").onchange = imporExcel;
  $("fileShp").onchange = bacaFileSpasial;
}

// =====================================================================
// IMPOR SHP / GEOJSON
// =====================================================================
// Kolom di web dan kata kunci untuk menebak kolom yang cocok di file
const KOLOM_IMPOR = [
  { kunci: "nib", label: "NIB", wajib: true, tebak: ["NIB", "NO_NIB", "NOMOR_NIB", "NIB_BIDANG"] },
  { kunci: "nop", label: "NOP", tebak: ["NOP", "NO_NOP", "NOMOR_NOP", "NOP_PBB"] },
  { kunci: "kecamatan", label: "Kecamatan", tebak: ["KECAMATAN", "KEC", "NAMA_KEC", "NM_KEC", "WADMKC"] },
  { kunci: "desa", label: "Desa/Kelurahan", tebak: ["DESA", "KELURAHAN", "DESA_KEL", "KEL_DESA", "NAMA_DESA", "NM_DESA", "WADMKD"] },
  { kunci: "hak", label: "Jenis hak", tebak: ["HAK", "TIPE_HAK", "TIPEHAK", "JENIS_HAK", "JNS_HAK", "STATUS_HAK"] },
  { kunci: "penggunaan", label: "Penggunaan", tebak: ["PENGGUNAAN", "GUNA", "GUNA_TANAH", "PENGGUNAAN_TANAH", "LANDUSE"] },
  { kunci: "luas", label: "Luas (m²)", tebak: ["LUAS", "LUAS_M2", "LUASTERTUL", "LUAS_TERTULIS", "LUAS_BIDANG", "AREA"] },
  { kunci: "pajak", label: "Status pajak", tebak: ["PAJAK", "STATUS_PAJAK", "STATUS_PBB", "LUNAS"] },
];
const SINGKATAN_HAK = { HM: "Hak Milik", SHM: "Hak Milik", HGB: "Hak Guna Bangunan", SHGB: "Hak Guna Bangunan",
  HP: "Hak Pakai", HGU: "Hak Guna Usaha", WAKAF: "Tanah Wakaf", HW: "Tanah Wakaf" };
let fileSpasial = null; // { fitur: [...], kolom: [...], nama }

async function bacaFileSpasial(e) {
  const file = e.target.files[0];
  if (!file) return;
  const kotak = $("hasilShp");
  kotak.innerHTML = `<p class="sub kecil">Membaca ${esc(file.name)}…</p>`;
  try {
    let gj;
    if (/\.zip$/i.test(file.name)) {
      if (typeof shp === "undefined") throw new Error("Pustaka pembaca SHP belum termuat. Periksa koneksi internet lalu muat ulang halaman.");
      gj = await shp(await file.arrayBuffer());
      if (Array.isArray(gj)) gj = { type: "FeatureCollection", features: gj.flatMap((x) => x.features) };
    } else {
      gj = JSON.parse(await file.text());
    }
    const fitur = (gj.features || []).filter((f) => f.geometry && /Polygon/.test(f.geometry.type));
    if (!fitur.length) throw new Error("Tidak ada bidang (poligon) di dalam file ini.");
    const contoh = cincinTerluar(fitur[0].geometry)[0];
    if (Math.abs(contoh[0]) > 180 || Math.abs(contoh[1]) > 90)
      throw new Error("Koordinat file bukan derajat (WGS 84). Kalau file SHP, pastikan file .prj ikut di dalam zip. Atau buka di QGIS lalu ekspor ulang dengan CRS EPSG:4326.");
    const kolom = [...new Set(fitur.flatMap((f) => Object.keys(f.properties || {})))];
    fileSpasial = { fitur, kolom, nama: file.name };
    tampilkanPencocokan();
  } catch (err) {
    console.error(err);
    kotak.innerHTML = `<p class="pesan-salah">❌ ${esc(err.message)}</p>`;
  }
}

function tebakKolom(k) {
  const norm = (t) => t.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const ada = fileSpasial.kolom;
  for (const t of k.tebak) { const c = ada.find((x) => norm(x) === norm(t)); if (c) return c; }
  // nama kolom SHP sering terpotong 10 huruf, misalnya PENGGUNAAN -> PENGGUNAA
  for (const t of k.tebak) { const c = ada.find((x) => norm(x).length >= 5 && norm(t).startsWith(norm(x))); if (c) return c; }
  return ada.find((x) => norm(x).includes(norm(k.tebak[0]))) || "";
}

function tampilkanPencocokan() {
  const { fitur, kolom, nama } = fileSpasial;
  const pilihan = (k) => `<select id="cocok-${k.kunci}"><option value="">(tidak ada)</option>${kolom.map((c) =>
    `<option ${c === tebakKolom(k) ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>`;
  const contoh = fitur[0].properties || {};
  $("hasilShp").innerHTML = `
    <p class="info-privasi">✅ <b>${esc(nama)}</b>: ${ribuan(fitur.length)} bidang ditemukan, ${kolom.length} kolom atribut.</p>
    <h2 style="margin-top:14px">Cocokkan kolom</h2>
    <p class="sub kecil">Pilih kolom di file yang berisi data berikut. Tebakan otomatis sudah diisi, periksa kembali.
      Jika kolom luas tidak ada, luas dihitung otomatis dari bentuk bidang.</p>
    <div class="tabel-gulir"><table class="tabel tabel-cocok">
      <tr><th>Data di web</th><th>Kolom di file</th><th>Contoh isi (bidang pertama)</th></tr>
      ${KOLOM_IMPOR.map((k) => `<tr><td>${k.label}${k.wajib ? " <b style='color:var(--merah)'>*</b>" : ""}</td>
        <td>${pilihan(k)}</td><td class="contoh-isi" id="contoh-${k.kunci}"></td></tr>`).join("")}
    </table></div>
    <div class="pilihan-impor">
      ${DATA.mode === "demo" ? `<label><input type="radio" name="modeImpor" value="ganti" checked> Ganti semua data contoh dengan isi file ini</label>` : ""}
      <label><input type="radio" name="modeImpor" value="gabung" ${DATA.mode === "demo" ? "" : "checked"}> Tambah &amp; perbarui (NIB yang sama diperbarui)</label>
    </div>
    <button class="btn utama" id="btnJalankanImpor">Impor ${ribuan(fitur.length)} bidang</button>
    <div id="laporanImpor"></div>`;
  const isiContoh = () => KOLOM_IMPOR.forEach((k) => {
    const c = $("cocok-" + k.kunci).value;
    $("contoh-" + k.kunci).textContent = c ? String(contoh[c] ?? "") : "—";
  });
  KOLOM_IMPOR.forEach((k) => ($("cocok-" + k.kunci).onchange = isiContoh));
  isiContoh();
  $("btnJalankanImpor").onclick = jalankanImpor;
}

// Ambil cincin luar poligon (untuk MultiPolygon: bagian terbesar), format [lng, lat]
function cincinTerluar(g) {
  if (g.type === "Polygon") return g.coordinates[0];
  return g.coordinates.map((p) => p[0]).sort((a, b) => b.length - a.length)[0];
}
// Luas poligon di permukaan bumi (m²), koordinat [lat, lng]
function hitungLuas(k) {
  const R = 6378137, rad = Math.PI / 180;
  let s = 0;
  for (let i = 0; i < k.length; i++) {
    const [la1, lo1] = k[i], [la2, lo2] = k[(i + 1) % k.length];
    s += (lo2 - lo1) * rad * (2 + Math.sin(la1 * rad) + Math.sin(la2 * rad));
  }
  return Math.abs(s * R * R / 2);
}
function rapikanNop(t) {
  const a = angkaSaja(t);
  if (a.length === 18) return `${a.slice(0, 2)}.${a.slice(2, 4)}.${a.slice(4, 7)}.${a.slice(7, 10)}.${a.slice(10, 13)}-${a.slice(13, 17)}.${a.slice(17)}`;
  return String(t || "").trim();
}
function rapikanHak(t) {
  const s = String(t || "").trim();
  return SINGKATAN_HAK[s.toUpperCase().replace(/[^A-Z]/g, "")] || s;
}
function rapikanPajak(t, adaNop) {
  if (!adaNop) return "Tanpa NOP";
  const s = String(t || "").toLowerCase();
  if (/belum|tunggak|tidak/.test(s)) return "Belum Lunas";
  if (/lunas|sudah|ya|true|1/.test(s)) return "Lunas";
  return "Belum Lunas";
}

async function jalankanImpor() {
  if (!(DATA.mode === "demo" || isAdmin())) return alert("Hanya admin yang boleh mengimpor data ke database.");
  const pilih = Object.fromEntries(KOLOM_IMPOR.map((k) => [k.kunci, $("cocok-" + k.kunci).value]));
  if (!pilih.nib) return alert("Kolom NIB wajib dipilih.");
  const mode = (document.querySelector("input[name=modeImpor]:checked") || {}).value || "gabung";
  const ambil = (f, k) => (pilih[k] ? (f.properties || {})[pilih[k]] : "");
  const hasil = [], nibSalah = [], nopTidakBaku = [], nibGanda = [];
  const sudah = new Set();
  fileSpasial.fitur.forEach((f, i) => {
    const nib = angkaSaja(String(ambil(f, "nib") ?? ""));
    if (nib.length !== 14) { nibSalah.push(`baris ${i + 1}: "${ambil(f, "nib") ?? ""}"`); return; }
    if (sudah.has(nib)) { nibGanda.push(nib); return; }
    sudah.add(nib);
    const koordinat = cincinTerluar(f.geometry).map(([lng, lat]) => [lat, lng]);
    if (koordinat.length > 1 && koordinat[0][0] === koordinat.at(-1)[0] && koordinat[0][1] === koordinat.at(-1)[1]) koordinat.pop();
    let nop = ambil(f, "nop") ? rapikanNop(ambil(f, "nop")) : null;
    if (nop && !POLA_NOP.test(nop)) { nopTidakBaku.push(`${nib}: ${nop}`); if (DATA.mode === "supabase") nop = null; }
    const luasFile = Number(String(ambil(f, "luas") ?? "").replace(",", "."));
    hasil.push({
      nib, nop,
      kecamatan: String(ambil(f, "kecamatan") || "").trim() || "Tanpa kecamatan",
      desa: String(ambil(f, "desa") || "").trim() || "Tanpa desa",
      hak: rapikanHak(ambil(f, "hak")) || "Lainnya",
      penggunaan: String(ambil(f, "penggunaan") || "").trim() || "Lainnya",
      luas: luasFile > 0 ? luasFile : Math.max(1, Math.round(hitungLuas(koordinat))),
      njop: null,
      pajak: rapikanPajak(ambil(f, "pajak"), !!nop),
      tahunPajak: new Date().getFullYear(),
      koordinat,
    });
  });
  if (!hasil.length) {
    $("laporanImpor").innerHTML = `<p class="pesan-salah">❌ Tidak ada bidang yang bisa diimpor. Periksa kolom NIB (harus 14 angka).</p>`;
    return;
  }
  const pesan = mode === "ganti"
    ? `Ganti SEMUA data yang ada dengan ${hasil.length} bidang dari file?`
    : `Tambah/perbarui ${hasil.length} bidang dari file?`;
  if (!confirm(pesan)) return;
  $("btnJalankanImpor").disabled = true;
  $("laporanImpor").innerHTML = `<p class="sub kecil">Menyimpan ${ribuan(hasil.length)} bidang…</p>`;
  const ok = await coba(async () => {
    await dbImporBidang(hasil, mode);
    await catat("Impor peta bidang", "", `${hasil.length} bidang dari ${fileSpasial.nama}`);
  });
  $("btnJalankanImpor").disabled = false;
  if (!ok) return;
  const daftarMasalah = (judul, isi) => isi.length
    ? `<details><summary>${judul} (${isi.length})</summary><p class="sub kecil">${isi.slice(0, 50).map(esc).join("<br>")}${isi.length > 50 ? "<br>…" : ""}</p></details>` : "";
  $("laporanImpor").innerHTML = `
    <p class="info-privasi">✅ ${ribuan(hasil.length)} bidang berhasil diimpor.</p>
    ${daftarMasalah("Dilewati karena NIB tidak 14 angka", nibSalah)}
    ${daftarMasalah("Dilewati karena NIB muncul dua kali di file", nibGanda)}
    ${daftarMasalah("NOP dengan format tidak baku" + (DATA.mode === "supabase" ? " (dikosongkan)" : ""), nopTidakBaku)}
    <button class="btn utama" onclick="location.hash='#peta'; location.reload()">Lihat di peta</button>`;
}

// Contoh file GeoJSON dari data yang sedang tampil, untuk mencoba fitur impor
function unduhContohGeojson() {
  const fitur = BIDANG.slice(0, 30).map((b) => ({
    type: "Feature",
    properties: { NIB: b.nib, NOP: b.nop || "", KECAMATAN: b.kecamatan, DESA: b.desa, TIPEHAK: b.hak, PENGGUNAAN: b.penggunaan, LUAS: b.luas },
    geometry: { type: "Polygon", coordinates: [[...b.koordinat, b.koordinat[0]].map(([lat, lng]) => [lng, lat])] },
  }));
  const blob = new Blob([JSON.stringify({ type: "FeatureCollection", features: fitur }, null, 1)], { type: "application/geo+json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "contoh-bidang.geojson";
  a.click();
  URL.revokeObjectURL(a.href);
}

function imporExcel(e) {
  const file = e.target.files[0];
  if (!file || !bolehUbah()) return;
  const baca = new FileReader();
  baca.onload = async () => {
    const buku = XLSX.read(baca.result, { type: "array" });
    const baris = XLSX.utils.sheet_to_json(buku.Sheets[buku.SheetNames[0]], { defval: "" });
    let diperbarui = 0; const tidakKetemu = [], salahFormat = [], gagal = [];
    $("hasilImpor").innerHTML = `<p class="sub kecil">Memproses ${baris.length} baris…</p>`;
    for (const r of baris) {
      const kunci = Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim().toUpperCase(), String(v).trim()]));
      const nib = angkaSaja(kunci.NIB), nop = kunci.NOP;
      if (!nib) continue;
      const b = BIDANG.find((x) => x.nib === nib);
      if (!b) { tidakKetemu.push(nib); continue; }
      if (nop && !POLA_NOP.test(nop)) { salahFormat.push(nib); continue; }
      if (nop && b.nop !== nop) {
        const lama = b.nop;
        try {
          await dbUbahBidang(nib, { nop, pajak: b.pajak === "Tanpa NOP" ? "Belum Lunas" : b.pajak });
          await catat("Mengimpor NOP", nib, `${lama || "-"} → ${nop}`);
          diperbarui++;
        } catch (err) { gagal.push(nib); }
      }
    }
    segarkanSemua();
    setTimeout(() => {
      $("hasilImpor").innerHTML = `<div class="info-privasi">✅ ${diperbarui} bidang diperbarui dari ${baris.length} baris.
        ${tidakKetemu.length ? `<br>⚠️ ${tidakKetemu.length} NIB tidak ditemukan: ${tidakKetemu.slice(0, 5).join(", ")}${tidakKetemu.length > 5 ? "…" : ""}` : ""}
        ${salahFormat.length ? `<br>⚠️ ${salahFormat.length} NOP formatnya salah (NIB ${salahFormat.slice(0, 5).join(", ")})` : ""}
        ${gagal.length ? `<br>❌ ${gagal.length} gagal disimpan ke database (NIB ${gagal.slice(0, 5).join(", ")})` : ""}</div>`;
    }, 50);
  };
  baca.readAsArrayBuffer(file);
}

function unduhTemplate() {
  const ws = XLSX.utils.json_to_sheet([{ NIB: BIDANG[0] ? BIDANG[0].nib : "02010101000001", NOP: "12.19.001.001.123-4567.0" }]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "NIB-NOP");
  XLSX.writeFile(wb, "template-impor-nop.xlsx");
}

function eksporExcel(hanyaTindak) {
  const sumber = hanyaTindak ? daftarTindak().map((t) => ({ ...t.b, masalah: t.masalah })) : BIDANG;
  const ws = XLSX.utils.json_to_sheet(sumber.map((b) => ({
    NIB: b.nib, NOP: b.nop || "", Kecamatan: b.kecamatan, "Desa/Kelurahan": b.desa, "Jenis Hak": b.hak,
    Penggunaan: b.penggunaan, "Luas (m2)": b.luas, "Status Pajak": b.pajak,
    Latitude: +titikTengah(b)[0].toFixed(7), Longitude: +titikTengah(b)[1].toFixed(7),
    ...(b.masalah ? { Masalah: b.masalah } : {}),
  })));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Bidang");
  XLSX.writeFile(wb, `sinibara-${hanyaTindak ? "perlu-tindak" : "semua-bidang"}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ---------- Tab: Riwayat ----------
async function isiRiwayat() {
  const riwayat = await dbAmbilRiwayat();
  $("tab-riwayat").innerHTML = `
    <h1>Riwayat perubahan</h1>
    <p class="sub">Semua perubahan data tercatat: siapa, kapan, dan apa yang diubah.</p>
    ${riwayat.length ? `<div class="tabel-gulir"><table class="tabel"><thead><tr><th>Waktu</th><th>Oleh</th><th>Aksi</th><th>NIB</th><th>Detail</th></tr></thead><tbody>
      ${riwayat.map((r) => `<tr><td>${waktuIndo(r.waktu)}</td><td>${esc(r.oleh)}</td><td>${esc(r.aksi)}</td><td>${esc(r.nib)}</td><td class="detail">${esc(r.detail)}</td></tr>`).join("")}
    </tbody></table></div>` : `<div class="panel">Belum ada perubahan yang tercatat.</div>`}`;
}

// ---------- Tab: Kelola akun (khusus admin) ----------
async function isiAkun() {
  const akun = await dbAmbilAkun();
  const demo = DATA.mode === "demo";
  $("tab-akun").innerHTML = `
    <h1>Kelola akun</h1>
    <p class="sub">Atur peran petugas, dan nonaktifkan akun yang tidak dipakai lagi.</p>
    ${demo ? `<form class="admin-saring" id="formAkun">
      <input id="akunNama" placeholder="Nama lengkap" required>
      <input id="akunEmail" type="email" placeholder="Email" required>
      <select id="akunPeran"><option value="petugas">Petugas</option><option value="admin">Admin</option></select>
      <button class="btn utama">＋ Tambah akun</button>
    </form>
    <p class="sub kecil">Mode demo: akun baru memakai kata sandi <code>${SANDI_DEMO}</code>.</p>`
    : `<div class="info-privasi">➕ <b>Cara menambah petugas baru:</b> buka dashboard Supabase → <b>Authentication</b> → <b>Users</b> → <b>Add user</b> → <b>Create new user</b>,
       isi email & kata sandi, centang <b>Auto Confirm User</b>. Akun otomatis muncul di tabel ini dalam keadaan <b>Nonaktif</b>. Klik <b>Aktifkan</b> supaya petugas bisa login.</div>`}
    <div class="tabel-gulir"><table class="tabel"><thead><tr><th>Nama</th><th>Email</th><th>Peran</th><th>Status</th><th></th></tr></thead><tbody>
      ${akun.map((a) => {
        const diriSendiri = a.email === pengguna.email;
        return `<tr><td>${esc(a.nama)}</td><td>${esc(a.email)}</td>
        <td><select onchange="ubahAkun('${esc(a.email)}', { peran: this.value })" ${diriSendiri ? "disabled" : ""}>
          <option value="petugas" ${a.peran === "petugas" ? "selected" : ""}>Petugas</option>
          <option value="admin" ${a.peran === "admin" ? "selected" : ""}>Admin</option></select></td>
        <td><span class="lencana ${a.aktif ? "lunas" : "abu"}">${a.aktif ? "Aktif" : "Nonaktif"}</span></td>
        <td>${diriSendiri ? "<small>(akun Anda)</small>" :
          `<button class="btn kecil" onclick="ubahAkun('${esc(a.email)}', { aktif: ${!a.aktif} })">${a.aktif ? "Nonaktifkan" : "Aktifkan"}</button>`}</td></tr>`;
      }).join("")}
    </tbody></table></div>`;
  if (demo) $("formAkun").onsubmit = async (e) => {
    e.preventDefault();
    const email = $("akunEmail").value.trim().toLowerCase();
    if (DATA.akun.some((a) => a.email === email)) { alert("Email sudah terdaftar."); return; }
    await dbTambahAkunDemo({ nama: $("akunNama").value.trim(), email, peran: $("akunPeran").value, aktif: true });
    await catat("Menambah akun", "", email);
    isiAkun();
  };
}
async function ubahAkun(email, perubahan) {
  const ket = perubahan.peran ? "peran → " + perubahan.peran : perubahan.aktif ? "diaktifkan" : "dinonaktifkan";
  await coba(async () => { await dbUbahAkun(email, perubahan); await catat("Mengubah akun", "", `${email}: ${ket}`); });
  isiAkun();
}