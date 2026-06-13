import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.inventory_item import InventoryItem
    from app.models.inventory_payment import InventoryPayment
    from app.models.transaction import Transaction
    from app.models.user import User
    from app.models.customer import Customer
    from app.models.supplier import Supplier


class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id", ondelete="CASCADE"), index=True
    )
    type: Mapped[str] = mapped_column(String(50), nullable=False)  # 'sale', 'purchase', 'adjustment'
    quantity: Mapped[Decimal] = mapped_column(Numeric(precision=18, scale=4), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(precision=18, scale=2), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    transaction_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("transactions.id", ondelete="SET NULL"), nullable=True
    )
    customer_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True
    )
    supplier_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("suppliers.id", ondelete="SET NULL"), nullable=True, index=True
    )
    payment_status: Mapped[str] = mapped_column(String(50), default="unpaid", nullable=False)  # 'unpaid', 'partial', 'paid'
    paid_amount: Mapped[Decimal] = mapped_column(Numeric(precision=18, scale=2), default=Decimal("0.00"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship()
    item: Mapped["InventoryItem"] = relationship(back_populates="transactions")
    cash_flow_transaction: Mapped[Optional["Transaction"]] = relationship()
    customer: Mapped[Optional["Customer"]] = relationship(back_populates="transactions")
    supplier: Mapped[Optional["Supplier"]] = relationship(back_populates="transactions")
    payments: Mapped[list["InventoryPayment"]] = relationship(
        back_populates="inventory_transaction", cascade="all, delete-orphan"
    )
