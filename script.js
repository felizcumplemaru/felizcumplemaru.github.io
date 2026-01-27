document.addEventListener('DOMContentLoaded', function() {
    const mapImage = document.querySelector('.map-container img');
    
    if (!mapImage) return;
    
    // Get actual image dimensions
    const actualImageWidth = mapImage.naturalWidth;
    const actualImageHeight = mapImage.naturalHeight;
    
    // Browser-displayed dimensions
    let displayedWidth = mapImage.width;
    let displayedHeight = mapImage.height;
    
    // If dimensions not available initially, get them from first measurement
    if (!displayedWidth) {
        displayedWidth = mapImage.offsetWidth;
        displayedHeight = mapImage.offsetHeight;
    }
    
    // Calculate scale factors
    const scaleX = actualImageWidth / displayedWidth;
    const scaleY = actualImageHeight / displayedHeight;
    
    console.log(`Image dimensions - Actual: ${actualImageWidth}x${actualImageHeight}, Displayed: ${displayedWidth}x${displayedHeight}, Scale: ${scaleX.toFixed(3)}x${scaleY.toFixed(3)}`);
    
    // Lambert Azimuthal Equal-Area Projection centered at South Pole
    // Using browser pixel coordinates (will be converted to actual image pixels)
    const mapConfig = {
        centerPixelX: 366,        // Browser pixel X coordinate of the projection center (south pole)
        centerPixelY: 2615,       // Browser pixel Y coordinate of the projection center (south pole)
        scale: 1,                 // Pixels per degree of angular distance from pole
        orientation: 0            // Rotation angle in degrees (0 = north up, adjust if needed)
    };
    
    mapImage.addEventListener('click', function(event) {
        // Get the image's bounding rectangle
        const rect = mapImage.getBoundingClientRect();
        
        // Calculate click position relative to the image in browser pixels
        const browserPixelX = event.clientX - rect.left;
        const browserPixelY = event.clientY - rect.top;
        
        // Convert to actual image pixel coordinates
        const actualPixelX = browserPixelX * scaleX;
        const actualPixelY = browserPixelY * scaleY;
        
        // Scale the map config center to actual image pixels for conversion
        const scaledMapConfig = {
            centerPixelX: mapConfig.centerPixelX * scaleX,
            centerPixelY: mapConfig.centerPixelY * scaleY,
            scale: mapConfig.scale * ((scaleX + scaleY) / 2),  // Average scale factor
            orientation: mapConfig.orientation
        };
        
        // Convert pixel coordinates to geographic coordinates using Lambert Azimuthal Equal-Area projection
        const { longitude, latitude, rho } = pixelToCoordinatesLambertAzimuthal(actualPixelX, actualPixelY, scaledMapConfig);
        
        if (isNaN(latitude)) {
            console.warn(`NaN result - scale may need calibration. Pixel distance from center: ${rho.toFixed(2)}`);
        }
        
        console.log(`Browser pixel: (${browserPixelX.toFixed(0)}, ${browserPixelY.toFixed(0)}) -> Actual pixel: (${actualPixelX.toFixed(0)}, ${actualPixelY.toFixed(0)}) -> Coordinates: ${latitude.toFixed(2)}°S, ${Math.abs(longitude).toFixed(2)}°W`);
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
        // lat = 2 * arcsin(rho / (2 * scale)) - 90
        const asinArg = rho / (config.scale * 2);
        
        // Clamp to [-1, 1] to prevent NaN from asin
        const clampedArg = Math.max(-1, Math.min(1, asinArg));
        const latitude = 2 * Math.asin(clampedArg) * 180 / Math.PI - 90;
        
        // Calculate longitude from azimuth
        // Azimuth 0° = North, 90° = East, 180° = South, 270° = West
        const longitude = azimuth - 180;  // Adjust so 0° is at bottom/north
        
        return { 
            longitude: longitude, 
            latitude: latitude,
            rho: rho
        };
    }
});
