const OrderService = require('../services/OrderService');
const PaymentService = require('../services/PaymentService');
const Order = require('../models/Order');
const User = require('../models/User');
const Settings = require('../models/Settings'); // For COD toggle

// Initialize OrderService
const orderService = new OrderService();

// USER CONTROLLERS

// Consolidated Create Order (Handles both COD and Razorpay initiation)
const createOrder = async (req, res) => {
    try {
        const userId = req.user.id;
        const { items, shippingAddress, paymentMethod, couponCode } = req.body;

        // 1. Validate and calculate order
        const calculation = await orderService.validateAndCalculateOrder(
            items,
            shippingAddress,
            couponCode,
            userId
        );

        // For Razorpay payments, create Razorpay order first
        if (paymentMethod === 'RAZORPAY') {
            // Get user's email for Razorpay notes
            const user = await User.findById(userId);
            const userEmail = user ? user.email : 'guest@example.com';

            // Validate amount before converting to paise
            if (typeof calculation.totalAmount !== 'number' || isNaN(calculation.totalAmount) || calculation.totalAmount <= 0) {
                throw new Error('Invalid order amount for Razorpay payment');
            }

            // Convert amount to paise and ensure it's a whole number
            const amountInPaise = Math.round(calculation.totalAmount * 100);

            // Create receipt ID
            const tempReceiptId = `ORDER_${Date.now()}`;
            const shortUserId = String(userId).substring(0, 10);
            const receiptForRazorpay = `${tempReceiptId}_${shortUserId}`;

            // Create Razorpay order
            const razorpayOrderResponse = await PaymentService.createRazorpayOrder(
                amountInPaise,
                receiptForRazorpay,
                userEmail
            );

            if (!razorpayOrderResponse.success) {
                return res.status(400).json({
                    message: 'Failed to initiate online payment.',
                    error: razorpayOrderResponse.error
                });
            }

            // For Razorpay payments, don't create the order yet
            // Just return the payment details and calculation
            return res.status(201).json({
                success: true,
                message: 'Payment initiation successful',
                orderData: {
                    items,
                    shippingAddress,
                    paymentMethod,
                    couponCode,
                    userId
                },
                razorpayDetails: {
                    orderId: razorpayOrderResponse.orderId,
                    amount: razorpayOrderResponse.amount,
                    currency: razorpayOrderResponse.currency,
                    key: process.env.RAZORPAY_KEY_ID
                },
                orderCalculation: calculation
            });
        }

        // For COD orders, create the order immediately
        const order = await orderService.createOrder({
            items,
            shippingAddress,
            paymentMethod,
            couponCode
        }, userId);

        // Return the created order
        res.status(201).json({
            success: true,
            message: 'Order placed successfully',
            order,
            orderNumber: order.orderNumber,
            orderCalculation: {
                subtotal: calculation.subtotal,
                deliveryCharge: calculation.deliveryCharge,
                discountAmount: calculation.discountAmount,
                discountOnDelivery: calculation.discountOnDelivery,
                totalAmount: calculation.totalAmount,
                savings: calculation.discountAmount + calculation.discountOnDelivery
            }
        });

    } catch (error) {
        console.error('Create order error:', error);
        res.status(400).json({ message: error.message });
    }
};


// Verify payment and confirm order
const verifyPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            orderData
        } = req.body;

        console.log('[verifyPayment] Payment verification started:', {
            razorpayOrderId: razorpay_order_id,
            paymentId: razorpay_payment_id,
            orderData: orderData
        });

        // First verify the payment signature
        const isValid = await PaymentService.verifyPaymentSignature(
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        );

        if (!isValid) {
            throw new Error('Payment signature validation failed');
        }

        // Use authenticated user's ID
        const userId = req.user.id;

        // Create or update the order with verified Razorpay details
        const order = await orderService.createOrder({
            ...orderData,
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature
        }, userId);

        // If order is created successfully, send the response
        res.json({
            success: true,
            message: 'Payment verified and order confirmed successfully',
            order
        });

    } catch (error) {
        console.error('[verifyPayment] Error:', error);
        res.status(400).json({ 
            success: false,
            message: error.message || 'Payment verification failed' 
        });
    }
};

// Apply coupon to cart (remains same)
const applyCoupon = async (req, res) => {
    try {
        const { couponCode, items, shippingAddress } = req.body;
        const userId = req.user.id;

        const calculation = await orderService.validateAndCalculateOrder(
            items,
            shippingAddress,
            couponCode,
            userId
        );

        res.json({
            success: true,
            message: 'Coupon applied successfully',
            calculation: {
                subtotal: calculation.subtotal,
                deliveryCharge: calculation.deliveryCharge,
                discountAmount: calculation.discountAmount,
                discountOnDelivery: calculation.discountOnDelivery,
                totalAmount: calculation.totalAmount,
                savings: calculation.discountAmount + calculation.discountOnDelivery,
                coupon: calculation.couponUsed
            }
        });

    } catch (error) {
        console.error('Apply coupon error:', error);
        res.status(400).json({ message: error.message });
    }
};

