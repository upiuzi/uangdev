import uuid
from decimal import Decimal
import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.account import Account
from app.models.inventory_item import InventoryItem
from app.models.inventory_transaction import InventoryTransaction
from app.models.transaction import Transaction


@pytest.fixture
async def test_account(session, test_user, test_workspace):
    account = Account(
        user_id=test_user.id,
        workspace_id=test_workspace.id,
        name="Test Inventory Wallet",
        type="checking",
        balance=Decimal("10000.00"),
        currency="USD",
    )
    session.add(account)
    await session.commit()
    await session.refresh(account)
    return account


@pytest.mark.asyncio
async def test_crud_inventory_item(client: AsyncClient, auth_headers):
    # 1. Create inventory item (physical)
    create_resp = await client.post(
        "/api/inventory/items",
        headers=auth_headers,
        json={
            "name": "Item A",
            "sku": "SKU-A",
            "description": "Item A Description",
            "price": "25.50",
            "cost": "15.00",
            "type": "physical",
        },
    )
    assert create_resp.status_code == 201
    item_data = create_resp.json()
    assert item_data["name"] == "Item A"
    assert item_data["sku"] == "SKU-A"
    assert item_data["price"] == "25.50"
    assert item_data["cost"] == "15.00"
    assert item_data["type"] == "physical"
    assert item_data["stock"] == "0.0000"
    item_id = item_data["id"]

    # 2. Get items
    get_resp = await client.get("/api/inventory/items", headers=auth_headers)
    assert get_resp.status_code == 200
    items = get_resp.json()
    assert len(items) >= 1
    assert any(x["id"] == item_id for x in items)

    # 3. Update item to service
    patch_resp = await client.patch(
        f"/api/inventory/items/{item_id}",
        headers=auth_headers,
        json={"name": "Item A Updated", "price": "30.00", "type": "service"},
    )
    assert patch_resp.status_code == 200
    updated_data = patch_resp.json()
    assert updated_data["name"] == "Item A Updated"
    assert updated_data["price"] == "30.00"
    assert updated_data["type"] == "service"

    # 4. Delete item
    del_resp = await client.delete(f"/api/inventory/items/{item_id}", headers=auth_headers)
    assert del_resp.status_code == 204


@pytest.mark.asyncio
async def test_physical_vs_service_stock_rules(client: AsyncClient, auth_headers, session):
    # Create Physical Item
    resp_phys = await client.post(
        "/api/inventory/items",
        headers=auth_headers,
        json={"name": "Physical Widget", "price": "10.00", "cost": "5.00", "type": "physical"},
    )
    assert resp_phys.status_code == 201
    phys_id = resp_phys.json()["id"]

    # Create Service Item
    resp_serv = await client.post(
        "/api/inventory/items",
        headers=auth_headers,
        json={"name": "Service Consultation", "price": "100.00", "cost": "0.00", "type": "service"},
    )
    assert resp_serv.status_code == 201
    serv_id = resp_serv.json()["id"]

    # 1. Attempt to sell Physical widget with 0 stock -> should fail (HTTP 400)
    sale_phys_fail = await client.post(
        f"/api/inventory/items/{phys_id}/transactions",
        headers=auth_headers,
        json={
            "type": "sale",
            "quantity": "1.0000",
            "unit_price": "10.00",
            "date": "2026-06-13",
        },
    )
    assert sale_phys_fail.status_code == 400
    assert "Insufficient stock" in sale_phys_fail.json()["detail"]

    # 2. Sell Service consultation with 0 stock -> should succeed immediately
    sale_serv_ok = await client.post(
        f"/api/inventory/items/{serv_id}/transactions",
        headers=auth_headers,
        json={
            "type": "sale",
            "quantity": "1.0000",
            "unit_price": "100.00",
            "date": "2026-06-13",
        },
    )
    assert sale_serv_ok.status_code == 201
    assert sale_serv_ok.json()["type"] == "sale"

    # Verify service stock level remains 0
    db_serv = await session.get(InventoryItem, uuid.UUID(serv_id))
    assert db_serv.stock == Decimal("0.0000")


