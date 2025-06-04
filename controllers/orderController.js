const Order = require('../models/Order');
const DeliveryCharge = require('../models/DeliveryCharge');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const DefaultDeliverySettings = require('../models/DefaultDeliverySettings');
const mongoose = require('mongoose');

function generateOrderNumber() {
    return `ORD${Date.now()}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
}

// Create new order with coupon support
const createOrder = async (req, res) => {
    try {
        const { items, shippingAddress, paymentMethod, paymentDetails, couponCode } = req.body;
        const userId = req.user.id;

        if (!items || items.length === 0) {
            return res.status(400).json({ message: 'Order items are required' });
        }

        let subtotal = 0;
        const validatedItems = [];

        // Validate items and calculate subtotal
        for (const item of items) {
            const product = await Product.findById(item.productId);
            if (!product) {
                return res.status(404).json({ message: `Product ${item.name} not found` });
            }

            validatedItems.push({
                productId: item.productId,
                name: product.name,
                price: product.price,
                quantity: item.quantity,
                size: item.size,
                color: item.color,
                image: product.mainImage
            });

            subtotal += product.price * item.quantity;
        }

        // Get delivery charge based on city and state
        const deliveryInfo = await DeliveryCharge.findOne({
            city: shippingAddress.city,
            state: shippingAddress.state,
            isActive: true
        });

        let deliveryCharge = deliveryInfo ? deliveryInfo.charge : 50; // Default ₹50

        // Free delivery if threshold met
        if (deliveryInfo && subtotal >= deliveryInfo.freeDeliveryThreshold) {
            deliveryCharge = 0;
        }

        let couponUsed = null;
        let discountAmount = 0;
        let discountOnDelivery = 0;

        // Handle coupon validation and application
        if (couponCode) {
            const coupon = await Coupon.findOne({ 
                code: couponCode.toUpperCase(),
                isActive: true 
            });

            if (!coupon) {
                return res.status(400).json({ message: 'Invalid coupon code' });
            }

            // Check if user can use this coupon
            if (!coupon.canUserUseCoupon(userId)) {
                return res.status(400).json({ 
                    message: 'You have reached the usage limit for this coupon' 
                });
            }

            // Calculate discount
            const discountResult = coupon.calculateDiscount(subtotal, deliveryCharge, validatedItems);

            if (discountResult.error) {
                return res.status(400).json({ message: discountResult.error });
            }

            discountAmount = discountResult.discount || 0;
            discountOnDelivery = discountResult.discountOnDelivery || 0;

            // Prepare coupon usage data
            couponUsed = {
                couponId: coupon._id,
                code: coupon.code,
                type: coupon.type,
                value: coupon.value,
                discountAmount: discountAmount,
                discountOnDelivery: discountOnDelivery
            };

            // Update coupon usage statistics
            await Coupon.findByIdAndUpdate(coupon._id, {
                $inc: { usageCount: 1 },
                $addToSet: {
                    usedBy: {
                        userId: userId,
                        usageCount: 1,
                        lastUsed: new Date()
                    }
                }
            });

            // Update user-specific usage count
            await Coupon.updateOne(
                { 
                    _id: coupon._id,
                    'usedBy.userId': userId
                },
                {
                    $inc: { 'usedBy.$.usageCount': 1 },
                    $set: { 'usedBy.$.lastUsed': new Date() }
                }
            );
        }

        // Calculate final amounts
        const finalDeliveryCharge = Math.max(0, deliveryCharge - discountOnDelivery);
        const finalSubtotal = Math.max(0, subtotal - discountAmount);
        const totalAmount = finalSubtotal + finalDeliveryCharge;

        const orderNumber = generateOrderNumber();

        const orderData = {
            orderNumber,
            userId,
            items: validatedItems,
            shippingAddress,
            subtotal,
            deliveryCharge,
            couponUsed,
            discountAmount,
            discountedDeliveryCharge: discountOnDelivery,
            totalAmount,
            paymentMethod,
            paymentStatus: paymentMethod === 'COD' ? 'Pending' : 'Paid'
        };

        if (paymentMethod === 'Online' && paymentDetails?.transactionId) {
            orderData.paymentDetails = {
                transactionId: paymentDetails.transactionId
            };
        }

        const order = new Order(orderData);
        await order.save();
        await order.populate('userId', 'name email');

        res.status(201).json({
            message: 'Order placed successfully',
            order,
            orderNumber: order.orderNumber,
            savings: {
                discountAmount,
                discountOnDelivery,
                totalSavings: discountAmount + discountOnDelivery
            }
        });

    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ message: 'Failed to create order', error: error.message });
    }
};

// Apply coupon to cart (before placing order)
const applyCouponToCart = async (req, res) => {
    try {
        console.log('Received apply-coupon request body:', req.body); // Check incoming data
        const { couponCode, items, shippingAddress } = req.body;
        const userId = req.user.id; // Assuming req.user.id is correctly populated by protect middleware

        if (!couponCode || !items || items.length === 0) {
            console.log('Validation failed: Missing couponCode or items');
            return res.status(400).json({
                message: 'Coupon code and items are required'
            });
        }
        console.log('Coupon Code:', couponCode);
        console.log('Items:', items);
        console.log('Shipping Address:', shippingAddress);
        console.log('User ID:', userId);

        // Calculate subtotal
        let subtotal = 0;
        for (const item of items) {
            const product = await Product.findById(item.productId);
            if (!product) { // Add a check for product existence
                console.log(`Product with ID ${item.productId} not found.`);
                return res.status(400).json({ message: `Product with ID ${item.productId} not found.` });
            }
            if (product) {
                subtotal += product.price * item.quantity;
            }
        }
        console.log('Calculated Subtotal:', subtotal);

        // ... rest of your code

        // Find and validate coupon
        const coupon = await Coupon.findOne({
            code: couponCode.toUpperCase(),
            isActive: true
        });

        if (!coupon) {
            console.log('Coupon not found or inactive:', couponCode);
            return res.status(400).json({ message: 'Invalid coupon code' });
        }
        console.log('Found Coupon:', coupon.code);

        // Check if user can use this coupon
        // IMPORTANT: Ensure `canUserUseCoupon` method exists on your Coupon model and works as expected.
        // It typically returns a boolean. If it throws an error or returns non-boolean, this could break.
        if (!coupon.canUserUseCoupon(userId)) {
            console.log('User usage limit reached for coupon:', couponCode, 'by user:', userId);
            return res.status(400).json({
                message: 'You have reached the usage limit for this coupon'
            });
        }

        // Calculate discount
        // IMPORTANT: Ensure `calculateDiscount` method exists on your Coupon model and works as expected.
        // It typically returns { discount: Number, discountOnDelivery: Number, error: String }
        const discountResult = coupon.calculateDiscount(subtotal, deliveryCharge, items);
        console.log('Discount Result:', discountResult);

        if (discountResult.error) {
            console.log('Discount calculation error:', discountResult.error);
            return res.status(400).json({ message: discountResult.error });
        }

        // ... rest of your success logic

    } catch (error) {
        console.error('SERVER ERROR in applyCouponToCart:', error); // Catch any unexpected errors
        // Add specific error handling for Mongoose errors if you want
        if (error.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid ID format for product or coupon.' });
        }
        res.status(500).json({ message: 'Failed to apply coupon due to a server error.' });
    }
};

// Get user orders (updated to include coupon info)
const getUserOrders = async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 10, status } = req.query;

        const filter = { userId };
        if (status) filter.orderStatus = status;

        const orders = await Order.find(filter)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .populate('items.productId', 'slug')
            .populate('couponUsed.couponId', 'name');

        const total = await Order.countDocuments(filter);

        res.json({
            orders,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });

    } catch (error) {
        console.error('Get user orders error:', error);
        res.status(500).json({ message: 'Failed to fetch orders' });
    }
};

// Get single order (updated to include coupon info)
const getOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.user.id;

        const order = await Order.findOne({
            $or: [{ _id: orderId }, { orderNumber: orderId }],
            userId
        })
        .populate('items.productId', 'slug')
        .populate('couponUsed.couponId', 'name description');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        res.json(order);

    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({ message: 'Failed to fetch order' });
    }
};

// Cancel order (user) - updated to handle coupon refund
const cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.params;

        if (!req.user || !req.user._id) {
            return res.status(401).json({ message: 'Authentication required or user ID not found.' });
        }
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ message: 'Invalid order ID format provided.' });
        }

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        if (order.userId.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'You do not have permission to cancel this order.' });
        }

        if (!['Pending', 'Confirmed'].includes(order.orderStatus)) {
            return res.status(400).json({ message: `Order cannot be cancelled in '${order.orderStatus}' status.` });
        }

        // Refund coupon usage if order had a coupon
        if (order.couponUsed && order.couponUsed.couponId) {
            await Coupon.findByIdAndUpdate(order.couponUsed.couponId, {
                $inc: { usageCount: -1 }
            });

            // Decrease user-specific usage count
            await Coupon.updateOne(
                { 
                    _id: order.couponUsed.couponId,
                    'usedBy.userId': userId
                },
                {
                    $inc: { 'usedBy.$.usageCount': -1 }
                }
            );
        }

        order.orderStatus = 'Cancelled';
        order.cancelledAt = new Date();
        await order.save();

        res.json({ message: 'Order cancelled successfully', order });

    } catch (error) {
        if (error instanceof mongoose.CastError && error.path === '_id') {
            return res.status(400).json({ message: 'Invalid order ID format provided.' });
        }

        res.status(500).json({ message: 'Failed to cancel order due to a server error.' });
    }
};

// ADMIN FUNCTIONS

// Get all orders (admin) - updated to include coupon info
const getAllOrders = async (req, res) => {
    try {
        const { page = 1, limit = 20, status, search } = req.query;

        const filter = {};
        if (status) filter.orderStatus = status;
        if (search) {
            filter.$or = [
                { orderNumber: { $regex: search, $options: 'i' } },
                { 'shippingAddress.fullName': { $regex: search, $options: 'i' } },
                { 'shippingAddress.phone': { $regex: search, $options: 'i' } },
                { 'couponUsed.code': { $regex: search, $options: 'i' } }
            ];
        }

        const orders = await Order.find(filter)
            .populate('userId', 'name email')
            .populate('couponUsed.couponId', 'name')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Order.countDocuments(filter);

        const stats = await Order.aggregate([
            {
                $group: {
                    _id: '$orderStatus',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$totalAmount' },
                    totalDiscount: { $sum: '$discountAmount' }
                }
            }
        ]);

        // Get coupon usage stats
        const couponStats = await Order.aggregate([
            {
                $match: { 'couponUsed.couponId': { $exists: true } }
            },
            {
                $group: {
                    _id: null,
                    totalCouponOrders: { $sum: 1 },
                    totalDiscount: { $sum: '$discountAmount' },
                    totalDeliveryDiscount: { $sum: '$discountedDeliveryCharge' }
                }
            }
        ]);

        res.json({
            orders,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total,
            stats,
            couponStats: couponStats[0] || { totalCouponOrders: 0, totalDiscount: 0, totalDeliveryDiscount: 0 }
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

        order.orderStatus = status;
        if (trackingNumber) order.trackingNumber = trackingNumber;
        if (notes) order.notes = notes;

        if (status === 'Shipped') order.shippedAt = new Date();
        if (status === 'Delivered') order.deliveredAt = new Date();
        if (status === 'Cancelled') {
            order.cancelledAt = new Date();
            
            // Refund coupon usage if order had a coupon
            if (order.couponUsed && order.couponUsed.couponId) {
                await Coupon.findByIdAndUpdate(order.couponUsed.couponId, {
                    $inc: { usageCount: -1 }
                });

                // Decrease user-specific usage count
                await Coupon.updateOne(
                    { 
                        _id: order.couponUsed.couponId,
                        'usedBy.userId': order.userId
                    },
                    {
                        $inc: { 'usedBy.$.usageCount': -1 }
                    }
                );
            }
        }

        await order.save();

        res.json({ message: 'Order status updated successfully', order });

    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({ message: 'Failed to update order status' });
    }
};

// Rest of the functions remain the same...
// Delivery charge management (Admin)
const getDeliveryCharges = async (req, res) => {
    try {
        const { page = 1, limit = 10, state, city, isActive } = req.query;
        const filter = {};

        if (state) filter.state = { $regex: state, $options: 'i' };
        if (city) filter.city = { $regex: city, $options: 'i' };
        if (isActive !== undefined) {
            filter.isActive = isActive === 'true';
        }

        const charges = await DeliveryCharge.find(filter)
            .sort({ state: 1, city: 1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await DeliveryCharge.countDocuments(filter);

        res.json({
            deliveryCharges: charges,
            currentPage: parseInt(page),
            total: total
        });
    } catch (error) {
        console.error('Get delivery charges error:', error);
        res.status(500).json({ message: 'Failed to fetch delivery charges' });
    }
};

const updateDeliveryCharge = async (req, res) => {
    try {
        const { city, state, charge, minimumOrderValue, freeDeliveryThreshold, estimatedDays, isActive } = req.body;

        if (!city || !state || charge === undefined) {
            return res.status(400).json({ message: 'State, City, and Charge are required.' });
        }

        const deliveryCharge = await DeliveryCharge.findOneAndUpdate(
            { city: city.trim(), state: state.trim() },
            {
                city: city.trim(),
                state: state.trim(),
                charge,
                minimumOrderValue: minimumOrderValue !== undefined ? minimumOrderValue : 0,
                freeDeliveryThreshold: freeDeliveryThreshold !== undefined ? freeDeliveryThreshold : 0,
                estimatedDays: estimatedDays !== undefined ? estimatedDays : 3,
                isActive: isActive !== undefined ? isActive : true
            },
            { upsert: true, new: true, runValidators: true }
        );

        res.status(200).json({ message: 'Delivery charge saved successfully', deliveryCharge });

    } catch (error) {
        console.error('Save delivery charge error:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message, errors: error.errors });
        }
        res.status(500).json({ message: 'Failed to save delivery charge', error: error.message });
    }
};

const deleteDeliveryCharge = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid delivery charge ID format.' });
        }
        const result = await DeliveryCharge.findByIdAndDelete(id);
        if (!result) {
            return res.status(404).json({ message: 'Delivery charge not found.' });
        }
        res.json({ message: 'Delivery charge deleted successfully' });
    } catch (error) {
        console.error('Delete delivery charge error:', error);
        res.status(500).json({ message: 'Failed to delete delivery charge' });
    }
};

const bulkUploadDeliveryCharges = async (req, res) => {
    try {
        const { deliveryCharges } = req.body;
        if (!Array.isArray(deliveryCharges) || deliveryCharges.length === 0) {
            return res.status(400).json({ message: 'An array of delivery charges is required for bulk upload.' });
        }

        const success = [];
        const errors = [];

        for (const chargeData of deliveryCharges) {
            try {
                const validatedChargeData = {
                    state: chargeData.state?.trim(),
                    city: chargeData.city?.trim(),
                    charge: parseFloat(chargeData.charge) || 0,
                    minimumOrderValue: parseFloat(chargeData.minimumOrderValue) || 0,
                    freeDeliveryThreshold: parseFloat(chargeData.freeDeliveryThreshold) || 0,
                    estimatedDays: parseInt(chargeData.estimatedDays) || 3,
                    isActive: chargeData.isActive !== undefined ? (String(chargeData.isActive).toLowerCase() === 'true') : true
                };

                const result = await DeliveryCharge.findOneAndUpdate(
                    { state: validatedChargeData.state, city: validatedChargeData.city },
                    { $set: validatedChargeData },
                    { upsert: true, new: true, runValidators: true }
                );
                success.push(result);
            } catch (error) {
                errors.push({ data: chargeData, error: error.message });
            }
        }
        res.json({ message: 'Bulk upload processed.', success, errors });
    } catch (error) {
        console.error('Bulk upload delivery charges error:', error);
        res.status(500).json({ message: 'Failed to process bulk upload.' });
    }
};

const getDefaultDeliverySettings = async (req, res) => {
    try {
        let settings = await DefaultDeliverySettings.findOne({ settingName: 'GLOBAL_DEFAULT_DELIVERY' });

        if (!settings) {
            settings = await DefaultDeliverySettings.create({
                settingName: 'GLOBAL_DEFAULT_DELIVERY',
                charge: 50,
                minimumOrderValue: 0,
                freeDeliveryThreshold: 500,
                estimatedDays: 3
            });
        }
        res.status(200).json(settings);
    } catch (error) {
        console.error('Get default delivery settings error:', error);
        res.status(500).json({ message: 'Failed to fetch default delivery settings' });
    }
};

const updateDefaultDeliverySettings = async (req, res) => {
    try {
        const { charge, minimumOrderValue, freeDeliveryThreshold, estimatedDays } = req.body;

        const settings = await DefaultDeliverySettings.findOneAndUpdate(
            { settingName: 'GLOBAL_DEFAULT_DELIVERY' },
            {
                charge: charge !== undefined ? charge : 50,
                minimumOrderValue: minimumOrderValue !== undefined ? minimumOrderValue : 0,
                freeDeliveryThreshold: freeDeliveryThreshold !== undefined ? freeDeliveryThreshold : 500,
                estimatedDays: estimatedDays !== undefined ? estimatedDays : 3
            },
            { upsert: true, new: true, runValidators: true }
        );

        res.status(200).json({ message: 'Default delivery settings updated successfully', settings });
    } catch (error) {
        console.error('Update default delivery settings error:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message, errors: error.errors });
        }
        res.status(500).json({ message: 'Failed to update default delivery settings', error: error.message });
    }
};

const getDeliveryCharge = async (req, res) => {
    try {
        const { city } = req.params;

        const deliveryInfo = await DeliveryCharge.findOne({
            city: city,
            isActive: true
        });

        const charge = deliveryInfo ? deliveryInfo.charge : 50;
        const freeThreshold = deliveryInfo ? deliveryInfo.freeDeliveryThreshold : 0;

        res.json({
            charge,
            freeDeliveryThreshold: freeThreshold,
            city
        });

    } catch (error) {
        console.error('Get delivery charge error:', error);
        res.status(500).json({ message: 'Failed to fetch delivery charge' });
    }
};

const processPayment = async (req, res) => {
    try {
        const { amount, paymentMethod, cardDetails } = req.body;

        await new Promise(resolve => setTimeout(resolve, 2000));

        const isSuccess = Math.random() > 0.1;

        if (isSuccess) {
            res.json({
                success: true,
                transactionId: `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`,
                message: 'Payment processed successfully',
                amount
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Payment failed. Please try again.',
                errorCode: 'PAYMENT_FAILED'
            });
        }

    } catch (error) {
        console.error('Payment processing error:', error);
        res.status(500).json({ message: 'Payment processing failed' });
    }
};

module.exports = {
    createOrder,
    applyCouponToCart, // New function
    getUserOrders,
    getOrder,
    cancelOrder,
    getAllOrders,
    updateOrderStatus,
    getDeliveryCharges,
    updateDeliveryCharge,
    getDeliveryCharge,
    processPayment,
    deleteDeliveryCharge,
    bulkUploadDeliveryCharges,
    getDefaultDeliverySettings,
    updateDefaultDeliverySettings
};