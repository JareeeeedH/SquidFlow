-- Phase 3: trip mileage tracking on orders (no GPS history table).
-- trip_distance_meters: accumulated / locked trip meters
-- trip_last_*: Backend-internal last billing GPS point (cleared on Complete in P3-D)

ALTER TABLE "orders" ADD COLUMN "trip_distance_meters" INTEGER,
ADD COLUMN "trip_last_latitude" DECIMAL(10,7),
ADD COLUMN "trip_last_longitude" DECIMAL(10,7);
