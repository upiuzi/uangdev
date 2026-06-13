from __future__ import annotations

from datetime import date as dt_date
from decimal import Decimal
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.services import inventory_service
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
from mcp_server.auth import CallContext
from mcp_server.registry import tool
from mcp_server.tools._helpers import num, parse_date, parse_uuid, resolve_workspace_id
from mcp_server.tools.proposals import _PROPOSAL_PREFACE, _APPLY_FIELD, _can_apply


@tool(
    name="list_inventory_items",
    description="List all inventory items (products/services) in the active workspace.",
    parameters={"type": "object", "properties": {}, "additionalProperties": False},
    tags=["read", "inventory"],
)
async def list_inventory_items(
    *,
    session: AsyncSession,
    ctx: CallContext,
) -> dict[str, Any]:
    ws_id = await resolve_workspace_id(session, ctx)
    items = await inventory_service.get_items(session, ws_id)
    serialized = [
        {
            "id": str(item.id),
            "name": item.name,
            "sku": item.sku,
            "description": item.description,
            "price": num(item.price),
            "cost": num(item.cost),
            "stock": num(item.stock),
            "type": item.type,
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "updated_at": item.updated_at.isoformat() if item.updated_at else None,
        }
        for item in items
    ]
    return {"items": serialized, "total": len(serialized)}


@tool(
    name="list_inventory_transactions",
    description="List all inventory transactions (sales, purchases, adjustments) in the active workspace.",
    parameters={"type": "object", "properties": {}, "additionalProperties": False},
    tags=["read", "inventory"],
)
async def list_inventory_transactions(
    *,
    session: AsyncSession,
    ctx: CallContext,
) -> dict[str, Any]:
    ws_id = await resolve_workspace_id(session, ctx)
    txs = await inventory_service.get_transactions(session, ws_id)
    serialized = [
        {
            "id": str(tx.id),
            "item_id": str(tx.item_id),
            "type": tx.type,
            "quantity": num(tx.quantity),
            "unit_price": num(tx.unit_price),
            "date": tx.date.isoformat() if tx.date else None,
            "description": tx.description,
            "transaction_id": str(tx.transaction_id) if tx.transaction_id else None,
            "customer_id": str(tx.customer_id) if tx.customer_id else None,
            "supplier_id": str(tx.supplier_id) if tx.supplier_id else None,
            "paid_amount": num(tx.paid_amount),
            "payment_status": tx.payment_status,
            "created_at": tx.created_at.isoformat() if tx.created_at else None,
        }
        for tx in txs
    ]
    return {"items": serialized, "total": len(serialized)}


