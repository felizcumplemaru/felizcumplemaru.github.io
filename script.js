document.addEventListener('DOMContentLoaded', function() {
    const mapImage = document.querySelector('.map-container img');
    
    if (!mapImage) return;
    
    // Lambert Azimuthal Equal-Area Projection centered at South Pole
    // Calibrate these values by identifying the map center and scale
    const mapConfig = {
        centerPixelX: 366,        // Pixel X coordinate of the projection center (south pole)
        centerPixelY: 2615,       // Pixel Y coordinate of the projection center (south pole)
        scale: 1,                 // Pixels per degree of angular distance from pole
        orientation: 0            // Rotation angle in degrees (0 = north up, adjust if needed)
    };
    
    mapImage.addEventListener('click', function(event) {
        // Get the image's bounding rectangle
        const rect = mapImage.getBoundingClientRect();
        
        // Calculate click position relative to the image
        const pixelX = event.clientX - rect.left;
        const pixelY = event.clientY - rect.top;
        
        // Convert pixel coordinates to geographic coordinates using Lambert Azimuthal Equal-Area projection
        const { longitude, latitude, rho, c } = pixelToCoordinatesLambertAzimuthal(pixelX, pixelY, mapConfig);
        
        if (isNaN(latitude)) {
            console.warn(`NaN result - scale may need calibration. Pixel distance from center: ${rho.toFixed(2)}`);
        }
        
        console.log(`Clicked at pixel (${pixelX.toFixed(0)}, ${pixelY.toFixed(0)}) -> Coordinates: ${latitude.toFixed(2)}°S, ${Math.abs(longitude).toFixed(2)}°W`);
    });
    
    function pixelToCoordinatesLambertAzimuthal(px, py, config) {
        // Lambert Azimuthal Equal-Area Projection (South Pole centered)
        // Translate pixel coordinates relative to projection center
        const dx = px - config.centerPixelX;
        const dy = py - config.centerPixelY;
        
        // Convert to polar coordinates (distance and azimuth)
        const rho = Math.sqrt(dx * dx + dy * dy);
        let azimuth = Math.atan2(dx, -dy) * 180 / Math.PI;  // Azimuth in degrees, 0 = North
        
        // Apply map orientation
        azimuth = (azimuth + config.orientation) % 360;
        if (azimuth < 0) azimuth += 360;
        
        // Lambert Azimuthal Equal-Area inverse formulas (South Pole centered)
        // c is the angular distance from the pole
        const asinArg = rho / (config.scale * 2 * Math.sqrt(2));
        
        // Clamp to [-1, 1] to prevent NaN from asin
        const clampedArg = Math.max(-1, Math.min(1, asinArg));
        const c = 2 * Math.asin(clampedArg) * 180 / Math.PI;
        
        // Calculate latitude (distance from south pole toward equator)
        // South pole is at -90°, and we move north as we move away from center
        const latitude = -90 + c;
        
        // Calculate longitude from azimuth
        // Azimuth 0° = North, 90° = East, 180° = South, 270° = West
        const longitude = azimuth - 180;  // Adjust so 0° is at bottom/north
        
        return { 
            longitude: longitude, 
            latitude: latitude,
            rho: rho,
            c: c
        };
    }
});
