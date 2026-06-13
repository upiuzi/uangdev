import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.workspace_context import (
    WorkspaceContext,
    current_workspace,
    current_writable_workspace,
)
from app.schemas.inventory import (
    InventoryItemCreate,
    InventoryItemRead,
    InventoryItemUpdate,
    InventoryTransactionCreate,
    InventoryTransactionRead,
    InventoryPaymentCreate,
    InventoryPaymentRead,
    CustomerCreate,
    CustomerRead,
    CustomerUpdate,
    SupplierCreate,
    SupplierRead,
    SupplierUpdate,
)
from app.services import inventory_service

router = APIRouter(prefix="/api/inventory", tags=["inventory"])


@router.get("/items", response_model=list[InventoryItemRead])
async def list_items(
    ctx: WorkspaceContext = Depends(current_workspace),
    session: AsyncSession = Depends(get_async_session),
):
    return await inventory_service.get_items(session, ctx.workspace.id)


@router.post("/items", response_model=InventoryItemRead, status_code=status.HTTP_201_CREATED)
async def create_item(
    data: InventoryItemCreate,
    ctx: WorkspaceContext = Depends(current_writable_workspace),
    session: AsyncSession = Depends(get_async_session),
):
    return await inventory_service.create_item(session, ctx.workspace.id, ctx.user_id, data)


@router.patch("/items/{item_id}", response_model=InventoryItemRead)
async def update_item(
    item_id: uuid.UUID,
    data: InventoryItemUpdate,
    ctx: WorkspaceContext = Depends(current_writable_workspace),
    session: AsyncSession = Depends(get_async_session),
):
    item = await inventory_service.update_item(session, item_id, ctx.workspace.id, data)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return item


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    item_id: uuid.UUID,
    ctx: WorkspaceContext = Depends(current_writable_workspace),
    session: AsyncSession = Depends(get_async_session),
):
    deleted = await inventory_service.delete_item(session, item_id, ctx.workspace.id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")


@router.get("/transactions", response_model=list[InventoryTransactionRead])
async def list_transactions(
    ctx: WorkspaceContext = Depends(current_workspace),
    session: AsyncSession = Depends(get_async_session),
):
    return await inventory_service.get_transactions(session, ctx.workspace.id)


@router.post("/items/{item_id}/transactions", response_model=InventoryTransactionRead, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    item_id: uuid.UUID,
    data: InventoryTransactionCreate,
    ctx: WorkspaceContext = Depends(current_writable_workspace),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        return await inventory_service.create_inventory_transaction(
            session=session,
            workspace_id=ctx.workspace.id,
            user_id=ctx.user_id,
            item_id=item_id,
            data=data,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/transactions/{transaction_id}/payments", response_model=list[InventoryPaymentRead])
async def list_payments(
    transaction_id: uuid.UUID,
    ctx: WorkspaceContext = Depends(current_workspace),
    session: AsyncSession = Depends(get_async_session),
):
    return await inventory_service.get_payments(session, transaction_id, ctx.workspace.id)


@router.post("/transactions/{transaction_id}/payments", response_model=InventoryPaymentRead, status_code=status.HTTP_201_CREATED)
async def create_payment(
    transaction_id: uuid.UUID,
    data: InventoryPaymentCreate,
    ctx: WorkspaceContext = Depends(current_writable_workspace),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        return await inventory_service.record_payment(
            session=session,
            workspace_id=ctx.workspace.id,
            user_id=ctx.user_id,
            transaction_id=transaction_id,
            data=data,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# --- Customers Endpoints ---
@router.get("/customers", response_model=list[CustomerRead])
async def list_customers(
    ctx: WorkspaceContext = Depends(current_workspace),
    session: AsyncSession = Depends(get_async_session),
):
    return await inventory_service.get_customers(session, ctx.workspace.id, ctx.user_id)


@router.post("/customers", response_model=CustomerRead, status_code=status.HTTP_201_CREATED)
async def create_customer(
    data: CustomerCreate,
    ctx: WorkspaceContext = Depends(current_writable_workspace),
    session: AsyncSession = Depends(get_async_session),
):
    return await inventory_service.create_customer(session, ctx.workspace.id, ctx.user_id, data)


@router.patch("/customers/{customer_id}", response_model=CustomerRead)
async def update_customer(
    customer_id: uuid.UUID,
    data: CustomerUpdate,
    ctx: WorkspaceContext = Depends(current_writable_workspace),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        customer = await inventory_service.update_customer(session, customer_id, ctx.workspace.id, data)
        if not customer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
        return customer
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(
    customer_id: uuid.UUID,
    ctx: WorkspaceContext = Depends(current_writable_workspace),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        deleted = await inventory_service.delete_customer(session, customer_id, ctx.workspace.id)
        if not deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# --- Suppliers Endpoints ---
@router.get("/suppliers", response_model=list[SupplierRead])
async def list_suppliers(
    ctx: WorkspaceContext = Depends(current_workspace),
    session: AsyncSession = Depends(get_async_session),
):
    return await inventory_service.get_suppliers(session, ctx.workspace.id, ctx.user_id)


@router.post("/suppliers", response_model=SupplierRead, status_code=status.HTTP_201_CREATED)
async def create_supplier(
    data: SupplierCreate,
    ctx: WorkspaceContext = Depends(current_writable_workspace),
    session: AsyncSession = Depends(get_async_session),
):
    return await inventory_service.create_supplier(session, ctx.workspace.id, ctx.user_id, data)


@router.patch("/suppliers/{supplier_id}", response_model=SupplierRead)
async def update_supplier(
    supplier_id: uuid.UUID,
    data: SupplierUpdate,
    ctx: WorkspaceContext = Depends(current_writable_workspace),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        supplier = await inventory_service.update_supplier(session, supplier_id, ctx.workspace.id, data)
        if not supplier:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
        return supplier
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/suppliers/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_supplier(
    supplier_id: uuid.UUID,
    ctx: WorkspaceContext = Depends(current_writable_workspace),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        deleted = await inventory_service.delete_supplier(session, supplier_id, ctx.workspace.id)
        if not deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
