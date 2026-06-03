//Dibangun dengan 
# React + vite
// Menjalankan Aplikasi
# npm run dev

Developer by : Majid Solihin Hadi

//Jalankan Infrastruktur (Redis & Mosquitto MQTT)
# docker-compose up -d
//Jalankan Backend (NestJS)
# cd smartbarn-backend
# npm run start:dev
//Jalankan Frontend (React)
# cd smartbarn-frontend
# npm run dev
//Jalankan Simulator MQTT
# cd simulator
# node index.js
//Jalankan MObile
# npx expo start



#  Sistem Caching SmartCattleBarn

##  Interval 10 Detik
- Sweet spot: cukup cepat untuk deteksi darurat, tapi tidak membebani PostgreSQL.
- Data sensor dikumpulkan lalu ditulis ke database setiap 10 detik (batch insert).

##  BullMQ (Redis Queue)
- `removeOnComplete: true` → data antrean langsung dihapus setelah diproses.
- `removeOnFail: 1000` → maksimal 1000 log kegagalan disimpan, sisanya otomatis dibuang.
- RAM backend (`this.batch`) hanya menampung 200 data sebelum dikosongkan kembali.

##  Cache Real-time Dashboard
- Data sensor (suhu, kelembapan, kecepatan angin) disimpan di Redis dengan **EX 70 detik**.
- Jika sensor mati/tidak kirim data, cache otomatis hilang setelah 70 detik.

##  Global Cache Module
- Memakai RAM lokal dengan batas waktu **30 menit**.
- Data lama yang jarang dipakai otomatis dibersihkan lewat garbage collection.
