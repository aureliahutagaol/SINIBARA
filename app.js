// =====================================================================
// APP.JS - "otak" dari web SINIBARA
// =====================================================================

// ---------- Fungsi bantu ----------
const rupiah = (n) => "Rp " + n.toLocaleString("id-ID");
const ribuan = (n) => n.toLocaleString("id-ID");
const angkaSaja = (t) => (t || "").replace(/[^0-9]/g, "");
const $ = (id) => document.getElementById(id);
const teksNop = (b) => b.nop || "Belum terhubung NOP";
const kelasPajak = (p) => (p === "Lunas" ? "lunas" : p === "Belum Lunas" ? "belum" : "abu");

// Titik tengah sebuah bidang
function titikTengah(b) {
  const lat = b.koordinat.reduce((s, k) => s + k[0], 0) / b.koordinat.length;
  const lng = b.koordinat.reduce((s, k) => s + k[1], 0) / b.koordinat.length;
  return [lat, lng];
}

// Link BHUMI ATR/BPN yang langsung terbuka di lokasi bidang
// (cara yang sama dengan SIPATEN: kirim koordinat dan kotak area ke BHUMI)
function linkBhumi(lat, lng) {
  const d = 0.0015; // ukuran area sekitar titik (kira-kira 150 meter)
  const p = new URLSearchParams({
    latitude: lat.toFixed(8), longitude: lng.toFixed(8), recenter: "1",
    bbox: [lng - d, lat - d, lng + d, lat + d].map((x) => x.toFixed(8)).join(","),
    width: "1200", height: "800", x: "600", y: "400",
  });
  return "https://bhumi.atrbpn.go.id/peta?" + p.toString();
}
function linkGoogleMaps(lat, lng) {
  return "https://www.google.com/maps/search/?api=1&query=" + lat.toFixed(7) + "," + lng.toFixed(7);
}

// ---------- Warna untuk setiap mode peta ----------
const WARNA = {
  nop: { "Terhubung NOP": "#1E8E4E", "Belum terhubung NOP": "#D64545" },
  pajak: { "Lunas": "#0F5132", "Belum Lunas": "#E07B2D", "Tanpa NOP": "#9AA5A0" },
  hak: { "Hak Milik": "#2BA3C9", "Hak Guna Bangunan": "#F2B705", "Hak Pakai": "#8E5CC2", "Hak Guna Usaha": "#E07B2D", "Tanah Wakaf": "#6D4C41", "Lainnya": "#94A3B8" },
  penggunaan: { "Permukiman": "#E0607E", "Sawah": "#8BC34A", "Kebun Sawit": "#2E7D32", "Kebun Karet": "#795548", "Tambak": "#29B6F6", "Perdagangan": "#FFA000", "Lainnya": "#94A3B8" },
};
const JUDUL_MODE = { nop: "Status NOP", pajak: "Status Pajak", hak: "Jenis Hak", penggunaan: "Penggunaan Tanah" };
function kategori(b, mode) {
  if (mode === "nop") return b.nop ? "Terhubung NOP" : "Belum terhubung NOP";
  if (mode === "pajak") return b.pajak;
  // Nilai di luar daftar warna (misalnya dari SHP) masuk kelompok "Lainnya"
  if (mode === "hak") return WARNA.hak[b.hak] ? b.hak : "Lainnya";
  return WARNA.penggunaan[b.penggunaan] ? b.penggunaan : "Lainnya";
}

// Ringkasan per kecamatan (dipakai beranda, dashboard, tabel)
function rekapKecamatan() {
  return WILAYAH.map((k) => {
    const isi = BIDANG.filter((b) => b.kecamatan === k.kecamatan);
    const pakaiNop = isi.filter((b) => b.nop);
    const luas = isi.reduce((s, b) => s + b.luas, 0);
    const lat = k.desa.reduce((s, d) => s + d.lat, 0) / k.desa.length;
    const lng = k.desa.reduce((s, d) => s + d.lng, 0) / k.desa.length;
    return {
      kecamatan: k.kecamatan, desa: k.desa.length, bidang: isi.length, luas,
      nop: pakaiNop.length, persenNop: isi.length ? Math.round(pakaiNop.length / isi.length * 100) : 0,
      lunas: isi.filter((b) => b.pajak === "Lunas").length, lat, lng,
    };
  });
}
let REKAP = []; // diisi saat web mulai (setelah data dimuat)

// =====================================================================
// 1. PINDAH HALAMAN
// =====================================================================
function bukaHalaman() {
  const nama = (location.hash || "#beranda").slice(1);
  document.querySelectorAll(".halaman").forEach((h) => h.classList.toggle("tampil", h.id === "hal-" + nama));
  document.querySelectorAll("nav a").forEach((a) => a.classList.toggle("aktif", a.getAttribute("href") === "#" + nama));
  $("menu").classList.remove("buka");
  window.scrollTo(0, 0);
  if (nama === "beranda") { siapkanPetaBeranda(); animasiAngka($("statistik")); }
  if (nama === "peta") { siapkanPeta(); setTimeout(() => peta.invalidateSize(), 50); }
  if (nama === "dashboard") { siapkanDashboard(); animasiAngka($("statistikDashboard")); }
  if (nama === "admin" && window.tampilkanAdmin) tampilkanAdmin();
}
window.addEventListener("hashchange", bukaHalaman);
$("menuToggle").onclick = () => $("menu").classList.toggle("buka");