@tool(
    name="list_inventory_payments",
    description="List all payment installments recorded for a specific inventory transaction.",
    parameters={
        "type": "object",
        "properties": {
            "transaction_id": {"type": "string", "format": "uuid"},
        },
        "required": ["transaction_id"],
        "additionalProperties": False,
    },
    tags=["read", "inventory"],
)
async def list_inventory_payments(
    *,
    session: AsyncSession,
    ctx: CallContext,
    transaction_id: str,
) -> dict[str, Any]:
    ws_id = await resolve_workspace_id(session, ctx)
    payments = await inventory_service.get_payments(session, parse_uuid(transaction_id), ws_id)
    serialized = [
        {
            "id": str(p.id),
            "inventory_transaction_id": str(p.inventory_transaction_id),
            "amount": num(p.amount),
            "date": p.date.isoformat() if p.date else None,
            "account_id": str(p.account_id) if p.account_id else None,
            "transaction_id": str(p.transaction_id) if p.transaction_id else None,
            "description": p.description,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in payments
    ]
    return {"items": serialized, "total": len(serialized)}


@tool(
    name="list_customers",
    description="List all customer contacts in the active workspace.",
    parameters={"type": "object", "properties": {}, "additionalProperties": False},
    tags=["read", "inventory"],
)
async def list_customers(
    *,
    session: AsyncSession,
    ctx: CallContext,
) -> dict[str, Any]:
    ws_id = await resolve_workspace_id(session, ctx)
    customers = await inventory_service.get_customers(session, ws_id, ctx.user_id)
    serialized = [
        {
            "id": str(c.id),
            "name": c.name,
            "phone": c.phone,
            "email": c.email,
            "address": c.address,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in customers
    ]
    return {"items": serialized, "total": len(serialized)}


@tool(
    name="list_suppliers",
    description="List all supplier contacts in the active workspace.",
    parameters={"type": "object", "properties": {}, "additionalProperties": False},
    tags=["read", "inventory"],
)
async def list_suppliers(
    *,
    session: AsyncSession,
    ctx: CallContext,
) -> dict[str, Any]:
    ws_id = await resolve_workspace_id(session, ctx)
    suppliers = await inventory_service.get_suppliers(session, ws_id, ctx.user_id)
    serialized = [
        {
            "id": str(s.id),
            "name": s.name,
            "phone": s.phone,
            "email": s.email,
            "address": s.address,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in suppliers
    ]
    return {"items": serialized, "total": len(serialized)}


@tool(
    name="propose_create_inventory_item",
    description=_PROPOSAL_PREFACE + "Propose creating a new inventory item (product or service).",
    parameters={
        "type": "object",
        "properties": {
            "name": {"type": "string", "minLength": 1},
            "sku": {"type": "string"},
            "description": {"type": "string"},
            "price": {"type": "number", "minimum": 0},
            "cost": {"type": "number", "minimum": 0},
            "type": {"type": "string", "enum": ["physical", "service"]},
            "apply": _APPLY_FIELD,
        },
        "required": ["name"],
        "additionalProperties": False,
    },
    is_proposal=True,
    tags=["propose", "inventory"],
)
async def propose_create_inventory_item(
    *,
    session: AsyncSession,
    ctx: CallContext,
    name: str,
    sku: str | None = None,
    description: str | None = None,
    price: float = 0.0,
    cost: float = 0.0,
    type: str = "physical",
    apply: bool = False,
) -> dict[str, Any]:
    ws_id = await resolve_workspace_id(session, ctx)
    proposed = {
        "name": name,
        "sku": sku,
        "description": description,
        "price": price,
        "cost": cost,
        "type": type,
    }
    preview = {
        "kind": "create_inventory_item",
        "proposed": proposed,
        "apply_endpoint": "POST /api/inventory/items",
    }
    if _can_apply(ctx, apply):
        created = await inventory_service.create_item(
            session,
            ws_id,
            ctx.user_id,
            InventoryItemCreate(
                name=name,
                sku=sku,
                description=description,
                price=Decimal(str(price)),
                cost=Decimal(str(cost)),
                type=type,
            )
        )
        return {
            "applied": True,
            "item": {
                "id": str(created.id),
                "name": created.name,
                "sku": created.sku,
                "price": num(created.price),
                "cost": num(created.cost),
                "type": created.type,
            }
        }
    return preview


@tool(
    name="propose_update_inventory_item",
    description=_PROPOSAL_PREFACE + "Propose updating details of an existing inventory item.",
    parameters={
        "type": "object",
        "properties": {
            "id": {"type": "string", "format": "uuid"},
            "name": {"type": "string"},
            "sku": {"type": "string"},
            "description": {"type": "string"},
            "price": {"type": "number", "minimum": 0},
            "cost": {"type": "number", "minimum": 0},
            "type": {"type": "string", "enum": ["physical", "service"]},
            "apply": _APPLY_FIELD,
        },
        "required": ["id"],
        "additionalProperties": False,
    },
    is_proposal=True,
    tags=["propose", "inventory"],
)
async def propose_update_inventory_item(
    *,
    session: AsyncSession,
    ctx: CallContext,
    id: str,
    name: str | None = None,
    sku: str | None = None,
    description: str | None = None,
    price: float | None = None,
    cost: float | None = None,
    type: str | None = None,
    apply: bool = False,
) -> dict[str, Any]:
    ws_id = await resolve_workspace_id(session, ctx)
    item_uuid = parse_uuid(id)
    item = await inventory_service.get_item(session, item_uuid, ws_id)
    if not item:
        return {"error": "inventory item not found"}

    proposed: dict[str, Any] = {}
    if name is not None:
        proposed["name"] = name
    if sku is not None:
        proposed["sku"] = sku
    if description is not None:
        proposed["description"] = description
    if price is not None:
        proposed["price"] = price
    if cost is not None:
        proposed["cost"] = cost
    if type is not None:
        proposed["type"] = type

    preview = {
        "kind": "update_inventory_item",
        "item_id": id,
        "original": {
            "name": item.name,
            "sku": item.sku,
            "description": item.description,
            "price": num(item.price),
            "cost": num(item.cost),
            "type": item.type,
        },
        "proposed": proposed,
        "apply_endpoint": f"PATCH /api/inventory/items/{id}",
    }

    if _can_apply(ctx, apply):
        updated = await inventory_service.update_item(
            session,
            item_uuid,
            ws_id,
            InventoryItemUpdate(
                name=name,
                sku=sku,
                description=description,
                price=Decimal(str(price)) if price is not None else None,
                cost=Decimal(str(cost)) if cost is not None else None,
                type=type,
            )
        )
        if not updated:
            return {"error": "failed to update item"}
        return {
            "applied": True,
            "item": {
                "id": str(updated.id),
                "name": updated.name,
                "sku": updated.sku,
                "price": num(updated.price),
                "cost": num(updated.cost),
                "type": updated.type,
            }
        }
    return preview


@tool(
    name="propose_delete_inventory_item",
    description=_PROPOSAL_PREFACE + "Propose deleting an inventory item.",
    parameters={
        "type": "object",
        "properties": {
            "id": {"type": "string", "format": "uuid"},
            "apply": _APPLY_FIELD,
        },
        "required": ["id"],
        "additionalProperties": False,
    },
    is_proposal=True,
    tags=["propose", "inventory"],
)
async def propose_delete_inventory_item(
    *,
    session: AsyncSession,
    ctx: CallContext,
    id: str,
    apply: bool = False,
) -> dict[str, Any]:
    ws_id = await resolve_workspace_id(session, ctx)
    item_uuid = parse_uuid(id)
    item = await inventory_service.get_item(session, item_uuid, ws_id)
    if not item:
        return {"error": "inventory item not found"}

    preview = {
        "kind": "delete_inventory_item",
        "item_id": id,
        "name": item.name,
        "sku": item.sku,
        "apply_endpoint": f"DELETE /api/inventory/items/{id}",
    }

    if _can_apply(ctx, apply):
        deleted = await inventory_service.delete_item(session, item_uuid, ws_id)
        return {"applied": True, "deleted": deleted}

    return preview


@tool(
    name="propose_create_inventory_transaction",
    description=_PROPOSAL_PREFACE + "Propose recording a new inventory transaction (sale, purchase, or adjustment).",
    parameters={
        "type": "object",
        "properties": {
            "item_id": {"type": "string", "format": "uuid"},
            "type": {"type": "string", "enum": ["sale", "purchase", "adjustment"]},
            "quantity": {"type": "number", "minimum": 0.0001},
            "unit_price": {"type": "number", "minimum": 0},
            "date": {"type": "string", "format": "date"},
            "description": {"type": "string"},
            "account_id": {"type": "string", "format": "uuid"},
            "paid_amount": {"type": "number", "minimum": 0},
            "customer_id": {"type": "string", "format": "uuid"},
            "supplier_id": {"type": "string", "format": "uuid"},
            "apply": _APPLY_FIELD,
        },
        "required": ["item_id", "type", "quantity", "unit_price"],
        "additionalProperties": False,
    },
    is_proposal=True,
    tags=["propose", "inventory"],
)
async def propose_create_inventory_transaction(
    *,
    session: AsyncSession,
    ctx: CallContext,
    item_id: str,
    type: str,
    quantity: float,
    unit_price: float,
    date: str | None = None,
    description: str | None = None,
    account_id: str | None = None,
    paid_amount: float | None = None,
    customer_id: str | None = None,
    supplier_id: str | None = None,
    apply: bool = False,
) -> dict[str, Any]:
    ws_id = await resolve_workspace_id(session, ctx)
    item_uuid = parse_uuid(item_id)
    item = await inventory_service.get_item(session, item_uuid, ws_id)
    if not item:
        return {"error": "item not found"}

    target_date = parse_date(date) or dt_date.today()

    proposed = {
        "item_id": item_id,
        "item_name": item.name,
        "type": type,
        "quantity": quantity,
        "unit_price": unit_price,
        "date": target_date.isoformat(),
        "description": description,
        "account_id": account_id,
        "paid_amount": paid_amount,
        "customer_id": customer_id,
        "supplier_id": supplier_id,
    }

    preview = {
        "kind": "create_inventory_transaction",
        "proposed": proposed,
        "apply_endpoint": f"POST /api/inventory/items/{item_id}/transactions",
    }

    if _can_apply(ctx, apply):
        try:
            created = await inventory_service.create_inventory_transaction(
                session,
                ws_id,
                ctx.user_id,
                item_uuid,
                InventoryTransactionCreate(
                    type=type,
                    quantity=Decimal(str(quantity)),
                    unit_price=Decimal(str(unit_price)),
                    date=target_date,
                    description=description,
                    account_id=parse_uuid(account_id) if account_id else None,
                    paid_amount=Decimal(str(paid_amount)) if paid_amount is not None else None,
                    customer_id=parse_uuid(customer_id) if customer_id else None,
                    supplier_id=parse_uuid(supplier_id) if supplier_id else None,
                )
            )
            return {
                "applied": True,
                "transaction": {
                    "id": str(created.id),
                    "type": created.type,
                    "quantity": num(created.quantity),
                    "unit_price": num(created.unit_price),
                    "payment_status": created.payment_status,
                    "paid_amount": num(created.paid_amount),
                }
            }
        except ValueError as e:
            return {"error": str(e)}

    return preview


@tool(
    name="propose_create_inventory_payment",
    description=_PROPOSAL_PREFACE + "Propose recording a payment installment for an inventory transaction.",
    parameters={
        "type": "object",
        "properties": {
            "transaction_id": {"type": "string", "format": "uuid"},
            "amount": {"type": "number", "minimum": 0.01},
            "date": {"type": "string", "format": "date"},
            "account_id": {"type": "string", "format": "uuid"},
            "description": {"type": "string"},
            "apply": _APPLY_FIELD,
        },
        "required": ["transaction_id", "amount", "account_id"],
        "additionalProperties": False,
    },
    is_proposal=True,
    tags=["propose", "inventory"],
)
async def propose_create_inventory_payment(
    *,
    session: AsyncSession,
    ctx: CallContext,
    transaction_id: str,
    amount: float,
    account_id: str,
    date: str | None = None,
    description: str | None = None,
    apply: bool = False,
) -> dict[str, Any]:
    ws_id = await resolve_workspace_id(session, ctx)
    tx_uuid = parse_uuid(transaction_id)
    target_date = parse_date(date) or dt_date.today()

    proposed = {
        "transaction_id": transaction_id,
        "amount": amount,
        "date": target_date.isoformat(),
        "account_id": account_id,
        "description": description,
    }

    preview = {
        "kind": "create_inventory_payment",
        "proposed": proposed,
        "apply_endpoint": f"POST /api/inventory/transactions/{transaction_id}/payments",
    }

    if _can_apply(ctx, apply):
        try:
            created = await inventory_service.record_payment(
                session,
                ws_id,
                ctx.user_id,
                tx_uuid,
                InventoryPaymentCreate(
                    amount=Decimal(str(amount)),
                    date=target_date,
                    account_id=parse_uuid(account_id),
                    description=description,
                )
            )
            return {
                "applied": True,
                "payment": {
                    "id": str(created.id),
                    "amount": num(created.amount),
                    "date": created.date.isoformat(),
                }
            }
        except ValueError as e:
            return {"error": str(e)}

    return preview


@tool(
    name="propose_create_customer",
    description=_PROPOSAL_PREFACE + "Propose creating a new customer contact.",
    parameters={
        "type": "object",
        "properties": {
            "name": {"type": "string", "minLength": 1},
            "phone": {"type": "string"},
            "email": {"type": "string"},
            "address": {"type": "string"},
            "apply": _APPLY_FIELD,
        },
        "required": ["name"],
        "additionalProperties": False,
    },
    is_proposal=True,
    tags=["propose", "inventory"],
)
async def propose_create_customer(
    *,
    session: AsyncSession,
    ctx: CallContext,
    name: str,
    phone: str | None = None,
    email: str | None = None,
    address: str | None = None,
    apply: bool = False,
) -> dict[str, Any]:
    ws_id = await resolve_workspace_id(session, ctx)
    proposed = {
        "name": name,
        "phone": phone,
        "email": email,
        "address": address,
    }
    preview = {
        "kind": "create_customer",
        "proposed": proposed,
        "apply_endpoint": "POST /api/inventory/customers",
    }
    if _can_apply(ctx, apply):
        created = await inventory_service.create_customer(
            session,
            ws_id,
            ctx.user_id,
            CustomerCreate(name=name, phone=phone, email=email, address=address)
        )
        return {
            "applied": True,
            "customer": {
                "id": str(created.id),
                "name": created.name,
                "phone": created.phone,
                "email": created.email,
                "address": created.address,
            }
        }
    return preview


@tool(
    name="propose_update_customer",
    description=_PROPOSAL_PREFACE + "Propose updating an existing customer contact.",
    parameters={
        "type": "object",
        "properties": {
            "id": {"type": "string", "format": "uuid"},
            "name": {"type": "string"},
            "phone": {"type": "string"},
            "email": {"type": "string"},
            "address": {"type": "string"},
            "apply": _APPLY_FIELD,
        },
        "required": ["id"],
        "additionalProperties": False,
    },
    is_proposal=True,
    tags=["propose", "inventory"],
)
async def propose_update_customer(
    *,
    session: AsyncSession,
    ctx: CallContext,
    id: str,
    name: str | None = None,
    phone: str | None = None,
    email: str | None = None,
    address: str | None = None,
    apply: bool = False,
) -> dict[str, Any]:
    ws_id = await resolve_workspace_id(session, ctx)
    cust_uuid = parse_uuid(id)
    cust = await inventory_service.get_customer(session, cust_uuid, ws_id)
    if not cust:
        return {"error": "customer not found"}

    proposed: dict[str, Any] = {}
    if name is not None:
        proposed["name"] = name
    if phone is not None:
        proposed["phone"] = phone
    if email is not None:
        proposed["email"] = email
    if address is not None:
        proposed["address"] = address

    preview = {
        "kind": "update_customer",
        "customer_id": id,
        "original": {
            "name": cust.name,
            "phone": cust.phone,
            "email": cust.email,
            "address": cust.address,
        },
        "proposed": proposed,
        "apply_endpoint": f"PATCH /api/inventory/customers/{id}",
    }

    if _can_apply(ctx, apply):
        try:
            updated = await inventory_service.update_customer(
                session,
                cust_uuid,
                ws_id,
                CustomerUpdate(name=name, phone=phone, email=email, address=address)
            )
            if not updated:
                return {"error": "failed to update customer"}
            return {
                "applied": True,
                "customer": {
                    "id": str(updated.id),
                    "name": updated.name,
                    "phone": updated.phone,
                    "email": updated.email,
                    "address": updated.address,
                }
            }
        except ValueError as e:
            return {"error": str(e)}

    return preview


@tool(
    name="propose_delete_customer",
    description=_PROPOSAL_PREFACE + "Propose deleting a customer contact.",
    parameters={
        "type": "object",
        "properties": {
            "id": {"type": "string", "format": "uuid"},
            "apply": _APPLY_FIELD,
        },
        "required": ["id"],
        "additionalProperties": False,
    },
    is_proposal=True,
    tags=["propose", "inventory"],
)
async def propose_delete_customer(
    *,
    session: AsyncSession,
    ctx: CallContext,
    id: str,
    apply: bool = False,
) -> dict[str, Any]:
    ws_id = await resolve_workspace_id(session, ctx)
    cust_uuid = parse_uuid(id)
    cust = await inventory_service.get_customer(session, cust_uuid, ws_id)
    if not cust:
        return {"error": "customer not found"}

    preview = {
        "kind": "delete_customer",
        "customer_id": id,
        "name": cust.name,
        "apply_endpoint": f"DELETE /api/inventory/customers/{id}",
    }

    if _can_apply(ctx, apply):
        try:
            deleted = await inventory_service.delete_customer(session, cust_uuid, ws_id)
            return {"applied": True, "deleted": deleted}
        except ValueError as e:
            return {"error": str(e)}

    return preview


@tool(
    name="propose_create_supplier",
    description=_PROPOSAL_PREFACE + "Propose creating a new supplier contact.",
    parameters={
        "type": "object",
        "properties": {
            "name": {"type": "string", "minLength": 1},
            "phone": {"type": "string"},
            "email": {"type": "string"},
            "address": {"type": "string"},
            "apply": _APPLY_FIELD,
        },
        "required": ["name"],
        "additionalProperties": False,
    },
    is_proposal=True,
    tags=["propose", "inventory"],
)
async def propose_create_supplier(
    *,
    session: AsyncSession,
    ctx: CallContext,
    name: str,
    phone: str | None = None,
    email: str | None = None,
    address: str | None = None,
    apply: bool = False,
) -> dict[str, Any]:
    ws_id = await resolve_workspace_id(session, ctx)
    proposed = {
        "name": name,
        "phone": phone,
        "email": email,
        "address": address,
    }
    preview = {
        "kind": "create_supplier",
        "proposed": proposed,
        "apply_endpoint": "POST /api/inventory/suppliers",
    }
    if _can_apply(ctx, apply):
        created = await inventory_service.create_supplier(
            session,
            ws_id,
            ctx.user_id,
            SupplierCreate(name=name, phone=phone, email=email, address=address)
        )
        return {
            "applied": True,
            "supplier": {
                "id": str(created.id),
                "name": created.name,
                "phone": created.phone,
                "email": created.email,
                "address": created.address,
            }
        }
    return preview


@tool(
    name="propose_update_supplier",
    description=_PROPOSAL_PREFACE + "Propose updating an existing supplier contact.",
    parameters={
        "type": "object",
        "properties": {
            "id": {"type": "string", "format": "uuid"},
            "name": {"type": "string"},
            "phone": {"type": "string"},
            "email": {"type": "string"},
            "address": {"type": "string"},
            "apply": _APPLY_FIELD,
        },
        "required": ["id"],
        "additionalProperties": False,
    },
    is_proposal=True,
    tags=["propose", "inventory"],
)
async def propose_update_supplier(
    *,
    session: AsyncSession,
    ctx: CallContext,
    id: str,
    name: str | None = None,
    phone: str | None = None,
    email: str | None = None,
    address: str | None = None,
    apply: bool = False,
) -> dict[str, Any]:
    ws_id = await resolve_workspace_id(session, ctx)
    supp_uuid = parse_uuid(id)
    supp = await inventory_service.get_supplier(session, supp_uuid, ws_id)
    if not supp:
        return {"error": "supplier not found"}

    proposed: dict[str, Any] = {}
    if name is not None:
        proposed["name"] = name
    if phone is not None:
        proposed["phone"] = phone
    if email is not None:
        proposed["email"] = email
    if address is not None:
        proposed["address"] = address

    preview = {
        "kind": "update_supplier",
        "supplier_id": id,
        "original": {
            "name": supp.name,
            "phone": supp.phone,
            "email": supp.email,
            "address": supp.address,
        },
        "proposed": proposed,
        "apply_endpoint": f"PATCH /api/inventory/suppliers/{id}",
    }

    if _can_apply(ctx, apply):
        try:
            updated = await inventory_service.update_supplier(
                session,
                supp_uuid,
                ws_id,
                SupplierUpdate(name=name, phone=phone, email=email, address=address)
            )
            if not updated:
                return {"error": "failed to update supplier"}
            return {
                "applied": True,
                "supplier": {
                    "id": str(updated.id),
                    "name": updated.name,
                    "phone": updated.phone,
                    "email": updated.email,
                    "address": updated.address,
                }
            }
        except ValueError as e:
            return {"error": str(e)}

    return preview


@tool(
    name="propose_delete_supplier",
    description=_PROPOSAL_PREFACE + "Propose deleting a supplier contact.",
    parameters={
        "type": "object",
        "properties": {
            "id": {"type": "string", "format": "uuid"},
            "apply": _APPLY_FIELD,
        },
        "required": ["id"],
        "additionalProperties": False,
    },
    is_proposal=True,
    tags=["propose", "inventory"],
)
async def propose_delete_supplier(
    *,
    session: AsyncSession,
    ctx: CallContext,
    id: str,
    apply: bool = False,
) -> dict[str, Any]:
    ws_id = await resolve_workspace_id(session, ctx)
    supp_uuid = parse_uuid(id)
    supp = await inventory_service.get_supplier(session, supp_uuid, ws_id)
    if not supp:
        return {"error": "supplier not found"}

    preview = {
        "kind": "delete_supplier",
        "supplier_id": id,
        "name": supp.name,
        "apply_endpoint": f"DELETE /api/inventory/suppliers/{id}",
    }

    if _can_apply(ctx, apply):
        try:
            deleted = await inventory_service.delete_supplier(session, supp_uuid, ws_id)
            return {"applied": True, "deleted": deleted}
        except ValueError as e:
            return {"error": str(e)}

    return preview
