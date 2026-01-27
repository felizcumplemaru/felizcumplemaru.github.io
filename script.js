document.addEventListener('DOMContentLoaded', function() {
    const mapImage = document.querySelector('.map-container img');
    
    if (!mapImage) return;
    
    // Wait for image to load to get dimensions
    if (mapImage.complete) {
        // Image already loaded (cached)
        initializeMap();
    } else {
        // Wait for image load
        mapImage.addEventListener('load', initializeMap);
        mapImage.addEventListener('error', function() {
            console.error('Failed to load map image');
        });
    }
    
    function initializeMap() {
        // Get actual image dimensions
        let actualImageWidth = mapImage.naturalWidth;
        let actualImageHeight = mapImage.naturalHeight;
        
        // Fallback if naturalWidth is not available
        if (!actualImageWidth || !actualImageHeight) {
            console.warn('naturalWidth/naturalHeight not available, using offsetWidth/offsetHeight');
            actualImageWidth = mapImage.offsetWidth;
            actualImageHeight = mapImage.offsetHeight;
        }
        
        // Browser-displayed dimensions
        const displayedWidth = mapImage.offsetWidth;
        const displayedHeight = mapImage.offsetHeight;
        
        // Calculate scale factors
        const scaleX = actualImageWidth / displayedWidth;
        const scaleY = actualImageHeight / displayedHeight;
        
        console.log(`Image loaded - Actual: ${actualImageWidth}x${actualImageHeight}, Displayed: ${displayedWidth}x${displayedHeight}, Scale: ${scaleX.toFixed(3)}x${scaleY.toFixed(3)}`);
        
        // Lambert Azimuthal Equal-Area Projection centered at South Pole
        // Using actual image pixel coordinates (366, 2615 is the south pole position)
        const mapConfig = {
            centerPixelX: 366,        // Actual image pixel X coordinate of the projection center (south pole)
            centerPixelY: 2615,       // Actual image pixel Y coordinate of the projection center (south pole)
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
            
            // Convert pixel coordinates to geographic coordinates
            const { longitude, latitude, rho } = pixelToCoordinatesLambertAzimuthal(actualPixelX, actualPixelY, mapConfig);
            
            if (isNaN(latitude)) {
                console.warn(`NaN result - scale may need calibration. Pixel distance from center: ${rho.toFixed(2)}`);
            }
            
            console.log(`Browser pixel: (${browserPixelX.toFixed(0)}, ${browserPixelY.toFixed(0)}) -> Actual pixel: (${actualPixelX.toFixed(0)}, ${actualPixelY.toFixed(0)}) -> Coordinates: ${latitude.toFixed(2)}°S, ${Math.abs(longitude).toFixed(2)}°W`);
        });
        
        function pixelToCoordinatesLambertAzimuthal(px, py, config) {
            // Lambert Azimuthal Equal-Area Projection (South Pole centered)
            const dx = px - config.centerPixelX;
            const dy = py - config.centerPixelY;
            
            // Convert to polar coordinates (distance and azimuth)
            const rho = Math.sqrt(dx * dx + dy * dy);
            let azimuth = Math.atan2(dx, -dy) * 180 / Math.PI;  // Azimuth in degrees, 0 = North
            
            // Apply map orientation
            azimuth = (azimuth + config.orientation) % 360;
            if (azimuth < 0) azimuth += 360;
            
            // Lambert Azimuthal Equal-Area inverse formulas (South Pole centered)
            const asinArg = rho / (config.scale * 2);
            
            // Clamp to [-1, 1] to prevent NaN from asin
            const clampedArg = Math.max(-1, Math.min(1, asinArg));
            const latitude = 2 * Math.asin(clampedArg) * 180 / Math.PI - 90;
            
            // Calculate longitude from azimuth
            const longitude = azimuth - 180;
            
            return { 
                longitude: longitude, 
                latitude: latitude,
                rho: rho
            };
        }
    }
});