// =====================================================================
// 2. BERANDA YANG INTERAKTIF
// =====================================================================

// Kartu angka. data-nilai = angka tujuan animasi
function kartuStatistik(wadah) {
  const total = BIDANG.length;
  const luasHa = BIDANG.reduce((s, b) => s + b.luas, 0) / 10000;
  const nop = BIDANG.filter((b) => b.nop).length;
  const lunas = BIDANG.filter((b) => b.pajak === "Lunas").length;
  const isi = [
    ["🧩", "Bidang tanah", total, "", "bidang terdaftar"],
    ["📐", "Total luas", luasHa, " ha", "hektare"],
    ["🔗", "Terhubung NOP", Math.round(nop / total * 100), "%", ribuan(nop) + " dari " + ribuan(total) + " bidang"],
    ["✅", "Pajak lunas", Math.round(lunas / nop * 100), "%", ribuan(lunas) + " dari " + ribuan(nop) + " NOP"],
  ];
  wadah.innerHTML = isi.map(([ikon, label, nilai, satuan, ket]) => `
    <div class="kartu angka">
      <span class="kartu-ikon">${ikon}</span>
      <div class="label">${label}</div>
      <div class="nilai"><span data-nilai="${nilai}" data-desimal="${nilai % 1 ? 1 : 0}">0</span>${satuan}</div>
      <div class="ket">${ket}</div>
    </div>`).join("");
}

// Animasi angka naik dari 0 ke nilai tujuan
function animasiAngka(wadah) {
  wadah.querySelectorAll("[data-nilai]").forEach((el) => {
    const tujuan = +el.dataset.nilai, desimal = +el.dataset.desimal, mulai = performance.now();
    const langkah = (t) => {
      const p = Math.min((t - mulai) / 1200, 1), mudah = 1 - Math.pow(1 - p, 3);
      el.textContent = (tujuan * mudah).toLocaleString("id-ID", { maximumFractionDigits: desimal, minimumFractionDigits: desimal });
      if (p < 1) requestAnimationFrame(langkah);
    };
    requestAnimationFrame(langkah);
  });
}

// Nama kecamatan di judul yang berganti-ganti
function kataBerganti() {
  let i = 0;
  setInterval(() => {
    const el = $("kataGanti");
    el.classList.add("keluar");
    setTimeout(() => {
      i = (i + 1) % WILAYAH.length;
      el.textContent = WILAYAH[i].kecamatan;
      el.classList.remove("keluar");
    }, 350);
  }, 2600);
}

// Peta mini: satu lingkaran per kecamatan
let petaBeranda = null;
function siapkanPetaBeranda() {
  if (petaBeranda) { setTimeout(() => petaBeranda.invalidateSize(), 50); return; }
  petaBeranda = L.map("petaBeranda", { scrollWheelZoom: false, zoomControl: true }).setView([3.20, 99.45], 10);
  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", { maxZoom: 20, maxNativeZoom: 16, attribution: "© Esri, HERE, Garmin" }).addTo(petaBeranda);
  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}", { maxZoom: 20, maxNativeZoom: 16 }).addTo(petaBeranda);
  const maks = Math.max(...REKAP.map((r) => r.bidang));
  const titik = REKAP.map((r) => {
    const c = L.circleMarker([r.lat, r.lng], {
      radius: 10 + (r.bidang / maks) * 16, color: "#fff", weight: 2,
      fillColor: "#0284C7", fillOpacity: .75,
    }).addTo(petaBeranda);
    c.bindTooltip(`<b>${r.kecamatan}</b><br>${r.bidang} bidang`, { direction: "top" });
    c.on("mouseover click", () => { tampilkanInfoKecamatan(r); titik.forEach((t) => t.setStyle({ fillColor: "#0284C7" })); c.setStyle({ fillColor: "#F2B705" }); });
    return c;
  });
  petaBeranda.fitBounds(titik.map((t) => t.getLatLng()), { padding: [30, 30] });
  tampilkanInfoKecamatan(REKAP[0]); titik[0].setStyle({ fillColor: "#F2B705" });
}