// Get user orders (remains same)
const getUserOrders = async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 10, status } = req.query;

        const filters = { userId };
        if (status) filters.status = status.toUpperCase();

        const result = await orderService.getOrders(filters, { page, limit });

        res.json({
            success: true,
            ...result
        });

    } catch (error) {
        console.error('Get user orders error:', error);
        res.status(500).json({ message: 'Failed to fetch orders' });
    }
};

// Get single order (remains same, but consider if this should also allow lookup by razorpayOrderId for convenience)
const getOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.user.id;

        const order = await Order.findOne({
            $or: [{ _id: orderId }, { orderNumber: orderId }],
            userId
        })
            .populate('userId', 'name email')
            .populate('items.productId', 'slug')
            .populate('couponUsed.couponId', 'name description');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        res.json({ success: true, order });

    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({ message: 'Failed to fetch order' });
    }
};

// Cancel order (remains same)
const cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.user.id;

        const order = await orderService.cancelOrder(orderId, userId);

        res.json({
            success: true,
            message: 'Order cancelled successfully',
            order
        });

    } catch (error) {
        console.error('Cancel order error:', error);
        res.status(400).json({ message: error.message });
    }
};

// ADMIN CONTROLLERS (remain same)

// Get all orders (admin)
const getAllOrders = async (req, res) => {
    try {
        const { page = 1, limit = 20, status, search } = req.query;

        const filters = {};
        if (status) filters.status = status.toUpperCase();
        if (search) {
            filters.$or = [
                { orderNumber: { $regex: search, $options: 'i' } },
                { 'shippingAddress.fullName': { $regex: search, $options: 'i' } },
                { 'shippingAddress.phone': { $regex: search, $options: 'i' } }
            ];
        }

        const result = await orderService.getOrders(filters, { page, limit });

        // Get order statistics
        const stats = await Order.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$totalAmount' }
                }
            }
        ]);

        res.json({
            success: true,
            ...result,
            stats
        });

    } catch (error) {
        console.error('Get all orders error:', error);
        res.status(500).json({ message: 'Failed to fetch orders' });
    }
};

// Update order status (admin)
const updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status, trackingNumber, notes } = req.body;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        order.status = status.toUpperCase();
        if (trackingNumber) order.trackingNumber = trackingNumber;
        if (notes) order.notes = notes;

        // Update timestamps based on status
        const now = new Date();
        switch (status.toUpperCase()) {
            case 'CONFIRMED':
                order.confirmedAt = now;
                break;
            case 'SHIPPED':
                order.shippedAt = now;
                break;
            case 'DELIVERED':
                order.deliveredAt = now;
                break;
            case 'CANCELLED':
                order.cancelledAt = now;
                // Handle refund if needed
                if (order.payment.status === 'PAID' && order.payment.razorpayPaymentId) {
                    const refundResult = await PaymentService.refundPayment(
                        order.payment.razorpayPaymentId,
                        order.totalAmount,
                        'Order cancelled by admin'
                    );
                    if (refundResult.success) {
                        order.payment.status = 'REFUNDED';
                    }
                }
                break;
        }

        await order.save();

        res.json({
            success: true,
            message: 'Order status updated successfully',
            order
        });

    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({ message: 'Failed to update order status' });
    }
};

// Toggle COD availability (admin) (remains same)
const toggleCOD = async (req, res) => {
    try {
        const { enabled } = req.body;

        await Settings.findOneAndUpdate(
            { key: 'COD_ENABLED' },
            { key: 'COD_ENABLED', value: enabled },
            { upsert: true }
        );

        res.json({
            success: true,
            message: `COD ${enabled ? 'enabled' : 'disabled'} successfully`,
            codEnabled: enabled
        });

    } catch (error) {
        console.error('Toggle COD error:', error);
        res.status(500).json({ message: 'Failed to update COD settings' });
    }
};

// Get COD status (remains same)
const getCODStatus = async (req, res) => {
    try {
        const setting = await Settings.findOne({ key: 'COD_ENABLED' });
        const codEnabled = setting ? setting.value : true; // Default to enabled

        res.json({
            success: true,
            codEnabled
        });

    } catch (error) {
        console.error('Get COD status error:', error);
        res.status(500).json({ message: 'Failed to fetch COD status' });
    }
};

