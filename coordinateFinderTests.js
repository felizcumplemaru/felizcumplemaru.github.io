// Inverse projection: convert coordinates to actual image pixel coordinates
function coordinatesToPixelLambertAzimuthal(latitude, longitude, config) {
    // Special case: south pole
    if (latitude === -90) {
        return {
            actualPixelX: config.centerPixelX,
            actualPixelY: config.centerPixelY
        };
    }
    
    // Calculate angular distance from south pole
    const angularDist = Math.abs(latitude + 90);  // Should always be positive
    
    // Determine appropriate scale based on angular distance
    let scale = config.scale;
    if (config.regionalScales) {
        const scales = config.regionalScales;
        if (angularDist <= 40) scale = scales.near || config.scale;
        else if (angularDist <= 50) scale = scales.mid || config.scale;
        else if (angularDist <= 60) scale = scales.far || config.scale;
        else scale = scales.vfar || config.scale;
    }
    
    // Calculate rho (distance from center in pixels) using the selected scale
    const angularDistRad = angularDist * Math.PI / 180;
    const rho = scale * 2 * Math.sin(angularDistRad / 2);
    
    // Calculate azimuth from longitude
    let lonDiff = longitude - config.centerLongitude;
    
    // Normalize to -180 to 180
    while (lonDiff > 180) lonDiff -= 360;
    while (lonDiff < -180) lonDiff += 360;
    
    // Apply inverse of longitude correction
    // Forward: longitude = centerLon ± (westComponent * correctionFactor)
    // Inverse: lonDiff / correctionFactor to get azimuth component
    const correctionFactor = config.longitudeCorrectionFactor || 1.43;
    const azimuthComponent = Math.abs(lonDiff) / correctionFactor;
    
    // Determine azimuth from longitude difference
    let azimuth;
    if (lonDiff > 0) {
        azimuth = azimuthComponent;
    } else {
        azimuth = 360 - azimuthComponent;
    }
    
    // Apply map orientation
    azimuth = (azimuth - config.orientation) % 360;
    if (azimuth < 0) azimuth += 360;
    
    // Convert azimuth and rho to cartesian coordinates
    const azimuthRad = azimuth * Math.PI / 180;
    const dx = rho * Math.sin(azimuthRad);
    const dy = -rho * Math.cos(azimuthRad);
    
    // Convert to actual image pixel coordinates
    const actualPixelX = config.centerPixelX + dx;
    const actualPixelY = config.centerPixelY + dy;
    
    return {
        actualPixelX: actualPixelX,
        actualPixelY: actualPixelY,
        rho: rho,
        azimuth: azimuth
    };
}

// Convert actual image pixels to browser pixels
function actualPixelToBrowserPixel(actualPixelX, actualPixelY, scaleX, scaleY) {
    return {
        browserPixelX: actualPixelX / scaleX,
        browserPixelY: actualPixelY / scaleY
    };
}

function pixelToCoordinatesLambertAzimuthal(px, py, config) {
    // Lambert Azimuthal Equal-Area Projection (South Pole centered)
    // Translate pixel coordinates relative to projection center
    const dx = px - config.centerPixelX;
    const dy = py - config.centerPixelY;
    
    // Convert to polar coordinates (distance and azimuth)
    const rho = Math.sqrt(dx * dx + dy * dy);
    
    // Special case: at the center (south pole), azimuth is undefined
    // Return the center coordinates
    if (rho < 0.1) {
        return {
            longitude: config.centerLongitude,
            latitude: -90,
            rho: rho
        };
    }
    
    // Use latitude-based sectioning for regional scale variation
    // Different latitude zones have different scale requirements
    let scale = config.scale;
    if (config.regionalScales) {
        const scales = config.regionalScales;
        // Group by distance from center (which roughly correlates with latitude)
        if (rho < 1800) scale = scales.near || config.scale;         // Near pole (-50°S to -90°S)
        else if (rho < 2200) scale = scales.mid || config.scale;     // Mid (-40°S to -50°S)
        else if (rho < 2500) scale = scales.far || config.scale;     // Far (-30°S to -40°S)
        else scale = scales.vfar || config.scale;                     // Very far (-23°S and north)
    }
    
    // For Lambert Azimuthal Equal-Area: azimuth = atan2(dE, dN)
    let azimuth = Math.atan2(dx, -dy) * 180 / Math.PI;  // Azimuth in degrees from north
    
    // Apply map orientation
    azimuth = (azimuth + config.orientation) % 360;
    if (azimuth < 0) azimuth += 360;
    
    // Lambert Azimuthal Equal-Area inverse formulas (South Pole centered)
    const asinArg = rho / (scale * 2);
    
    // Clamp to [-1, 1] to prevent NaN from asin
    const clampedArg = Math.max(-1, Math.min(1, asinArg));
    const latitude = 2 * Math.asin(clampedArg) * 180 / Math.PI - 90;
    
    // Calculate longitude from azimuth
    // Note: azimuth alone underestimates eastward/westward displacement due to projection
    // Apply a correction factor that increases with angle from the center meridian
    let azimuthFromCenter = Math.abs(azimuth - 360); // Distance from due north (0°/360°)
    if (azimuthFromCenter > 180) azimuthFromCenter = 360 - azimuthFromCenter;
    
    // Correction factor: scales azimuth displacement to match actual longitude
    const correctionFactor = config.longitudeCorrectionFactor || 1.43;
    
    let longitude = config.centerLongitude + azimuthFromCenter * Math.sign(azimuth - 180) * correctionFactor;
    
    // Simpler approach: just apply correction to westward/eastward component
    const westComponent = azimuth > 180 ? (360 - azimuth) : 0;
    const eastComponent = azimuth < 180 && azimuth > 0 ? azimuth : 0;
    
    longitude = config.centerLongitude - (westComponent * correctionFactor) + (eastComponent * correctionFactor);
    
    // Normalize to -180 to 180 range
    while (longitude > 180) longitude -= 360;
    while (longitude < -180) longitude += 360;
    
    return { 
        longitude: longitude, 
        latitude: latitude,
        rho: rho,
        azimuth: azimuth
    };
}

