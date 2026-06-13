import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory_item import InventoryItem
from app.models.inventory_transaction import InventoryTransaction
from app.models.inventory_payment import InventoryPayment
from app.models.customer import Customer
from app.models.supplier import Supplier
from app.schemas.inventory import (
    InventoryItemCreate,
    InventoryItemUpdate,
    InventoryTransactionCreate,
    InventoryPaymentCreate,
    CustomerCreate,
    CustomerUpdate,
    SupplierCreate,
    SupplierUpdate,
)
from app.schemas.transaction import TransactionCreate
from app.services import transaction_service


async def get_items(session: AsyncSession, workspace_id: uuid.UUID) -> list[InventoryItem]:
    result = await session.execute(
        select(InventoryItem)
        .where(InventoryItem.workspace_id == workspace_id)
        .order_by(InventoryItem.name)
    )
    return list(result.scalars().all())


async def get_item(
    session: AsyncSession, item_id: uuid.UUID, workspace_id: uuid.UUID
) -> Optional[InventoryItem]:
    result = await session.execute(
        select(InventoryItem).where(
            InventoryItem.id == item_id, InventoryItem.workspace_id == workspace_id
        )
    )
    return result.scalar_one_or_none()


async def create_item(
    session: AsyncSession, workspace_id: uuid.UUID, user_id: uuid.UUID, data: InventoryItemCreate
) -> InventoryItem:
    item = InventoryItem(
        user_id=user_id,
        workspace_id=workspace_id,
        name=data.name,
        sku=data.sku,
        description=data.description,
        price=data.price,
        cost=data.cost,
        stock=Decimal("0.0000"),
        type=data.type,
    )
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return item


async def update_item(
    session: AsyncSession,
    item_id: uuid.UUID,
    workspace_id: uuid.UUID,
    data: InventoryItemUpdate,
) -> Optional[InventoryItem]:
    item = await get_item(session, item_id, workspace_id)
    if not item:
        return None

    update_dict = data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(item, key, value)

    await session.commit()
    await session.refresh(item)
    return item


async def delete_item(
    session: AsyncSession, item_id: uuid.UUID, workspace_id: uuid.UUID
) -> bool:
    item = await get_item(session, item_id, workspace_id)
    if not item:
        return False

    await session.delete(item)
    await session.commit()
    return True


async def get_transactions(
    session: AsyncSession, workspace_id: uuid.UUID
) -> list[InventoryTransaction]:
    result = await session.execute(
        select(InventoryTransaction)
        .where(InventoryTransaction.workspace_id == workspace_id)
        .order_by(InventoryTransaction.created_at.desc())
    )
    return list(result.scalars().all())


async def create_inventory_transaction(
    session: AsyncSession,
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    item_id: uuid.UUID,
    data: InventoryTransactionCreate,
) -> InventoryTransaction:
    item = await get_item(session, item_id, workspace_id)
    if not item:
        raise ValueError("Item not found")

    total_amount = data.quantity * data.unit_price

    # Determine initial paid amount
    initial_paid = Decimal("0.00")
    if data.paid_amount is not None:
        initial_paid = min(data.paid_amount, total_amount)
    elif data.account_id is not None:
        # If no paid_amount is provided, but account is provided, assume full payment
        initial_paid = total_amount

    # Stock validation & adjustment (only physical items track stock)
    qty_change = Decimal("0.0000")
    if item.type == "physical":
        if data.type == "sale":
            if item.stock < data.quantity:
                raise ValueError("Insufficient stock. Physical products must be purchased/stocked first.")
            qty_change = -data.quantity
        elif data.type == "purchase":
            qty_change = data.quantity
        elif data.type == "adjustment":
            qty_change = data.quantity - item.stock
        item.stock += qty_change

    # Calculate payment status
    payment_status = "unpaid"
    if initial_paid >= total_amount:
        payment_status = "paid"
    elif initial_paid > 0:
        payment_status = "partial"

    # Resolve customer/supplier for sale/purchase
    customer_id = None
    supplier_id = None
    if data.type == "sale":
        if data.customer_id:
            customer_id = data.customer_id
        else:
            walk_in_cust = await ensure_walk_in_customer(session, workspace_id, user_id)
            customer_id = walk_in_cust.id
    elif data.type == "purchase":
        if data.supplier_id:
            supplier_id = data.supplier_id
        else:
            walk_in_supp = await ensure_walk_in_supplier(session, workspace_id, user_id)
            supplier_id = walk_in_supp.id

    # Create the Inventory Transaction record first
    inv_tx = InventoryTransaction(
        user_id=user_id,
        workspace_id=workspace_id,
        item_id=item.id,
        type=data.type,
        quantity=data.quantity,
        unit_price=data.unit_price,
        date=data.date,
        description=data.description,
        paid_amount=initial_paid,
        payment_status=payment_status,
        transaction_id=None,
        customer_id=customer_id,
        supplier_id=supplier_id,
    )
    session.add(inv_tx)
    await session.flush()  # Populate inv_tx.id

    # If initial payment is registered, create both payment record and cash flow transaction
    if initial_paid > 0 and data.account_id:
        cash_flow_type = "credit" if data.type == "sale" else "debit"
        prefix = "Penjualan" if data.type == "sale" else "Pembelian"

        tx_create = TransactionCreate(
            description=f"{prefix} {item.name} x {float(data.quantity):g}",
            amount=initial_paid,
            date=data.date,
            type=cash_flow_type,
            account_id=data.account_id,
            notes=f"Transaksi stok otomatis untuk barang: {item.name}",
        )

        cash_flow_tx = await transaction_service.create_transaction(
            session=session,
            workspace_id=workspace_id,
            user_id=user_id,
            data=tx_create,
        )

        payment = InventoryPayment(
            user_id=user_id,
            workspace_id=workspace_id,
            inventory_transaction_id=inv_tx.id,
            amount=initial_paid,
            date=data.date,
            account_id=data.account_id,
            transaction_id=cash_flow_tx.id,
            description=f"Initial payment",
        )
        session.add(payment)

        # Map to transaction_id for legacy dashboard compatibility
        inv_tx.transaction_id = cash_flow_tx.id

    await session.commit()
    await session.refresh(inv_tx)
    return inv_tx


