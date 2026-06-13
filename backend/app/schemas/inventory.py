import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class InventoryItemBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    sku: Optional[str] = Field(default=None, max_length=100)
    description: Optional[str] = Field(default=None, max_length=1000)
    price: Decimal = Field(default=Decimal("0.00"), ge=0)
    cost: Decimal = Field(default=Decimal("0.00"), ge=0)
    type: str = Field(default="physical", pattern="^(physical|service)$")


class InventoryItemCreate(InventoryItemBase):
    pass


class InventoryItemUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    sku: Optional[str] = Field(default=None, max_length=100)
    description: Optional[str] = Field(default=None, max_length=1000)
    price: Optional[Decimal] = Field(default=None, ge=0)
    cost: Optional[Decimal] = Field(default=None, ge=0)
    type: Optional[str] = Field(default=None, pattern="^(physical|service)$")


class InventoryItemRead(InventoryItemBase):
    id: uuid.UUID
    user_id: uuid.UUID
    workspace_id: uuid.UUID
    stock: Decimal
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InventoryTransactionBase(BaseModel):
    type: str = Field(pattern="^(sale|purchase|adjustment)$")
    quantity: Decimal = Field(gt=0)
    unit_price: Decimal = Field(ge=0)
    date: date
    description: Optional[str] = Field(default=None, max_length=500)


class InventoryTransactionCreate(InventoryTransactionBase):
    account_id: Optional[uuid.UUID] = None
    paid_amount: Optional[Decimal] = Field(default=None, ge=0)
    customer_id: Optional[uuid.UUID] = None
    supplier_id: Optional[uuid.UUID] = None


class InventoryTransactionRead(InventoryTransactionBase):
    id: uuid.UUID
    user_id: uuid.UUID
    workspace_id: uuid.UUID
    item_id: uuid.UUID
    transaction_id: Optional[uuid.UUID] = None
    paid_amount: Decimal
    payment_status: str
    customer_id: Optional[uuid.UUID] = None
    supplier_id: Optional[uuid.UUID] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InventoryPaymentCreate(BaseModel):
    amount: Decimal = Field(gt=0)
    date: date
    account_id: uuid.UUID
    description: Optional[str] = Field(default=None, max_length=500)


class InventoryPaymentRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    workspace_id: uuid.UUID
    inventory_transaction_id: uuid.UUID
    amount: Decimal
    date: date
    account_id: Optional[uuid.UUID] = None
    transaction_id: Optional[uuid.UUID] = None
    description: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CustomerBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=50)
    email: Optional[str] = Field(default=None, max_length=255)
    address: Optional[str] = Field(default=None, max_length=500)


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=50)
    email: Optional[str] = Field(default=None, max_length=255)
    address: Optional[str] = Field(default=None, max_length=500)


class CustomerRead(CustomerBase):
    id: uuid.UUID
    user_id: uuid.UUID
    workspace_id: uuid.UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SupplierBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=50)
    email: Optional[str] = Field(default=None, max_length=255)
    address: Optional[str] = Field(default=None, max_length=500)


class SupplierCreate(SupplierBase):
    pass


class SupplierUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=50)
    email: Optional[str] = Field(default=None, max_length=255)
    address: Optional[str] = Field(default=None, max_length=500)


class SupplierRead(SupplierBase):
    id: uuid.UUID
    user_id: uuid.UUID
    workspace_id: uuid.UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
