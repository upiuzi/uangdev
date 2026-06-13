Implementation Plan: Customers and Suppliers for Business Transactions
This plan outlines the design and implementation to support Customers and Suppliers for business inventory transactions. It includes CRUD endpoints for managing them, automatic seeding of a default "Walk In" customer and supplier, and updating sales/purchases forms to reference them.

Proposed Changes
1. Database Schema & Models (Backend)
[NEW] 
customer.py
Create a Customer model representing buyers for sales:

Fields: id (UUID), user_id (UUID), workspace_id (UUID), name (string), phone (nullable string), email (nullable string), address (nullable string), created_at (datetime).
Relationships: user, transactions (to InventoryTransaction).
[NEW] 
supplier.py
Create a Supplier model representing vendors for purchases:

Fields: id (UUID), user_id (UUID), workspace_id (UUID), name (string), phone (nullable string), email (nullable string), address (nullable string), created_at (datetime).
Relationships: user, transactions (to InventoryTransaction).
[MODIFY] 
inventory_transaction.py
Add ForeignKey columns:
customer_id: points to customers.id, nullable.
supplier_id: points to suppliers.id, nullable.
Add relationships:
customer: Mapped[Optional[Customer]] = relationship(back_populates="transactions")
supplier: Mapped[Optional[Supplier]] = relationship(back_populates="transactions")
[MODIFY] 
init
.py
Import and register Customer and Supplier models.
[MODIFY] 
workspace_autostamp.py
Add Customer and Supplier models to _AUTOSTAMP_MODELS to ensure workspace mapping.
[NEW] 
064_add_suppliers_and_customers.py
Add Alembic migration script to:
Create table customers
Create table suppliers
Add customer_id and supplier_id foreign keys to inventory_transactions.
2. API & Schemas (Backend)
[MODIFY] 
inventory.py
Add schemas for Customer: CustomerBase, CustomerCreate, CustomerUpdate, CustomerRead.
Add schemas for Supplier: SupplierBase, SupplierCreate, SupplierUpdate, SupplierRead.
Add customer_id: Optional[uuid.UUID] = None and supplier_id: Optional[uuid.UUID] = None to InventoryTransactionCreate.
Add customer_id: Optional[uuid.UUID] = None and supplier_id: Optional[uuid.UUID] = None to InventoryTransactionRead.
[MODIFY] 
inventory_service.py
Implement ensure_walk_in_customer(session, workspace_id, user_id) and ensure_walk_in_supplier(session, workspace_id, user_id).
Implement CRUD methods for Customer and Supplier:
get_customers, create_customer, update_customer, delete_customer (automatically calls ensure_walk_in_customer to seed default "Walk In" if it is missing).
get_suppliers, create_supplier, update_supplier, delete_supplier (automatically calls ensure_walk_in_supplier to seed default "Walk In" if it is missing).
Update create_inventory_transaction:
If transaction type is 'sale': use data.customer_id. If omitted, default to the ID of the "Walk In" customer.
If transaction type is 'purchase': use data.supplier_id. If omitted, default to the ID of the "Walk In" supplier.
[MODIFY] 
inventory.py
Add endpoints:

GET /api/inventory/customers -> lists workspace customers.
POST /api/inventory/customers -> creates new customer.
PATCH /api/inventory/customers/{id} -> updates customer.
DELETE /api/inventory/customers/{id} -> deletes customer.
GET /api/inventory/suppliers -> lists workspace suppliers.
POST /api/inventory/suppliers -> creates new supplier.
PATCH /api/inventory/suppliers/{id} -> updates supplier.
DELETE /api/inventory/suppliers/{id} -> deletes supplier.
3. Frontend Integration (Vite)
[MODIFY] 
index.ts
Add Customer and Supplier interfaces.
Update InventoryTransaction to include customer_id?: string and supplier_id?: string.
[MODIFY] 
api.ts
Add methods:
getCustomers(), createCustomer(payload), updateCustomer(id, payload), deleteCustomer(id).
getSuppliers(), createSupplier(payload), updateSupplier(id, payload), deleteSupplier(id).
Update createTransaction signature to accept customer_id and supplier_id in the payload.
[MODIFY] 
inventory.tsx
Manage Tabs: Add a "Contacts" tab containing two sub-lists/tables: "Customers" and "Suppliers" where users can add/edit contacts.
Log Table: Show the customer's name for Sales rows (e.g. "To: Customer Name") and supplier's name for Purchases rows (e.g. "From: Supplier Name").
Record Dialog:
In "Record Sale" dialog, show a dropdown to select a Customer (defaults to "Walk In", lists other customers, and has a shortcut to add a new Customer).
In "Record Purchase" dialog, show a dropdown to select a Supplier (defaults to "Walk In", lists other suppliers, and has a shortcut to add a new Supplier).
Verification Plan
Automated Tests
Extend backend/tests/test_inventory.py to cover:
Verifying ensure_walk_in_customer and ensure_walk_in_supplier auto-seeding.
Recording a sale transaction with customer reference (fallback to "Walk In").
Recording a purchase transaction with supplier reference (fallback to "Walk In").
Customer/Supplier CRUD endpoint checks.
Manual Verification
Open the UI, record a sale. Verify that "Walk In" is preselected.
Navigate to "Contacts", add a new customer "John Doe" and supplier "Acme Corp".
Record a sale and choose "John Doe". Verify it shows in logs.
Record a purchase and choose "Acme Corp". Verify it shows in logs.
