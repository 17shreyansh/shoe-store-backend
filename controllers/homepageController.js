const mongoose = require('mongoose');
const { protect, isAdmin } = require("../middleware/authMiddleware"); // Assuming these are correctly defined
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Node.js file system module
const asyncHandler = require('express-async-handler');


// Ensure the uploads directory exists
const uploadDir = path.join(__dirname, '../uploads/homepage');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Save files to the 'uploads/homepage' directory
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Use the original file name with a timestamp to prevent overwrites
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

// Multer file filter to accept only images
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

// Multer upload instance
// 'upload' will be exported and used in the routes
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB file size limit
});


// Banner Schema
const bannerSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        default: "STEP INTO STYLE. WALK WITH CONFIDENCE."
    },
    subtitle: {
        type: String,
        required: true,
        default: "Discover premium shoes that blend comfort, craftsmanship, and cutting-edge design — for every step you take."
    },
    image: {
        type: String,
        required: true,
        default: "/assets/b1.png" // Default image path
    },
    exploreText: {
        type: String,
        default: "EXPLORE NEW ARRIVALS"
    }
}, { timestamps: true });

// Shipping Guarantee Banner Schema
const shippingBannerSchema = new mongoose.Schema({
    guarantees: [{
        text: {
            type: String,
            required: true
        }
    }],
    image: {
        type: String,
        required: true,
        default: "/assets/b4.png" // Default image path
    },
    backgroundColor: {
        type: String,
        default: "#1C4352"
    },
    textColor: {
        type: String,
        default: "#F0D8B6"
    }
}, { timestamps: true });

// Image Grid Schema
const imageGridSchema = new mongoose.Schema({
    images: [{
        url: {
            type: String,
            required: true
        },
        alt: {
            type: String,
            required: true
        }
    }],
    backgroundColor: {
        type: String,
        default: "#E2BF9B"
    }
}, { timestamps: true });

// Promo Banner Schema
const promoBannerSchema = new mongoose.Schema({
  title: {
    type: [String], // Array of title lines
    required: true,
    validate: {
      validator: function(arr) {
        return arr.length > 0 && arr.length <= 6; // Allow 1-6 title lines
      },
      message: 'Title must contain between 1 and 6 lines'
    }
  },
  image: {
    type: String, // URL or path to the image
    required: false,
    default: null
  }
}, {
  timestamps: true
});

// Ensure only one promo banner exists (singleton pattern)
promoBannerSchema.statics.getInstance = async function() {
  let banner = await this.findOne();
  if (!banner) {
    // Create default banner if none exists
    banner = await this.create({
      title: ['Free Shipping', 'Easy Returns', '100% Comfort', 'Guarantee']
    });
  }
  return banner;
};


// Footer Offer Schema
const footerOfferSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        default: "FOOT WEAR COLLECTION"
    },
    discount: {
        type: String,
        required: true,
        default: "30% OFF"
    },
    buttonText: {
        type: String,
        default: "SHOP NOW"
    },
    backgroundColor: {
        type: String,
        default: "#F3E2CD"
    }
}, { timestamps: true });

// Create Models
const Banner = mongoose.model('Banner', bannerSchema);
const ShippingBanner = mongoose.model('ShippingBanner', shippingBannerSchema);
const ImageGrid = mongoose.model('ImageGrid', imageGridSchema);
const PromoBanner = mongoose.model('PromoBanner', promoBannerSchema);
const FooterOffer = mongoose.model('FooterOffer', footerOfferSchema);

// Controllers

