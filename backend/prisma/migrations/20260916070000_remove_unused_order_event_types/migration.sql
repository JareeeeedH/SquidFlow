-- Remove unused OrderEventType values that were never written by the app.
-- PostgreSQL requires recreating the enum to drop values.

ALTER TYPE "OrderEventType" RENAME TO "OrderEventType_old";

CREATE TYPE "OrderEventType" AS ENUM (
  'ORDER_CREATED',
  'ORDER_PUBLISHED',
  'ORDER_ACCEPTED',
  'ORDER_STARTED',
  'ORDER_COMPLETED',
  'ORDER_CANCELLED'
);

ALTER TABLE "order_events"
  ALTER COLUMN "event_type" TYPE "OrderEventType"
  USING ("event_type"::text::"OrderEventType");

DROP TYPE "OrderEventType_old";
