// =====================================================
// SIPETA - Peta Interaktif (Leaflet)
// =====================================================

// ---------- 1. PENGATURAN AWAL ----------
// Ganti angka ini agar peta langsung terbuka di wilayah Anda.
// Format: [lintang, bujur], lalu tingkat zoom
// (5 = Indonesia, 13 = kecamatan, 16 = kelurahan)
const PUSAT_AWAL = [-2.5, 118];
const ZOOM_AWAL = 5;

// ---------- 2. MEMBUAT PETA ----------
const map = L.map('map', {
  center: PUSAT_AWAL,
  zoom: ZOOM_AWAL,
  zoomControl: true
});

// ---------- 3. BASEMAP ----------
const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
});

const satelit = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  {
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri'
  }
);

const labelSatelit = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
  {
    maxZoom: 19,
    attribution: 'Label &copy; Esri'
  }
);

const topografi = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
  maxZoom: 17,
  attribution: '&copy; OpenStreetMap contributors, &copy; OpenTopoMap'
});

// Basemap yang tampil pertama kali
osm.addTo(map);

// ---------- 4. KONTROL PILIHAN LAYER ----------
const baseMaps = {
  'Peta Jalan (OSM)': osm,
  'Citra Satelit (Esri)': satelit,
  'Satelit + Nama Tempat': L.layerGroup([satelit, labelSatelit]),
  'Topografi': topografi
};

// Wadah layer tambahan (nanti diisi data shapefile/GeoJSON)
const overlayMaps = {};

const layerControl = L.control.layers(baseMaps, overlayMaps, {
  collapsed: true,
  position: 'topright'
}).addTo(map);

// ---------- 5. SKALA ----------
L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

// ---------- 6. KOORDINAT KURSOR ----------
const kotakKoordinat = document.getElementById('koordinat');

map.on('mousemove', function (e) {
  kotakKoordinat.textContent =
    'Lat: ' + e.latlng.lat.toFixed(6) + ' | Lng: ' + e.latlng.lng.toFixed(6);
});

// ---------- 7. KLIK PETA = TAMPILKAN KOORDINAT ----------
map.on('click', function (e) {
  L.popup()
    .setLatLng(e.latlng)
    .setContent(
      '<b>Koordinat titik</b><br>' +
      'Lintang: ' + e.latlng.lat.toFixed(6) + '<br>' +
      'Bujur: ' + e.latlng.lng.toFixed(6)
    )
    .openOn(map);
});

// ---------- 8. TOMBOL LOKASI SAYA ----------
let penandaLokasi = null;
let lingkaranAkurasi = null;

document.getElementById('tombol-lokasi').addEventListener('click', function () {
  map.locate({ setView: true, maxZoom: 17 });
});

map.on('locationfound', function (e) {
  if (penandaLokasi) map.removeLayer(penandaLokasi);
  if (lingkaranAkurasi) map.removeLayer(lingkaranAkurasi);

  lingkaranAkurasi = L.circle(e.latlng, {
    radius: e.accuracy,
    color: '#235c42',
    fillOpacity: 0.15
  }).addTo(map);

  penandaLokasi = L.marker(e.latlng)
    .addTo(map)
    .bindPopup('<b>Lokasi Anda</b><br>Akurasi ± ' + Math.round(e.accuracy) + ' m')
    .openPopup();
});

map.on('locationerror', function () {
  alert('Lokasi tidak bisa diakses. Izinkan akses lokasi di browser Anda.');
});

// ---------- 9. TOMBOL TAMPILAN AWAL ----------
document.getElementById('tombol-reset').addEventListener('click', function () {
  map.setView(PUSAT_AWAL, ZOOM_AWAL);
});

// ---------- 10. TEMPAT DATA SHAPEFILE (NANTI) ----------
// Saat shapefile sudah ada: ekspor dari QGIS ke GeoJSON (EPSG:4326),
// simpan di folder data/, lalu hapus tanda // pada kode di bawah.
//
// fetch('data/bidang_tanah.geojson')
//   .then(res => res.json())
//   .then(data => {
//     const layerBidang = L.geoJSON(data, {
//       style: { color: '#ffffff', weight: 1, fillColor: '#2e7d32', fillOpacity: 0.6 },
//       onEachFeature: (feature, layer) => {
//         const p = feature.properties;
//         layer.bindPopup('<b>Bidang Tanah</b><br>' +
//           Object.keys(p).map(k => k + ': ' + p[k]).join('<br>'));
//       }
//     }).addTo(map);
//     map.fitBounds(layerBidang.getBounds());
//     layerControl.addOverlay(layerBidang, 'Bidang Tanah');
//   })
//   .catch(err => console.error('Gagal memuat data:', err));