// Banner Controllers
const getBanner = async (req, res) => {
    try {
        let banner = await Banner.findOne();
        if (!banner) {
            banner = new Banner({});
            await banner.save();
        }
        res.json({ success: true, data: banner });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateBanner = async (req, res) => {
    try {
        let banner = await Banner.findOne();
        if (!banner) {
            banner = new Banner(req.body);
        } else {
            // If a new file is uploaded, update the image path
            if (req.file) {
                // Delete old image if it's not a default one
                if (banner.image && !banner.image.startsWith('/assets/')) {
                    const oldImagePath = path.join(__dirname, '..', banner.image);
                    if (fs.existsSync(oldImagePath)) {
                        fs.unlinkSync(oldImagePath);
                    }
                }
                // Store the relative path from the project root (e.g., /uploads/homepage/filename.jpg)
                banner.image = `/uploads/homepage/${req.file.filename}`;
            }
            Object.assign(banner, req.body); // Update other fields from body
        }
        await banner.save();
        res.json({ success: true, data: banner, message: 'Banner updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Shipping Banner Controllers
const getShippingBanner = async (req, res) => {
    try {
        let shippingBanner = await ShippingBanner.findOne();
        if (!shippingBanner) {
            shippingBanner = new ShippingBanner({
                guarantees: [
                    { text: "Free Shipping" },
                    { text: "Easy Returns" },
                    { text: "100% Comfort Guarantee" }
                ]
            });
            await shippingBanner.save();
        }
        res.json({ success: true, data: shippingBanner });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


const updateShippingBanner = async (req, res) => {
    try {
        let shippingBanner = await ShippingBanner.findOne();

        if (!shippingBanner) {
            // If no existing shipping banner is found, create a new one.
            // Ensure that 'guarantees' is parsed for initial creation as well.
            const dataToSave = { ...req.body };
            if (dataToSave.guarantees && typeof dataToSave.guarantees === 'string') {
                try {
                    dataToSave.guarantees = JSON.parse(dataToSave.guarantees);
                } catch (parseError) {
                    console.error("Error parsing guarantees for new shipping banner:", parseError);
                    return res.status(400).json({ success: false, message: "Invalid 'guarantees' format." });
                }
            }
            shippingBanner = new ShippingBanner(dataToSave);
        } else {
            // Handle image update if a new file is provided in the request
            if (req.file) {
                // Check if there's an old image and if it's not a default asset
                if (shippingBanner.image && !shippingBanner.image.startsWith('/assets/')) {
                    // Construct the absolute path to the old image file
                    const oldImagePath = path.join(__dirname, '..', shippingBanner.image);
                    // Check if the file actually exists before attempting to delete
                    if (fs.existsSync(oldImagePath)) {
                        // Asynchronously delete the old image file
                        fs.unlink(oldImagePath, (err) => {
                            if (err) {
                                console.error(`Failed to delete old shipping banner image: ${oldImagePath}`, err);
                            } else {
                                console.log(`Successfully deleted old shipping banner image: ${oldImagePath}`);
                            }
                        });
                    }
                }
                // Update the image path to the newly uploaded file
                shippingBanner.image = `/uploads/homepage/${req.file.filename}`;
            }

            // Handle 'guarantees' array: Parse if it's a string from FormData
            if (req.body.guarantees && typeof req.body.guarantees === 'string') {
                try {
                    shippingBanner.guarantees = JSON.parse(req.body.guarantees);
                } catch (parseError) {
                    console.error("Error parsing guarantees in update:", parseError);
                    // Respond with a 400 Bad Request if the JSON is malformed
                    return res.status(400).json({ success: false, message: "Invalid 'guarantees' data format." });
                }
            } else if (req.body.guarantees) {
                // If it's already an array (e.g., from a non-file-upload request, or if frontend sends it parsed)
                shippingBanner.guarantees = req.body.guarantees;
            }

            // Update other fields from the request body.
            // Exclude 'guarantees' as it's handled separately to ensure correct parsing.
            // Also exclude 'image' if req.file exists, as it's handled above.
            const { guarantees, image, ...otherBodyFields } = req.body;
            Object.assign(shippingBanner, otherBodyFields);
        }

        // Save the updated shipping banner to the database
        await shippingBanner.save();

        // Send a success response with the updated data
        res.json({ success: true, data: shippingBanner, message: 'Shipping banner updated successfully' });

    } catch (error) {
        // Log the actual error to your console for debugging purposes
        console.error("Error updating shipping banner:", error);
        // Send a 500 Internal Server Error response
        res.status(500).json({ success: false, message: "Failed to update shipping banner. " + error.message });
    }
};


// Image Grid Controllers

// Assuming 'ImageGrid' is your Mongoose model
// const ImageGrid = require('../models/ImageGridModel'); // Example import

const getImageGrid = async (req, res) => {
    try {
        let imageGrid = await ImageGrid.findOne();
        if (!imageGrid) {
            imageGrid = new ImageGrid({
                images: [
                    { url: "/assets/sample.jpeg", alt: "image1" },
                    { url: "/assets/sample.jpeg", alt: "image2" },
                    { url: "/assets/sample.jpeg", alt: "image3" },
                    { url: "/assets/sample.jpeg", alt: "image4" }
                ]
            });
            await imageGrid.save();
        }
        res.json({ success: true, data: imageGrid });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateImageGrid = async (req, res) => {
    try {
        let imageGrid = await ImageGrid.findOne();
        let oldImageUrls = []; // To store URLs of images currently in the DB before update

        if (!imageGrid) {
            // If no existing image grid, create a new one.
            // For initial creation, ensure req.body.images contains proper URLs
            // (which would come from req.files if new images are uploaded during creation).
            // If no files are uploaded on creation, and req.body.images has UIDs,
            // it will still save UIDs. This scenario should ideally be handled by frontend validation
            // requiring initial images or by providing default images on backend.
            imageGrid = new ImageGrid(req.body);
        } else {
            // Store old image URLs before any modifications for comparison and deletion later
            if (imageGrid.images && imageGrid.images.length > 0) {
                oldImageUrls = imageGrid.images.map(img => img.url);
            }

            const newImagesData = []; // This will be the final array of images to save
            const incomingImagesFromFrontend = Array.isArray(req.body.images) ? req.body.images : [];
            const uploadedFiles = req.files || []; // Multer files, if any

            // Iterate through the images data sent from the frontend
            incomingImagesFromFrontend.forEach((item, index) => {
                let imageUrlToSave = '';
                const altText = item.alt || `image${index + 1}`; // Use alt text from frontend or default

                // Check if a new file was uploaded for this specific image slot (by index)
                if (uploadedFiles[index]) {
                    // If a new file is uploaded, use its server path
                    imageUrlToSave = `/uploads/homepage/${uploadedFiles[index].filename}`;
                } else {
                    // If no new file is uploaded for this slot, it must be an existing image.
                    // Find its original URL from the database's current imageGrid.images data.
                    // We rely on the frontend sending the correct 'url' for existing images,
                    // which was fixed by the frontend update (using img.url as uid).
                    // However, to be absolutely safe, we can also check if the URL from frontend is a UID.
                    if (item.url && !item.url.startsWith('rc-upload-')) {
                        imageUrlToSave = item.url; // It's an existing server URL, use it
                    } else {
                        // This case means:
                        // 1. No new file uploaded for this slot.
                        // 2. The URL from the frontend is an 'rc-upload-' UID (meaning it was a new file
                        //    in a previous session that wasn't properly synced).
                        // In this scenario, we cannot determine the actual server URL.
                        // This indicates a potential frontend state issue or a missing re-upload.
                        // For now, we'll log a warning and skip adding this image, or use a default.
                        console.warn(`Skipping image at index ${index} as no new file was uploaded and existing URL is a client-side UID: ${item.url}`);
                        // You might want to add a default placeholder image here if desired
                        // imageUrlToSave = "/assets/placeholder.png";
                        return; // Skip this image if its URL is invalid and no new file is provided
                    }
                }
                
                // Add the image with the determined URL and alt text to the new list
                if (imageUrlToSave) { // Only add if a valid URL was determined
                    newImagesData.push({
                        url: imageUrlToSave,
                        alt: altText
                    });
                }
            });

            // Update the imageGrid.images with the newly constructed array
            imageGrid.images = newImagesData;

            // Handle deletion of old files that are no longer in the new image list
            const currentImageUrls = imageGrid.images.map(img => img.url);
            oldImageUrls.forEach(oldUrl => {
                // If the old URL is not a default asset and is no longer in the current list of images
                if (!oldUrl.startsWith('/assets/') && !currentImageUrls.includes(oldUrl)) {
                    const oldImagePath = path.join(__dirname, '..', oldUrl);
                    if (fs.existsSync(oldImagePath)) {
                        fs.unlink(oldImagePath, (err) => { // Use fs.unlink (async)
                            if (err) console.error(`Error deleting old file: ${oldImagePath}`, err);
                            else console.log(`Deleted old file: ${oldImagePath}`);
                        });
                    }
                }
            });

            // Update other fields like backgroundColor from req.body, but exclude 'images'
            const { images, ...otherBodyFields } = req.body;
            Object.assign(imageGrid, otherBodyFields);
        }

        await imageGrid.save();
        res.json({ success: true, data: imageGrid, message: 'Image grid updated successfully' });
    } catch (error) {
        console.error("Error updating image grid:", error);
        res.status(500).json({ success: false, message: "Failed to update image grid. " + error.message });
    }
};

// Promo Banner Controllers
const getPromoBanner = asyncHandler(async (req, res) => {
  const banner = await PromoBanner.getInstance();
  
  res.json({
    success: true,
    data: banner
  });
});

// @desc    Update promo banner
// @route   PUT /api/promo-banner
// @access  Private/Admin
const updatePromoBanner = asyncHandler(async (req, res) => {
  console.log('Request body:', req.body);
  console.log('Request file:', req.file);
  
  // Handle title array - it comes as req.body.title when sent as title[]
  let titleArray = [];
  
  if (req.body.title) {
    // If title is sent as an array, use it directly
    if (Array.isArray(req.body.title)) {
      titleArray = req.body.title;
    }
    // If title is sent as a single string, wrap it in an array
    else if (typeof req.body.title === 'string') {
      titleArray = [req.body.title];
    }
  }
  
  // Validation
  if (!titleArray || titleArray.length === 0) {
    res.status(400);
    throw new Error('Title array is required and cannot be empty');
  }

  if (titleArray.length > 6) {
    res.status(400);
    throw new Error('Title cannot have more than 6 lines');
  }
  
  // Filter out empty titles
  titleArray = titleArray.filter(title => title && title.trim() !== '');
  
  if (titleArray.length === 0) {
    res.status(400);
    throw new Error('At least one non-empty title is required');
  }

  let banner = await PromoBanner.findOne();
  
  // Handle image
  let imageUrl = null;
  if (req.file) {
    // New file uploaded
    imageUrl = `/uploads/homepage/${req.file.filename}`;
  } else if (req.body.image && typeof req.body.image === 'string') {
    // Existing image URL passed
    imageUrl = req.body.image;
  } else if (banner && banner.image) {
    // Keep existing image if no new one provided
    imageUrl = banner.image;
  }
  
  if (!banner) {
    // Create new banner if none exists
    banner = await PromoBanner.create({
      title: titleArray,
      image: imageUrl
    });
  } else {
    // Update existing banner
    banner.title = titleArray;
    banner.image = imageUrl;
    await banner.save();
  }

  res.json({
    success: true,
    data: banner,
    message: 'Promo banner updated successfully'
  });
});

// Footer Offer Controllers
const getFooterOffer = async (req, res) => {
    try {
        let footerOffer = await FooterOffer.findOne();
        if (!footerOffer) {
            footerOffer = new FooterOffer({});
            await footerOffer.save();
        }
        res.json({ success: true, data: footerOffer });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateFooterOffer = async (req, res) => {
    try {
        let footerOffer = await FooterOffer.findOne();
        if (!footerOffer) {
            footerOffer = new FooterOffer(req.body);
        } else {
            Object.assign(footerOffer, req.body);
        }
        await footerOffer.save();
        res.json({ success: true, data: footerOffer, message: 'Footer offer updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    // Controllers
    getBanner,
    updateBanner,
    getShippingBanner,
    updateShippingBanner,
    getImageGrid,
    updateImageGrid,
    getPromoBanner,
    updatePromoBanner,
    getFooterOffer,
    updateFooterOffer,

    // Models
    Banner,
    ShippingBanner,
    ImageGrid,
    PromoBanner,
    FooterOffer,

    // Multer upload instance
    upload // Export the upload instance to be used in routes
};
