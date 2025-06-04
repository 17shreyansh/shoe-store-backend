const mongoose = require('mongoose');

const defaultDeliverySettingsSchema = new mongoose.Schema({
    // A unique identifier, typically just one document for global settings
    settingName: {
        type: String,
        required: true,
        unique: true,
        default: 'GLOBAL_DEFAULT_DELIVERY' // A fixed name to easily find this single settings document
    },
    charge: {
        type: Number,
        required: true,
        default: 50,
        min: 0
    },
    minimumOrderValue: {
        type: Number,
        default: 0,
        min: 0
    },
    freeDeliveryThreshold: {
        type: Number,
        default: 500,
        min: 0
    },
    estimatedDays: {
        type: Number,
        default: 3,
        min: 1
    }
}, {
    timestamps: true
});

const DefaultDeliverySettings = mongoose.model('DefaultDeliverySettings', defaultDeliverySettingsSchema);

module.exports = DefaultDeliverySettings;