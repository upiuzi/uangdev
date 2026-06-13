"""add type to inventory_items, payment fields to inventory_transactions, and create inventory_payments table

Revision ID: 063
Revises: 062
Create Date: 2026-06-13
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "063"
down_revision: Union[str, None] = "062"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add type to inventory_items
    op.add_column(
        "inventory_items",
        sa.Column("type", sa.String(length=50), nullable=False, server_default="physical"),
    )

    # 2. Add payment columns to inventory_transactions
    op.add_column(
        "inventory_transactions",
        sa.Column("payment_status", sa.String(length=50), nullable=False, server_default="unpaid"),
    )
    op.add_column(
        "inventory_transactions",
        sa.Column("paid_amount", sa.Numeric(precision=18, scale=2), nullable=False, server_default="0.00"),
    )

    # 3. Create inventory_payments table
    op.create_table(
        "inventory_payments",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("workspace_id", sa.UUID(), nullable=False),
        sa.Column("inventory_transaction_id", sa.UUID(), nullable=False),
        sa.Column("amount", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("account_id", sa.UUID(), nullable=True),
        sa.Column("transaction_id", sa.UUID(), nullable=True),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["inventory_transaction_id"], ["inventory_transactions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["transaction_id"], ["transactions.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_inventory_payments_workspace_id", "inventory_payments", ["workspace_id"], unique=False)
    op.create_index(
        "ix_inventory_payments_inventory_transaction_id",
        "inventory_payments",
        ["inventory_transaction_id"],
        unique=False,
    )


def downgrade() -> None:
    # Drop index and table
    op.drop_table("inventory_payments")

    # Drop columns using batch operations for SQLite compatibility
    with op.batch_alter_table("inventory_transactions") as batch_op:
        batch_op.drop_column("payment_status")
        batch_op.drop_column("paid_amount")

    with op.batch_alter_table("inventory_items") as batch_op:
        batch_op.drop_column("type")