function tampilkanInfoKecamatan(r) {
  $("infoKecamatan").innerHTML = `
    <span class="hero-tag gelap">Kecamatan</span>
    <h2 class="besar">${r.kecamatan}</h2>
    <div class="info-baris"><span>Bidang tanah</span><b>${ribuan(r.bidang)}</b></div>
    <div class="info-baris"><span>Luas</span><b>${ribuan(Math.round(r.luas / 100) / 100)} ha</b></div>
    <div class="info-baris"><span>Desa/kelurahan (contoh)</span><b>${r.desa}</b></div>
    <div class="info-baris"><span>Terhubung NOP</span><b>${r.persenNop}%</b></div>
    <div class="bar-kecil"><div style="width:${r.persenNop}%"></div></div>
    <div class="info-baris"><span>Pajak lunas</span><b>${r.nop ? Math.round(r.lunas / r.nop * 100) : 0}%</b></div>
    <div class="bar-kecil emas"><div style="width:${r.nop ? r.lunas / r.nop * 100 : 0}%"></div></div>
    <a class="btn utama penuh" href="#peta" onclick="setTimeout(() => pilihKecamatanDiPeta('${r.kecamatan}'), 150)">Lihat ${r.kecamatan} di peta →</a>`;
}

// "Tahukah kamu?" yang berganti otomatis
const FAKTA = [
  "NIB (Nomor Identifikasi Bidang) adalah nomor unik 14 digit untuk setiap bidang tanah yang terdaftar di BPN.",
  "NOP (Nomor Objek Pajak) adalah nomor 18 digit untuk objek PBB, dikelola oleh pemerintah daerah.",
  "Menghubungkan NIB dengan NOP membantu memastikan setiap bidang tanah tercatat sebagai objek pajak.",
  "Kabupaten Batu Bara terletak di pesisir timur Sumatera Utara, berbatasan langsung dengan Selat Malaka.",
  "Kamu bisa mencetak info bidang ke PDF, lengkap dengan peta mini dan QR code lokasinya.",
];
function putarFakta() {
  let i = 0;
  $("faktaTitik").innerHTML = FAKTA.map((_, n) => `<button data-n="${n}" aria-label="Fakta ${n + 1}"></button>`).join("");
  const tampil = (n) => {
    i = n;
    $("faktaTeks").classList.add("keluar");
    setTimeout(() => { $("faktaTeks").textContent = FAKTA[i]; $("faktaTeks").classList.remove("keluar"); }, 250);
    $("faktaTitik").querySelectorAll("button").forEach((b, k) => b.classList.toggle("aktif", k === i));
  };
  $("faktaTitik").onclick = (e) => { if (e.target.dataset.n) tampil(+e.target.dataset.n); };
  tampil(0);
  setInterval(() => tampil((i + 1) % FAKTA.length), 6000);
}

// Kotak cari cepat di beranda -> pindah ke halaman Pencarian
$("formCariCepat").onsubmit = (e) => {
  e.preventDefault();
  $("jenisCari").value = $("jenisCepat").value;
  $("inputCari").value = $("inputCepat").value;
  $("cariKecamatan").value = ""; $("cariDesa").length = 1;
  location.hash = "#cari";
  setTimeout(cari, 50);
};

// =====================================================================
// 3. PETA INTERAKTIF
// =====================================================================
let peta = null, lapisanBidang = null, legenda = null;

function siapkanPeta() {
  if (peta) return;
  peta = L.map("map", { maxZoom: 20 }).setView([3.20, 99.45], 11);
  pasangPilihanPetaDasar();
  L.control.scale({ imperial: false }).addTo(peta);

  // ===== Fitur SINIBARA: koordinat kursor, klik kanan, tampilan awal =====
  const KotakKoordinat = L.Control.extend({
    options: { position: "bottomleft" },
    onAdd() {
      const div = L.DomUtil.create("div", "kotak-koordinat");
      div.id = "koordinatKursor";
      div.textContent = "Lat: - | Lng: -";
      return div;
    },
  });
  new KotakKoordinat().addTo(peta);
  peta.on("mousemove", (e) => {
    $("koordinatKursor").textContent = `Lat: ${e.latlng.lat.toFixed(6)} | Lng: ${e.latlng.lng.toFixed(6)}`;
  });
  peta.on("contextmenu", (e) => {
    L.popup().setLatLng(e.latlng)
      .setContent(`<b>Koordinat titik</b><br>Lintang: ${e.latlng.lat.toFixed(6)}<br>Bujur: ${e.latlng.lng.toFixed(6)}`)
      .openOn(peta);
  });
  $("btnAwal").onclick = () => keTampilanAwal();
  // ===== Akhir fitur SINIBARA =====

  WILAYAH.forEach((k) => $("filterKecamatan").add(new Option(k.kecamatan, k.kecamatan)));
  $("filterKecamatan").onchange = gambarBidang;
  $("modeWarna").onchange = gambarBidang;

  $("btnLokasi").onclick = () => peta.locate({ setView: true, maxZoom: 17, enableHighAccuracy: true });
  peta.on("locationfound", (e) => L.circleMarker(e.latlng, { radius: 8, color: "#2BA3C9", fillOpacity: .8 }).addTo(peta).bindPopup("Lokasi Anda").openPopup());
  peta.on("locationerror", () => alert("Lokasi tidak bisa diambil. Pastikan izin lokasi di browser sudah aktif."));
  peta.on("zoomend", aturLabelNib);
  gambarBidang();
  keTampilanAwal();
}

