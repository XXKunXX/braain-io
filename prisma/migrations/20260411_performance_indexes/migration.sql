-- Performance Indexes
-- Adds missing indexes on frequently queried foreign keys and filter fields

-- Request
CREATE INDEX "Request_contactId_idx" ON "Request"("contactId");
CREATE INDEX "Request_status_idx" ON "Request"("status");

-- Quote
CREATE INDEX "Quote_contactId_idx" ON "Quote"("contactId");
CREATE INDEX "Quote_requestId_idx" ON "Quote"("requestId");
CREATE INDEX "Quote_status_idx" ON "Quote"("status");

-- Order
CREATE INDEX "Order_contactId_idx" ON "Order"("contactId");
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE INDEX "Order_startDate_idx" ON "Order"("startDate");

-- DispositionEntry
CREATE INDEX "DispositionEntry_resourceId_idx" ON "DispositionEntry"("resourceId");
CREATE INDEX "DispositionEntry_baustelleId_idx" ON "DispositionEntry"("baustelleId");
CREATE INDEX "DispositionEntry_startDate_endDate_idx" ON "DispositionEntry"("startDate", "endDate");

-- DeliveryNote
CREATE INDEX "DeliveryNote_contactId_idx" ON "DeliveryNote"("contactId");
CREATE INDEX "DeliveryNote_orderId_idx" ON "DeliveryNote"("orderId");
CREATE INDEX "DeliveryNote_baustelleId_idx" ON "DeliveryNote"("baustelleId");
CREATE INDEX "DeliveryNote_invoiceId_idx" ON "DeliveryNote"("invoiceId");
CREATE INDEX "DeliveryNote_date_idx" ON "DeliveryNote"("date");

-- Task
CREATE INDEX "Task_contactId_idx" ON "Task"("contactId");
CREATE INDEX "Task_status_idx" ON "Task"("status");
CREATE INDEX "Task_deliveryNoteId_idx" ON "Task"("deliveryNoteId");
CREATE INDEX "Task_invoiceId_idx" ON "Task"("invoiceId");

-- Invoice
CREATE INDEX "Invoice_contactId_idx" ON "Invoice"("contactId");
CREATE INDEX "Invoice_orderId_idx" ON "Invoice"("orderId");
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");
CREATE INDEX "Invoice_invoiceDate_idx" ON "Invoice"("invoiceDate");
CREATE INDEX "Invoice_dueDate_idx" ON "Invoice"("dueDate");

-- InvoiceItem
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

-- Baustelle
CREATE INDEX "Baustelle_orderId_idx" ON "Baustelle"("orderId");
CREATE INDEX "Baustelle_contactId_idx" ON "Baustelle"("contactId");
CREATE INDEX "Baustelle_status_idx" ON "Baustelle"("status");
