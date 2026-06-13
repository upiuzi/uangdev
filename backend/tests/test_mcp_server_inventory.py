from __future__ import annotations

import uuid
from decimal import Decimal
from datetime import date
import pytest

import mcp_server.tools.inventory as inventory_tool
from mcp_server.auth import CallContext


def _ctx(user_id, external=False, workspace_id=None):
    return CallContext(user_id=user_id, external=external, workspace_id=workspace_id)


@pytest.mark.asyncio
async def test_list_inventory_items(session, test_user, test_workspace):
    # Seed an inventory item directly
    from app.models.inventory_item import InventoryItem
    item = InventoryItem(
        user_id=test_user.id,
        workspace_id=test_workspace.id,
        name="MCP Widget",
        sku="MCP-1",
        description="Widget for MCP",
        price=Decimal("19.99"),
        cost=Decimal("9.99"),
        stock=Decimal("5.0"),
        type="physical",
    )
    session.add(item)
    await session.commit()

    ctx = _ctx(test_user.id, workspace_id=test_workspace.id)
    result = await inventory_tool.list_inventory_items(session=session, ctx=ctx)
    assert result["total"] == 1
    item_res = result["items"][0]
    assert item_res["name"] == "MCP Widget"
    assert item_res["sku"] == "MCP-1"
    assert item_res["price"] == 19.99
    assert item_res["cost"] == 9.99
    assert item_res["stock"] == 5.0
    assert item_res["type"] == "physical"


@pytest.mark.asyncio
async def test_list_customers_and_suppliers(session, test_user, test_workspace):
    # Get customers (seeds Walk In automatically)
    ctx = _ctx(test_user.id, workspace_id=test_workspace.id)
    result = await inventory_tool.list_customers(session=session, ctx=ctx)
    assert result["total"] == 1
    assert result["items"][0]["name"] == "Walk In"

    # Get suppliers (seeds Walk In automatically)
    result_supp = await inventory_tool.list_suppliers(session=session, ctx=ctx)
    assert result_supp["total"] == 1
    assert result_supp["items"][0]["name"] == "Walk In"


@pytest.mark.asyncio
async def test_propose_create_inventory_item(session, test_user, test_workspace):
    ctx_internal = _ctx(test_user.id, external=False, workspace_id=test_workspace.id)
    
    # Internal call (preview only)
    res_preview = await inventory_tool.propose_create_inventory_item(
        session=session,
        ctx=ctx_internal,
        name="Internal Widget",
        price=10.0,
        cost=5.0,
        type="physical",
    )
    assert "proposed" in res_preview
    assert res_preview["proposed"]["name"] == "Internal Widget"
    assert "apply_endpoint" in res_preview
    assert not res_preview.get("applied")

    # External call with apply=True (does actual write)
    ctx_external = _ctx(test_user.id, external=True, workspace_id=test_workspace.id)
    res_apply = await inventory_tool.propose_create_inventory_item(
        session=session,
        ctx=ctx_external,
        name="External Widget",
        price=15.0,
        cost=7.5,
        type="physical",
        apply=True,
    )
    assert res_apply["applied"] is True
    assert res_apply["item"]["name"] == "External Widget"
    assert res_apply["item"]["price"] == 15.0


@pytest.mark.asyncio
async def test_propose_create_inventory_transaction(session, test_user, test_workspace):
    # Create inventory item first
    from app.models.inventory_item import InventoryItem
    item = InventoryItem(
        user_id=test_user.id,
        workspace_id=test_workspace.id,
        name="MCP Tx Item",
        price=Decimal("10.00"),
        cost=Decimal("5.00"),
        stock=Decimal("10.0"),
        type="physical",
    )
    session.add(item)
    await session.commit()

    ctx = _ctx(test_user.id, external=True, workspace_id=test_workspace.id)
    
    # Propose sale
    res_tx = await inventory_tool.propose_create_inventory_transaction(
        session=session,
        ctx=ctx,
        item_id=str(item.id),
        type="sale",
        quantity=2.0,
        unit_price=10.0,
        apply=True,
    )
    
    assert res_tx["applied"] is True
    assert res_tx["transaction"]["type"] == "sale"
    assert res_tx["transaction"]["quantity"] == 2.0
    assert res_tx["transaction"]["unit_price"] == 10.0
