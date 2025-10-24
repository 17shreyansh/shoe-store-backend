require("dotenv").config();
const mongoose = require("mongoose");
const Category = require("./models/Category");

const testAddCategory = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Add a new test category
    const newCategory = new Category({
      name: "Sports",
      description: "Sports shoes and equipment"
    });

    await newCategory.save();
    console.log(`Created new category: ${newCategory.name} (slug: ${newCategory.slug})`);

    // Test the menu API response
    console.log("\nTesting menu API...");
    const categories = await Category.find().sort({ level: 1, name: 1 });
    
    console.log(`Total categories: ${categories.length}`);
    categories.forEach((cat, index) => {
      let link = "/category";
      if (cat.ancestors && cat.ancestors.length > 0) {
        // This would need to be populated in real scenario
        console.log(`- ${cat.name} -> ${link}/${cat.slug} (Level: ${cat.level})`);
      } else {
        console.log(`- ${cat.name} -> ${link}/${cat.slug} (Level: ${cat.level})`);
      }
    });

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
};

testAddCategory();