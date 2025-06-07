const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    enum: ['PAYMENT', 'DELIVERY', 'GENERAL', 'NOTIFICATIONS'],
    default: 'GENERAL'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
settingsSchema.index({ category: 1 });

// Static method to get setting value
settingsSchema.statics.getValue = async function(key, defaultValue = null) {
  try {
    const setting = await this.findOne({ key: key.toUpperCase(), isActive: true });
    return setting ? setting.value : defaultValue;
  } catch (error) {
    console.error(`Error fetching setting ${key}:`, error);
    return defaultValue;
  }
};

// Static method to set setting value
settingsSchema.statics.setValue = async function(key, value, description = '') {
  try {
    return await this.findOneAndUpdate(
      { key: key.toUpperCase() },
      { 
        key: key.toUpperCase(), 
        value, 
        description,
        updatedAt: new Date()
      },
      { 
        upsert: true, 
        new: true,
        runValidators: true
      }
    );
  } catch (error) {
    console.error(`Error setting ${key}:`, error);
    throw error;
  }
};

// Static method to get all settings by category
settingsSchema.statics.getByCategory = async function(category) {
  try {
    return await this.find({ 
      category: category.toUpperCase(), 
      isActive: true 
    }).select('-__v');
  } catch (error) {
    console.error(`Error fetching settings for category ${category}:`, error);
    return [];
  }
};

// Virtual for formatted key display
settingsSchema.virtual('displayKey').get(function() {
  return this.key.replace(/_/g, ' ').toLowerCase()
    .replace(/\b\w/g, l => l.toUpperCase());
});

// Ensure virtuals are included in JSON output
settingsSchema.set('toJSON', { virtuals: true });
settingsSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Settings', settingsSchema);