// Tampilan awal = seluruh bidang terlihat (otomatis mengikuti data SHP)
function keTampilanAwal() {
  const semua = BIDANG.flatMap((b) => b.koordinat || []);
  if (semua.length) peta.fitBounds(L.latLngBounds(semua), { padding: [30, 30] });
  else peta.setView([3.20, 99.45], 11);
}

// =====================================================================
// PILIHAN PETA DASAR (panel dengan gambar kecil + pengatur transparansi)
// maxNativeZoom = zoom paling dekat yang gambarnya tersedia dari server.
// Kalau di-zoom lebih dekat, gambar yang ada diperbesar (tidak kosong).
// Semua sumber di bawah ini gratis dipakai dengan mencantumkan atribusi.
// =====================================================================
const ESRI = (layanan) => `https://server.arcgisonline.com/ArcGIS/rest/services/${layanan}/MapServer/tile/{z}/{y}/{x}`;
// Catatan: server OpenStreetMap dan CARTO menolak permintaan dari file yang dibuka langsung
// di komputer (alamat file:///...), jadi di sini dipakai sumber yang tetap jalan tanpa kunci API.
const PETA_DASAR = [
  { id: "jalan", nama: "Peta Jalan", url: ESRI("World_Street_Map"), native: 17, atribusi: "© Esri, HERE, Garmin, © OpenStreetMap" },
  { id: "satelit", nama: "Citra Satelit", url: ESRI("World_Imagery"), native: 17, atribusi: "© Esri, Maxar, Earthstar Geographics" },
  { id: "hibrida", nama: "Satelit + Label", url: ESRI("World_Imagery"), native: 17, atribusi: "© Esri, Maxar, Earthstar Geographics",
    label: [ESRI("Reference/World_Boundaries_and_Places"), ESRI("Reference/World_Transportation")] },
  { id: "topo", nama: "Topografi", url: ESRI("World_Topo_Map"), native: 17, atribusi: "© Esri, HERE, Garmin, USGS" },
  { id: "opentopo", nama: "OpenTopoMap", url: "https://a.tile.opentopomap.org/{z}/{x}/{y}.png", native: 17, atribusi: "© OpenStreetMap, SRTM | © OpenTopoMap (CC-BY-SA)" },
  { id: "terang", nama: "Abu-abu Terang", url: ESRI("Canvas/World_Light_Gray_Base"), native: 16, atribusi: "© Esri, HERE, Garmin",
    label: [ESRI("Canvas/World_Light_Gray_Reference")] },
  { id: "gelap", nama: "Abu-abu Gelap", url: ESRI("Canvas/World_Dark_Gray_Base"), native: 16, atribusi: "© Esri, HERE, Garmin",
    label: [ESRI("Canvas/World_Dark_Gray_Reference")] },
  { id: "polos", nama: "Tanpa Peta Dasar", url: null },
];
let lapisanDasar = [], dasarAktif = null, opasitasDasar = 1, opasitasBidang = 1, bidangTampil = true;

// Gambar kecil: satu kotak peta dari daerah Lima Puluh, zoom 13
function urlContoh(pd) {
  if (!pd.url) return "";
  const z = 13, lat = 3.169, lng = 99.415, n = 2 ** z;
  const x = Math.floor((lng + 180) / 360 * n);
  const y = Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * n);
  return pd.url.replace("{z}", z).replace("{x}", x).replace("{y}", y);
}

function pilihPetaDasar(id) {
  const pd = PETA_DASAR.find((p) => p.id === id) || PETA_DASAR[0];
  lapisanDasar.forEach((l) => l.remove());
  lapisanDasar = [];
  const opsi = (atribusi) => ({ maxZoom: 20, maxNativeZoom: pd.native, attribution: atribusi, opacity: opasitasDasar });
  if (pd.url) lapisanDasar.push(L.tileLayer(pd.url, opsi(pd.atribusi)));
  (pd.label || []).forEach((u) => lapisanDasar.push(L.tileLayer(u, opsi(""))));
  lapisanDasar.forEach((l) => l.addTo(peta).bringToBack());
  dasarAktif = pd.id;
  $("map").classList.toggle("tanpa-dasar", !pd.url);
  localStorage.setItem("sinibara-peta-dasar", pd.id);
  document.querySelectorAll(".pd-pilihan").forEach((b) => b.classList.toggle("aktif", b.dataset.id === pd.id));
  $("tombolPetaDasar").querySelector("img").src = urlContoh(pd) || "images/logo.svg";
}

