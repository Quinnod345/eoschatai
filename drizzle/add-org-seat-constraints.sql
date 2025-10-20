-- Add constraints to prevent invalid seat count data

-- Ensure seat count is positive and within reasonable limits
ALTER TABLE "Org" 
  ADD CONSTRAINT "org_seat_count_positive" 
  CHECK ("seatCount" > 0 AND "seatCount" <= 10000);

-- Ensure pendingRemoval is non-negative and not more than seatCount
ALTER TABLE "Org"
  ADD CONSTRAINT "org_pending_removal_valid"
  CHECK ("pendingRemoval" >= 0 AND "pendingRemoval" <= "seatCount");

-- Update any existing invalid data (safety measure)
UPDATE "Org" SET "seatCount" = 1 WHERE "seatCount" <= 0;
UPDATE "Org" SET "seatCount" = 10000 WHERE "seatCount" > 10000;
UPDATE "Org" SET "pendingRemoval" = 0 WHERE "pendingRemoval" < 0;
UPDATE "Org" SET "pendingRemoval" = "seatCount" WHERE "pendingRemoval" > "seatCount";










































