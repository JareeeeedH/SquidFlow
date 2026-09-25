-- Phase 3 Completion / Fare fields (ADR 0001).
-- arrived_at: null = not arrived; set on Arrive (mileage locked)
-- calculated_fare: system fare at Arrive; null until Arrive
-- final_fare: driver-confirmed fare at Complete; null until COMPLETED
-- price remains original dispatch price (unchanged)

ALTER TABLE "orders" ADD COLUMN "arrived_at" TIMESTAMPTZ(6),
ADD COLUMN "calculated_fare" DECIMAL(10,2),
ADD COLUMN "final_fare" DECIMAL(10,2);