function pasangPilihanPetaDasar() {
  // Tombol di pojok kanan atas peta
  const Tombol = L.Control.extend({
    options: { position: "topright" },
    onAdd() {
      const div = L.DomUtil.create("div", "pd-tombol");
      div.id = "tombolPetaDasar";
      div.innerHTML = `<img alt=""><span>Peta dasar</span>`;
      div.title = "Pilih peta dasar & lapisan";
      L.DomEvent.disableClickPropagation(div);
      div.onclick = () => $("panelPeta").classList.toggle("buka");
      return div;
    },
  });
  new Tombol().addTo(peta);

  // Panel pengaturan (di dalam kotak peta)
  const panel = L.DomUtil.create("div", "pd-panel", $("map"));
  panel.id = "panelPeta";
  panel.innerHTML = `
    <div class="pd-kepala"><b>Pengaturan Peta</b><button class="pd-tutup" aria-label="Tutup">✕</button></div>
    <div class="pd-judul">PETA DASAR</div>
    <div class="pd-grid">${PETA_DASAR.map((p) => `
      <button class="pd-pilihan" data-id="${p.id}">
        ${p.url ? `<img src="${urlContoh(p)}" alt="" loading="lazy">` : `<span class="pd-polos">∅</span>`}
        ${p.label ? `<img class="pd-label" src="${urlContoh({ url: p.label[0] })}" alt="">` : ""}
        <span>${p.nama}</span>
      </button>`).join("")}</div>
    <label class="pd-geser">Transparansi peta dasar <b id="nilaiDasar">100%</b>
      <input type="range" id="geserDasar" min="0" max="100" value="100"></label>
    <div class="pd-judul">LAPISAN DATA</div>
    <label class="pd-centang"><input type="checkbox" id="centangBidang" checked> Bidang tanah SINIBARA</label>
    <label class="pd-geser">Transparansi bidang tanah <b id="nilaiBidang">100%</b>
      <input type="range" id="geserBidang" min="0" max="100" value="100"></label>`;
  L.DomEvent.disableClickPropagation(panel);
  L.DomEvent.disableScrollPropagation(panel);
  panel.querySelector(".pd-tutup").onclick = () => panel.classList.remove("buka");
  panel.querySelectorAll(".pd-pilihan").forEach((b) => (b.onclick = () => pilihPetaDasar(b.dataset.id)));
  $("geserDasar").oninput = (e) => {
    opasitasDasar = e.target.value / 100;
    $("nilaiDasar").textContent = e.target.value + "%";
    lapisanDasar.forEach((l) => l.setOpacity(opasitasDasar));
  };
  $("geserBidang").oninput = (e) => {
    opasitasBidang = e.target.value / 100;
    $("nilaiBidang").textContent = e.target.value + "%";
    aturGayaBidang();
  };
  $("centangBidang").onchange = (e) => { bidangTampil = e.target.checked; gambarBidang(); };

  pilihPetaDasar(localStorage.getItem("sinibara-peta-dasar") || "jalan"); // pilihan lama yang sudah dihapus otomatis kembali ke "Peta Jalan"
}

// Ketebalan & transparansi bidang mengikuti pengaturan
function gayaBidang(warna, sorot) {
  return { color: warna, fillColor: warna, weight: sorot ? 3 : 1.5,
    opacity: opasitasBidang, fillOpacity: (sorot ? .8 : .5) * opasitasBidang };
}
function aturGayaBidang() {
  if (lapisanBidang) lapisanBidang.eachLayer((l) => l.setStyle(gayaBidang(l.options.color, false)));
}

function pilihKecamatanDiPeta(kec) {
  siapkanPeta();
  $("filterKecamatan").value = kec;
  gambarBidang();
}

function gambarBidang() {
  if (lapisanBidang) lapisanBidang.remove();
  const mode = $("modeWarna").value, kec = $("filterKecamatan").value, warna = WARNA[mode];
  const tampil = BIDANG.filter((b) => !kec || b.kecamatan === kec);

  lapisanBidang = L.featureGroup();
  tampil.forEach((b) => {
    const c = warna[kategori(b, mode)];
    L.polygon(b.koordinat, gayaBidang(c, false))
      .bindPopup(isiPopup(b))
      .bindTooltip(b.nib, { permanent: true, direction: "center", className: "label-nib" })
      .on("mouseover", function () { this.setStyle(gayaBidang(c, true)); })
      .on("mouseout", function () { this.setStyle(gayaBidang(c, false)); })
      .addTo(lapisanBidang);
  });
  if (bidangTampil) lapisanBidang.addTo(peta);
  aturLabelNib();
  if (kec && tampil.length) peta.fitBounds(lapisanBidang.getBounds(), { padding: [30, 30] });

  // Legenda dengan jumlah bidang per warna
  if (legenda) legenda.remove();
  legenda = L.control({ position: "bottomright" });
  legenda.onAdd = () => {
    const div = L.DomUtil.create("div", "legenda");
    div.innerHTML = `<b>${JUDUL_MODE[mode]}</b><br>` + Object.entries(warna).map(([n, c]) =>
      `<span class="titik" style="background:${c}"></span>${n} <span class="jml">(${tampil.filter((b) => kategori(b, mode) === n).length})</span>`).join("<br>");
    return div;
  };
  legenda.addTo(peta);
}

// Label NIB hanya tampil kalau peta sudah di-zoom dekat
function aturLabelNib() { $("map").classList.toggle("sembunyi-label", peta.getZoom() < 17); }

