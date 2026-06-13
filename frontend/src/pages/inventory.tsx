import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { inventory as inventoryApi, accounts as accountsApi } from '@/lib/api'
import { formatCurrency } from '@/lib/format'
import { useDisplayLocale } from '@/hooks/use-display-locale'
import { useAuth } from '@/contexts/auth-context'
import { useWorkspace } from '@/contexts/workspace-context'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/page-header'
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  TrendingDown,
  TrendingUp,
  Sliders,
  DollarSign,
  AlertTriangle,
  History,
  Info,
} from 'lucide-react'
import type { InventoryItem, InventoryTransaction } from '@/types'

export default function InventoryPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { canWrite } = useWorkspace()
  const locale = useDisplayLocale()
  const userCurrency = user?.preferences?.currency_display ?? 'USD'

  // State Dialogs
  const [itemDialogOpen, setItemDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [txDialogOpen, setTxDialogOpen] = useState(false)
  const [activeItemForTx, setActiveItemForTx] = useState<InventoryItem | null>(null)

  // Form States - Item
  const [itemName, setItemName] = useState('')
  const [itemSku, setItemSku] = useState('')
  const [itemDescription, setItemDescription] = useState('')
  const [itemPrice, setItemPrice] = useState('0.00')
  const [itemCost, setItemCost] = useState('0.00')

  // Form States - Transaction
  const [txType, setTxType] = useState<'sale' | 'purchase' | 'adjustment'>('sale')
  const [txQty, setTxQty] = useState('1')
  const [txUnitPrice, setTxUnitPrice] = useState('0.00')
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0])
  const [txDesc, setTxDesc] = useState('')
  const [txAccountId, setTxAccountId] = useState('none')

  // Queries
  const { data: items = [] } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: inventoryApi.listItems,
  })

  const { data: transactions = [] } = useQuery({
    queryKey: ['inventory-transactions'],
    queryFn: inventoryApi.listTransactions,
  })

  const { data: accountsList = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: accountsApi.list,
  })

  // Mutations
  const createItemMutation = useMutation({
    mutationFn: inventoryApi.createItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
      setItemDialogOpen(false)
      toast.success(t('inventory.itemCreated', 'Item created successfully'))
    },
  })

  const updateItemMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      inventoryApi.updateItem(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
      setItemDialogOpen(false)
      toast.success(t('inventory.itemUpdated', 'Item information updated'))
    },
  })

  const deleteItemMutation = useMutation({
    mutationFn: inventoryApi.deleteItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
      toast.success(t('inventory.itemDeleted', 'Item deleted successfully'))
    },
  })

  const createTxMutation = useMutation({
    mutationFn: ({ itemId, payload }: { itemId: string; payload: any }) =>
      inventoryApi.createTransaction(itemId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-transactions'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] }) // Refresh balance
      setTxDialogOpen(false)
      toast.success(t('inventory.txCreated', 'Stock transaction recorded successfully'))
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || t('common.error', 'Terjadi kesalahan'))
    },
  })

  // Handlers
  const handleOpenCreateItem = () => {
    setEditingItem(null)
    setItemName('')
    setItemSku('')
    setItemDescription('')
    setItemPrice('0.00')
    setItemCost('0.00')
    setItemDialogOpen(true)
  }

  const handleOpenEditItem = (item: InventoryItem) => {
    setEditingItem(item)
    setItemName(item.name)
    setItemSku(item.sku ?? '')
    setItemDescription(item.description ?? '')
    setItemPrice(item.price.toFixed(2))
    setItemCost(item.cost.toFixed(2))
    setItemDialogOpen(true)
  }

  const handleOpenRecordTx = (item: InventoryItem) => {
    setActiveItemForTx(item)
    setTxType('sale')
    setTxQty('1')
    setTxUnitPrice(item.price.toFixed(2))
    setTxDate(new Date().toISOString().split('T')[0])
    setTxDesc('')
    setTxAccountId('none')
    setTxDialogOpen(true)
  }

  const handleItemSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      name: itemName,
      sku: itemSku || undefined,
      description: itemDescription || undefined,
      price: parseFloat(itemPrice) || 0,
      cost: parseFloat(itemCost) || 0,
    }

    if (editingItem) {
      updateItemMutation.mutate({ id: editingItem.id, payload })
    } else {
      createItemMutation.mutate(payload)
    }
  }

  const handleTxSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeItemForTx) return

    const payload: any = {
      type: txType,
      quantity: parseFloat(txQty) || 0,
      unit_price: parseFloat(txUnitPrice) || 0,
      date: txDate,
      description: txDesc || undefined,
      account_id: txAccountId !== 'none' ? txAccountId : undefined,
    }

    createTxMutation.mutate({ itemId: activeItemForTx.id, payload })
  }

  // Update default unit price based on transaction type
  const handleTxTypeChange = (value: 'sale' | 'purchase' | 'adjustment') => {
    setTxType(value)
    if (!activeItemForTx) return
    if (value === 'sale') {
      setTxUnitPrice(activeItemForTx.price.toFixed(2))
    } else if (value === 'purchase') {
      setTxUnitPrice(activeItemForTx.cost.toFixed(2))
    } else {
      setTxUnitPrice('0.00')
    }
  }

  // Metrics
  const totalStockValue = items.reduce(
    (sum, item) => sum + Number(item.stock) * Number(item.cost),
    0
  )
  const lowStockCount = items.filter((item) => Number(item.stock) <= 0).length

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('inventory.title', 'Inventory & Sales')}
        description={t('inventory.subtitle', 'Manage inventory, stock purchases, and sales of goods')}
        action={
          canWrite && (
            <Button onClick={handleOpenCreateItem} className="gap-2">
              <Plus size={16} />
              {t('inventory.addItem', 'Add Item')}
            </Button>
          )
        }
      />

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-sm border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('inventory.totalItems', 'Total Items')}
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Package size={16} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{items.length}</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('inventory.itemsRegistered', 'items registered in inventory')}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('inventory.stockValue', 'Inventory Value (Cost)')}
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <DollarSign size={16} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalStockValue, userCurrency, locale)}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('inventory.totalCostBasis', 'calculated based on cost basis')}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('inventory.outOfStock', 'Out of Stock')}
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
              <AlertTriangle size={16} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{lowStockCount}</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('inventory.requireRestock', 'items require restocking')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="items" className="w-full">
        <TabsList className="bg-muted/60 p-1 rounded-lg border border-border/40">
          <TabsTrigger value="items" className="gap-2">
            <Package size={14} />
            {t('inventory.itemsTab', 'Item List')}
          </TabsTrigger>
          <TabsTrigger value="transactions" className="gap-2">
            <History size={14} />
            {t('inventory.historyTab', 'Stock History')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="pt-4">
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('inventory.itemName', 'Item Name')}</TableHead>
                  <TableHead>{t('inventory.skuHeader', 'SKU')}</TableHead>
                  <TableHead className="text-right">{t('inventory.stockHeader', 'Stock')}</TableHead>
                  <TableHead className="text-right">{t('inventory.costHeader', 'Cost Price')}</TableHead>
                  <TableHead className="text-right">{t('inventory.priceHeader', 'Sale Price')}</TableHead>
                  <TableHead className="text-center w-[160px]">{t('inventory.actionsHeader', 'Actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Package size={32} className="text-muted-foreground/50" />
                        <p>{t('inventory.noItems', 'No items registered yet.')}</p>
                        {canWrite && (
                          <Button variant="outline" size="sm" onClick={handleOpenCreateItem} className="mt-2">
                            {t('inventory.addFirstItem', 'Add First Item')}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="font-medium">
                        <div>
                          <p className="text-sm text-foreground">{item.name}</p>
                          {item.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]" title={item.description}>
                              {item.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{item.sku || '—'}</TableCell>
                      <TableCell className="text-right font-semibold">
                        <span className={Number(item.stock) <= 0 ? 'text-destructive font-bold' : ''}>
                          {parseFloat(item.stock.toString()).toString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatCurrency(item.cost, userCurrency, locale)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatCurrency(item.price, userCurrency, locale)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {canWrite && (
                            <>
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() => handleOpenRecordTx(item)}
                                className="h-7 text-xs px-2"
                                title="Catat Jual/Beli"
                              >
                                {t('inventory.recordTxBtn', 'Buy/Sell')}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenEditItem(item)}
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              >
                                <Pencil size={14} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (confirm(t('inventory.confirmDelete', 'Delete this item and its stock history?'))) {
                                    deleteItemMutation.mutate(item.id)
                                  }
                                }}
                                className="h-7 w-7 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 size={14} />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="transactions" className="pt-4">
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('inventory.txDate', 'Date')}</TableHead>
                  <TableHead>{t('inventory.txItem', 'Item')}</TableHead>
                  <TableHead>{t('inventory.txType', 'Type')}</TableHead>
                  <TableHead className="text-right">{t('inventory.txQty', 'Quantity')}</TableHead>
                  <TableHead className="text-right">{t('inventory.txPrice', 'Unit Price')}</TableHead>
                  <TableHead className="text-right">{t('inventory.txTotal', 'Total')}</TableHead>
                  <TableHead>{t('inventory.txDesc', 'Description')}</TableHead>
                  <TableHead className="text-center">{t('inventory.txLinked', 'Cash Flow')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <History size={32} className="text-muted-foreground/50" />
                        <p>{t('inventory.noTransactions', 'No stock transactions recorded yet.')}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((tx) => {
                    const item = items.find((i) => i.id === tx.item_id)
                    const totalVal = Number(tx.quantity) * Number(tx.unit_price)

                    return (
                      <TableRow key={tx.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(tx.date + 'T00:00:00').toLocaleDateString(locale)}
                        </TableCell>
                        <TableCell className="font-medium">{item?.name || t('inventory.unknownItem', 'Deleted Item')}</TableCell>
                        <TableCell>
                          {tx.type === 'sale' ? (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1 font-semibold">
                              <TrendingDown size={11} /> {t('inventory.badgeSale', 'Sale')}
                            </Badge>
                          ) : tx.type === 'purchase' ? (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 gap-1 font-semibold">
                              <TrendingUp size={11} /> {t('inventory.badgePurchase', 'Purchase')}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-slate-500/10 text-slate-600 border-slate-500/20 gap-1 font-semibold">
                              <Sliders size={11} /> {t('inventory.badgeAdjustment', 'Adjustment')}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {tx.type === 'sale' ? '-' : tx.type === 'purchase' ? '+' : ''}
                          {parseFloat(tx.quantity.toString()).toString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatCurrency(tx.unit_price, userCurrency, locale)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold">
                          {tx.type === 'adjustment' ? '—' : formatCurrency(totalVal, userCurrency, locale)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{tx.description || '—'}</TableCell>
                        <TableCell className="text-center">
                          {tx.transaction_id ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-medium" title="Saldo kas/bank terhubung otomatis">
                              Linked
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground/60">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* dialog 1: Add/Edit Item */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleItemSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingItem ? t('inventory.editItemTitle', 'Edit Inventory Item') : t('inventory.addItemTitle', 'Add Inventory Item')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">{t('inventory.itemNameLabel', 'Item Name')}</Label>
                <Input
                  id="name"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="Contoh: Kopi Bubuk Arabika"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sku">{t('inventory.skuLabel', 'SKU (Item Code)')}</Label>
                <Input
                  id="sku"
                  value={itemSku}
                  onChange={(e) => setItemSku(e.target.value)}
                  placeholder="Contoh: KPA-001 (opsional)"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">{t('inventory.descriptionLabel', 'Description')}</Label>
                <Input
                  id="description"
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  placeholder="Contoh: Kopi arabika sumatra kemasan 250gr"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="cost">{t('inventory.costLabel', 'Cost (Purchase Price)')}</Label>
                  <Input
                    id="cost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={itemCost}
                    onChange={(e) => setItemCost(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="price">{t('inventory.priceLabel', 'Sale Price')}</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setItemDialogOpen(false)}>
                {t('common.cancel', 'Batal')}
              </Button>
              <Button type="submit" disabled={createItemMutation.isPending || updateItemMutation.isPending}>
                {t('common.save', 'Simpan')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* dialog 2: Record Stock Transaction */}
      <Dialog open={txDialogOpen} onOpenChange={setTxDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleTxSubmit}>
            <DialogHeader>
              <DialogTitle>
                {t('inventory.recordTxTitle', 'Record Stock Transaction')}
              </DialogTitle>
              {activeItemForTx && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t('inventory.txItemSubtitle', 'Item:')} <span className="font-semibold text-foreground">{activeItemForTx.name}</span> (Stok saat ini: {parseFloat(activeItemForTx.stock.toString()).toString()})
                </p>
              )}
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="txType">{t('inventory.txTypeLabel', 'Transaction Type')}</Label>
                <Select value={txType} onValueChange={(val: any) => handleTxTypeChange(val)}>
                  <SelectTrigger id="txType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sale">{t('inventory.optSale', 'Sale (Stock Decrease)')}</SelectItem>
                    <SelectItem value="purchase">{t('inventory.optPurchase', 'Purchase (Stock Increase)')}</SelectItem>
                    <SelectItem value="adjustment">{t('inventory.optAdjustment', 'Adjustment (Set Stock Level)')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="qty">
                    {txType === 'adjustment' ? t('inventory.qtyTargetLabel', 'New Stock Level') : t('inventory.qtyLabel', 'Quantity')}
                  </Label>
                  <Input
                    id="qty"
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    value={txQty}
                    onChange={(e) => setTxQty(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="txPrice">
                    {txType === 'adjustment' ? t('inventory.txPriceLabelDummy', 'Price (Ignored)') : t('inventory.txPriceLabel', 'Unit Price')}
                  </Label>
                  <Input
                    id="txPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={txUnitPrice}
                    onChange={(e) => setTxUnitPrice(e.target.value)}
                    disabled={txType === 'adjustment'}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="txDate">{t('inventory.txDateLabel', 'Date')}</Label>
                <Input
                  id="txDate"
                  type="date"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="txDesc">{t('inventory.txDescLabel', 'Description')}</Label>
                <Input
                  id="txDesc"
                  value={txDesc}
                  onChange={(e) => setTxDesc(e.target.value)}
                  placeholder="Contoh: Terjual 3 pack kopi arabika (opsional)"
                />
              </div>

              {txType !== 'adjustment' && (
                <div className="space-y-1.5 bg-muted/40 p-3 rounded-lg border border-border/40">
                  <Label htmlFor="accountSelect" className="flex items-center gap-1.5 text-xs text-foreground font-semibold">
                    <Info size={12} className="text-primary" />
                    {txType === 'sale'
                      ? t('inventory.linkAccountSale', 'Link to Cash Flow (Record Income)?')
                      : t('inventory.linkAccountPurchase', 'Link to Cash Flow (Record Expense)?')}
                  </Label>
                  <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
                    {t('inventory.linkAccountHelp', 'If selected, the linked bank account balance will be automatically adjusted.')}
                  </p>
                  <Select value={txAccountId} onValueChange={setTxAccountId}>
                    <SelectTrigger id="accountSelect" className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('inventory.optNoLink', 'Stock Only (No Cash Transaction)')}</SelectItem>
                      {accountsList.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.display_name || acc.name} ({formatCurrency(acc.current_balance, acc.currency, locale)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTxDialogOpen(false)}>
                {t('common.cancel', 'Batal')}
              </Button>
              <Button type="submit" disabled={createTxMutation.isPending}>
                {t('common.save', 'Simpan')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
