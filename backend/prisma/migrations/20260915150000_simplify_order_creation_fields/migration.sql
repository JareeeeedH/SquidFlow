-- AlterTable
ALTER TABLE "orders" DROP COLUMN "scheduled_at",
DROP COLUMN "vehicle_type",
ALTER COLUMN "customer_name" DROP NOT NULL,
ALTER COLUMN "destination" DROP NOT NULL,
ALTER COLUMN "price" DROP NOT NULL;
