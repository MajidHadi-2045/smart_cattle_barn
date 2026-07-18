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
# 1. Tarik informasi terbaru dari GitHub tanpa mengubah file
git fetch origin
# 2. Paksa kode di VPS agar 100% sama dengan branch 'main' di GitHub
git reset --hard origin/main
# (Opsional tapi disarankan) 3. Bersihkan file-file sementara/sampah yang tidak ada di GitHub
git clean -fd

##Apk (File APK)
#Cara Mengunggah APK Baru ke Server (Jalankan di CMD Laptop, BUKAN di SSH Server)
$ scp C:\Users\majid\Downloads\smartbarn.apk majid@77.37.63.21:/home/majid/
#Pindahkan APK ke Web (Jalankan di Terminal SSH Server)
$ sudo mv /home/majid/smartbarn.apk /var/www/smartcattlebarn.site/html/

##JARINGAN (Nginx & Firewall)
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




