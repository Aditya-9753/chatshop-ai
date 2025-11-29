const Customer = require("../models/Customer.model");

class CustomerService {
  // Get all customers with filters
  async getCustomers(userId, filters = {}) {
    const { platform, search, page = 1, limit = 20 } = filters;

    const query = { userId };

    if (platform) {
      query.platform = platform;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const customers = await Customer.find(query)
      .sort({ lastMessageDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Customer.countDocuments(query);

    return {
      customers,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      total: count,
    };
  }

  // Get single customer
  async getCustomer(userId, customerId) {
    const customer = await Customer.findOne({
      _id: customerId,
      userId,
    });

    if (!customer) {
      throw new Error("Customer not found");
    }

    return customer;
  }

  // Create new customer
  async createCustomer(userId, customerData) {
    const { name, phone, email, platform, platformId, tags, notes } =
      customerData;

    // Check if customer already exists
    const existingCustomer = await Customer.findOne({
      userId,
      phone,
      platform,
    });

    if (existingCustomer) {
      throw new Error("Customer already exists");
    }

    const customer = await Customer.create({
      userId,
      name,
      phone,
      email,
      platform,
      platformId,
      tags,
      notes,
    });

    return customer;
  }

  // Update customer
  async updateCustomer(userId, customerId, updateData) {
    const customer = await Customer.findOne({
      _id: customerId,
      userId,
    });

    if (!customer) {
      throw new Error("Customer not found");
    }

    const { name, email, tags, notes } = updateData;

    if (name) customer.name = name;
    if (email) customer.email = email;
    if (tags) customer.tags = tags;
    if (notes) customer.notes = notes;

    await customer.save();
    return customer;
  }

  // Delete customer
  async deleteCustomer(userId, customerId) {
    const customer = await Customer.findOneAndDelete({
      _id: customerId,
      userId,
    });

    if (!customer) {
      throw new Error("Customer not found");
    }

    return true;
  }

  // Block/unblock customer
  async blockCustomer(userId, customerId, isBlocked) {
    const customer = await Customer.findOne({
      _id: customerId,
      userId,
    });

    if (!customer) {
      throw new Error("Customer not found");
    }

    customer.isBlocked = isBlocked;
    await customer.save();

    return customer;
  }
}

module.exports = new CustomerService();
