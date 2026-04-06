-- Add actor tracking fields to record who performed each action
ALTER TABLE "Order" ADD COLUMN "createdByName" TEXT;
ALTER TABLE "Order" ADD COLUMN "statusChangedByName" TEXT;
ALTER TABLE "Request" ADD COLUMN "createdByName" TEXT;
ALTER TABLE "Baustelle" ADD COLUMN "createdByName" TEXT;
ALTER TABLE "DeliveryNote" ADD COLUMN "createdByName" TEXT;
ALTER TABLE "Attachment" ADD COLUMN "createdByName" TEXT;
