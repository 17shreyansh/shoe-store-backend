// utils/deliveryCharges.js
// This is a simplified, in-memory store for delivery settings.
// In a production environment, this would be persisted in a database (e.g., a 'Settings' collection).

const deliverySettings = {
  cityCharges: {
    'mumbai': 70,
    'delhi': 60,
    'bangalore': 80,
    'noida': 50, // Added Noida as per the current location
  },
  distanceBased: true, // If true, applies chargePerKm
};

const getCityDeliveryCharge = (city, distanceKm = 0) => {
  const lowerCaseCity = city.toLowerCase();
  let charge = 0;

  if (deliverySettings.distanceBased) {
    const chargePerKm = parseFloat(process.env.DUMMY_DELIVERY_CHARGE_PER_KM || 0);
    charge = chargePerKm * distanceKm;
  } else if (deliverySettings.cityCharges[lowerCaseCity]) {
    charge = deliverySettings.cityCharges[lowerCaseCity];
  } else {
    // Default charge if city not found or not distance-based
    charge = 50; // A default base charge
  }
  return charge;
};

module.exports = {
  deliverySettings,
  getCityDeliveryCharge
};