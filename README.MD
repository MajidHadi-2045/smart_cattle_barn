# 1. Backend (smartbarn-backend)
cd smartbarn-backend

# Menjalankan server backend dalam mode development (auto restart saat ada perubahan file)
npm run start:dev

# Build TypeScript → JavaScript di folder dist
npm run build

# Menjalankan server backend langsung (produksi/staging)
npm run start

# Menjalankan hasil build dari dist/main
npm run start:prod

# Generate Prisma Client baru setelah ubah schema
npx prisma generate

# Sinkronisasi schema database dengan schema.prisma
npx prisma db push

# Membuka GUI web untuk kelola data database
npx prisma studio

# Cek kualitas kode backend dengan ESLint
npm run lint

-----------------------------------
# 2. Frontend (smartbarn-frontend)
cd smartbarn-frontend

# Menjalankan server lokal frontend (Vite) → http://localhost:5173
npm run dev

# Build produksi React siap deploy
npm run build

# Preview hasil build produksi secara lokal
npm run preview

# Cek kualitas kode frontend dengan ESLint
npm run lint

-----------------------------------

# 3. Mobile App (smartbarn-mobile)
cd smartbarn-mobile

# Menjalankan Expo bundler/development server
npm run start

# Jalankan app di emulator/perangkat Android
npm run android

# Jalankan app di simulator iOS (macOS saja)
npm run ios

# Periksa tipe TypeScript tanpa menghasilkan file
npx tsc --noEmit

-----------------------------------

# 4. Simulator Sensor (simulator)
cd simulator

# Menjalankan simulator IoT berbasis MQTT
npm start

# Kirim data sensor sapi & kandang ke MQTT broker
node index.js

-----------------------------------
git remote -v
git push -u origin main
git add .
git commit -m "Initial commit SmartCattleBarn"
git push
git remote set-url origin https://github.com/USERNAME_ANDA/smart-cattle-barn.git