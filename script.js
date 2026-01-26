document.addEventListener('DOMContentLoaded', function() {
    const mapImage = document.querySelector('.map-container img');
    
    if (!mapImage) return;
    
    // Define reference points: pixel coordinates mapped to geographic coordinates
    // These are calibrated based on the visible map markings (60°W, 70°W, 30°S, 40°S, 50°S)
    const referencePoints = [
        // Format: { pixelX, pixelY, longitude, latitude }
        // These values should be calibrated based on your specific map image
        { pixelX: 50, pixelY: 30, longitude: -73.5, latitude: -23 },      // Top-left area
        { pixelX: 350, pixelY: 30, longitude: -54, latitude: -23 },       // Top-right area
        { pixelX: 50, pixelY: 350, longitude: -73.5, latitude: -56 },     // Bottom-left area
        { pixelX: 350, pixelY: 350, longitude: -54, latitude: -56 }       // Bottom-right area
    ];
    
    mapImage.addEventListener('click', function(event) {
        // Get the image's bounding rectangle
        const rect = mapImage.getBoundingClientRect();
        
        // Calculate click position relative to the image
        const pixelX = event.clientX - rect.left;
        const pixelY = event.clientY - rect.top;
        
        // Convert pixel coordinates to geographic coordinates using bilinear interpolation
        const { longitude, latitude } = pixelToCoordinates(pixelX, pixelY, referencePoints);
        
        console.log(`Clicked at pixel (${pixelX.toFixed(0)}, ${pixelY.toFixed(0)}) -> Coordinates: ${latitude.toFixed(2)}°S, ${longitude.toFixed(2)}°W`);
    });
    
    function pixelToCoordinates(px, py, refPoints) {
        // Simple bilinear interpolation
        const topLeft = refPoints[0];
        const topRight = refPoints[1];
        const bottomLeft = refPoints[2];
        const bottomRight = refPoints[3];
        
        const imgWidth = topRight.pixelX - topLeft.pixelX;
        const imgHeight = bottomLeft.pixelY - topLeft.pixelY;
        
        const t = (px - topLeft.pixelX) / imgWidth;
        const s = (py - topLeft.pixelY) / imgHeight;
        
        // Clamp values between 0 and 1
        const t_clamped = Math.max(0, Math.min(1, t));
        const s_clamped = Math.max(0, Math.min(1, s));
        
        // Bilinear interpolation
        const longitude = 
            topLeft.longitude * (1 - t_clamped) * (1 - s_clamped) +
            topRight.longitude * t_clamped * (1 - s_clamped) +
            bottomLeft.longitude * (1 - t_clamped) * s_clamped +
            bottomRight.longitude * t_clamped * s_clamped;
        
        const latitude = 
            topLeft.latitude * (1 - t_clamped) * (1 - s_clamped) +
            topRight.latitude * t_clamped * (1 - s_clamped) +
            bottomLeft.latitude * (1 - t_clamped) * s_clamped +
            bottomRight.latitude * t_clamped * s_clamped;
        
        return { longitude: Math.abs(longitude), latitude: Math.abs(latitude) };
    }
});
