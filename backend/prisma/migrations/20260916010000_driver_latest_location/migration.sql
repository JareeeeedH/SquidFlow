-- AlterTable
ALTER TABLE "drivers" ADD COLUMN "latitude" DECIMAL(10,7),
ADD COLUMN "longitude" DECIMAL(10,7),
ADD COLUMN "location_updated_at" TIMESTAMPTZ(6);