function isiPopup(b) {
  const [lat, lng] = titikTengah(b);
  return `<div class="popup-bidang"><b>Bidang NIB ${b.nib}</b><table>
    <tr><td>NOP</td><td>${teksNop(b)}</td></tr>
    <tr><td>Hak</td><td>${b.hak}</td></tr>
    <tr><td>Penggunaan</td><td>${b.penggunaan}</td></tr>
    <tr><td>Luas</td><td>${ribuan(b.luas)} m²</td></tr>
    <tr><td>Lokasi</td><td>${b.desa}, ${b.kecamatan}</td></tr>
    <tr><td>Pajak ${b.tahunPajak}</td><td><span class="lencana ${kelasPajak(b.pajak)}">${b.pajak}</span></td></tr>
  </table>
  <div class="popup-tombol">
    <a class="btn kecil utama" href="${linkBhumi(lat, lng)}" target="_blank" rel="noopener">BHUMI ↗</a>
    <a class="btn kecil" href="${linkGoogleMaps(lat, lng)}" target="_blank" rel="noopener">Google Maps ↗</a>
    <button class="btn kecil" onclick="cetakBidang('${b.nib}')">🖨️ Cetak</button>
  </div></div>`;
}

function lihatDiPeta(lat, lng, zoom) {
  location.hash = "#peta";
  setTimeout(() => peta.setView([lat, lng], zoom || 17), 120);
}
function lihatBidang(nib) {
  const b = BIDANG.find((x) => x.nib === nib);
  location.hash = "#peta";
  setTimeout(() => {
    peta.fitBounds(b.koordinat, { maxZoom: 18 });
    L.popup().setLatLng(b.koordinat[2]).setContent(isiPopup(b)).openOn(peta);
  }, 120);
}

// =====================================================================
// 4. DASHBOARD GRAFIK
// =====================================================================
let dashboardSiap = false;
function siapkanDashboard() {
  if (dashboardSiap) return;
  dashboardSiap = true;
  kartuStatistik($("statistikDashboard"));
  Chart.defaults.font.family = "'Segoe UI', Roboto, Arial, sans-serif";
  Chart.defaults.color = "#5E6B63";
  const nama = REKAP.map((r) => r.kecamatan);
  const tanpaLegenda = { plugins: { legend: { display: false } }, maintainAspectRatio: false };

  new Chart($("grafikJumlah"), {
    type: "bar",
    data: { labels: nama, datasets: [
      { label: "Terhubung NOP", data: REKAP.map((r) => r.nop), backgroundColor: "#1E8E4E", borderRadius: 4 },
      { label: "Belum terhubung NOP", data: REKAP.map((r) => r.bidang - r.nop), backgroundColor: "#D64545", borderRadius: 4 },
    ] },
    options: { maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }, plugins: { legend: { position: "bottom" } } },
  });
  new Chart($("grafikPersen"), {
    type: "bar",
    data: { labels: nama, datasets: [{ data: REKAP.map((r) => r.persenNop), backgroundColor: REKAP.map((r) => r.persenNop >= 85 ? "#1E8E4E" : r.persenNop >= 70 ? "#F2B705" : "#D64545"), borderRadius: 4 }] },
    options: { ...tanpaLegenda, indexAxis: "y", scales: { x: { min: 0, max: 100, ticks: { callback: (v) => v + "%" } } } },
  });
  new Chart($("grafikLuas"), {
    type: "bar",
    data: { labels: nama, datasets: [{ data: REKAP.map((r) => Math.round(r.luas / 100) / 100), backgroundColor: "#2BA3C9", borderRadius: 4 }] },
    options: { ...tanpaLegenda, indexAxis: "y" },
  });
  const donat = (id, mode) => {
    const kat = Object.keys(WARNA[mode]);
    new Chart($(id), {
      type: "doughnut",
      data: { labels: kat, datasets: [{ data: kat.map((k) => BIDANG.filter((b) => kategori(b, mode) === k).length), backgroundColor: kat.map((k) => WARNA[mode][k]), borderWidth: 2 }] },
      options: { maintainAspectRatio: false, cutout: "60%", plugins: { legend: { position: "right" } } },
    });
  };
  donat("grafikHak", "hak");
  donat("grafikGuna", "penggunaan");

  // Tabel rekap
  const total = REKAP.reduce((t, r) => ({ bidang: t.bidang + r.bidang, luas: t.luas + r.luas, nop: t.nop + r.nop, lunas: t.lunas + r.lunas, desa: t.desa + r.desa }), { bidang: 0, luas: 0, nop: 0, lunas: 0, desa: 0 });
  const baris = (r, tebal) => `<tr class="${tebal ? "total" : ""}"><td>${r.kecamatan}</td><td>${r.desa}</td><td>${ribuan(r.bidang)}</td>
    <td>${ribuan(Math.round(r.luas / 100) / 100)}</td><td>${ribuan(r.nop)}</td>
    <td><div class="bar-sel"><div style="width:${Math.round(r.nop / r.bidang * 100)}%"></div><span>${Math.round(r.nop / r.bidang * 100)}%</span></div></td>
    <td>${r.nop ? Math.round(r.lunas / r.nop * 100) : 0}%</td></tr>`;
  $("tabelRekap").innerHTML = `<thead><tr><th>Kecamatan</th><th>Desa/Kel.</th><th>Bidang</th><th>Luas (ha)</th><th>Punya NOP</th><th>% Terhubung</th><th>% Lunas</th></tr></thead>
    <tbody>${REKAP.map((r) => baris(r)).join("")}${baris({ kecamatan: "Total", ...total }, true)}</tbody>`;
}