// Helper function to generate invoice HTML
const generateInvoiceHtml = (order) => {
    if (!order) return '<div>No order found.</div>';

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount);
    };

    const formatDate = (date) => new Date(date).toLocaleDateString('en-IN');

    const itemsHtml = order.items.map(item => `
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px 0;">${item.productId.name}</td>
            <td style="padding: 8px 0; text-align: center;">${item.quantity}</td>
            <td style="padding: 8px 0; text-align: right;">${formatCurrency(item.price)}</td>
            <td style="padding: 8px 0; text-align: right;">${formatCurrency(item.price * item.quantity)}</td>
        </tr>
    `).join('');

    return `
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Invoice #${order.orderNumber}</title>
            <style>
                body { font-family: 'Arial', sans-serif; margin: 20px; color: #333; }
                .container { width: 800px; margin: 0 auto; border: 1px solid #eee; padding: 30px; box-shadow: 0 0 10px rgba(0,0,0,0.05); }
                .header, .footer { text-align: center; margin-bottom: 30px; }
                .header h1 { margin: 0; color: #555; }
                .invoice-details, .customer-details, .summary-details { margin-bottom: 20px; }
                .invoice-details table, .customer-details table, .summary-details table { width: 100%; border-collapse: collapse; }
                .invoice-details td, .customer-details td, .summary-details td { padding: 5px; vertical-align: top; }
                .invoice-details .label, .customer-details .label, .summary-details .label { font-weight: bold; width: 150px; }
                .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                .items-table th, .items-table td { border: 1px solid #eee; padding: 8px; text-align: left; }
                .items-table th { background-color: #f9f9f9; }
                .total-row { font-weight: bold; background-color: #f0f0f0; }
                .text-right { text-align: right; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Invoice</h1>
                    <p>Order Number: <strong>${order.orderNumber}</strong></p>
                    <p>Date: ${formatDate(order.createdAt)}</p>
                </div>

                <div class="customer-details">
                    <table style="width: 100%;">
                        <tr>
                            <td style="width: 50%;">
                                <strong>Bill To:</strong><br/>
                                ${order.userId.name || 'N/A'}<br/>
                                ${order.userId.email || 'N/A'}<br/>
                                ${order.shippingAddress.phone || 'N/A'}
                            </td>
                            <td style="width: 50%;">
                                <strong>Ship To:</strong><br/>
                                ${order.shippingAddress.fullName || order.userId.name || 'N/A'}<br/>
                                ${order.shippingAddress.address || 'N/A'}<br/>
                                ${order.shippingAddress.city || 'N/A'}, ${order.shippingAddress.state || 'N/A'} - ${order.shippingAddress.pincode || 'N/A'}
                            </td>
                        </tr>
                    </table>
                </div>

                <table class="items-table">
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th style="text-align: center;">Qty</th>
                            <th style="text-align: right;">Unit Price</th>
                            <th style="text-align: right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>

                <div class="summary-details" style="width: 100%; text-align: right;">
                    <table style="width: 50%; float: right;">
                        <tr>
                            <td>Subtotal:</td>
                            <td class="text-right">${formatCurrency(order.subtotal)}</td>
                        </tr>
                        <tr>
                            <td>Delivery Charge:</td>
                            <td class="text-right">${formatCurrency(order.deliveryCharge)}</td>
                        </tr>
                        ${order.discountAmount > 0 ? `
                        <tr>
                            <td>Discount:</td>
                            <td class="text-right">-${formatCurrency(order.discountAmount)}</td>
                        </tr>` : ''}
                        <tr class="total-row">
                            <td>Grand Total:</td>
                            <td class="text-right">${formatCurrency(order.totalAmount)}</td>
                        </tr>
                        <tr>
                            <td>Payment Method:</td>
                            <td class="text-right">${order.paymentMethod} (${order.payment?.status || 'N/A'})</td>
                        </tr>
                    </table>
                    <div style="clear: both;"></div>
                </div>

                <div class="footer" style="margin-top: 50px;">
                    <p>Thank you for your business!</p>
                </div>
            </div>
        </body>
        </html>
    `;
};

// Get order invoice
const getOrderInvoice = async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.user.id;

        // Find order and validate ownership
        const order = await Order.findOne({
            $or: [{ _id: orderId }, { orderNumber: orderId }],
            userId
        })
        .populate('userId', 'name email')
        .populate('items.productId', 'name');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Generate invoice HTML
        const invoiceHtml = generateInvoiceHtml(order);

        // Send response
        res.set('Content-Type', 'text/html');
        res.status(200).send(invoiceHtml);

    } catch (error) {
        console.error('Get invoice error:', error);
        res.status(500).json({ message: 'Failed to generate invoice' });
    }
};

module.exports = {
    // User routes
    // Removed createPaymentOrder as it's merged into createOrder
    createOrder, // This is now the main endpoint for order creation
    verifyPayment,
    applyCoupon,
    getUserOrders,
    getOrder,
    cancelOrder,
    getOrderInvoice,

    // Admin routes
    getAllOrders,
    updateOrderStatus,
    toggleCOD,
    getCODStatus
};