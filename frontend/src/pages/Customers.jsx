import React, { useState, useEffect } from "react";
import {
  Users,
  Plus,
  Search,
  Edit,
  Trash2,
  Ban,
  CheckCircle,
  Phone,
  Mail,
  Tag,
  StickyNote,
  X,
  Filter,
} from "lucide-react";
import customerService from "../services/customer.service";
import Modal from "../components/Modal";
import Button from "../components/Button";
import Input from "../components/Input";
import { useToast } from "../components/Toast";

const AVAILABLE_TAGS = [
  { id: "vip", label: "VIP", color: "bg-purple-100 text-purple-800" },
  {
    id: "first-time",
    label: "First Time",
    color: "bg-green-100 text-green-800",
  },
  { id: "inactive", label: "Inactive", color: "bg-gray-100 text-gray-800" },
  { id: "returning", label: "Returning", color: "bg-blue-100 text-blue-800" },
  {
    id: "high-value",
    label: "High Value",
    color: "bg-yellow-100 text-yellow-800",
  },
  {
    id: "needs-followup",
    label: "Needs Follow-up",
    color: "bg-red-100 text-red-800",
  },
];

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [customerNotes, setCustomerNotes] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [showTagDropdown, setShowTagDropdown] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    platform: "whatsapp",
  });
  const { success, error } = useToast();

  useEffect(() => {
    fetchCustomers();
  }, [searchTerm]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await customerService.getCustomers({
        search: searchTerm,
      });
      if (response.success) {
        setCustomers(response.data);
      }
    } catch (err) {
      error(err.message || "Failed to fetch customers");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (selectedCustomer) {
        await customerService.updateCustomer(selectedCustomer._id, formData);
        success("Customer updated successfully");
      } else {
        await customerService.createCustomer(formData);
        success("Customer created successfully");
      }
      setIsModalOpen(false);
      resetForm();
      fetchCustomers();
    } catch (err) {
      error(err.message || "Operation failed");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this customer?"))
      return;
    try {
      await customerService.deleteCustomer(id);
      success("Customer deleted successfully");
      fetchCustomers();
    } catch (err) {
      error(err.message || "Failed to delete customer");
    }
  };

  const handleBlock = async (id, isBlocked) => {
    try {
      await customerService.blockCustomer(id, !isBlocked);
      success(`Customer ${!isBlocked ? "blocked" : "unblocked"} successfully`);
      fetchCustomers();
    } catch (err) {
      error(err.message || "Operation failed");
    }
  };

  const handleAddTag = async (customerId, tag) => {
    try {
      await customerService.addTag(customerId, tag);
      success("Tag added successfully");
      fetchCustomers();
      setShowTagDropdown(null);
    } catch (err) {
      error(err.message || "Failed to add tag");
    }
  };

  const handleRemoveTag = async (customerId, tag) => {
    try {
      await customerService.removeTag(customerId, tag);
      success("Tag removed successfully");
      fetchCustomers();
    } catch (err) {
      error(err.message || "Failed to remove tag");
    }
  };

  const openNotesModal = async (customer) => {
    setSelectedCustomer(customer);
    setIsNotesModalOpen(true);
    try {
      const response = await customerService.getInternalNotes(customer._id);
      if (response.success) {
        setCustomerNotes(response.data);
      }
    } catch (err) {
      error("Failed to load notes");
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    try {
      await customerService.addInternalNote(selectedCustomer._id, newNote);
      success("Note added successfully");
      setNewNote("");
      const response = await customerService.getInternalNotes(
        selectedCustomer._id
      );
      if (response.success) {
        setCustomerNotes(response.data);
      }
    } catch (err) {
      error("Failed to add note");
    }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await customerService.deleteInternalNote(noteId);
      success("Note deleted successfully");
      const response = await customerService.getInternalNotes(
        selectedCustomer._id
      );
      if (response.success) {
        setCustomerNotes(response.data);
      }
    } catch (err) {
      error("Failed to delete note");
    }
  };

  const openModal = (customer = null) => {
    if (customer) {
      setSelectedCustomer(customer);
      setFormData({
        name: customer.name,
        phone: customer.phone,
        email: customer.email || "",
        platform: customer.platform,
      });
    }
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setSelectedCustomer(null);
    setFormData({ name: "", phone: "", email: "", platform: "whatsapp" });
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-600 mt-1">Manage your customer database</p>
        </div>
        <Button icon={Plus} onClick={() => openModal()}>
          Add Customer
        </Button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No customers found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Platform
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Orders
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Total Spent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {customers.map((customer) => (
                  <tr key={customer._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white font-semibold">
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-semibold text-gray-900">
                            {customer.name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 flex items-center gap-1">
                        <Phone className="w-4 h-4 text-gray-400" />
                        {customer.phone}
                      </div>
                      {customer.email && (
                        <div className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                          <Mail className="w-4 h-4 text-gray-400" />
                          {customer.email}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          customer.platform === "whatsapp"
                            ? "bg-green-100 text-green-800"
                            : "bg-pink-100 text-pink-800"
                        }`}
                      >
                        {customer.platform === "whatsapp"
                          ? "💬 WhatsApp"
                          : "📸 Instagram"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {customer.totalOrders || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      ₹{(customer.totalSpent || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {customer.isBlocked ? (
                        <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                          Blocked
                        </span>
                      ) : (
                        <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openModal(customer)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() =>
                            handleBlock(customer._id, customer.isBlocked)
                          }
                          className={
                            customer.isBlocked
                              ? "text-green-600 hover:text-green-900"
                              : "text-yellow-600 hover:text-yellow-900"
                          }
                        >
                          {customer.isBlocked ? (
                            <CheckCircle className="w-5 h-5" />
                          ) : (
                            <Ban className="w-5 h-5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(customer._id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          resetForm();
        }}
        title={selectedCustomer ? "Edit Customer" : "Add New Customer"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Customer name"
            required
          />
          <Input
            label="Phone"
            name="phone"
            type="tel"
            value={formData.phone}
            onChange={handleChange}
            placeholder="+91 98765 43210"
            required
          />
          <Input
            label="Email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="customer@example.com"
          />
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Platform <span className="text-red-500">*</span>
            </label>
            <select
              name="platform"
              value={formData.platform}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1">
              {selectedCustomer ? "Update" : "Create"} Customer
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsModalOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Customers;