@pytest.mark.asyncio
async def test_partial_and_deferred_payments(
    client: AsyncClient, auth_headers, session, test_account
):
    # Create Item
    resp = await client.post(
        "/api/inventory/items",
        headers=auth_headers,
        json={"name": "Bulk Coffee Bags", "price": "20.00", "cost": "10.00", "type": "physical"},
    )
    assert resp.status_code == 201
    item_id = resp.json()["id"]

    # Stock up coffee first
    await client.post(
        f"/api/inventory/items/{item_id}/transactions",
        headers=auth_headers,
        json={
            "type": "purchase",
            "quantity": "50.0000",
            "unit_price": "10.00",
            "date": "2026-06-13",
        },
    )

    # 1. Create a Sale for 10 bags @ $20 = $200 total, but with deferred payment (Unpaid)
    sale_resp = await client.post(
        f"/api/inventory/items/{item_id}/transactions",
        headers=auth_headers,
        json={
            "type": "sale",
            "quantity": "10.0000",
            "unit_price": "20.00",
            "date": "2026-06-13",
            "paid_amount": "0.00",
        },
    )
    assert sale_resp.status_code == 201
    tx_data = sale_resp.json()
    tx_id = tx_data["id"]
    assert tx_data["paid_amount"] == "0.00"
    assert tx_data["payment_status"] == "unpaid"
    assert tx_data["transaction_id"] is None

    # Get payments list -> should be empty
    pmts_resp = await client.get(
        f"/api/inventory/transactions/{tx_id}/payments",
        headers=auth_headers,
    )
    assert pmts_resp.status_code == 200
    assert len(pmts_resp.json()) == 0

    # 2. Record a partial payment of $75
    pay_resp1 = await client.post(
        f"/api/inventory/transactions/{tx_id}/payments",
        headers=auth_headers,
        json={
            "amount": "75.00",
            "date": "2026-06-14",
            "account_id": str(test_account.id),
            "description": "First deposit",
        },
    )
    assert pay_resp1.status_code == 201
    p1 = pay_resp1.json()
    assert p1["amount"] == "75.00"
    assert p1["transaction_id"] is not None

    # Verify transaction status changed to partial
    tx_get = await client.get("/api/inventory/transactions", headers=auth_headers)
    our_tx = next(x for x in tx_get.json() if x["id"] == tx_id)
    assert our_tx["paid_amount"] == "75.00"
    assert our_tx["payment_status"] == "partial"
    # Legacy transaction_id should now point to this first payment
    assert our_tx["transaction_id"] == p1["transaction_id"]

    # Verify PFM transaction recorded
    db_tx1 = await session.get(Transaction, uuid.UUID(p1["transaction_id"]))
    assert db_tx1 is not None
    assert db_tx1.amount == Decimal("75.00")
    assert db_tx1.type == "credit"

    # 3. Pay remaining balance ($125)
    pay_resp2 = await client.post(
        f"/api/inventory/transactions/{tx_id}/payments",
        headers=auth_headers,
        json={
            "amount": "150.00", # Overpay amount: should be automatically capped at remaining $125
            "date": "2026-06-15",
            "account_id": str(test_account.id),
            "description": "Final settlement",
        },
    )
    assert pay_resp2.status_code == 201
    p2 = pay_resp2.json()
    assert p2["amount"] == "125.00" # Capped at remaining

    # Verify transaction status is now Paid
    tx_get_final = await client.get("/api/inventory/transactions", headers=auth_headers)
    our_tx_final = next(x for x in tx_get_final.json() if x["id"] == tx_id)
    assert our_tx_final["paid_amount"] == "200.00"
    assert our_tx_final["payment_status"] == "paid"

    # Verify payments list has 2 items
    pmts_final = await client.get(
        f"/api/inventory/transactions/{tx_id}/payments",
        headers=auth_headers,
    )
    assert len(pmts_final.json()) == 2


@pytest.mark.asyncio
async def test_customers_and_suppliers_flow(client: AsyncClient, auth_headers, session):
    # 1. Verify default "Walk In" customer and supplier are seeded automatically when listing
    cust_list_resp = await client.get("/api/inventory/customers", headers=auth_headers)
    assert cust_list_resp.status_code == 200
    customers = cust_list_resp.json()
    assert len(customers) == 1
    assert customers[0]["name"] == "Walk In"
    walk_in_cust_id = customers[0]["id"]

    supp_list_resp = await client.get("/api/inventory/suppliers", headers=auth_headers)
    assert supp_list_resp.status_code == 200
    suppliers = supp_list_resp.json()
    assert len(suppliers) == 1
    assert suppliers[0]["name"] == "Walk In"
    walk_in_supp_id = suppliers[0]["id"]

    # 2. Create custom customer and supplier
    cust_create = await client.post(
        "/api/inventory/customers",
        headers=auth_headers,
        json={"name": "Alice Buyer", "phone": "123456", "email": "alice@test.com", "address": "123 St"},
    )
    assert cust_create.status_code == 201
    custom_cust_id = cust_create.json()["id"]

    supp_create = await client.post(
        "/api/inventory/suppliers",
        headers=auth_headers,
        json={"name": "Bob Vendor", "phone": "654321", "email": "bob@test.com", "address": "456 Rd"},
    )
    assert supp_create.status_code == 201
    custom_supp_id = supp_create.json()["id"]

    # Verify lists now have 2 items
    cust_list_resp2 = await client.get("/api/inventory/customers", headers=auth_headers)
    assert len(cust_list_resp2.json()) == 2

    supp_list_resp2 = await client.get("/api/inventory/suppliers", headers=auth_headers)
    assert len(supp_list_resp2.json()) == 2

    # 3. Create Item to perform transaction tests
    resp_item = await client.post(
        "/api/inventory/items",
        headers=auth_headers,
        json={"name": "Test Widget", "price": "10.00", "cost": "5.00", "type": "physical"},
    )
    item_id = resp_item.json()["id"]

    # 4. Perform purchase using default Walk In supplier (omitted supplier_id)
    purchase_resp1 = await client.post(
        f"/api/inventory/items/{item_id}/transactions",
        headers=auth_headers,
        json={
            "type": "purchase",
            "quantity": "10.0000",
            "unit_price": "5.00",
            "date": "2026-06-13",
        },
    )
    assert purchase_resp1.status_code == 201
    assert purchase_resp1.json()["supplier_id"] == walk_in_supp_id

    # 5. Perform sale using custom customer
    sale_resp = await client.post(
        f"/api/inventory/items/{item_id}/transactions",
        headers=auth_headers,
        json={
            "type": "sale",
            "quantity": "2.0000",
            "unit_price": "10.00",
            "date": "2026-06-13",
            "customer_id": custom_cust_id,
        },
    )
    assert sale_resp.status_code == 201
    assert sale_resp.json()["customer_id"] == custom_cust_id

    # 6. Verify cannot delete default Walk In records
    del_cust = await client.delete(f"/api/inventory/customers/{walk_in_cust_id}", headers=auth_headers)
    assert del_cust.status_code == 400
    assert "Cannot delete the default Walk In customer" in del_cust.json()["detail"]

    # 7. Verify can delete custom records
    del_custom_cust = await client.delete(f"/api/inventory/customers/{custom_cust_id}", headers=auth_headers)
    assert del_custom_cust.status_code == 204
