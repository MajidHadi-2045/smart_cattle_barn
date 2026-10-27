# Direktori Dokumentasi Hasil Pengujian & Eksperimen Skripsi

Folder ini adalah **pusat penyimpanan tunggal yang rapi** untuk seluruh data hasil pengujian, eksperimen, dan visualisasi performa sistem *Smart Cattle Barn*.

---

## 📌 Dokumen Utama:
* **[MASTER_DOKUMENTASI_HASIL_EKSPERIMEN.md](file:///c:/Users/majid/Downloads/Documents/smart%20cattle%20barn/smart_cattle_barn_v1/DOKUMENTASI_HASIL_EKSPERIMEN/MASTER_DOKUMENTASI_HASIL_EKSPERIMEN.md)**  
  *(Dokumen master lengkap berisi seluruh tabel angka, metodologi, analisis ilmiah, panduan sidang, dan indeks file mentah).*

---

## 📊 Ringkasan Isi Pengujian yang Terdokumentasi:

1. **Pengujian Baseline Bab 4 (Laptop $\to$ Internet $\to$ VPS)**:
   - Data kinerja Jalur 1 (BullMQ) & Jalur 2 (In-Memory) pada 10, 50, dan 100 VU.
   - Kurva latensi terverifikasi menurun konsisten.
2. **Eksperimen 1: Pengujian Pacing & Matriks 7×7**:
   - Membuktikan penurunan latensi dipicu oleh *throughput (laju pesan)*, bukan jumlah koneksi VU.
3. **Eksperimen 2: Pengujian TCP Delayed ACK Klien Windows**:
   - Membuktikan bahwa fitur Delayed ACK Windows hanya menyumbang -4.33 ms (bukan faktor utama).
4. **Eksperimen 3: Pengujian Distribusi Penerima ACK (1 vs 5 Subscriber)**:
   - Membuktikan bahwa pemecahan koneksi subscriber menghilangkan selisih latensi (dari 26 ms menyusut ke 4.35 ms).
5. **Investigasi Eliminasi Komputasi Internal Backend**:
   - Membuktikan komputasi internal server hanya 6–12 ms dan naik seiring beban (+5.95 ms), mengeliminasi backend dari penyebab anomali.
6. **Pengujian Kontrol Lokal VPS (127.0.0.1)**:
   - Membuktikan pada kondisi tanpa internet, latensi murni mematuhi *Queueing Theory* (9.7 ms $\to$ 16.7 ms $\to$ 21.3 ms).
7. **Pengujian Isolasi Pure Echo Broker (6 Iterasi Penuh - Backend Mati)**:
   - Pengujian murni transport layer dengan backend mati total, membuktikan batas dasar internet stabil di ~180 ms (Median P50) dan jitter turun 58.7% pada 100 VU.
8. **Protokol Validasi TCP Congestion Window (CWND)**:
   - Panduan pengujian otomatis untuk memvalidasi `cwnd` kernel Linux VPS.
9. **Panduan Menjawab Pertanyaan Dosen Penguji (FAQ Sidang)**:
   - Kumpulan argumen ilmiah teruji untuk menghadapi pertanyaan kritis dewan penguji.

---

## 🖼️ Direktori Grafik & Data:
* **Folder Gambar Grafik (16 Gambar PNG 300 DPI):** [smartbarn-backend/scratch/charts/](file:///c:/Users/majid/Downloads/Documents/smart%20cattle%20barn/smart_cattle_barn_v1/smartbarn-backend/scratch/charts/)
* **Data Mentah JSON:** [smartbarn-backend/scratch/](file:///c:/Users/majid/Downloads/Documents/smart%20cattle%20barn/smart_cattle_barn_v1/smartbarn-backend/scratch/)
