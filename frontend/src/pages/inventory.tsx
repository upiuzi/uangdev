import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
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
  ShoppingBag,
  ShoppingCart,
  Banknote,
  Users,
} from 'lucide-react'
import type { InventoryItem, InventoryTransaction, Customer, Supplier } from '@/types'

export default function InventoryPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { canWrite } = useWorkspace()
  const locale = useDisplayLocale()
  const userCurrency = user?.preferences?.currency_display ?? 'USD'

  // Determine current mode from path
  const location = useLocation()
  const currentPath = location.pathname
  const mode = currentPath.endsWith('/sales')
    ? 'sales'
    : currentPath.endsWith('/purchases')
    ? 'purchases'
    : currentPath.endsWith('/contacts')
    ? 'contacts'
    : 'items'

  // State Dialogs
  const [itemDialogOpen, setItemDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [txDialogOpen, setTxDialogOpen] = useState(false)
  const [activeItemForTx, setActiveItemForTx] = useState<InventoryItem | null>(null)
  const [selectedItemId, setSelectedItemId] = useState('')

  // State Contacts
  const [contactsTab, setContactsTab] = useState<'customers' | 'suppliers'>('customers')
  const [contactDialogOpen, setContactDialogOpen] = useState(false)
  const [contactType, setContactType] = useState<'customer' | 'supplier'>('customer')
  const [editingContact, setEditingContact] = useState<Customer | Supplier | null>(null)
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactAddress, setContactAddress] = useState('')

  // Form States - Item
  const [itemName, setItemName] = useState('')
  const [itemSku, setItemSku] = useState('')
  const [itemDescription, setItemDescription] = useState('')
  const [itemPrice, setItemPrice] = useState('0.00')
  const [itemCost, setItemCost] = useState('0.00')
  const [itemType, setItemType] = useState<'physical' | 'service'>('physical')

  // Form States - Transaction
  const [txType, setTxType] = useState<'sale' | 'purchase' | 'adjustment'>('sale')
  const [txQty, setTxQty] = useState('1')
  const [txUnitPrice, setTxUnitPrice] = useState('0.00')
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0])
  const [txDesc, setTxDesc] = useState('')
  const [txAccountId, setTxAccountId] = useState('none')
  const [paymentType, setPaymentType] = useState<'full' | 'partial' | 'deferred'>('full')
  const [txPaidAmount, setTxPaidAmount] = useState('0.00')
  const [selectedCustomerId, setSelectedCustomerId] = useState('walk-in')
  const [selectedSupplierId, setSelectedSupplierId] = useState('walk-in')

  // Form States - Payments List & New payment
  const [paymentsDialogOpen, setPaymentsDialogOpen] = useState(false)
  const [selectedTxForPayments, setSelectedTxForPayments] = useState<InventoryTransaction | null>(null)
  const [newPaymentAmount, setNewPaymentAmount] = useState('0.00')
  const [newPaymentDate, setNewPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [newPaymentAccountId, setNewPaymentAccountId] = useState('none')
  const [newPaymentDescription, setNewPaymentDescription] = useState('')

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
    queryFn: () => accountsApi.list(),
  })

  const { data: paymentsList = [], isLoading: loadingPayments } = useQuery({
    queryKey: ['inventory-payments', selectedTxForPayments?.id],
    queryFn: () => selectedTxForPayments ? inventoryApi.listPayments(selectedTxForPayments.id) : Promise.resolve([]),
    enabled: !!selectedTxForPayments,
  })

  const { data: customers = [] } = useQuery({
    queryKey: ['inventory-customers'],
    queryFn: inventoryApi.getCustomers,
  })

  const { data: suppliers = [] } = useQuery({
    queryKey: ['inventory-suppliers'],
    queryFn: inventoryApi.getSuppliers,
  })

  // Effects to resolve default "Walk In" customer and supplier IDs
  React.useEffect(() => {
    if (customers.length > 0 && selectedCustomerId === 'walk-in') {
      const walkIn = customers.find((c) => c.name === 'Walk In')
      if (walkIn) setSelectedCustomerId(walkIn.id)
    }
  }, [customers, selectedCustomerId])

  React.useEffect(() => {
    if (suppliers.length > 0 && selectedSupplierId === 'walk-in') {
      const walkIn = suppliers.find((s) => s.name === 'Walk In')
      if (walkIn) setSelectedSupplierId(walkIn.id)
    }
  }, [suppliers, selectedSupplierId])


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
      toast.error(err?.response?.data?.detail || t('common.error', 'An error occurred'))
    },
  })

  const createPaymentMutation = useMutation({
    mutationFn: ({ txId, payload }: { txId: string; payload: any }) =>
      inventoryApi.createPayment(txId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-payments', selectedTxForPayments?.id] })
      queryClient.invalidateQueries({ queryKey: ['inventory-transactions'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] }) // Refresh balance
      toast.success(t('inventory.paymentRecorded', 'Payment installment recorded successfully'))
      setNewPaymentAmount('0.00')
      setNewPaymentDescription('')
      // Update selectedTxForPayments values locally to refresh headers without waiting
      if (selectedTxForPayments) {
        const remaining = (Number(selectedTxForPayments.quantity) * Number(selectedTxForPayments.unit_price)) - (Number(selectedTxForPayments.paid_amount) + parseFloat(newPaymentAmount))
        setSelectedTxForPayments({
          ...selectedTxForPayments,
          paid_amount: selectedTxForPayments.paid_amount + parseFloat(newPaymentAmount),
          payment_status: remaining <= 0 ? 'paid' : 'partial'
        })
        setNewPaymentAmount(Math.max(0, remaining).toFixed(2))
      }
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || t('common.error', 'An error occurred'))
    },
  })

  const createCustomerMutation = useMutation({
    mutationFn: inventoryApi.createCustomer,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-customers'] })
      setContactDialogOpen(false)
      toast.success(t('inventory.customerCreated', 'Customer created successfully'))
      setSelectedCustomerId(data.id)
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || t('common.error', 'An error occurred'))
    },
  })

  const updateCustomerMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      inventoryApi.updateCustomer(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-customers'] })
      setContactDialogOpen(false)
      toast.success(t('inventory.customerUpdated', 'Customer information updated'))
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || t('common.error', 'An error occurred'))
    },
  })

  const deleteCustomerMutation = useMutation({
    mutationFn: inventoryApi.deleteCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-customers'] })
      toast.success(t('inventory.customerDeleted', 'Customer deleted successfully'))
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || t('common.error', 'An error occurred'))
    },
  })

  const createSupplierMutation = useMutation({
    mutationFn: inventoryApi.createSupplier,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-suppliers'] })
      setContactDialogOpen(false)
      toast.success(t('inventory.supplierCreated', 'Supplier created successfully'))
      setSelectedSupplierId(data.id)
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || t('common.error', 'An error occurred'))
    },
  })

  const updateSupplierMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      inventoryApi.updateSupplier(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-suppliers'] })
      setContactDialogOpen(false)
      toast.success(t('inventory.supplierUpdated', 'Supplier information updated'))
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || t('common.error', 'An error occurred'))
    },
  })

  const deleteSupplierMutation = useMutation({
    mutationFn: inventoryApi.deleteSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-suppliers'] })
      toast.success(t('inventory.supplierDeleted', 'Supplier deleted successfully'))
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || t('common.error', 'An error occurred'))
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
    setItemType('physical')
    setItemDialogOpen(true)
  }

  const handleOpenEditItem = (item: InventoryItem) => {
    setEditingItem(item)
    setItemName(item.name)
    setItemSku(item.sku ?? '')
    setItemDescription(item.description ?? '')
    setItemPrice(item.price.toFixed(2))
    setItemCost(item.cost.toFixed(2))
    setItemType(item.type ?? 'physical')
    setItemDialogOpen(true)
  }

  const handleOpenRecordTx = (item: InventoryItem) => {
    setActiveItemForTx(item)
    setSelectedItemId(item.id)
    setTxType('sale')
    setTxQty('1')
    setTxUnitPrice(item.price.toFixed(2))
    setTxDate(new Date().toISOString().split('T')[0])
    setTxDesc('')
    setTxAccountId(accountsList[0]?.id || 'none')
    setPaymentType('full')
    setTxPaidAmount(item.price.toFixed(2))
    const walkInCust = customers.find((c) => c.name === 'Walk In')
    if (walkInCust) setSelectedCustomerId(walkInCust.id)
    const walkInSupp = suppliers.find((s) => s.name === 'Walk In')
    if (walkInSupp) setSelectedSupplierId(walkInSupp.id)
    setTxDialogOpen(true)
  }

  const handleOpenRecordSale = () => {
    setActiveItemForTx(null)
    setSelectedItemId('')
    setTxType('sale')
    setTxQty('1')
    setTxUnitPrice('0.00')
    setTxDate(new Date().toISOString().split('T')[0])
    setTxDesc('')
    setTxAccountId(accountsList[0]?.id || 'none')
    setPaymentType('full')
    setTxPaidAmount('0.00')
    const walkInCust = customers.find((c) => c.name === 'Walk In')
    if (walkInCust) setSelectedCustomerId(walkInCust.id)
    setTxDialogOpen(true)
  }

  const handleOpenRecordPurchase = () => {
    setActiveItemForTx(null)
    setSelectedItemId('')
    setTxType('purchase')
    setTxQty('1')
    setTxUnitPrice('0.00')
    setTxDate(new Date().toISOString().split('T')[0])
    setTxDesc('')
    setTxAccountId(accountsList[0]?.id || 'none')
    setPaymentType('full')
    setTxPaidAmount('0.00')
    const walkInSupp = suppliers.find((s) => s.name === 'Walk In')
    if (walkInSupp) setSelectedSupplierId(walkInSupp.id)
    setTxDialogOpen(true)
  }

  const handleOpenCreateContact = () => {
    setEditingContact(null)
    setContactName('')
    setContactPhone('')
    setContactEmail('')
    setContactAddress('')
    setContactType(contactsTab === 'customers' ? 'customer' : 'supplier')
    setContactDialogOpen(true)
  }

  const handleOpenEditContact = (contact: Customer | Supplier, type: 'customer' | 'supplier') => {
    setEditingContact(contact)
    setContactName(contact.name)
    setContactPhone(contact.phone ?? '')
    setContactEmail(contact.email ?? '')
    setContactAddress(contact.address ?? '')
    setContactType(type)
    setContactDialogOpen(true)
  }

  const handleOpenManagePayments = (tx: InventoryTransaction) => {
    setSelectedTxForPayments(tx)
    const total = Number(tx.quantity) * Number(tx.unit_price)
    const remaining = total - Number(tx.paid_amount)
    setNewPaymentAmount(Math.max(0, remaining).toFixed(2))
    setNewPaymentDate(new Date().toISOString().split('T')[0])
    setNewPaymentAccountId(accountsList[0]?.id || 'none')
    setNewPaymentDescription('')
    setPaymentsDialogOpen(true)
  }

  const handleItemSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      name: itemName,
      sku: itemSku || undefined,
      description: itemDescription || undefined,
      price: parseFloat(itemPrice) || 0,
      cost: parseFloat(itemCost) || 0,
      type: itemType,
    }

    if (editingItem) {
      updateItemMutation.mutate({ id: editingItem.id, payload })
    } else {
      createItemMutation.mutate(payload)
    }
  }

  const handleTxSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const targetItemId = activeItemForTx?.id || selectedItemId
    if (!targetItemId) {
      toast.error(t('inventory.errNoItem', 'Please select an item first'))
      return
    }

    const qty = parseFloat(txQty) || 0
    const price = parseFloat(txUnitPrice) || 0
    const total = qty * price

    const payload: any = {
      type: txType,
      quantity: qty,
      unit_price: price,
      date: txDate,
      description: txDesc || undefined,
    }

    if (txType === 'sale' && selectedCustomerId) {
      payload.customer_id = selectedCustomerId
    } else if (txType === 'purchase' && selectedSupplierId) {
      payload.supplier_id = selectedSupplierId
    }

    if (txType !== 'adjustment') {
      if (paymentType === 'full') {
        payload.paid_amount = total
        payload.account_id = txAccountId !== 'none' ? txAccountId : undefined
        if (!payload.account_id) {
          toast.error(t('inventory.errNoAccount', 'Please select a payment account'))
          return
        }
      } else if (paymentType === 'partial') {
        payload.paid_amount = parseFloat(txPaidAmount) || 0
        payload.account_id = txAccountId !== 'none' ? txAccountId : undefined
        if (payload.paid_amount <= 0) {
          toast.error(t('inventory.errPaidAmountGtZero', 'Paid amount must be greater than zero'))
          return
        }
        if (payload.paid_amount > total) {
          toast.error(t('inventory.errPaidAmountLtTotal', 'Paid amount cannot exceed total transaction amount'))
          return
        }
        if (!payload.account_id) {
          toast.error(t('inventory.errNoAccount', 'Please select a payment account'))
          return
        }
      } else {
        payload.paid_amount = 0
      }
    }

    createTxMutation.mutate({ itemId: targetItemId, payload })
  }

  // Update default unit price and paid amount based on transaction type and selected item
  const handleTxTypeChange = (value: 'sale' | 'purchase' | 'adjustment') => {
    setTxType(value)
    const currentItem = activeItemForTx || items.find((i) => i.id === selectedItemId)
    if (!currentItem) return
    let calculatedPrice = 0
    if (value === 'sale') {
      calculatedPrice = currentItem.price
    } else if (value === 'purchase') {
      calculatedPrice = currentItem.cost
    }
    setTxUnitPrice(calculatedPrice.toFixed(2))
    setTxPaidAmount((calculatedPrice * (parseFloat(txQty) || 1)).toFixed(2))
  }

  const handleQtyOrPriceChange = (qtyStr: string, priceStr: string) => {
    const qty = parseFloat(qtyStr) || 0
    const price = parseFloat(priceStr) || 0
    if (paymentType === 'full') {
      setTxPaidAmount((qty * price).toFixed(2))
    }
  }

  // Metrics - Items
  const totalStockValue = items.reduce(
    (sum, item) => sum + (item.type === 'physical' ? Number(item.stock) * Number(item.cost) : 0),
    0
  )
  const lowStockCount = items.filter((item) => item.type === 'physical' && Number(item.stock) <= 0).length

  // Filter transactions by type
  const saleTransactions = transactions.filter((t) => t.type === 'sale')
  const purchaseTransactions = transactions.filter((t) => t.type === 'purchase')

  // Metrics - Sales
  const totalSalesRevenue = saleTransactions.reduce(
    (sum, tx) => sum + Number(tx.quantity) * Number(tx.unit_price),
    0
  )
  const salesCount = saleTransactions.length
  const totalStockSold = saleTransactions.reduce(
    (sum, tx) => sum + Number(tx.quantity),
    0
  )

  // Metrics - Purchases
  const totalPurchasesExpense = purchaseTransactions.reduce(
    (sum, tx) => sum + Number(tx.quantity) * Number(tx.unit_price),
    0
  )
  const purchasesCount = purchaseTransactions.length
  const totalStockPurchased = purchaseTransactions.reduce(
    (sum, tx) => sum + Number(tx.quantity),
    0
  )

  // Page Header Details
  const headerTitle =
    mode === 'sales'
      ? t('inventory.salesTitle', 'Sales')
      : mode === 'purchases'
      ? t('inventory.purchasesTitle', 'Purchases')
      : t('inventory.itemsTitle', 'Business Items')

  const headerDescription =
    mode === 'sales'
      ? t('inventory.salesSubtitle', 'Track and record your merchandise sales history')
      : mode === 'purchases'
      ? t('inventory.purchasesSubtitle', 'Track and record your merchandise purchase history')
      : t('inventory.itemsSubtitle', 'Manage your merchandise items and stock levels')

  const headerAction = canWrite && (
    mode === 'sales' ? (
      <Button onClick={handleOpenRecordSale} className="gap-2">
        <Plus size={16} />
        {t('inventory.recordSale', 'Record Sale')}
      </Button>
    ) : mode === 'purchases' ? (
      <Button onClick={handleOpenRecordPurchase} className="gap-2">
        <Plus size={16} />
        {t('inventory.recordPurchase', 'Record Purchase')}
      </Button>
    ) : (
      <Button onClick={handleOpenCreateItem} className="gap-2">
        <Plus size={16} />
        {t('inventory.addItem', 'Add Item')}
      </Button>
    )
  )

  return (
    <div className="space-y-6">
      <PageHeader
        section={headerDescription}
        title={headerTitle}
        action={headerAction}
      />

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {mode === 'items' && (
          <>
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
                  {t('inventory.requireRestock', 'physical items require restocking')}
                </p>
              </CardContent>
            </Card>
          </>
        )}

        {mode === 'sales' && (
          <>
            <Card className="shadow-sm border-border/60">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('inventory.totalRevenue', 'Total Sales Revenue')}
                </CardTitle>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <DollarSign size={16} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">
                  {formatCurrency(totalSalesRevenue, userCurrency, locale)}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('inventory.totalRevenueBasis', 'consolidated store revenue')}
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border/60">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('inventory.salesCount', 'Sales Count')}
                </CardTitle>
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <ShoppingBag size={16} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{salesCount}</div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('inventory.salesCountDesc', 'completed checkout transactions')}
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border/60">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('inventory.stockSold', 'Stock Sold')}
                </CardTitle>
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <Package size={16} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalStockSold.toString()}</div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('inventory.stockSoldDesc', 'units delivered to clients')}
                </p>
              </CardContent>
            </Card>
          </>
        )}

        {mode === 'purchases' && (
          <>
            <Card className="shadow-sm border-border/60">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('inventory.totalExpense', 'Total Purchase Expense')}
                </CardTitle>
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-500">
                  <DollarSign size={16} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-rose-600">
                  {formatCurrency(totalPurchasesExpense, userCurrency, locale)}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('inventory.totalExpenseBasis', 'consolidated restocking costs')}
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border/60">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('inventory.purchasesCount', 'Purchases Count')}
                </CardTitle>
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <ShoppingCart size={16} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{purchasesCount}</div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('inventory.purchasesCountDesc', 'completed supplier acquisitions')}
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border/60">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('inventory.stockPurchased', 'Stock Purchased')}
                </CardTitle>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <Package size={16} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalStockPurchased.toString()}</div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('inventory.stockPurchasedDesc', 'units received at warehouse')}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Main Content Area */}
      <div className="pt-2">
        {mode === 'items' && (
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
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-foreground font-semibold">{item.name}</span>
                            {item.type === 'service' ? (
                              <Badge variant="outline" className="bg-sky-500/10 text-sky-600 border-sky-500/20 text-[10px] py-0 px-1.5 font-medium leading-none h-4">
                                {t('inventory.badgeService', 'Service')}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] py-0 px-1.5 font-medium leading-none h-4">
                                {t('inventory.badgePhysical', 'Physical')}
                              </Badge>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]" title={item.description}>
                              {item.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{item.sku || '—'}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {item.type === 'service' ? (
                          <span className="text-muted-foreground/60 font-normal">—</span>
                        ) : (
                          <span className={Number(item.stock) <= 0 ? 'text-destructive font-bold' : ''}>
                            {parseFloat(item.stock.toString()).toString()}
                          </span>
                        )}
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
        )}

        {(mode === 'sales' || mode === 'purchases') && (
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
                  <TableHead className="text-center">{t('inventory.txPaymentStatus', 'Payment Status')}</TableHead>
                  <TableHead>{t('inventory.txDesc', 'Description')}</TableHead>
                  <TableHead className="text-center w-[100px]">{t('inventory.actionsHeader', 'Actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(mode === 'sales' ? saleTransactions : purchaseTransactions).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <History size={32} className="text-muted-foreground/50" />
                        <p>{t('inventory.noTransactions', 'No stock transactions recorded yet.')}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  (mode === 'sales' ? saleTransactions : purchaseTransactions).map((tx) => {
                    const item = items.find((i) => i.id === tx.item_id)
                    const totalVal = Number(tx.quantity) * Number(tx.unit_price)
                    const customerName = tx.customer_id ? (customers.find((c) => c.id === tx.customer_id)?.name || 'Walk In') : null
                    const supplierName = tx.supplier_id ? (suppliers.find((s) => s.id === tx.supplier_id)?.name || 'Walk In') : null

                    return (
                      <TableRow key={tx.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(tx.date + 'T00:00:00').toLocaleDateString(locale)}
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="space-y-0.5">
                            <p>{item?.name || t('inventory.unknownItem', 'Deleted Item')}</p>
                            {tx.type === 'sale' && (
                              <span className="text-[11px] text-muted-foreground block">
                                {t('inventory.toCustomer', 'To')}: {customerName || 'Walk In'}
                              </span>
                            )}
                            {tx.type === 'purchase' && (
                              <span className="text-[11px] text-muted-foreground block">
                                {t('inventory.fromSupplier', 'From')}: {supplierName || 'Walk In'}
                              </span>
                            )}
                            {item?.type === 'service' && (
                              <span className="text-[10px] text-sky-500 font-medium block">{t('inventory.badgeService', 'Service')}</span>
                            )}
                          </div>
                        </TableCell>
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
                        <TableCell className="text-center">
                          {tx.type !== 'adjustment' ? (
                            <div className="flex flex-col items-center gap-0.5">
                              {tx.payment_status === 'paid' ? (
                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] font-semibold py-0.5 h-5">
                                  {t('inventory.statusPaid', 'Paid')}
                                </Badge>
                              ) : tx.payment_status === 'partial' ? (
                                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] font-semibold py-0.5 h-5">
                                  {t('inventory.statusPartial', 'Partial')}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[10px] font-semibold py-0.5 h-5">
                                  {t('inventory.statusUnpaid', 'Unpaid')}
                                </Badge>
                              )}
                              <span className="text-[9px] text-muted-foreground font-mono">
                                {formatCurrency(Number(tx.paid_amount), userCurrency, locale)} / {formatCurrency(totalVal, userCurrency, locale)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/60">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{tx.description || '—'}</TableCell>
                        <TableCell className="text-center">
                          {tx.type !== 'adjustment' && (
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => handleOpenManagePayments(tx)}
                              className="h-7 text-xs px-2 gap-1 rounded-lg"
                            >
                              <Banknote size={12} />
                              {tx.payment_status === 'paid'
                                ? t('inventory.viewPayments', 'History')
                                : t('inventory.payInstallment', 'Pay')}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {mode === 'contacts' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={contactsTab === 'customers' ? 'default' : 'outline'}
                onClick={() => setContactsTab('customers')}
                className="h-9 px-4 py-2"
              >
                <Users size={15} className="mr-2" />
                {t('inventory.customersTab', 'Customers')}
              </Button>
              <Button
                type="button"
                variant={contactsTab === 'suppliers' ? 'default' : 'outline'}
                onClick={() => setContactsTab('suppliers')}
                className="h-9 px-4 py-2"
              >
                <Users size={15} className="mr-2" />
                {t('inventory.suppliersTab', 'Suppliers')}
              </Button>
            </div>

            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              {contactsTab === 'customers' ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('inventory.itemNameLabel', 'Name')}</TableHead>
                      <TableHead>{t('inventory.phone', 'Phone')}</TableHead>
                      <TableHead>{t('inventory.email', 'Email')}</TableHead>
                      <TableHead>{t('inventory.address', 'Address')}</TableHead>
                      <TableHead className="text-center w-[120px]">{t('inventory.actionsHeader', 'Actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                          {t('inventory.noCustomers', 'No customers found.')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      customers.map((c) => (
                        <TableRow key={c.id} className="hover:bg-muted/40 transition-colors">
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell>{c.phone || '—'}</TableCell>
                          <TableCell>{c.email || '—'}</TableCell>
                          <TableCell className="truncate max-w-[200px]">{c.address || '—'}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenEditContact(c, 'customer')}
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              >
                                <Pencil size={14} />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (c.name === 'Walk In') {
                                    toast.error(t('inventory.cannotDeleteWalkIn', 'Cannot delete the default Walk In customer'))
                                    return
                                  }
                                  if (confirm(t('inventory.confirmDeleteContact', 'Are you sure you want to delete this contact?'))) {
                                    deleteCustomerMutation.mutate(c.id)
                                  }
                                }}
                                disabled={c.name === 'Walk In'}
                                className="h-7 w-7 text-destructive/70 hover:text-destructive hover:bg-destructive/10 disabled:opacity-50"
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('inventory.itemNameLabel', 'Name')}</TableHead>
                      <TableHead>{t('inventory.phone', 'Phone')}</TableHead>
                      <TableHead>{t('inventory.email', 'Email')}</TableHead>
                      <TableHead>{t('inventory.address', 'Address')}</TableHead>
                      <TableHead className="text-center w-[120px]">{t('inventory.actionsHeader', 'Actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppliers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                          {t('inventory.noSuppliers', 'No suppliers found.')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      suppliers.map((s) => (
                        <TableRow key={s.id} className="hover:bg-muted/40 transition-colors">
                          <TableCell className="font-medium">{s.name}</TableCell>
                          <TableCell>{s.phone || '—'}</TableCell>
                          <TableCell>{s.email || '—'}</TableCell>
                          <TableCell className="truncate max-w-[200px]">{s.address || '—'}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenEditContact(s, 'supplier')}
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              >
                                <Pencil size={14} />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (s.name === 'Walk In') {
                                    toast.error(t('inventory.cannotDeleteWalkIn', 'Cannot delete the default Walk In supplier'))
                                    return
                                  }
                                  if (confirm(t('inventory.confirmDeleteContact', 'Are you sure you want to delete this contact?'))) {
                                    deleteSupplierMutation.mutate(s.id)
                                  }
                                }}
                                disabled={s.name === 'Walk In'}
                                className="h-7 w-7 text-destructive/70 hover:text-destructive hover:bg-destructive/10 disabled:opacity-50"
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        )}
      </div>

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
                  placeholder="e.g. Coffee Powder Arabica"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="itemType">{t('inventory.itemTypeLabel', 'Product Type')}</Label>
                <Select value={itemType} onValueChange={(val: any) => setItemType(val)}>
                  <SelectTrigger id="itemType" className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="physical">{t('inventory.optPhysical', 'Physical Product (Requires stock)')}</SelectItem>
                    <SelectItem value="service">{t('inventory.optService', 'Service / Consultation (No stock required)')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sku">{t('inventory.skuLabel', 'SKU (Item Code)')}</Label>
                <Input
                  id="sku"
                  value={itemSku}
                  onChange={(e) => setItemSku(e.target.value)}
                  placeholder="e.g. CPA-001 (optional)"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">{t('inventory.descriptionLabel', 'Description')}</Label>
                <Input
                  id="description"
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  placeholder="e.g. Sumatra arabica coffee 250g package"
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
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button type="submit" disabled={createItemMutation.isPending || updateItemMutation.isPending}>
                {t('common.save', 'Save')}
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
              {activeItemForTx ? (
                <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                  <p>{t('inventory.txItemSubtitle', 'Item:')} <span className="font-semibold text-foreground">{activeItemForTx.name}</span></p>
                  {activeItemForTx.type === 'physical' ? (
                    <p>{t('inventory.currentStock', 'Current Stock:')} <span className="font-semibold text-foreground">{parseFloat(activeItemForTx.stock.toString()).toString()}</span></p>
                  ) : (
                    <span className="text-sky-500 font-medium">{t('inventory.badgeService', 'Service (No stock tracking)')}</span>
                  )}
                </div>
              ) : items.length === 0 ? (
                <div className="space-y-1.5 mt-2 bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/20 p-3 rounded-lg flex items-start gap-2.5">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <div className="text-xs space-y-0.5">
                    <p className="font-semibold">{t('inventory.noItemsWarning', 'No items registered')}</p>
                    <p className="text-muted-foreground leading-relaxed">
                      {t('inventory.noItemsWarningHelp', 'Please register at least one merchandise item under Business Items first.')}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 mt-2">
                  <Label htmlFor="itemSelect">{t('inventory.itemNameLabel', 'Item Name')}</Label>
                  <Select
                    value={selectedItemId}
                    onValueChange={(val) => {
                      setSelectedItemId(val)
                      const item = items.find((i) => i.id === val)
                      if (item) {
                        let calculatedPrice = 0
                        if (txType === 'sale') {
                          calculatedPrice = item.price
                        } else if (txType === 'purchase') {
                          calculatedPrice = item.cost
                        }
                        setTxUnitPrice(calculatedPrice.toFixed(2))
                        handleQtyOrPriceChange(txQty, calculatedPrice.toString())
                      }
                    }}
                  >
                    <SelectTrigger id="itemSelect" className="bg-background">
                      <SelectValue placeholder="Choose an item..." />
                    </SelectTrigger>
                    <SelectContent>
                      {items.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.name} {i.type === 'service' ? '(Service)' : `(Stock: ${parseFloat(i.stock.toString()).toString()})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </DialogHeader>
            <div className="space-y-4 py-4">
              {mode === 'items' && (
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
              )}

              {txType === 'sale' && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="customerSelect">{t('inventory.customerLabel', 'Customer')}</Label>
                    {canWrite && (
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0 text-xs text-primary"
                        onClick={() => {
                          setEditingContact(null)
                          setContactName('')
                          setContactPhone('')
                          setContactEmail('')
                          setContactAddress('')
                          setContactType('customer')
                          setContactDialogOpen(true)
                        }}
                      >
                        <Plus size={12} className="mr-0.5 inline" />
                        {t('inventory.addCustomer', 'Add Customer')}
                      </Button>
                    )}
                  </div>
                  <Select
                    value={selectedCustomerId}
                    onValueChange={(val) => setSelectedCustomerId(val)}
                  >
                    <SelectTrigger id="customerSelect" className="bg-background">
                      <SelectValue placeholder={t('inventory.customerDropdownPlaceholder', 'Select customer...')} />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {txType === 'purchase' && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="supplierSelect">{t('inventory.supplierLabel', 'Supplier')}</Label>
                    {canWrite && (
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0 text-xs text-primary"
                        onClick={() => {
                          setEditingContact(null)
                          setContactName('')
                          setContactPhone('')
                          setContactEmail('')
                          setContactAddress('')
                          setContactType('supplier')
                          setContactDialogOpen(true)
                        }}
                      >
                        <Plus size={12} className="mr-0.5 inline" />
                        {t('inventory.addSupplier', 'Add Supplier')}
                      </Button>
                    )}
                  </div>
                  <Select
                    value={selectedSupplierId}
                    onValueChange={(val) => setSelectedSupplierId(val)}
                  >
                    <SelectTrigger id="supplierSelect" className="bg-background">
                      <SelectValue placeholder={t('inventory.supplierDropdownPlaceholder', 'Select supplier...')} />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

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
                    onChange={(e) => {
                      setTxQty(e.target.value)
                      handleQtyOrPriceChange(e.target.value, txUnitPrice)
                    }}
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
                    onChange={(e) => {
                      setTxUnitPrice(e.target.value)
                      handleQtyOrPriceChange(txQty, e.target.value)
                    }}
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
                  placeholder="e.g. Sold 3 packs of arabica coffee (optional)"
                />
              </div>

              {txType !== 'adjustment' && (
                <div className="space-y-4 bg-muted/40 p-3 rounded-lg border border-border/40">
                  <div className="space-y-1.5">
                    <Label htmlFor="paymentType" className="text-xs font-semibold text-foreground">
                      {t('inventory.paymentTypeLabel', 'Payment Term')}
                    </Label>
                    <Select value={paymentType} onValueChange={(val: any) => setPaymentType(val)}>
                      <SelectTrigger id="paymentType" className="bg-background h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full" className="text-xs">{t('inventory.paymentFull', 'Paid in Full')}</SelectItem>
                        <SelectItem value="partial" className="text-xs">{t('inventory.paymentPartial', 'Partial Payment')}</SelectItem>
                        <SelectItem value="deferred" className="text-xs">{t('inventory.paymentDeferred', 'Deferred / Pay Later')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {paymentType !== 'deferred' && (
                    <div className="space-y-1.5">
                      <Label htmlFor="accountSelect" className="flex items-center gap-1.5 text-[11px] text-foreground font-semibold">
                        <Info size={12} className="text-primary" />
                        {txType === 'sale'
                          ? t('inventory.linkAccountSale', 'Link to Cash Flow (Record Income)?')
                          : t('inventory.linkAccountPurchase', 'Link to Cash Flow (Record Expense)?')}
                      </Label>
                      <Select value={txAccountId} onValueChange={setTxAccountId}>
                        <SelectTrigger id="accountSelect" className="bg-background h-8 text-xs">
                          <SelectValue placeholder="Choose account..." />
                        </SelectTrigger>
                        <SelectContent>
                          {accountsList.map((acc) => (
                            <SelectItem key={acc.id} value={acc.id} className="text-xs">
                              {acc.display_name || acc.name} ({formatCurrency(acc.current_balance, acc.currency, locale)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {paymentType === 'partial' && (
                    <div className="space-y-1.5">
                      <Label htmlFor="paidAmount" className="text-[11px] font-semibold">{t('inventory.paidAmountLabel', 'Paid Amount')}</Label>
                      <Input
                        id="paidAmount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={txPaidAmount}
                        onChange={(e) => setTxPaidAmount(e.target.value)}
                        className="h-8 text-xs"
                        required
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTxDialogOpen(false)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button type="submit" disabled={createTxMutation.isPending || (!activeItemForTx && items.length === 0)}>
                {t('common.save', 'Save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* dialog 3: Manage Payments */}
      <Dialog open={paymentsDialogOpen} onOpenChange={setPaymentsDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>
              {t('inventory.managePaymentsTitle', 'Payment Installments')}
            </DialogTitle>
            {selectedTxForPayments && (
              <div className="text-xs text-muted-foreground mt-2 space-y-1 p-3 rounded-lg bg-muted/40 border">
                <div className="flex justify-between">
                  <span>{t('inventory.txItem', 'Item')}:</span>
                  <span className="font-semibold text-foreground">
                    {items.find(i => i.id === selectedTxForPayments.item_id)?.name || 'Deleted Item'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{t('inventory.txTotal', 'Total Amount')}:</span>
                  <span className="font-mono text-foreground font-semibold">
                    {formatCurrency(Number(selectedTxForPayments.quantity) * Number(selectedTxForPayments.unit_price), userCurrency, locale)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{t('inventory.paidAmountLabel', 'Paid Amount')}:</span>
                  <span className="font-mono text-emerald-600 font-bold">
                    {formatCurrency(Number(selectedTxForPayments.paid_amount), userCurrency, locale)}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-1 mt-1 font-semibold">
                  <span>{t('inventory.dueAmount', 'Remaining Balance')}:</span>
                  <span className="font-mono text-foreground">
                    {formatCurrency(
                      Math.max(0, (Number(selectedTxForPayments.quantity) * Number(selectedTxForPayments.unit_price)) - Number(selectedTxForPayments.paid_amount)),
                      userCurrency,
                      locale
                    )}
                  </span>
                </div>
              </div>
            )}
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Payments List */}
            <div className="space-y-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('inventory.paymentInstallments', 'Installments History')}
              </h3>
              {loadingPayments ? (
                <div className="text-xs text-center py-4 text-muted-foreground">Loading...</div>
              ) : paymentsList.length === 0 ? (
                <div className="text-xs text-center py-4 text-muted-foreground bg-muted/10 border border-dashed rounded-lg">
                  {t('inventory.noPayments', 'No payments recorded yet.')}
                </div>
              ) : (
                <div className="max-h-[150px] overflow-y-auto border rounded-lg divide-y">
                  {paymentsList.map((p) => {
                    const accName = accountsList.find(a => a.id === p.account_id)?.name || 'Deleted Account'
                    return (
                      <div key={p.id} className="p-2.5 flex items-center justify-between hover:bg-muted/10 text-xs">
                        <div>
                          <p className="font-semibold text-foreground">{formatCurrency(p.amount, userCurrency, locale)}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {new Date(p.date + 'T00:00:00').toLocaleDateString(locale)} • {accName}
                          </p>
                          {p.description && (
                            <p className="text-[10px] text-muted-foreground/80 italic mt-0.5">"{p.description}"</p>
                          )}
                        </div>
                        {p.transaction_id && (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[9px] font-medium leading-none h-4">
                            Linked
                          </Badge>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Record New Payment Form */}
            {selectedTxForPayments && selectedTxForPayments.payment_status !== 'paid' && canWrite && (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  createPaymentMutation.mutate({
                    txId: selectedTxForPayments.id,
                    payload: {
                      amount: parseFloat(newPaymentAmount) || 0,
                      date: newPaymentDate,
                      account_id: newPaymentAccountId,
                      description: newPaymentDescription || undefined,
                    },
                  })
                }}
                className="space-y-2.5 bg-muted/20 p-3 rounded-lg border border-border/80"
              >
                <h4 className="text-xs font-semibold text-foreground">
                  {t('inventory.recordPayment', 'Add Payment Installment')}
                </h4>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label htmlFor="payAmt" className="text-[10px]">{t('inventory.paidAmountLabel', 'Amount')}</Label>
                    <Input
                      id="payAmt"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={newPaymentAmount}
                      onChange={(e) => setNewPaymentAmount(e.target.value)}
                      className="h-8 text-xs"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="payDate" className="text-[10px]">{t('inventory.txDateLabel', 'Date')}</Label>
                    <Input
                      id="payDate"
                      type="date"
                      value={newPaymentDate}
                      onChange={(e) => setNewPaymentDate(e.target.value)}
                      className="h-8 text-xs"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="payAcc" className="text-[10px]">{t('inventory.paymentAccount', 'Account')}</Label>
                  <Select
                    value={newPaymentAccountId}
                    onValueChange={(val) => setNewPaymentAccountId(val)}
                  >
                    <SelectTrigger id="payAcc" className="h-8 text-xs bg-background">
                      <SelectValue placeholder="Choose account..." />
                    </SelectTrigger>
                    <SelectContent>
                      {accountsList.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id} className="text-xs">
                          {acc.display_name || acc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="payDesc" className="text-[10px]">{t('inventory.txDescLabel', 'Description')}</Label>
                  <Input
                    id="payDesc"
                    value={newPaymentDescription}
                    onChange={(e) => setNewPaymentDescription(e.target.value)}
                    placeholder="e.g. Paid installment (optional)"
                    className="h-8 text-xs"
                  />
                </div>

                <Button
                  type="submit"
                  size="sm"
                  className="w-full mt-1.5 text-xs h-8"
                  disabled={createPaymentMutation.isPending || parseFloat(newPaymentAmount) <= 0 || newPaymentAccountId === 'none'}
                >
                  {createPaymentMutation.isPending ? t('common.loading') : t('inventory.recordPaymentBtn', 'Add Payment')}
                </Button>
              </form>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setPaymentsDialogOpen(false)}>
              {t('common.close', 'Close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* dialog 4: Add/Edit Contact */}
      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={(e) => {
            e.preventDefault()
            const payload = {
              name: contactName,
              phone: contactPhone || null,
              email: contactEmail || null,
              address: contactAddress || null,
            }
            if (contactType === 'customer') {
              if (editingContact) {
                updateCustomerMutation.mutate({ id: editingContact.id, payload })
              } else {
                createCustomerMutation.mutate(payload)
              }
            } else {
              if (editingContact) {
                updateSupplierMutation.mutate({ id: editingContact.id, payload })
              } else {
                createSupplierMutation.mutate(payload)
              }
            }
          }}>
            <DialogHeader>
              <DialogTitle>
                {editingContact 
                  ? (contactType === 'customer' ? t('inventory.editCustomer', 'Edit Customer') : t('inventory.editSupplier', 'Edit Supplier'))
                  : (contactType === 'customer' ? t('inventory.addCustomer', 'Add Customer') : t('inventory.addSupplier', 'Add Supplier'))}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="contactName">{t('inventory.itemNameLabel', 'Name')}</Label>
                <Input
                  id="contactName"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="e.g. John Doe"
                  required
                  disabled={editingContact?.name === 'Walk In'}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contactPhone">{t('inventory.phone', 'Phone')}</Label>
                <Input
                  id="contactPhone"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="e.g. +123456789"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contactEmail">{t('inventory.email', 'Email')}</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="e.g. john@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contactAddress">{t('inventory.address', 'Address')}</Label>
                <Input
                  id="contactAddress"
                  value={contactAddress}
                  onChange={(e) => setContactAddress(e.target.value)}
                  placeholder="e.g. 123 Main St"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setContactDialogOpen(false)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button type="submit" disabled={
                createCustomerMutation.isPending || 
                updateCustomerMutation.isPending || 
                createSupplierMutation.isPending || 
                updateSupplierMutation.isPending
              }>
                {t('common.save', 'Save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
