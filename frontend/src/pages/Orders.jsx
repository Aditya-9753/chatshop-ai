import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ShoppingBag,
  Search,
  Eye,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  Plus,
  Filter,
  Download,
  RefreshCw,
  Edit,
  Trash2,
  Phone,
  MapPin,
  CreditCard,
  Calendar,
  ChevronRight,
  ArrowUpDown,
  X,
  FileText,
  Printer,
  Building,
  Mail,
} from "lucide-react";
import orderService from "../services/order.service";
import customerService from "../services/customer.service";
import productService from "../services/product.service";
import Modal from "../components/Modal";
import Button from "../components/Button";
import { useToast } from "../components/Toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const invoiceRef = useRef(null);

  // Create Order Form State
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [orderForm, setOrderForm] = useState({
    customerId: "",
    platform: "whatsapp",
    items: [],
    paymentMethod: "cod",
    taxType: "gst", // gst, cgst_sgst, or custom
    taxPercentage: 18,
    shippingAmount: 50,
    shippingAddress: {
      name: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      pincode: "",
    },
  });
  const [selectedProduct, setSelectedProduct] = useState("");
  const [productQuantity, setProductQuantity] = useState(1);

  const { success, error } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (statusFilter !== "all") params.status = statusFilter;
      if (paymentFilter !== "all") params.paymentStatus = paymentFilter;

      const response = await orderService.getOrders(params);
      if (response.success) {
        setOrders(response.data || []);
      }
    } catch (err) {
      error(err.message || "Failed to fetch orders");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, paymentFilter, error]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await orderService.getOrderStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }, []);

  useEffect(() => {
    // Debounce search
    const delaySearch = setTimeout(() => {
      fetchOrders();
      fetchStats();
    }, 300);

    return () => clearTimeout(delaySearch);
  }, [searchTerm, statusFilter, paymentFilter, fetchOrders, fetchStats]);

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      await orderService.updateOrderStatus(orderId, { status: newStatus });
      success(`Order status updated to ${newStatus}`);
      fetchOrders();
      fetchStats();
      setIsViewModalOpen(false);
    } catch (err) {
      error(err.message || "Failed to update order status");
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm("Are you sure you want to delete this order?")) return;

    try {
      await orderService.deleteOrder(orderId);
      success("Order deleted successfully");
      fetchOrders();
      fetchStats();
      setIsViewModalOpen(false);
    } catch (err) {
      error(err.message || "Failed to delete order");
    }
  };

  const viewOrderDetails = (order) => {
    setSelectedOrder(order);
    setIsViewModalOpen(true);
  };

  const openInvoice = (order) => {
    setSelectedOrder(order);
    setIsInvoiceModalOpen(true);
  };

  const handlePrintInvoice = () => {
    const order = selectedOrder;
    const windowPrint = window.open("", "", "width=900,height=650");

    const invoiceHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice - ${order.orderNumber}</title>
          <meta charset="UTF-8">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            @page { 
              size: A4;
              margin: 8mm;
            }
            body { 
              font-family: Arial, Helvetica, sans-serif; 
              line-height: 1.1;
              color: #333;
              padding: 0;
              background: #fff;
              font-size: 9px;
            }
            .container { 
              max-width: 100%; 
              margin: 0;
              padding: 0;
            }
            
            /* Header */
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 4px;
              padding-bottom: 4px;
              border-bottom: 2px solid #333;
            }
            .company-name {
              font-size: 15px;
              font-weight: bold;
              color: #111;
              margin-bottom: 1px;
            }
            .company-tagline {
              font-size: 7px;
              color: #666;
              margin-bottom: 2px;
            }
            .company-details {
              font-size: 7px;
              color: #666;
              line-height: 1.2;
            }
            .invoice-section {
              text-align: right;
            }
            .invoice-title {
              font-size: 16px;
              font-weight: bold;
              color: #111;
              margin-bottom: 3px;
            }
            .invoice-details {
              font-size: 7px;
              color: #555;
              line-height: 1.3;
            }
            .invoice-details strong {
              color: #333;
              font-weight: 600;
            }
            .status-badge {
              display: inline-block;
              padding: 2px 5px;
              border-radius: 5px;
              font-size: 6px;
              font-weight: bold;
              margin-top: 2px;
              text-transform: uppercase;
            }
            .status-paid { background: #dcfce7; color: #166534; }
            .status-pending { background: #fef3c7; color: #92400e; }
            .status-failed { background: #fee2e2; color: #991b1b; }
            
            /* Addresses */
            .addresses {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
              margin: 4px 0;
            }
            .address-block h3 {
              font-size: 7px;
              font-weight: bold;
              color: #666;
              text-transform: uppercase;
              letter-spacing: 0.1px;
              margin-bottom: 2px;
            }
            .address-block .customer-name {
              font-size: 9px;
              font-weight: bold;
              color: #111;
              margin-bottom: 1px;
            }
            .address-block p {
              font-size: 7px;
              color: #555;
              margin: 0;
              line-height: 1.2;
            }
            
            /* Table */
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 4px 0;
            }
            thead {
              background: #f8f9fa;
            }
            th {
              padding: 3px 2px;
              text-align: left;
              font-size: 7px;
              font-weight: bold;
              color: #555;
              text-transform: uppercase;
              letter-spacing: 0;
              border-bottom: 1px solid #dee2e6;
            }
            th.center { text-align: center; }
            th.right { text-align: right; }
            td {
              padding: 3px 2px;
              font-size: 8px;
              color: #333;
              border-bottom: 1px solid #e9ecef;
              line-height: 1.1;
            }
            td.center { text-align: center; }
            td.right { text-align: right; }
            .item-name {
              font-weight: 600;
              color: #111;
              font-size: 8px;
            }
            .item-desc {
              font-size: 6px;
              color: #777;
              margin-top: 0;
            }
            
            /* Totals */
            .totals-section {
              display: flex;
              justify-content: flex-end;
              margin: 4px 0;
            }
            .totals-table {
              min-width: 180px;
            }
            .totals-row {
              display: flex;
              justify-content: space-between;
              padding: 2px 0;
              font-size: 8px;
            }
            .totals-row.border-top {
              border-top: 1px solid #dee2e6;
              margin-top: 1px;
              padding-top: 3px;
            }
            .totals-row.total-line {
              border-top: 2px solid #333;
              margin-top: 2px;
              padding-top: 3px;
            }
            .totals-row .label {
              color: #555;
              font-weight: 500;
            }
            .totals-row .amount {
              font-weight: 600;
              color: #111;
            }
            .totals-row.total-line .label {
              font-size: 9px;
              font-weight: bold;
            }
            .totals-row.total-line .amount {
              font-size: 11px;
              font-weight: bold;
              color: #4F46E5;
            }
            
            /* Payment Info */
            .payment-section {
              background: #f8f9fa;
              padding: 4px;
              border-radius: 3px;
              margin: 3px 0;
            }
            .payment-section h4 {
              font-size: 7px;
              font-weight: bold;
              color: #333;
              margin-bottom: 2px;
            }
            .payment-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 4px;
            }
            .payment-item .label {
              font-size: 6px;
              color: #666;
              margin-bottom: 1px;
            }
            .payment-item .value {
              font-size: 8px;
              font-weight: 600;
              color: #111;
              text-transform: capitalize;
            }
            
            /* Terms */
            .terms-section {
              margin: 3px 0;
              padding-top: 3px;
              border-top: 1px solid #dee2e6;
            }
            .terms-section h4 {
              font-size: 7px;
              font-weight: bold;
              color: #333;
              margin-bottom: 2px;
            }
            .terms-section ul {
              list-style: disc;
              padding-left: 10px;
            }
            .terms-section li {
              font-size: 6px;
              color: #666;
              margin: 0;
              line-height: 1.2;
            }
            
            /* Footer */
            .footer {
              margin-top: 4px;
              padding-top: 3px;
              border-top: 1px solid #dee2e6;
              text-align: center;
            }
            .footer .thank-you {
              font-size: 8px;
              font-weight: 600;
              color: #111;
              margin-bottom: 1px;
            }
            .footer .note {
              font-size: 6px;
              color: #777;
              margin: 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <!-- Header -->
            <div class="header">
              <div class="company-section">
                <div class="company-name">${
                  user?.businessInfo?.businessName ||
                  user?.name ||
                  "Your Business"
                }</div>
                <div class="company-tagline">Powered by ChatShop-AI</div>
                <div class="company-details">
                  ${
                    user?.businessInfo?.address
                      ? user.businessInfo.address + "<br>"
                      : ""
                  }
                  ${user?.phone ? "Phone: " + user.phone + "<br>" : ""}
                  ${user?.email ? "Email: " + user.email : ""}
                </div>
              </div>
              <div class="invoice-section">
                <div class="invoice-title">INVOICE</div>
                <div class="invoice-details">
                  <strong>Invoice #:</strong> ${order.orderNumber}<br>
                  <strong>Date:</strong> ${new Date(
                    order.createdAt
                  ).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}<br>
                  <strong>Due Date:</strong> ${new Date(
                    new Date(order.createdAt).getTime() +
                      7 * 24 * 60 * 60 * 1000
                  ).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                  <div class="status-badge status-${
                    order.paymentStatus
                  }">${order.paymentStatus?.toUpperCase()}</div>
                </div>
              </div>
            </div>
            
            <!-- Addresses -->
            <div class="addresses">
              <div class="address-block">
                <h3>Bill To:</h3>
                <div class="customer-name">${
                  order.customerId?.name || "N/A"
                }</div>
                <p>${order.customerId?.email || ""}</p>
                <p>${order.customerId?.phone || ""}</p>
                ${
                  order.customerId?.address
                    ? "<p>" + order.customerId.address + "</p>"
                    : ""
                }
              </div>
              <div class="address-block">
                <h3>Ship To:</h3>
                <div class="customer-name">${
                  order.shippingAddress?.name || order.customerId?.name || "N/A"
                }</div>
                <p>${
                  order.shippingAddress?.phone || order.customerId?.phone || ""
                }</p>
                <p>${
                  order.shippingAddress?.address || "Same as billing address"
                }</p>
                ${
                  order.shippingAddress?.city
                    ? "<p>" +
                      order.shippingAddress.city +
                      ", " +
                      order.shippingAddress.state +
                      " - " +
                      order.shippingAddress.pincode +
                      "</p>"
                    : ""
                }
              </div>
            </div>
            
            <!-- Items Table -->
            <table>
              <thead>
                <tr>
                  <th style="width: 5%">#</th>
                  <th style="width: 45%">Item Description</th>
                  <th class="center" style="width: 12%">Qty</th>
                  <th class="right" style="width: 18%">Unit Price</th>
                  <th class="right" style="width: 20%">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${order.items
                  ?.map(
                    (item, index) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>
                      <div class="item-name">${
                        item.productId?.name || item.name || "Product"
                      }</div>
                      ${
                        item.productId?.description
                          ? '<div class="item-desc">' +
                            item.productId.description.substring(0, 80) +
                            "...</div>"
                          : ""
                      }
                    </td>
                    <td class="center"><strong>${item.quantity}</strong></td>
                    <td class="right">₹${(item.price || 0).toLocaleString(
                      "en-IN"
                    )}</td>
                    <td class="right"><strong>₹${(
                      (item.price || 0) * (item.quantity || 0)
                    ).toLocaleString("en-IN")}</strong></td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>
            
            <!-- Totals -->
            <div class="totals-section">
              <div class="totals-table">
                <div class="totals-row">
                  <span class="label">Subtotal:</span>
                  <span class="amount">₹${(order.subtotal || 0).toLocaleString(
                    "en-IN"
                  )}</span>
                </div>
                ${
                  order.discount > 0
                    ? `
                  <div class="totals-row">
                    <span class="label">Discount:</span>
                    <span class="amount" style="color: #16a34a;">- ₹${(
                      order.discount || 0
                    ).toLocaleString("en-IN")}</span>
                  </div>
                `
                    : ""
                }
                <div class="totals-row">
                  <span class="label">Tax (${
                    order.taxPercentage || 18
                  }%):</span>
                  <span class="amount">₹${(order.tax || 0).toLocaleString(
                    "en-IN"
                  )}</span>
                </div>
                <div class="totals-row border-top">
                  <span class="label">Shipping:</span>
                  <span class="amount">₹${(
                    order.shippingAmount || 0
                  ).toLocaleString("en-IN")}</span>
                </div>
                <div class="totals-row total-line">
                  <span class="label">Total Amount:</span>
                  <span class="amount">₹${(order.total || 0).toLocaleString(
                    "en-IN"
                  )}</span>
                </div>
              </div>
            </div>
            
            <!-- Payment Info -->
            <div class="payment-section">
              <h4>Payment Information</h4>
              <div class="payment-grid">
                <div class="payment-item">
                  <div class="label">Payment Method:</div>
                  <div class="value">${order.paymentMethod || "COD"}</div>
                </div>
                <div class="payment-item">
                  <div class="label">Payment Status:</div>
                  <div class="value">${order.paymentStatus || "Pending"}</div>
                </div>
              </div>
            </div>
            
            <!-- Terms -->
            <div class="terms-section">
              <h4>Terms & Conditions</h4>
              <ul>
                <li>Payment is due within 7 days from the invoice date</li>
                <li>Please include the invoice number on your payment</li>
                <li>All prices are in Indian Rupees (INR)</li>
                <li>Goods once sold will not be taken back or exchanged</li>
                <li>For any queries, please contact ${
                  user?.email || "support@chatshop-ai.com"
                }</li>
              </ul>
            </div>
            
            <!-- Footer -->
            <div class="footer">
              <p class="thank-you">Thank you for your business!</p>
              <p class="note">This is a computer-generated invoice and does not require a physical signature.</p>
              <p class="note">ChatShop-AI © ${new Date().getFullYear()} | All Rights Reserved</p>
            </div>
          </div>
        </body>
      </html>
    `;

    windowPrint.document.write(invoiceHTML);
    windowPrint.document.close();
    windowPrint.focus();
    setTimeout(() => {
      windowPrint.print();
      windowPrint.close();
    }, 250);
  };

  const handleDownloadInvoice = () => {
    // Create a simple PDF-style download (HTML to print as PDF)
    handlePrintInvoice();
    success("Use 'Save as PDF' in the print dialog to download");
  };

  const handleRefresh = () => {
    success("Refreshing orders...");
    fetchOrders();
    fetchStats();
  };

  const handleExport = () => {
    try {
      // Convert orders to CSV
      const headers = [
        "Order #",
        "Customer",
        "Phone",
        "Items",
        "Total",
        "Status",
        "Payment",
        "Date",
      ];
      const csvData = orders.map((order) => [
        order.orderNumber,
        order.customerId?.name || "Unknown",
        order.customerId?.phone || "",
        order.items?.length || 0,
        order.total || 0,
        order.status,
        order.paymentStatus,
        new Date(order.createdAt).toLocaleDateString("en-IN"),
      ]);

      const csvContent = [
        headers.join(","),
        ...csvData.map((row) => row.join(",")),
      ].join("\n");

      // Create and download file
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orders-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      success("Orders exported successfully!");
    } catch (err) {
      error("Failed to export orders");
    }
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();

    if (!orderForm.customerId) {
      error("Please select a customer");
      return;
    }

    if (orderForm.items.length === 0) {
      error("Please add at least one item");
      return;
    }

    try {
      // Calculate totals
      const subtotal = orderForm.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      const tax = subtotal * (orderForm.taxPercentage / 100);
      const shipping = orderForm.shippingAmount || 0;
      const total = subtotal + tax + shipping;

      const orderData = {
        customerId: orderForm.customerId,
        platform: orderForm.platform,
        items: orderForm.items,
        subtotal,
        tax,
        taxType: orderForm.taxType,
        taxPercentage: orderForm.taxPercentage,
        shipping,
        total,
        paymentMethod: orderForm.paymentMethod,
        shippingAddress: orderForm.shippingAddress,
      };

      const response = await orderService.createOrder(orderData);
      if (response.success) {
        success("Order created successfully!");
        setIsCreateModalOpen(false);
        resetOrderForm();
        fetchOrders();
        fetchStats();
      }
    } catch (err) {
      error(err.message || "Failed to create order");
    }
  };

  const resetOrderForm = () => {
    setOrderForm({
      customerId: "",
      platform: "whatsapp",
      items: [],
      paymentMethod: "cod",
      taxType: "gst",
      taxPercentage: 18,
      shippingAmount: 50,
      shippingAddress: {
        name: "",
        phone: "",
        address: "",
        city: "",
        state: "",
        pincode: "",
      },
    });
    setSelectedProduct("");
    setProductQuantity(1);
  };

  const handleAddItem = () => {
    if (!selectedProduct) {
      error("Please select a product");
      return;
    }

    const product = products.find((p) => p._id === selectedProduct);
    if (!product) return;

    const existingItem = orderForm.items.find(
      (item) => item.productId === product._id
    );

    if (existingItem) {
      setOrderForm({
        ...orderForm,
        items: orderForm.items.map((item) =>
          item.productId === product._id
            ? { ...item, quantity: item.quantity + productQuantity }
            : item
        ),
      });
    } else {
      setOrderForm({
        ...orderForm,
        items: [
          ...orderForm.items,
          {
            productId: product._id,
            name: product.name,
            price: product.price,
            quantity: productQuantity,
          },
        ],
      });
    }

    setSelectedProduct("");
    setProductQuantity(1);
    success("Item added to order");
  };

  const handleRemoveItem = (productId) => {
    setOrderForm({
      ...orderForm,
      items: orderForm.items.filter((item) => item.productId !== productId),
    });
  };

  const fetchCustomersAndProducts = async () => {
    try {
      const [customersRes, productsRes] = await Promise.all([
        customerService.getCustomers(),
        productService.getProducts(),
      ]);

      if (customersRes.success) setCustomers(customersRes.data || []);
      if (productsRes.success) setProducts(productsRes.data || []);
    } catch (err) {
      console.error("Failed to fetch customers/products:", err);
    }
  };

  useEffect(() => {
    if (isCreateModalOpen) {
      fetchCustomersAndProducts();
    }
  }, [isCreateModalOpen]);

  const getStatusColor = (status) => {
    const colors = {
      pending: "bg-amber-50 text-amber-700 border-amber-200",
      confirmed: "bg-blue-50 text-blue-700 border-blue-200",
      processing: "bg-indigo-50 text-indigo-700 border-indigo-200",
      shipped: "bg-purple-50 text-purple-700 border-purple-200",
      delivered: "bg-green-50 text-green-700 border-green-200",
      cancelled: "bg-red-50 text-red-700 border-red-200",
    };
    return colors[status] || "bg-gray-50 text-gray-700 border-gray-200";
  };

  const getStatusIcon = (status) => {
    const icons = {
      pending: <Clock className="w-4 h-4" />,
      confirmed: <CheckCircle className="w-4 h-4" />,
      processing: <Package className="w-4 h-4" />,
      shipped: <Truck className="w-4 h-4" />,
      delivered: <CheckCircle className="w-4 h-4" />,
      cancelled: <XCircle className="w-4 h-4" />,
    };
    return icons[status] || <Package className="w-4 h-4" />;
  };

  const getNextStatus = (currentStatus) => {
    const workflow = {
      pending: "confirmed",
      confirmed: "processing",
      processing: "shipped",
      shipped: "delivered",
    };
    return workflow[currentStatus];
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Orders Management
          </h1>
          <p className="text-gray-600 mt-1">
            Track, manage, and fulfill customer orders
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="p-2.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5 text-gray-600" />
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Create Order
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-indigo-600" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Total Orders</p>
            <p className="text-2xl font-bold text-gray-900">
              {stats.totalOrders || 0}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Pending</p>
            <p className="text-2xl font-bold text-amber-600">
              {stats.pending || 0}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Truck className="w-5 h-5 text-purple-600" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Shipped</p>
            <p className="text-2xl font-bold text-purple-600">
              {stats.shipped || 0}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Delivered</p>
            <p className="text-2xl font-bold text-green-600">
              {stats.delivered || 0}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
            <p className="text-xl font-bold text-green-600">
              ₹{(stats.totalRevenue || 0).toLocaleString("en-IN")}
            </p>
          </div>
        </div>
      )}

      {/* Filters & Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by order number, customer name, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm font-medium min-w-[140px]"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="processing">Processing</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Payment Filter */}
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm font-medium min-w-[140px]"
          >
            <option value="all">All Payments</option>
            <option value="pending">Unpaid</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
      </div>

      {/* Orders List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <RefreshCw className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
            <p className="text-gray-600">Loading orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No orders found
            </h3>
            <p className="text-gray-600 mb-6">
              {searchTerm || statusFilter !== "all"
                ? "Try adjusting your search or filters"
                : "Create your first order to get started"}
            </p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              <Plus className="w-5 h-5" />
              Create Order
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {orders.map((order) => (
              <div
                key={order._id}
                className="p-6 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => viewOrderDetails(order)}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Order Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <ShoppingBag className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-base font-bold text-gray-900">
                            #{order.orderNumber}
                          </h3>
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(
                              order.status
                            )}`}
                          >
                            {getStatusIcon(order.status)}
                            {order.status?.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600">
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-4 h-4" />
                            <span className="font-medium">
                              {order.customerId?.name || "Unknown Customer"}
                            </span>
                            <span className="text-gray-400">•</span>
                            <span>{order.customerId?.phone}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-4 h-4" />
                            <span>
                              {formatDate(order.createdAt)} at{" "}
                              {formatTime(order.createdAt)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Package className="w-4 h-4" />
                            <span>{order.items?.length || 0} items</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Order Details */}
                  <div className="flex items-center gap-6 lg:flex-shrink-0">
                    {/* Payment Status */}
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-1">Payment</p>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          order.paymentStatus === "paid"
                            ? "bg-green-100 text-green-700"
                            : order.paymentStatus === "failed"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {order.paymentStatus === "paid" ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        {order.paymentStatus?.toUpperCase()}
                      </span>
                    </div>

                    {/* Total Amount */}
                    <div className="text-right">
                      <p className="text-xs text-gray-500 mb-1">Total</p>
                      <p className="text-lg font-bold text-gray-900">
                        ₹{(order.total || 0).toLocaleString("en-IN")}
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openInvoice(order);
                        }}
                        className="p-2 hover:bg-green-50 rounded-lg transition-colors group"
                        title="Generate Invoice"
                      >
                        <FileText className="w-5 h-5 text-green-600 group-hover:scale-110 transition-transform" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          viewOrderDetails(order);
                        }}
                        className="p-2 hover:bg-indigo-50 rounded-lg transition-colors group"
                        title="View Details"
                      >
                        <Eye className="w-5 h-5 text-indigo-600 group-hover:scale-110 transition-transform" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={`Order Details - #${selectedOrder?.orderNumber || ""}`}
        size="2xl"
      >
        {selectedOrder && (
          <div className="space-y-6">
            {/* Order Status Timeline */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-6">
              <h4 className="text-sm font-semibold text-gray-900 mb-4">
                Order Status
              </h4>
              <div className="flex items-center justify-between">
                {[
                  "pending",
                  "confirmed",
                  "processing",
                  "shipped",
                  "delivered",
                ].map((status, index, arr) => {
                  const isActive = arr.indexOf(selectedOrder.status) >= index;
                  const isCurrent = selectedOrder.status === status;
                  return (
                    <div key={status} className="flex items-center flex-1">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            isActive
                              ? isCurrent
                                ? "bg-indigo-600 ring-4 ring-indigo-100"
                                : "bg-green-600"
                              : "bg-gray-200"
                          } transition-all`}
                        >
                          {isActive ? (
                            <CheckCircle className="w-5 h-5 text-white" />
                          ) : (
                            <div className="w-3 h-3 bg-gray-400 rounded-full" />
                          )}
                        </div>
                        <p
                          className={`text-xs mt-2 font-medium capitalize ${
                            isActive ? "text-gray-900" : "text-gray-500"
                          }`}
                        >
                          {status}
                        </p>
                      </div>
                      {index < arr.length - 1 && (
                        <div
                          className={`flex-1 h-1 mx-2 ${
                            isActive ? "bg-green-600" : "bg-gray-200"
                          } transition-all`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Customer Information */}
              <div className="bg-gray-50 rounded-lg p-5">
                <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Customer Information
                </h4>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-gray-600 text-xs mb-1">Name</p>
                    <p className="font-medium text-gray-900">
                      {selectedOrder.customerId?.name || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-xs mb-1">Phone</p>
                    <p className="font-medium text-gray-900">
                      {selectedOrder.customerId?.phone || "N/A"}
                    </p>
                  </div>
                  {selectedOrder.customerId?.email && (
                    <div>
                      <p className="text-gray-600 text-xs mb-1">Email</p>
                      <p className="font-medium text-gray-900">
                        {selectedOrder.customerId.email}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-gray-600 text-xs mb-1">Platform</p>
                    <p className="font-medium text-gray-900 capitalize">
                      {selectedOrder.platform}
                    </p>
                  </div>
                </div>
              </div>

              {/* Payment & Shipping Info */}
              <div className="bg-gray-50 rounded-lg p-5">
                <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Payment & Delivery
                </h4>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-gray-600 text-xs mb-1">Payment Method</p>
                    <p className="font-medium text-gray-900 uppercase">
                      {selectedOrder.paymentMethod || "COD"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-xs mb-1">Payment Status</p>
                    <span
                      className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                        selectedOrder.paymentStatus === "paid"
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {selectedOrder.paymentStatus?.toUpperCase()}
                    </span>
                  </div>
                  {selectedOrder.shippingAddress && (
                    <div>
                      <p className="text-gray-600 text-xs mb-1">
                        Shipping Address
                      </p>
                      <p className="font-medium text-gray-900">
                        {selectedOrder.shippingAddress.address},{" "}
                        {selectedOrder.shippingAddress.city}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-gray-600 text-xs mb-1">Order Date</p>
                    <p className="font-medium text-gray-900">
                      {formatDate(selectedOrder.createdAt)} at{" "}
                      {formatTime(selectedOrder.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Order Items */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-4">
                Order Items ({selectedOrder.items?.length || 0})
              </h4>
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                        Product
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">
                        Qty
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">
                        Price
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {selectedOrder.items?.map((item, index) => (
                      <tr key={index} className="bg-white">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900">
                            {item.name || item.productId?.name || "Unknown"}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-gray-900">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-900">
                          ₹{(item.price || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                          ₹
                          {((item.price || 0) * item.quantity).toLocaleString(
                            "en-IN"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-100">
                    <tr>
                      <td
                        colSpan="3"
                        className="px-4 py-3 text-right text-sm font-semibold text-gray-900"
                      >
                        Subtotal
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                        ₹{(selectedOrder.subtotal || 0).toLocaleString("en-IN")}
                      </td>
                    </tr>
                    {selectedOrder.tax > 0 && (
                      <tr>
                        <td
                          colSpan="3"
                          className="px-4 py-2 text-right text-sm text-gray-700"
                        >
                          Tax
                        </td>
                        <td className="px-4 py-2 text-right text-sm text-gray-900">
                          ₹{(selectedOrder.tax || 0).toLocaleString("en-IN")}
                        </td>
                      </tr>
                    )}
                    {selectedOrder.shipping > 0 && (
                      <tr>
                        <td
                          colSpan="3"
                          className="px-4 py-2 text-right text-sm text-gray-700"
                        >
                          Shipping
                        </td>
                        <td className="px-4 py-2 text-right text-sm text-gray-900">
                          ₹
                          {(selectedOrder.shipping || 0).toLocaleString(
                            "en-IN"
                          )}
                        </td>
                      </tr>
                    )}
                    <tr className="border-t-2 border-gray-300">
                      <td
                        colSpan="3"
                        className="px-4 py-3 text-right text-base font-bold text-gray-900"
                      >
                        Total Amount
                      </td>
                      <td className="px-4 py-3 text-right text-lg font-bold text-indigo-600">
                        ₹{(selectedOrder.total || 0).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="border-t border-gray-200 pt-6">
              <h4 className="text-sm font-semibold text-gray-900 mb-4">
                Quick Actions
              </h4>
              <div className="flex flex-wrap gap-3">
                {/* Next Status Button */}
                {getNextStatus(selectedOrder.status) && (
                  <button
                    onClick={() =>
                      handleStatusUpdate(
                        selectedOrder._id,
                        getNextStatus(selectedOrder.status)
                      )
                    }
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Mark as {getNextStatus(selectedOrder.status)}
                  </button>
                )}

                {/* All Status Options */}
                {[
                  "pending",
                  "confirmed",
                  "processing",
                  "shipped",
                  "delivered",
                  "cancelled",
                ]
                  .filter((status) => status !== selectedOrder.status)
                  .map((status) => (
                    <button
                      key={status}
                      onClick={() =>
                        handleStatusUpdate(selectedOrder._id, status)
                      }
                      className="px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium capitalize"
                    >
                      {status}
                    </button>
                  ))}

                {/* Delete Button */}
                <button
                  onClick={() => handleDeleteOrder(selectedOrder._id)}
                  className="ml-auto flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Order
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Create Order Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          resetOrderForm();
        }}
        title="Create New Order"
        size="2xl"
      >
        <form onSubmit={handleCreateOrder} className="space-y-6">
          {/* Customer Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Select Customer *
            </label>
            <select
              value={orderForm.customerId}
              onChange={(e) => {
                const customer = customers.find(
                  (c) => c._id === e.target.value
                );
                setOrderForm({
                  ...orderForm,
                  customerId: e.target.value,
                  shippingAddress: {
                    ...orderForm.shippingAddress,
                    name: customer?.name || "",
                    phone: customer?.phone || "",
                  },
                });
              }}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            >
              <option value="">Choose a customer...</option>
              {customers.map((customer) => (
                <option key={customer._id} value={customer._id}>
                  {customer.name} - {customer.phone}
                </option>
              ))}
            </select>
          </div>

          {/* Platform */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Platform *
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="whatsapp"
                  checked={orderForm.platform === "whatsapp"}
                  onChange={(e) =>
                    setOrderForm({ ...orderForm, platform: e.target.value })
                  }
                  className="w-4 h-4 text-indigo-600"
                />
                <span className="text-sm">WhatsApp</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="instagram"
                  checked={orderForm.platform === "instagram"}
                  onChange={(e) =>
                    setOrderForm({ ...orderForm, platform: e.target.value })
                  }
                  className="w-4 h-4 text-indigo-600"
                />
                <span className="text-sm">Instagram</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="other"
                  checked={orderForm.platform === "other"}
                  onChange={(e) =>
                    setOrderForm({ ...orderForm, platform: e.target.value })
                  }
                  className="w-4 h-4 text-indigo-600"
                />
                <span className="text-sm">Other</span>
              </label>
            </div>
          </div>

          {/* Tax Configuration */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">
              Tax Configuration
            </h4>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Tax Type *
                </label>
                <select
                  value={orderForm.taxType}
                  onChange={(e) => {
                    const taxType = e.target.value;
                    let taxPercentage = orderForm.taxPercentage;

                    // Set default percentages for each tax type
                    if (taxType === "gst") {
                      taxPercentage = 18;
                    } else if (taxType === "cgst_sgst") {
                      taxPercentage = 18; // 9% CGST + 9% SGST
                    }

                    setOrderForm({
                      ...orderForm,
                      taxType,
                      taxPercentage,
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
                >
                  <option value="gst">GST (Goods and Services Tax)</option>
                  <option value="cgst_sgst">CGST + SGST (State GST)</option>
                  <option value="igst">IGST (Integrated GST)</option>
                  <option value="custom">Custom Tax</option>
                  <option value="no_tax">No Tax</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Tax Percentage *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={orderForm.taxPercentage}
                    onChange={(e) =>
                      setOrderForm({
                        ...orderForm,
                        taxPercentage: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
                  />
                  <span className="text-sm text-gray-600 font-medium">%</span>
                </div>
                {orderForm.taxType === "cgst_sgst" && (
                  <p className="text-xs text-gray-500 mt-1">
                    CGST: {(orderForm.taxPercentage / 2).toFixed(2)}% + SGST:{" "}
                    {(orderForm.taxPercentage / 2).toFixed(2)}%
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Shipping Amount *
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 font-medium">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={orderForm.shippingAmount}
                    onChange={(e) =>
                      setOrderForm({
                        ...orderForm,
                        shippingAmount: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
                    placeholder="Enter shipping amount"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Add Products */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">
              Add Products
            </h4>
            <div className="flex gap-3 mb-4">
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
              >
                <option value="">Select product...</option>
                {products.map((product) => (
                  <option key={product._id} value={product._id}>
                    {product.name} - ₹{product.price}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                value={productQuantity}
                onChange={(e) => setProductQuantity(parseInt(e.target.value))}
                placeholder="Qty"
                className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
              />
              <button
                type="button"
                onClick={handleAddItem}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Order Items List */}
            {orderForm.items.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-xs font-semibold text-gray-700 mb-2">
                  Order Items ({orderForm.items.length})
                </h5>
                {orderForm.items.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {item.name}
                      </p>
                      <p className="text-xs text-gray-600">
                        ₹{item.price} × {item.quantity} = ₹
                        {item.price * item.quantity}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.productId)}
                      className="p-1 hover:bg-red-50 rounded transition-colors"
                    >
                      <X className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                ))}
                <div className="border-t border-gray-300 pt-3 mt-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium">
                      ₹
                      {orderForm.items
                        .reduce(
                          (sum, item) => sum + item.price * item.quantity,
                          0
                        )
                        .toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">
                      {orderForm.taxType === "cgst_sgst"
                        ? `Tax (CGST ${(orderForm.taxPercentage / 2).toFixed(
                            1
                          )}% + SGST ${(orderForm.taxPercentage / 2).toFixed(
                            1
                          )}%)`
                        : orderForm.taxType === "igst"
                        ? `Tax (IGST ${orderForm.taxPercentage}%)`
                        : orderForm.taxType === "gst"
                        ? `Tax (GST ${orderForm.taxPercentage}%)`
                        : orderForm.taxType === "custom"
                        ? `Tax (${orderForm.taxPercentage}%)`
                        : "Tax"}
                    </span>
                    <span className="font-medium">
                      ₹
                      {(
                        orderForm.items.reduce(
                          (sum, item) => sum + item.price * item.quantity,
                          0
                        ) *
                        (orderForm.taxPercentage / 100)
                      ).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Shipping</span>
                    <span className="font-medium">
                      ₹{orderForm.shippingAmount.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between text-base font-bold border-t border-gray-300 pt-2">
                    <span>Total</span>
                    <span className="text-indigo-600">
                      ₹
                      {(
                        orderForm.items.reduce(
                          (sum, item) => sum + item.price * item.quantity,
                          0
                        ) *
                          (1 + orderForm.taxPercentage / 100) +
                        (orderForm.shippingAmount || 0)
                      ).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Payment Method *
            </label>
            <select
              value={orderForm.paymentMethod}
              onChange={(e) =>
                setOrderForm({ ...orderForm, paymentMethod: e.target.value })
              }
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            >
              <option value="cod">Cash on Delivery (COD)</option>
              <option value="upi">UPI</option>
              <option value="razorpay">Razorpay</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Shipping Address */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">
              Shipping Address
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Full Name"
                value={orderForm.shippingAddress.name}
                onChange={(e) =>
                  setOrderForm({
                    ...orderForm,
                    shippingAddress: {
                      ...orderForm.shippingAddress,
                      name: e.target.value,
                    },
                  })
                }
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
              />
              <input
                type="text"
                placeholder="Phone Number"
                value={orderForm.shippingAddress.phone}
                onChange={(e) =>
                  setOrderForm({
                    ...orderForm,
                    shippingAddress: {
                      ...orderForm.shippingAddress,
                      phone: e.target.value,
                    },
                  })
                }
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
              />
              <input
                type="text"
                placeholder="Address"
                value={orderForm.shippingAddress.address}
                onChange={(e) =>
                  setOrderForm({
                    ...orderForm,
                    shippingAddress: {
                      ...orderForm.shippingAddress,
                      address: e.target.value,
                    },
                  })
                }
                className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
              />
              <input
                type="text"
                placeholder="City"
                value={orderForm.shippingAddress.city}
                onChange={(e) =>
                  setOrderForm({
                    ...orderForm,
                    shippingAddress: {
                      ...orderForm.shippingAddress,
                      city: e.target.value,
                    },
                  })
                }
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
              />
              <input
                type="text"
                placeholder="State"
                value={orderForm.shippingAddress.state}
                onChange={(e) =>
                  setOrderForm({
                    ...orderForm,
                    shippingAddress: {
                      ...orderForm.shippingAddress,
                      state: e.target.value,
                    },
                  })
                }
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
              />
              <input
                type="text"
                placeholder="Pincode"
                value={orderForm.shippingAddress.pincode}
                onChange={(e) =>
                  setOrderForm({
                    ...orderForm,
                    shippingAddress: {
                      ...orderForm.shippingAddress,
                      pincode: e.target.value,
                    },
                  })
                }
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
              />
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={() => {
                setIsCreateModalOpen(false);
                resetOrderForm();
              }}
              className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={orderForm.items.length === 0}
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Create Order
            </button>
          </div>
        </form>
      </Modal>

      {/* Invoice/Billing Modal */}
      <Modal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        title="Invoice"
        size="2xl"
      >
        {selectedOrder && (
          <div className="space-y-6">
            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pb-4 border-b">
              <button
                onClick={handleDownloadInvoice}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
              <button
                onClick={handlePrintInvoice}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
            </div>

            {/* Invoice Content */}
            <div
              ref={invoiceRef}
              className="invoice-container bg-white p-8 border border-gray-200 rounded-lg"
            >
              {/* Invoice Header */}
              <div className="header flex items-start justify-between mb-8 pb-6 border-b-2 border-gray-300">
                <div className="company-info">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="logo w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
                      <ShoppingBag className="w-7 h-7 text-white" />
                    </div>
                    <div className="company-details">
                      <h1 className="text-3xl font-bold text-gray-900">
                        {user?.businessInfo?.businessName ||
                          user?.name ||
                          "Your Business"}
                      </h1>
                      <p className="text-sm text-gray-600">
                        Powered by ChatShop-AI
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-1 text-sm text-gray-600">
                    {user?.businessInfo?.address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        <span>{user.businessInfo.address}</span>
                      </div>
                    )}
                    {user?.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        <span>{user.phone}</span>
                      </div>
                    )}
                    {user?.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        <span>{user.email}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    INVOICE
                  </h2>
                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="font-semibold text-gray-700">
                        Invoice #:
                      </span>{" "}
                      <span className="text-gray-900 font-mono">
                        {selectedOrder.orderNumber}
                      </span>
                    </p>
                    <p>
                      <span className="font-semibold text-gray-700">Date:</span>{" "}
                      <span className="text-gray-900">
                        {new Date(selectedOrder.createdAt).toLocaleDateString(
                          "en-IN",
                          {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          }
                        )}
                      </span>
                    </p>
                    <p>
                      <span className="font-semibold text-gray-700">
                        Due Date:
                      </span>{" "}
                      <span className="text-gray-900">
                        {new Date(
                          new Date(selectedOrder.createdAt).getTime() +
                            7 * 24 * 60 * 60 * 1000
                        ).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    </p>
                    <div className="mt-2">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                          selectedOrder.paymentStatus === "paid"
                            ? "bg-green-100 text-green-700"
                            : selectedOrder.paymentStatus === "failed"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {selectedOrder.paymentStatus?.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bill To / Ship To */}
              <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                  <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                    Bill To:
                  </h3>
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold text-gray-900 text-base">
                      {selectedOrder.customerId?.name || "N/A"}
                    </p>
                    <p className="text-gray-600">
                      {selectedOrder.customerId?.email}
                    </p>
                    <p className="text-gray-600">
                      {selectedOrder.customerId?.phone}
                    </p>
                    {selectedOrder.customerId?.address && (
                      <p className="text-gray-600 mt-2">
                        {selectedOrder.customerId.address}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                    Ship To:
                  </h3>
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold text-gray-900 text-base">
                      {selectedOrder.shippingAddress?.name ||
                        selectedOrder.customerId?.name}
                    </p>
                    <p className="text-gray-600">
                      {selectedOrder.shippingAddress?.phone ||
                        selectedOrder.customerId?.phone}
                    </p>
                    <p className="text-gray-600 mt-2">
                      {selectedOrder.shippingAddress?.address ||
                        "Same as billing address"}
                    </p>
                    {selectedOrder.shippingAddress?.city && (
                      <p className="text-gray-600">
                        {selectedOrder.shippingAddress.city},{" "}
                        {selectedOrder.shippingAddress.state} -{" "}
                        {selectedOrder.shippingAddress.pincode}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="mb-8">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-100 border-b-2 border-gray-300">
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Item Description
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Qty
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Unit Price
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {selectedOrder.items?.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-900">
                            {item.productId?.name || item.name || "Product"}
                          </p>
                          {item.productId?.description && (
                            <p className="text-xs text-gray-500 mt-1">
                              {item.productId.description.substring(0, 60)}...
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-gray-900 font-medium">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-900">
                          ₹{(item.price || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                          ₹
                          {(
                            (item.price || 0) * (item.quantity || 0)
                          ).toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals Section */}
              <div className="flex justify-end mb-8">
                <div className="w-80">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between py-2">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="font-semibold text-gray-900">
                        ₹{(selectedOrder.subtotal || 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                    {selectedOrder.discount > 0 && (
                      <div className="flex items-center justify-between py-2 text-green-600">
                        <span>Discount:</span>
                        <span className="font-semibold">
                          - ₹
                          {(selectedOrder.discount || 0).toLocaleString(
                            "en-IN"
                          )}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between py-2">
                      <span className="text-gray-600">
                        Tax ({selectedOrder.taxPercentage || 18}%):
                      </span>
                      <span className="font-semibold text-gray-900">
                        ₹{(selectedOrder.tax || 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-gray-600">Shipping:</span>
                      <span className="font-semibold text-gray-900">
                        ₹
                        {(selectedOrder.shippingAmount || 0).toLocaleString(
                          "en-IN"
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-3 border-t-2 border-gray-300 mt-2">
                      <span className="text-lg font-bold text-gray-900">
                        Total Amount:
                      </span>
                      <span className="text-2xl font-bold text-indigo-600">
                        ₹{(selectedOrder.total || 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Info */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 className="text-sm font-bold text-gray-700 mb-2">
                  Payment Information
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Payment Method:</p>
                    <p className="font-semibold text-gray-900 capitalize">
                      {selectedOrder.paymentMethod || "COD"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Payment Status:</p>
                    <p className="font-semibold text-gray-900 capitalize">
                      {selectedOrder.paymentStatus || "Pending"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Terms & Conditions */}
              <div className="border-t pt-6">
                <h4 className="text-sm font-bold text-gray-700 mb-2">
                  Terms & Conditions
                </h4>
                <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                  <li>Payment is due within 7 days from the invoice date</li>
                  <li>Please include the invoice number on your payment</li>
                  <li>All prices are in Indian Rupees (INR)</li>
                  <li>Goods once sold will not be taken back or exchanged</li>
                  <li>
                    For any queries, please contact support@chatshop-ai.com
                  </li>
                </ul>
              </div>

              {/* Footer */}
              <div className="mt-8 pt-6 border-t text-center">
                <p className="text-sm font-semibold text-gray-900 mb-1">
                  Thank you for your business!
                </p>
                <p className="text-xs text-gray-500">
                  This is a computer-generated invoice and does not require a
                  physical signature.
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  ChatShop-AI © {new Date().getFullYear()} | All Rights Reserved
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Orders;