// =====================================================================
// 5. DATA WILAYAH
// =====================================================================
function isiWilayah() {
  $("daftarWilayah").innerHTML = WILAYAH.map((k) => {
    const n = BIDANG.filter((b) => b.kecamatan === k.kecamatan).length;
    return `<div class="kartu"><h2>Kec. ${k.kecamatan}</h2><div class="ket">${n} bidang · ${k.desa.length} desa/kel. (contoh)</div><ul>` +
      k.desa.map((d) => `<li><a onclick="lihatDiPeta(${d.lat}, ${d.lng}, 16)">${d.nama}</a>
        <span class="jenis">${d.jenis} · ${BIDANG.filter((b) => b.desa === d.nama).length} bidang</span></li>`).join("") + `</ul></div>`;
  }).join("");
}

// =====================================================================
// 6. PENCARIAN NIB / NOP
// =====================================================================
function siapkanFormCari() {
  WILAYAH.forEach((k) => $("cariKecamatan").add(new Option(k.kecamatan, k.kecamatan)));
  $("cariKecamatan").onchange = () => {
    $("cariDesa").length = 1;
    const k = WILAYAH.find((x) => x.kecamatan === $("cariKecamatan").value);
    if (k) k.desa.forEach((d) => $("cariDesa").add(new Option(d.nama, d.nama)));
  };
  $("jenisCari").onchange = (e) => ($("inputCari").placeholder = e.target.value === "nib" ? "Masukkan NIB…" : "Masukkan NOP…");
  $("formCari").onsubmit = (e) => { e.preventDefault(); cari(); };
}

function cari() {
  const jenis = $("jenisCari").value, q = angkaSaja($("inputCari").value);
  const kec = $("cariKecamatan").value, desa = $("cariDesa").value, kotak = $("hasilCari");

  if (q.length > 0 && q.length < 4) { kotak.innerHTML = `<p class="sub">Ketik minimal 4 angka.</p>`; return; }
  if (!q && !kec) { kotak.innerHTML = `<p class="sub">Masukkan nomor, atau pilih kecamatan terlebih dahulu.</p>`; return; }

  const semua = BIDANG.filter((b) =>
    (!kec || b.kecamatan === kec) && (!desa || b.desa === desa) &&
    (!q || angkaSaja(jenis === "nib" ? b.nib : b.nop).includes(q)));
  const hasil = semua.slice(0, 30);

  if (!hasil.length) { kotak.innerHTML = `<p class="sub">Data tidak ditemukan. Periksa kembali nomor yang dimasukkan.</p>`; return; }
  kotak.innerHTML = `<p class="sub">Ditemukan ${semua.length} bidang${semua.length > 30 ? " (ditampilkan 30 pertama)" : ""}.</p>` + hasil.map((b) => {
    const [lat, lng] = titikTengah(b);
    return `
    <div class="hasil">
      <h3>NIB ${b.nib}</h3>
      <dl>
        <dt>NOP</dt><dd>${teksNop(b)}</dd>
        <dt>Jenis hak</dt><dd>${b.hak}</dd>
        <dt>Penggunaan</dt><dd>${b.penggunaan}</dd>
        <dt>Luas</dt><dd>${ribuan(b.luas)} m²</dd>
        <dt>Lokasi</dt><dd>${b.desa}, Kec. ${b.kecamatan}</dd>
        <dt>NJOP bumi</dt><dd>${b.njop ? rupiah(b.njop) + " /m²" : "-"}</dd>
        <dt>Pajak ${b.tahunPajak}</dt><dd><span class="lencana ${kelasPajak(b.pajak)}">${b.pajak}</span></dd>
      </dl>
      <button class="btn utama kecil" onclick="lihatBidang('${b.nib}')">🗺️ Lihat di peta</button>
      <button class="btn kecil" onclick="cetakBidang('${b.nib}')">🖨️ Cetak PDF</button>
      <a class="btn kecil" href="${linkBhumi(lat, lng)}" target="_blank" rel="noopener">Lihat bidang di BHUMI ATR/BPN ↗</a>
      <a class="btn kecil" href="${linkGoogleMaps(lat, lng)}" target="_blank" rel="noopener">Google Maps ↗</a>
      <p class="ket-bhumi">BHUMI akan terbuka di lokasi bidang ini. Aktifkan layer "Bidang Tanah" di BHUMI untuk melihat bentuk bidangnya.</p>
    </div>`;
  }).join("");
}

