"""add suppliers and customers

Revision ID: 5b7c97e54366
Revises: 063
Create Date: 2026-06-13 06:46:35.118529

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5b7c97e54366'
down_revision: Union[str, Sequence[str], None] = '063'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create customers table
    op.create_table('customers',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('workspace_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('address', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_customers_workspace_id'), 'customers', ['workspace_id'], unique=False)

    # 2. Create suppliers table
    op.create_table('suppliers',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('workspace_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('address', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_suppliers_workspace_id'), 'suppliers', ['workspace_id'], unique=False)

    # 3. Add columns to inventory_transactions
    op.add_column('inventory_transactions', sa.Column('customer_id', sa.UUID(), nullable=True))
    op.add_column('inventory_transactions', sa.Column('supplier_id', sa.UUID(), nullable=True))
    op.create_index(op.f('ix_inventory_transactions_customer_id'), 'inventory_transactions', ['customer_id'], unique=False)
    op.create_index(op.f('ix_inventory_transactions_supplier_id'), 'inventory_transactions', ['supplier_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_suppliers_workspace_id'), table_name='suppliers')
    op.drop_table('suppliers')
    op.drop_index(op.f('ix_customers_workspace_id'), table_name='customers')
    op.drop_table('customers')

    with op.batch_alter_table("inventory_transactions") as batch_op:
        batch_op.drop_index('ix_inventory_transactions_customer_id')
        batch_op.drop_index('ix_inventory_transactions_supplier_id')
        batch_op.drop_column("customer_id")
        batch_op.drop_column("supplier_id")
