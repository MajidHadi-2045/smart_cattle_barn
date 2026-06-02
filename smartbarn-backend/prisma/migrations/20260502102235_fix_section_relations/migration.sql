-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'MANAGER', 'KANDANG', 'VETERINER');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LivestockStatus" AS ENUM ('SEHAT', 'SAKIT', 'HAMIL');

-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('DALAM_PERAWATAN', 'SEMBUH', 'KRITIS');

-- CreateEnum
CREATE TYPE "FeedStatus" AS ENUM ('AMAN', 'KRITIS');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('TERJADWAL', 'BERLANGSUNG', 'SELESAI');

-- CreateTable
CREATE TABLE "Zone" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Section" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "zoneId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'KANDANG',
    "status" TEXT NOT NULL DEFAULT 'AKTIF',
    "task" TEXT,
    "photo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRequest" (
    "id" SERIAL NOT NULL,
    "requester" TEXT NOT NULL,
    "calonName" TEXT NOT NULL,
    "calonEmail" TEXT NOT NULL,
    "posisi" TEXT NOT NULL,
    "alasan" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Livestock" (
    "id" SERIAL NOT NULL,
    "cattleId" TEXT NOT NULL,
    "breed" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "initialWeight" DOUBLE PRECISION NOT NULL,
    "currentWeight" DOUBLE PRECISION,
    "sectionId" INTEGER NOT NULL,
    "status" "LivestockStatus" NOT NULL DEFAULT 'SEHAT',
    "pregnancyStart" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Livestock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Health" (
    "id" SERIAL NOT NULL,
    "cattleId" TEXT NOT NULL,
    "diagnosa" TEXT NOT NULL,
    "penanganan" TEXT NOT NULL,
    "pemeriksa" TEXT NOT NULL,
    "status" "HealthStatus" NOT NULL DEFAULT 'DALAM_PERAWATAN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Health_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LivestockVital" (
    "id" SERIAL NOT NULL,
    "cattleId" TEXT NOT NULL,
    "heartRate" DOUBLE PRECISION,
    "bodyTemperature" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LivestockVital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvironmentData" (
    "id" SERIAL NOT NULL,
    "sectionId" INTEGER NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "humidity" DOUBLE PRECISION NOT NULL,
    "ammonia" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnvironmentData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AirCirculation" (
    "id" SERIAL NOT NULL,
    "zoneId" INTEGER NOT NULL,
    "windspeed" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AirCirculation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActuatorState" (
    "id" SERIAL NOT NULL,
    "sectionId" INTEGER NOT NULL,
    "fanOn" BOOLEAN NOT NULL DEFAULT false,
    "sprinklerOn" BOOLEAN NOT NULL DEFAULT false,
    "lampOn" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActuatorState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Silo" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "feedType" TEXT NOT NULL,
    "capacity" DOUBLE PRECISION NOT NULL,
    "currentStock" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "status" "FeedStatus" NOT NULL DEFAULT 'AMAN',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Silo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedingSchedule" (
    "id" SERIAL NOT NULL,
    "time" TEXT NOT NULL,
    "sectionId" INTEGER NOT NULL,
    "feedType" TEXT NOT NULL,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'TERJADWAL',
    "siloId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedingSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" SERIAL NOT NULL,
    "reportType" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "fileFormat" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LivestockWaste" (
    "id" SERIAL NOT NULL,
    "cattleId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "fecesKg" DOUBLE PRECISION NOT NULL,
    "urineL" DOUBLE PRECISION NOT NULL,
    "isAuto" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LivestockWaste_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Zone_name_key" ON "Zone"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Section_name_zoneId_key" ON "Section"("name", "zoneId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Livestock_cattleId_key" ON "Livestock"("cattleId");

-- CreateIndex
CREATE INDEX "Health_cattleId_createdAt_idx" ON "Health"("cattleId", "createdAt");

-- CreateIndex
CREATE INDEX "LivestockVital_cattleId_timestamp_idx" ON "LivestockVital"("cattleId", "timestamp");

-- CreateIndex
CREATE INDEX "EnvironmentData_sectionId_timestamp_idx" ON "EnvironmentData"("sectionId", "timestamp");

-- CreateIndex
CREATE INDEX "AirCirculation_zoneId_timestamp_idx" ON "AirCirculation"("zoneId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "ActuatorState_sectionId_key" ON "ActuatorState"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Silo_name_key" ON "Silo"("name");

-- CreateIndex
CREATE INDEX "LivestockWaste_date_idx" ON "LivestockWaste"("date");

-- CreateIndex
CREATE UNIQUE INDEX "LivestockWaste_cattleId_date_key" ON "LivestockWaste"("cattleId", "date");

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Livestock" ADD CONSTRAINT "Livestock_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Health" ADD CONSTRAINT "Health_cattleId_fkey" FOREIGN KEY ("cattleId") REFERENCES "Livestock"("cattleId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LivestockVital" ADD CONSTRAINT "LivestockVital_cattleId_fkey" FOREIGN KEY ("cattleId") REFERENCES "Livestock"("cattleId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentData" ADD CONSTRAINT "EnvironmentData_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AirCirculation" ADD CONSTRAINT "AirCirculation_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActuatorState" ADD CONSTRAINT "ActuatorState_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedingSchedule" ADD CONSTRAINT "FeedingSchedule_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedingSchedule" ADD CONSTRAINT "FeedingSchedule_siloId_fkey" FOREIGN KEY ("siloId") REFERENCES "Silo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LivestockWaste" ADD CONSTRAINT "LivestockWaste_cattleId_fkey" FOREIGN KEY ("cattleId") REFERENCES "Livestock"("cattleId") ON DELETE CASCADE ON UPDATE CASCADE;
