## prisma
#npx prisma generate
#npx prisma db push

## Restart Server
#Tekan Ctrl + Shift + P pada keyboard.
#Ketik: Restart TS Server.
#Pilih opsi: TypeScript: Restart TS Server

## Description
[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov

## Deployment
$ npm install -g @nestjs/mau
$ mau deploy

# Backend NestJS/Database
#Masuk ke folder Backend
$ cd ~/smart_cattle_barn/smartbarn-backend
#Menarik Update (kalau ada yg Baru) dari GitHub
$ git pull
#jika ada permbaruan yang mengaharuskan npm install
$ npm install
#Memperbarui Tipe Database (Wajib jika mengubah file schema.prisma)
$ npx prisma generate
#Build/Compile Ulang Backend
$ npm run build
#Membangunkan / Menyalakan Backend
$ pm2 start smartbarn-api-4000
# 1. Simpan daftar proses aktif ke harddisk VPS
pm2 save
# 2. Daftarkan PM2 ke systemd Linux agar otomatis hidup saat VPS reboot
pm2 startup
#Menidurkan / Mematikan Backend
$ pm2 stop smartbarn-api-4000
#Restart Backend (Wajib dilakukan setiap habis npm run build)
$ pm2 restart smartbarn-api-4000
#Cek Status RAM & Aplikasi Backend
$ pm2 status
#Lihat Error / Log Terminal Backend (Real-time)
$ pm2 logs smartbarn-api-4000
#Batasi RAM
$ pm2 start smartbarn-api-4000 --max-memory-restart 200M
$ pm2 restart smartbarn-api-4000 --max-memory-restart 200M
# 1-Line Super Fast Auto Deploy Backend (Jalankan ini di VPS untuk Update Otomatis 10 Detik)
$ git fetch origin && git reset --hard origin/main && npm run build && pm2 restart smartbarn-api-4000

## PENGUJIAN OTOMATIS (BENCHMARK SUITE)
# Jalankan dari Laptop via Internet (72 Sesi Uji Otomatis + Pre/Post Network Test + CPU/RAM Polling):
$ npm run test:auto:remote
# Jalankan langsung di Server VPS Lokal:
$ npm run test:auto:local
# Bersihkan seluruh log pengujian:
$ npm run test:clean
# (Panduan lengkap lihat file K6_TESTING_GUIDE.md)

## FRONTEND (Vite / Website UI)
#Masuk ke folder Frontend
$ cd ~/smart_cattle_barn/smartbarn-frontend
#Menarik Update (kalau ada yg Baru) dari GitHub
$ git pull
#jika ada permbaruan yang mengaharuskan npm install
$ npm install
#Build/Compile Ulang Desain Web
$ rm -rf dist
$ npm run build
#Menerapkan Pembaruan ke Internet (Memindahkan ke Nginx)
$ sudo cp -r dist/* /var/www/smartcattlebarn.site/html/
# Restrat ngnix
$ sudo systemctl restart nginx
# 1 line
$ git pull && rm -rf dist && npm run build && sudo cp -r dist/* /var/www/smartcattlebarn.site/html/ && sudo systemctl restart nginx
# 1-Line Super Fast Auto Deploy (Jalankan ini di VPS untuk Update Otomatis 10 Detik)
$ git fetch origin && git reset --hard origin/main && npm run build && sudo cp -r dist/* /var/www/smartcattlebarn.site/html/ && sudo systemctl restart nginx

# (Opsional) 3. Bersihkan file-file sementara/sampah yang tidak ada di GitHub
$ git clean -fd

##Apk (File APK)
#Cara Mengunggah APK Baru ke Server (Jalankan di CMD Laptop, BUKAN di SSH Server)
$ scp C:\Users\majid\Downloads\smartbarn.apk majid@77.37.63.21:/home/majid/
#Pindahkan APK ke Web (Jalankan di Terminal SSH Server)
$ sudo mv /home/majid/smartbarn.apk /var/www/smartcattlebarn.site/html/

##JARINGAN (Nginx Caching & Firewall)
# Optimasi Caching Nginx (Tambahkan ke /etc/nginx/sites-available/smartcattlebarn.site)
# location /assets/ { expires 1y; add_header Cache-Control "public, max-age=31536000, immutable"; }
# location ~* \.(svg|png|ico|woff2)$ { expires 30d; add_header Cache-Control "public, max-age=2592000"; }

#Cara Mematikan Website Frontend Sementara Waktu (Menutup Akses Web)
$ sudo rm /etc/nginx/sites-enabled/smartcattlebarn.site
$ sudo systemctl reload nginx
#Cara Menyalakan Website Frontend Kembali
$ sudo ln -s /etc/nginx/sites-available/smartcattlebarn.site /etc/nginx/sites-enabled/
$ sudo systemctl reload nginx
#Melihat Error Nginx (Jika web tiba-tiba Error 500/502)
$ sudo tail -n 20 /var/log/nginx/error.log

##Redis
$ redis-cli info memory | grep used_memory_human #used_memory_human adalah total memori RAM asli yang saat ini sedang dipakai oleh Redis untuk menyimpan cache dan data sementara
$ redis-cli info memory | grep maxmemory #maxmemory adalah batas maksimum memori yang diizinkan oleh sistem untuk digunakan oleh Redis (jika sudah penuh, Redis akan mulai menghapus data lama/kurang penting untuk memberi ruang)
$ redis-cli info memory | grep maxmemory_policy #maxmemory_policy adalah aturan yang digunakan Redis untuk menghapus data ketika memori penuh (misalnya: allkeys-lru, volatile-lru, dll.)

$used_memory_rss → RAM aktual yang diambil dari OS (bisa lebih besar karena fragmentasi).

$used_memory_peak → penggunaan RAM tertinggi yang pernah dicapai.

$mem_fragmentation_ratio → rasio fragmentasi memori.

pm2 status
pm2 monit
redis-cli info memory | grep used_memory_human

##Notes redis:
#(Sebagai info tambahan: Redis biasanya sangat ringan dan pintar mengelola memori. Ia jarang menjadi penyebab memori penuh kecuali dikonfigurasi untuk menyimpan data yang berukuran gigabyte. Tersangka utamanya biasanya tetap jatuh pada aplikasi Node.js/PM2 yang menyala berhari-hari tadi)

##Jangan pernah menjalankan perintah $redis-cli flushall (perintah untuk menghapus semua isi Redis). Jika Anda melakukannya, cache website teman Anda juga akan ikut terhapus dan bisa membuat website mereka melambat! 
$ redis-cli flushall

# Testing notif mobile
$ node test-notifikasi.js ExponentPushToken[xxxxxxxxx]

# Testing notif email
$ node test-notifikasi.js emailanda@gmail.com

# Testing notif email & mobile
$ node test-notifikasi.js emailanda@gmail.com ExponentPushToken[xxxxxxxxx]

#Tesing notif Web
$ node test-notifikasi.js web

#riset db sensor
$ node reset-sensor.js
#nginx config
sudo nano /etc/nginx/sites-available/default

# A. Cadangkan folder log lama menjadi folder arsip
Copy-Item -Path "benchmark_logs" -Destination "benchmark_logs_backup_v2" -Recurse -Force
# B. Bersihkan folder log aktif & checkpoint
node clean-benchmark.js

# Opsi 1: Dijalankan dari LAPTOP menuju SERVER VPS (Remote Testing)
node auto-benchmark-remote.js
node auto-benchmark-remote.js --iter 4

# Opsi 2: Dijalankan langsung DI DALAM SERVER VPS (Local Testing)
node auto-benchmark-local.js
node auto-benchmark-local.js --iter 4

# Cek Resource CPU, RAM, & Redis Server secara Live (Polling tiap 1 detik)
node monitor-remote.js
# Cek Jumlah Data Antrean BullMQ di Redis
node check-bullmq.js
# Cek Jumlah Data di Database PostgreSQL
node check-db-counts.js
#Membersihkan Log
sudo truncate -s 0 /var/log/xrdp.log
#Membersihkan log pm2
pm2 flush
#Membersihkan cache npm
npm cache clean --force
#Cek ruang Disk
df -h
# Membersihkan cache redis (remote)
node flush-redis-remote.js
# Membersihkan cache redis (local)
redis-cli flushall
#Pindahkan Log
scp -r majid@77.37.63.21:/home/majid/smart_cattle_barn/smartbarn-backend/benchmark_logs "C:\Users\majid\Downloads"

# Jalankan hanya Jalur 5 (DB Benchmark) dengan 50VU Iterasi 1, 2, 3 (Lalu otomatis lanjut sisanya)
node auto-benchmark-remote.js jalur5
# Reset dan Jalankan hanya Jalur 1, 2, 5
node auto-benchmark-remote.js jalur1,jalur2,jalur5 --reset
# Reset dan Jalankan hanya Jalur 1, 2, 5
node auto-benchmark-remote.js jalur1,jalur2,jalur5 --reset
cd smartbarn-backend

# 1. Jalankan BEBERAPA PENGUJIAN SEKALIGUS (Batch Multi-Scenario dalam sekali perintah):
# Contoh: Jalur 1 (50 VU 2x) LALU Jalur 6B (100 VU 2x) otomatis berurutan:
node run-quick-test.js jalur1:50:2 jalur6b:100:2

# Contoh 3 skenario spesifik sekaligus:
node run-quick-test.js jalur1:50:2 jalur6b:100:2 jalur4:50:1

# 2. Pengujian Tunggal Spesifik:
# Jalur 1 (50 VU, 2 Iterasi):
node run-quick-test.js jalur1 50 2

# Jalur 6B (100 VU, 2 Iterasi):
node run-quick-test.js jalur6b 100 2

# 3. Mode Local VPS (tambahkan kata 'local' di ujung):
node run-quick-test.js jalur1:50:2 jalur6b:100:2 local
node run-quick-test.js jalur1:75:6 jalur1:150:6 jalur2:75:6 jalur2:150:6 local --resume


sudo tcpdump -i any "host <IP_LAPTOP_ANDA> and port 1883" -w benchmark_50vu.pcap

sudo setcap cap_net_raw,cap_net_admin=eip $(which tcpdump)

#Jalankan script PCAP:
node run-pcap-jalur1-2.js jalur1:50:1 jalur1:100:1
node run-pcap-jalur1-2.js jalur2:50:1 jalur2:100:1
node run-pcap-jalur1-2.js --iter=3

# ============================================================================
# EKSPERIMEN 1: MATRIKS EKUIVALENSI SILANG THROUGHPUT & BEBAN (PACING MATRIX HINGGA 500 VU)
# ============================================================================
# Matriks Iso-Throughput (Menguji 10 VU s.d. 500 VU):
#  1. 10 VU  : 1000ms (~10 msg/s), 200ms (Setara 50), 100ms (Setara 100), 50ms (Setara 200), 33ms (Setara 300)
#  2. 50 VU  : 5000ms (Setara 10), 1000ms (~50 msg/s), 500ms (Setara 100), 250ms (Setara 200), 167ms (Setara 300)
#  3. 100 VU : 10000ms (Setara 10), 2000ms (Setara 50), 1000ms (~100 msg/s), 500ms (Setara 200), 333ms (Setara 300)
#  4. 200 VU : 20000ms (Setara 10), 4000ms (Setara 50), 2000ms (Setara 100), 1000ms (~200 msg/s), 667ms (Setara 300)
#  5. 300 VU : 30000ms (Setara 10), 6000ms (Setara 50), 3000ms (Setara 100), 1500ms (Setara 200), 1000ms (~300 msg/s)
#  6. 400 VU : 40000ms (Setara 10), 8000ms (Setara 50), 4000ms (Setara 100), 2000ms (Setara 200), 1333ms (Setara 300), 1000ms (~400 msg/s)
#  7. 500 VU : 50000ms (Setara 10), 10000ms (Setara 50), 5000ms (Setara 100), 2500ms (Setara 200), 1667ms (Setara 300), 1000ms (~500 msg/s)
#
# ============================================================================
# 1. PENGUJIAN STANDAR (BIASA - TANPA TELEMETRI TAMBAHAN)
# ============================================================================
# Mode Full VU v7 (Beban penuh dari detik ke-0):
node run-experiment-1-pacing.js --iter=6
# Mode Full VU dengan RESUME (melanjutkan jika sempat terhenti):
node run-experiment-1-pacing.js --resume --iter=6
# Mode Stage VUs v7_0_stage (Ramp-up bertahap):
node run-experiment-1-pacing.js --stage --iter=6
node run-experiment-1-pacing.js --stage --resume --iter=6
# Khusus 400 VU & 500 VU Baseline Normal:
node run-experiment-1-pacing.js 400vu 500vu normal --stage --resume --iter=6

# ============================================================================
# 2. PENGUJIAN MONITORED: VERSI STAGE VUs (RAM VPS + PING + JITTER + SPEEDTEST)
# Output CSV: experiment_1_pacing_stage_monitored_summary.csv & details.csv
# Mendukung checkpoint & resume otomatis dengan flag '--resume'
# ============================================================================
# A. UJI KHUSUS BASELINE NORMAL 400 VU & 500 VU (Paling Direkomendasikan & Cepat):
#    (Hanya menjalankan 400VU@1s & 500VU@1s, 2 skenario x 2 jalur x 6 iterasi = 24 sesi)
node run-experiment-1-pacing-stage-monitored.js 400vu 500vu normal --resume --iter=6

# B. UJI LENGKAP SEMUA SKENARIO 400 VU & 500 VU (Pacing Matrix + Normal):
node run-experiment-1-pacing-stage-monitored.js 400vu 500vu --resume --iter=6

# C. UJI KHUSUS 400 VU SAJA:
#    - Hanya Normal 400 VU (@1000ms):
node run-experiment-1-pacing-stage-monitored.js 400vu normal --resume --iter=6
#    - Seluruh Skenario 400 VU (T10, T50, T100, T200, T300, Normal T400):
node run-experiment-1-pacing-stage-monitored.js 400vu --resume --iter=6

# D. UJI KHUSUS 500 VU SAJA:
#    - Hanya Normal 500 VU (@1000ms):
node run-experiment-1-pacing-stage-monitored.js 500vu normal --resume --iter=6
#    - Seluruh Skenario 500 VU (T10, T50, T100, T200, T300, Normal T500):
node run-experiment-1-pacing-stage-monitored.js 500vu --resume --iter=6

# E. FILTER PER JALUR (Contoh: Jalur 1 Saja):
node run-experiment-1-pacing-stage-monitored.js jalur1 400vu 500vu normal --resume --iter=6

# F. Uji Kolom Iso-Throughput Target ~300 msg/s:
node run-experiment-1-pacing-stage-monitored.js target300 --resume --iter=6

# ============================================================================
# 3. PENGUJIAN MONITORED: VERSI FULL VUs (RAM VPS + PING + JITTER + SPEEDTEST)
# Output CSV: experiment_1_pacing_full_monitored_summary.csv & details.csv
# Mendukung checkpoint & resume otomatis dengan flag '--resume'
# ============================================================================
# A. Jalankan Seluruh Matriks 4x4 (Jalur 1 & 2 x 16 Skenario x 6 Iterasi):
node run-experiment-1-pacing-full-monitored.js --iter=6
# MELANJUTKAN jika sempat terhenti di tengah jalan:
node run-experiment-1-pacing-full-monitored.js --resume --iter=6

# B. Filter Per Jalur:
node run-experiment-1-pacing-full-monitored.js jalur1 --iter=6
node run-experiment-1-pacing-full-monitored.js jalur1 --resume --iter=6
node run-experiment-1-pacing-full-monitored.js jalur2 --iter=6
node run-experiment-1-pacing-full-monitored.js jalur2 --resume --iter=6

# C. Filter Kelompok Beban Tertentu:
node run-experiment-1-pacing-full-monitored.js 10vu --iter=6
node run-experiment-1-pacing-full-monitored.js 50vu --iter=6
node run-experiment-1-pacing-full-monitored.js 100vu --iter=6
node run-experiment-1-pacing-full-monitored.js 200vu --iter=6
node run-experiment-1-pacing-full-monitored.js normal --iter=6
node run-experiment-1-pacing-full-monitored.js jalur1 200vu --iter=6
node run-experiment-1-pacing-full-monitored.js jalur2 200vu --iter=6
node run-experiment-1-pacing-full-monitored.js --dry-run

# ============================================================================
# 4. EKSPERIMEN 2 & 3 DENGAN FITUR RESUME
# ============================================================================
# Eksperimen 2: TCP Delayed ACK Elimination
node run-experiment-2-delayed-ack.js --iter=6
node run-experiment-2-delayed-ack.js --resume --iter=6
node run-experiment-2-delayed-ack.js --stage --resume --iter=6

# Eksperimen 3: Distributed Multi-Subscriber
node run-experiment-3-distributed.js --iter=6
node run-experiment-3-distributed.js --resume --iter=6
node run-experiment-3-distributed.js --stage --resume --iter=6


#ACK delay step 
EKSPERIMEN 2: Eliminasi TCP Delayed ACK Windows Registry
Menguji pengaruh timer penundaan konfirmasi TCP Delayed ACK bawaan Windows pada 3 level beban (10, 50, 100 VU) di Jalur 1 dan Jalur 2.

#Langkah 1 (PowerShell Administrator - Matikan Delayed ACK):
powershell -ExecutionPolicy Bypass -File .\toggle-delayed-ack.ps1 -DisableDelayedAck
#Langkah 2 (Jalankan Uji 3 Beban x 2 Jalur x 6 Iterasi):
#Mode Full VU v7 (Default):
node run-experiment-2-delayed-ack.js --iter=6
#Mode Staged Ramp-up v7_0_stage:
node run-experiment-2-delayed-ack.js --stage --iter=6
#Langkah 3 (Kembalikan Registry Windows ke Standar Pabrik):
powershell -ExecutionPolicy Bypass -File .\toggle-delayed-ack.ps1 -RestoreDefault

# ============================================================================
# PENGUJIAN FULL VU SEJAK AWAL DI LOKAL VPS (SSH VPS)
# ============================================================================
# 1. Menggunakan Suite Lengkap Otomatis (Rekomendasi Skripsi: Jalur 1 & 2 x 6 Iterasi):
# node auto-benchmark-local.js jalur1,jalur2 --v7 --iter 6 --reset

# 2. Menggunakan Runner Cepat Full VU:
# node run-full-vu-test.js local
# node run-full-vu-test.js local jalur1
# node run-full-vu-test.js local jalur2

# 3. Menjalankan Langsung binary K6 Linux (Uji Instan 30s):
# ./k6-linux-mqtt run -e VUS=50 -e LOCAL=true -e TARGET=local -e MQTT_URL=mqtt://127.0.0.1:1883 k6-sensor-test-v7.js
# ./k6-linux-mqtt run -e VUS=50 -e LOCAL=true -e TARGET=local -e MQTT_URL=mqtt://127.0.0.1:1883 k6-env-test-v7.js

# ============================================================================
# PENGUJIAN ISOLASI PURE ECHO BROKER (TANPA BACKEND)
# ============================================================================
# Menguji transmisi bolak-balik (Half-RTT) langsung di level broker Mosquitto 
# dengan mematikan total NestJS API, PostgreSQL, dan Redis untuk mengisolasi 
# pengaruh komputasi backend terhadap latensi jaringan WAN.
#
# Di Terminal SSH VPS:
# 1. Matikan backend NestJS:
pm2 stop smartbarn-api-4000
# 2. Jalankan Echo Worker ringan:
node mqtt_echo_worker.js
# 3. Kembalikan backend setelah selesai pengujian:
pm2 start smartbarn-api-4000

# ============================================================================
# PENGUJIAN VALIDASI TCP KERNEL: CWND (CONGESTION WINDOW) & KERNEL RTT
# ============================================================================
# Menguji hipotesis lapisan transport: apakah peningkatan laju paket pada 100 VU 
# memicu ekspansi TCP Congestion Window (cwnd) di kernel Linux VPS sehingga 
# aliran paket lebih efisien dan latensi turun.
#
# Metrik yang Diukur dari Kernel Linux (`ss -tin sport = :1883`):
# - cwnd   : Ukuran jendela kongesti (kelipatan MSS ~1448 byte)
# - rtt    : Smoothed Round-Trip Time murni dari algoritma TCP CUBIC kernel
# - retrans: Jumlah retransmisi paket TCP yang hilang
#
# --- CARA PENGUJIAN OTOMATIS (REKOMENDASI) ---
#
# Langkah 1 (Di Terminal SSH VPS):
# Matikan backend dan jalankan daemon pengukur kernel + echo responder:
pm2 stop smartbarn-api-4000
node auto_cwnd_vps.js
#
# Langkah 2 (Di Terminal CMD/PowerShell Laptop):
# Jalankan master runner (otomatis mengeksekusi 50 VU & 100 VU dan merekap hasil):
node scratch/run_cwnd_suite.js
#
# Langkah 3 (Setelah Pengujian Selesai):
# Hentikan daemon di VPS (Ctrl + C), lalu hidupkan kembali backend NestJS:
pm2 start smartbarn-api-4000
#
# --- CARA PENGUJIAN MANUAL (OPSIONAL) ---
# Di VPS:
# ss -tin sport = :1883
# ss -ti | grep -A 5 ESTAB