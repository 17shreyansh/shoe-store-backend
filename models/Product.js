const mongoose = require("mongoose");
const slugify = require("slugify");

// Sub-schema for stock variants (size + color combination)
const stockVariantSchema = new mongoose.Schema({
  size: { type: Number, required: true },
  color: { type: String, required: true, trim: true },
  stock: { type: Number, required: true, min: 0, default: 0 },
  sku: { type: String, unique: true }, // Auto-generated SKU
}, { _id: true });

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, unique: true, lowercase: true },
  description: { type: String, trim: true },
  price: { type: Number, required: true, min: 0 },
  
  // Available sizes and colors (for filtering)
  availableSizes: [{ type: Number, required: true }],
  availableColors: [{ type: String, trim: true }],
  
  // Stock variants - each combination of size and color has its own stock
  stockVariants: [stockVariantSchema],
  
  // Total stock (calculated field)
  totalStock: { type: Number, default: 0 },
  
  mainImage: { type: String, default: "placeholder.jpg" },
  galleryImages: [{ type: String }],
  
  brand: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Brand",
    required: true,
  },
  
  material: { type: String, trim: true },
  gender: {
    type: String,
    enum: ["Men", "Women", "Unisex", "Kids"],
    default: "Unisex",
  },
  
  rating: { type: Number, default: 0, min: 0, max: 5 },
  reviewsCount: { type: Number, default: 0, min: 0 },
    categories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
  }],
  
  isFeatured: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Pre-save hook to generate slug and calculate total stock
productSchema.pre("save", function(next) {
  // Generate slug
  if (this.isModified("name") || this.isNew) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  
  // Generate SKUs for stock variants and calculate total stock
  let totalStock = 0;
  this.stockVariants.forEach((variant, index) => {
    if (!variant.sku) {
      variant.sku = `${this.slug}-${variant.size}-${slugify(variant.color, { lower: true })}`;
    }
    totalStock += variant.stock;
  });
  
  this.totalStock = totalStock;
  next();
});

// Method to get stock for specific size and color
productSchema.methods.getStockForVariant = function(size, color) {
  const variant = this.stockVariants.find(
    v => v.size === size && v.color.toLowerCase() === color.toLowerCase()
  );
  return variant ? variant.stock : 0;
};

// Method to update stock for specific variant
productSchema.methods.updateVariantStock = function(size, color, newStock) {
  const variant = this.stockVariants.find(
    v => v.size === size && v.color.toLowerCase() === color.toLowerCase()
  );
  if (variant) {
    variant.stock = newStock;
    this.totalStock = this.stockVariants.reduce((total, v) => total + v.stock, 0);
    return true;
  }
  return false;
};

module.exports = mongoose.model("Product", productSchema);