async def get_payments(
    session: AsyncSession, transaction_id: uuid.UUID, workspace_id: uuid.UUID
) -> list[InventoryPayment]:
    result = await session.execute(
        select(InventoryPayment)
        .where(
            InventoryPayment.inventory_transaction_id == transaction_id,
            InventoryPayment.workspace_id == workspace_id
        )
        .order_by(InventoryPayment.created_at.asc())
    )
    return list(result.scalars().all())


async def record_payment(
    session: AsyncSession,
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    transaction_id: uuid.UUID,
    data: InventoryPaymentCreate,
) -> InventoryPayment:
    result = await session.execute(
        select(InventoryTransaction).where(
            InventoryTransaction.id == transaction_id,
            InventoryTransaction.workspace_id == workspace_id
        )
    )
    inv_tx = result.scalar_one_or_none()
    if not inv_tx:
        raise ValueError("Transaction not found")

    item = await get_item(session, inv_tx.item_id, workspace_id)
    if not item:
        raise ValueError("Item not found")

    total_amount = inv_tx.quantity * inv_tx.unit_price
    remaining = total_amount - inv_tx.paid_amount
    if remaining <= 0:
        raise ValueError("Transaction is already fully paid")

    payment_amount = min(data.amount, remaining)

    cash_flow_type = "credit" if inv_tx.type == "sale" else "debit"
    prefix = "Bayar Penjualan" if inv_tx.type == "sale" else "Bayar Pembelian"

    tx_create = TransactionCreate(
        description=f"{prefix} {item.name} (Cicilan/Pelunasan)",
        amount=payment_amount,
        date=data.date,
        type=cash_flow_type,
        account_id=data.account_id,
        notes=data.description or f"Pembayaran otomatis untuk transaksi: {inv_tx.id}",
    )

    cash_flow_tx = await transaction_service.create_transaction(
        session=session,
        workspace_id=workspace_id,
        user_id=user_id,
        data=tx_create,
    )

    payment = InventoryPayment(
        user_id=user_id,
        workspace_id=workspace_id,
        inventory_transaction_id=inv_tx.id,
        amount=payment_amount,
        date=data.date,
        account_id=data.account_id,
        transaction_id=cash_flow_tx.id,
        description=data.description or "Payment installment",
    )
    session.add(payment)

    inv_tx.paid_amount += payment_amount
    if inv_tx.paid_amount >= total_amount:
        inv_tx.payment_status = "paid"
    else:
        inv_tx.payment_status = "partial"

    # Map legacy transaction_id if not set yet
    if inv_tx.transaction_id is None:
        inv_tx.transaction_id = cash_flow_tx.id

    await session.commit()
    await session.refresh(payment)
    return payment


# --- Customer Service Methods ---
async def ensure_walk_in_customer(session: AsyncSession, workspace_id: uuid.UUID, user_id: uuid.UUID) -> Customer:
    result = await session.execute(
        select(Customer).where(
            Customer.workspace_id == workspace_id,
            Customer.name == "Walk In"
        )
    )
    walk_in = result.scalar_one_or_none()
    if not walk_in:
        walk_in = Customer(
            user_id=user_id,
            workspace_id=workspace_id,
            name="Walk In"
        )
        session.add(walk_in)
        await session.commit()
        await session.refresh(walk_in)
    return walk_in


