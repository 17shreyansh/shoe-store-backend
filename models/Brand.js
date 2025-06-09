const mongoose = require("mongoose");
const slugify = require('slugify');

const brandSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    trim: true, 
    unique: true 
  },
  slug: {
    type: String,
    unique: true
  },
  logo: { 
    type: String, 
    default: "" 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
}, { timestamps: true });

// Pre-save middleware to generate slug
brandSchema.pre('save', function(next) {
  if (!this.slug || this.isModified('name')) {
    this.slug = slugify(this.name, {
      lower: true,
      strict: true
    });
  }
  next();
});

module.exports = mongoose.model("Brand", brandSchema);