let coordinatesTests = [
    { pixel: {x: 366, y: 2615}, expected: {lat: -90, lon: 0} },
    { pixel: {x: 365, y: 906}, expected: {lat: -50, lon: 60} },
    { pixel: {x: 158, y: 919}, expected: {lat: -50, lon: 70} },
    { pixel: {x: 365, y: 585}, expected: {lat: -40, lon: 60} },
    { pixel: {x: 118, y: 599}, expected: {lat: -40, lon: 70} },
    { pixel: {x: 365, y: 264}, expected: {lat: -30, lon: 60} },
    { pixel: {x: 85, y: 280}, expected: {lat: -30, lon: 70} },
    { pixel: {x: 365, y: 54}, expected: {lat: -23.43, lon: 60} },
    { pixel: {x: 67, y: 70}, expected: {lat: -23.43, lon: 70} },
]


const mapConfig = {
    centerPixelX: 366,
    centerPixelY: 2615,
    centerLongitude: -60,
    scale: 2400,
    longitudeCorrectionFactor: 1.43,
    regionalScales: {
        near: 2498,
        mid: 2402,
        far: 2351,
        vfar: 2333
    },
    orientation: 0
};

// for (let test of coordinatesTests) {
//     const { longitude, latitude, rho, azimuth} = pixelToCoordinatesLambertAzimuthal(test.pixel.x, test.pixel.y, mapConfig);
//     const latDiff = Math.abs(latitude - test.expected.lat);
//     const lonDiff = Math.abs(longitude + test.expected.lon);  // Note: expecting negative (west), so add to expected
//     // cummulativeError += latDiff;
//     // Calculate what scale SHOULD be for this point
//     // Angular distance from south pole: abs(lat - (-90))
//     const expectedAngularDist = Math.abs(test.expected.lat - (-90)); // Should be positive
//     const shouldBeScale = rho / (2 * Math.sin(expectedAngularDist * Math.PI / 180 / 2));
    
//     console.log(`Test Pixel (${test.pixel.x}, ${test.pixel.y}): Expected (${test.expected.lat}°S, ${test.expected.lon}°W), Got (${latitude.toFixed(2)}°S, ${longitude.toFixed(2)}°W) -> Lat Diff: ${latDiff.toFixed(2)}, Lon Diff: ${lonDiff.toFixed(2)}`);
//     console.log(`  rho=${rho.toFixed(2)}, azimuth=${azimuth?.toFixed(2) || 'N/A'}°, expectedDist=${expectedAngularDist}°, calculatedScale=${shouldBeScale.toFixed(0)}`);
// }

for (let test of coordinatesTests) {
    const pixelCoords = coordinatesToPixelLambertAzimuthal(test.expected.lat, -test.expected.lon, mapConfig);
    const xDiff = Math.abs(pixelCoords.actualPixelX - test.pixel.x);
    const yDiff = Math.abs(pixelCoords.actualPixelY - test.pixel.y);
    
    console.log(`Inverse Test Coord (${test.expected.lat}°S, ${test.expected.lon}°W): Expected Pixel (${test.pixel.x}, ${test.pixel.y}), Got Pixel (${pixelCoords.actualPixelX.toFixed(2)}, ${pixelCoords.actualPixelY.toFixed(2)}) -> X Diff: ${xDiff.toFixed(2)}, Y Diff: ${yDiff.toFixed(2)}`);
}