"use client"

import { useState, useEffect, useCallback } from "react"
import { api } from "@/lib/api-client"
import { adminApi } from "@/hooks/useAdmin"
import { ChevronLeft, ChevronRight, DollarSign } from "lucide-react"
import { AdminButton } from "@/components/admin/admin-button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select"
import { toast } from "sonner"
import type { AffiliateSale, PaginatedResponse } from "@repo/validation"

export default function AdminSalesPage() {
  const [page, setPage] = useState(1)
  const [data, setData] = useState<PaginatedResponse<AffiliateSale> | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchSales = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get<PaginatedResponse<AffiliateSale>>(
        `/api/v1/admin/affiliates/sales?page=${page}`,
        { requireAuth: true }
      )
      setData(res)
    } catch {
      console.error("Failed to fetch sales")
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { fetchSales() }, [fetchSales])

  const totalPages = Math.ceil((data?.total || 0) / 20)

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await adminApi.updateSaleStatus(id, status)
      toast.success("Sale status updated")
      fetchSales()
    } catch {
      toast.error("Failed to update status")
    }
  }

  const statusColor = (s: string) => {
    switch (s) {
      case "confirmed": return "bg-green-900/40 text-green-400"
      case "paid": return "bg-blue-900/40 text-blue-400"
      case "refunded": return "bg-red-900/40 text-red-400"
      default: return "bg-yellow-900/40 text-yellow-400"
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Sales</h1>
        <p className="text-slate-400 mt-1">Track all affiliate sales and commissions</p>
      </div>

      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-900/50 text-slate-400 text-left">
                <th className="px-4 py-3 font-medium">Affiliate Code</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Commission</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={7} className="px-4 py-3"><div className="h-5 bg-slate-800 rounded animate-pulse" /></td></tr>
                ))
              ) : !data?.data?.length ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">No sales recorded yet</td>
                </tr>
              ) : (
                data.data.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-900/30">
                    <td className="px-4 py-3 text-slate-300 font-mono text-xs">
                      {sale.affiliate_links?.code || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{sale.customer_email || "-"}</td>
                    <td className="px-4 py-3 text-slate-200 font-medium">${Number(sale.amount).toFixed(2)}</td>
                    <td className="px-4 py-3 text-emerald-400">${Number(sale.commission).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(sale.status)}`}>
                        {sale.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{new Date(sale.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <Select
                        value={sale.status}
                        onValueChange={(v) => handleStatusUpdate(sale.id, v)}
                      >
                        <SelectTrigger className="w-28 h-8 bg-slate-800 border-slate-700 text-slate-300 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="refunded">Refunded</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">{data?.total} total sales</p>
          <div className="flex gap-2">
            <AdminButton variant="secondary" size="icon" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </AdminButton>
            <span className="flex items-center text-sm text-slate-400 px-2">{page} / {totalPages}</span>
            <AdminButton variant="secondary" size="icon" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </AdminButton>
          </div>
        </div>
      )}
    </div>
  )
}
