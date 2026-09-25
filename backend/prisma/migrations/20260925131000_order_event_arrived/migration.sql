-- Phase 3 Arrive: OrderEventType ORDER_ARRIVED (ADR 0001 / PHASE-3-SPEC).

ALTER TYPE "OrderEventType" RENAME TO "OrderEventType_old";

CREATE TYPE "OrderEventType" AS ENUM (
  'ORDER_CREATED',
  'ORDER_PUBLISHED',
  'ORDER_ACCEPTED',
  'ORDER_STARTED',
  'ORDER_ARRIVED',
  'ORDER_COMPLETED',
  'ORDER_CANCELLED'
);

ALTER TABLE "order_events"
  ALTER COLUMN "event_type" TYPE "OrderEventType"
  USING ("event_type"::text::"OrderEventType");

DROP TYPE "OrderEventType_old";