async def get_customers(session: AsyncSession, workspace_id: uuid.UUID, user_id: uuid.UUID) -> list[Customer]:
    await ensure_walk_in_customer(session, workspace_id, user_id)
    result = await session.execute(
        select(Customer)
        .where(Customer.workspace_id == workspace_id)
        .order_by(Customer.created_at.asc())
    )
    return list(result.scalars().all())


async def get_customer(session: AsyncSession, customer_id: uuid.UUID, workspace_id: uuid.UUID) -> Optional[Customer]:
    result = await session.execute(
        select(Customer).where(Customer.id == customer_id, Customer.workspace_id == workspace_id)
    )
    return result.scalar_one_or_none()


async def create_customer(
    session: AsyncSession, workspace_id: uuid.UUID, user_id: uuid.UUID, data: CustomerCreate
) -> Customer:
    customer = Customer(
        user_id=user_id,
        workspace_id=workspace_id,
        name=data.name,
        phone=data.phone,
        email=data.email,
        address=data.address,
    )
    session.add(customer)
    await session.commit()
    await session.refresh(customer)
    return customer


async def update_customer(
    session: AsyncSession, customer_id: uuid.UUID, workspace_id: uuid.UUID, data: CustomerUpdate
) -> Optional[Customer]:
    customer = await get_customer(session, customer_id, workspace_id)
    if not customer:
        return None
    if customer.name == "Walk In" and data.name and data.name != "Walk In":
        raise ValueError("Cannot change the name of the default Walk In customer")

    update_dict = data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(customer, key, value)
    await session.commit()
    await session.refresh(customer)
    return customer


async def delete_customer(session: AsyncSession, customer_id: uuid.UUID, workspace_id: uuid.UUID) -> bool:
    customer = await get_customer(session, customer_id, workspace_id)
    if not customer:
        return False
    if customer.name == "Walk In":
        raise ValueError("Cannot delete the default Walk In customer")
    await session.delete(customer)
    await session.commit()
    return True


# --- Supplier Service Methods ---
async def ensure_walk_in_supplier(session: AsyncSession, workspace_id: uuid.UUID, user_id: uuid.UUID) -> Supplier:
    result = await session.execute(
        select(Supplier).where(
            Supplier.workspace_id == workspace_id,
            Supplier.name == "Walk In"
        )
    )
    walk_in = result.scalar_one_or_none()
    if not walk_in:
        walk_in = Supplier(
            user_id=user_id,
            workspace_id=workspace_id,
            name="Walk In"
        )
        session.add(walk_in)
        await session.commit()
        await session.refresh(walk_in)
    return walk_in


async def get_suppliers(session: AsyncSession, workspace_id: uuid.UUID, user_id: uuid.UUID) -> list[Supplier]:
    await ensure_walk_in_supplier(session, workspace_id, user_id)
    result = await session.execute(
        select(Supplier)
        .where(Supplier.workspace_id == workspace_id)
        .order_by(Supplier.created_at.asc())
    )
    return list(result.scalars().all())


async def get_supplier(session: AsyncSession, supplier_id: uuid.UUID, workspace_id: uuid.UUID) -> Optional[Supplier]:
    result = await session.execute(
        select(Supplier).where(Supplier.id == supplier_id, Supplier.workspace_id == workspace_id)
    )
    return result.scalar_one_or_none()


async def create_supplier(
    session: AsyncSession, workspace_id: uuid.UUID, user_id: uuid.UUID, data: SupplierCreate
) -> Supplier:
    supplier = Supplier(
        user_id=user_id,
        workspace_id=workspace_id,
        name=data.name,
        phone=data.phone,
        email=data.email,
        address=data.address,
    )
    session.add(supplier)
    await session.commit()
    await session.refresh(supplier)
    return supplier


async def update_supplier(
    session: AsyncSession, supplier_id: uuid.UUID, workspace_id: uuid.UUID, data: SupplierUpdate
) -> Optional[Supplier]:
    supplier = await get_supplier(session, supplier_id, workspace_id)
    if not supplier:
        return None
    if supplier.name == "Walk In" and data.name and data.name != "Walk In":
        raise ValueError("Cannot change the name of the default Walk In supplier")

    update_dict = data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(supplier, key, value)
    await session.commit()
    await session.refresh(supplier)
    return supplier


async def delete_supplier(session: AsyncSession, supplier_id: uuid.UUID, workspace_id: uuid.UUID) -> bool:
    supplier = await get_supplier(session, supplier_id, workspace_id)
    if not supplier:
        return False
    if supplier.name == "Walk In":
        raise ValueError("Cannot delete the default Walk In supplier")
    await session.delete(supplier)
    await session.commit()
    return True