function isiContohCari() {
  const a = BIDANG[0], b = BIDANG.find((x, i) => i > 25 && x.nop);
  const tautan = (id, jenis, nilai) => {
    const el = $(id);
    el.textContent = (jenis === "nib" ? "NIB " : "NOP ") + nilai;
    el.onclick = (e) => {
      e.preventDefault();
      $("jenisCari").value = jenis;
      $("cariKecamatan").value = ""; $("cariDesa").length = 1; // hapus filter wilayah
      $("inputCari").value = nilai;
      cari();
    };
  };
  tautan("contohNib", "nib", a.nib); tautan("contohNop", "nop", b.nop);
}

// =====================================================================
// 7. CETAK INFO BIDANG KE PDF
//    Membuat lembar A4 berisi peta mini, data bidang, dan QR code,
//    lalu membuka jendela cetak. Pilih "Simpan sebagai PDF" di sana.
// =====================================================================
let petaCetak = null;
function cetakBidang(nib) {
  const b = BIDANG.find((x) => x.nib === nib);
  const [lat, lng] = titikTengah(b);
  const urlLokasi = linkGoogleMaps(lat, lng);

  // QR code berisi link lokasi bidang di Google Maps
  const qr = qrcode(0, "M");
  qr.addData(urlLokasi);
  qr.make();

  const tgl = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  $("lembarCetak").innerHTML = `
    <div class="cetak-kop">
      <img src="images/logo.svg" alt="">
      <div><b>SINIBARA</b><br><span>Sistem Informasi NIB, Pajak, dan Pertanahan Batu Bara</span></div>
    </div>
    <h1>Informasi Bidang Tanah</h1>
    <div class="cetak-nib">NIB ${b.nib}</div>
    <div id="petaCetak"></div>
    <div class="cetak-bawah">
      <table>
        <tr><td>NIB</td><td>${b.nib}</td></tr>
        <tr><td>NOP</td><td>${teksNop(b)}</td></tr>
        <tr><td>Jenis hak</td><td>${b.hak}</td></tr>
        <tr><td>Penggunaan</td><td>${b.penggunaan}</td></tr>
        <tr><td>Luas</td><td>${ribuan(b.luas)} m²</td></tr>
        <tr><td>Desa/Kelurahan</td><td>${b.desa}</td></tr>
        <tr><td>Kecamatan</td><td>${b.kecamatan}</td></tr>
        <tr><td>Status pajak ${b.tahunPajak}</td><td>${b.pajak}</td></tr>
        <tr><td>Koordinat</td><td>${lat.toFixed(6)}, ${lng.toFixed(6)}</td></tr>
      </table>
      <div class="cetak-qr">${qr.createSvgTag({ cellSize: 4, margin: 2 })}<span>Pindai untuk membuka lokasi bidang</span></div>
    </div>
    <p class="cetak-catatan">Dicetak dari SINIBARA pada ${tgl}. Dokumen ini hanya informasi, bukan bukti kepemilikan hak atas tanah.
      Nama pemegang hak dan NIK tidak ditampilkan. Data contoh, bukan data asli.</p>`;

  // Peta mini dengan bentuk bidang
  if (petaCetak) petaCetak.remove();
  petaCetak = L.map("petaCetak", { zoomControl: false, attributionControl: false });
  const dasar = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 20, maxNativeZoom: 17 }).addTo(petaCetak);
  // bidang tetangga (tipis) + bidang yang dicetak (tebal kuning)
  BIDANG.filter((x) => x.desa === b.desa && x.nib !== b.nib).forEach((x) =>
    L.polygon(x.koordinat, { color: "#fff", weight: 1, fillOpacity: 0 }).addTo(petaCetak));
  const poli = L.polygon(b.koordinat, { color: "#F2B705", weight: 4, fillColor: "#F2B705", fillOpacity: .25 }).addTo(petaCetak);
  L.control.scale({ imperial: false }).addTo(petaCetak);
  petaCetak.fitBounds(poli.getBounds(), { padding: [60, 60], maxZoom: 18 });

  // Tunggu gambar peta selesai dimuat (maks. 4 detik), baru buka jendela cetak
  document.body.classList.add("mode-cetak");
  let sudah = false;
  const cetak = () => { if (sudah) return; sudah = true; setTimeout(() => window.print(), 300); };
  dasar.on("load", cetak);
  setTimeout(cetak, 4000);
}
window.addEventListener("afterprint", () => document.body.classList.remove("mode-cetak"));

// =====================================================================
// MULAI
// =====================================================================
async function mulai() {
  await muatData();            // ambil data dari database (atau pakai data contoh)
  REKAP = rekapKecamatan();
  $("bannerContoh").hidden = !DATA.pakaiContoh;
  kartuStatistik($("statistik"));
  kataBerganti();
  putarFakta();
  isiWilayah();
  siapkanFormCari();
  isiContohCari();
  if (window.mulaiAdmin) await mulaiAdmin();
  bukaHalaman();
}
// Tunggu semua file script selesai dimuat, baru mulai
document.addEventListener("DOMContentLoaded", mulai);