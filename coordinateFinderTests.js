// Inverse projection: convert coordinates to actual image pixel coordinates
function coordinatesToPixelLambertAzimuthal(latitude, longitude, config) {
    // Special case: south pole
    if (latitude === -90) {
        return {
            actualPixelX: config.centerPixelX,
            actualPixelY: config.centerPixelY
        };
    }
    
    // Calculate angular distance from south pole (degrees)
    const angularDist = Math.abs(latitude + 90);
    
    // Determine appropriate scale based on angular distance (allow regional overrides)
    let scale = config.scale;
    if (config.regionalScales) {
        const scales = config.regionalScales;
        if (angularDist <= 40) scale = scales.near || config.scale;
        else if (angularDist <= 50) scale = scales.mid || config.scale;
        else if (angularDist <= 60) scale = scales.far || config.scale;
        else scale = scales.vfar || config.scale;
    }

    // Convert angular distance to radians and compute rho using spherical Lambert Azimuthal equal-area
    const angularDistRad = angularDist * Math.PI / 180;
    const rho = scale * 2 * Math.sin(angularDistRad / 2);

    // Compute longitude difference and normalize to [-180,180]
    let lonDiff = longitude - config.centerLongitude;
    while (lonDiff > 180) lonDiff -= 360;
    while (lonDiff < -180) lonDiff += 360;

    // Apply inverse of longitude correction used in the inverse transform (if any)
    const correctionFactor = config.longitudeCorrectionFactor || 1.43;
    const azimuthComponent = Math.abs(lonDiff) / correctionFactor;

    // Determine azimuth (degrees clockwise from north)
    let azimuth;
    if (lonDiff > 0) {
        azimuth = azimuthComponent;
    } else {
        azimuth = 360 - azimuthComponent;
    }

    // Apply map orientation offset
    azimuth = (azimuth - (config.orientation || 0)) % 360;
    if (azimuth < 0) azimuth += 360;

    // Convert azimuth and rho to cartesian (image) coordinates
    const azimuthRad = azimuth * Math.PI / 180;
    const dx = rho * Math.sin(azimuthRad);
    const dy = -rho * Math.cos(azimuthRad);

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
    // Translate pixel coordinates relative to projection center
    const dx = px - config.centerPixelX;
    const dy = py - config.centerPixelY;

    // Distance from center in pixels
    const rho = Math.sqrt(dx * dx + dy * dy);

    // Special-case: near center -> south pole
    if (rho < 0.1) {
        return {
            longitude: config.centerLongitude,
            latitude: -90,
            rho: rho
        };
    }

    // Choose scale regionally if available (heuristic thresholds chosen to match map)
    let scale = config.scale;
    if (config.regionalScales) {
        const scales = config.regionalScales;
        if (rho < 1800) scale = scales.near || config.scale;
        else if (rho < 2200) scale = scales.mid || config.scale;
        else if (rho < 2500) scale = scales.far || config.scale;
        else scale = scales.vfar || config.scale;
    }

    // Azimuth: atan2(dx, -dy) gives degrees clockwise from north
    let azimuth = Math.atan2(dx, -dy) * 180 / Math.PI;
    azimuth = (azimuth + (config.orientation || 0)) % 360;
    if (azimuth < 0) azimuth += 360;

    // Inverse Lambert Azimuthal Equal-Area (south-pole-centered)
    const asinArg = rho / (scale * 2);
    const clampedArg = Math.max(-1, Math.min(1, asinArg));
    const latitude = 2 * Math.asin(clampedArg) * 180 / Math.PI - 90;

    // Compute longitude applying the correction factor used in forward transform
    const correctionFactor = config.longitudeCorrectionFactor || 1.43;

    // Convert azimuth into east/west components and apply correction
    const westComponent = azimuth > 180 ? (360 - azimuth) : 0;
    const eastComponent = (azimuth <= 180) ? azimuth : 0;

    let longitude = config.centerLongitude - (westComponent * correctionFactor) + (eastComponent * correctionFactor);

    // Normalize longitude to [-180, 180]
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
    { pixel: {x: 275, y: 407}, expected: {lat: -34.3832745, lon: 63.3850129} },
    { pixel: {x: 276, y: 426}, expected: {lat: -35.000061, lon: 63.3855941} },
    { pixel: {x: 149, y: 466}, expected: {lat: -35.9995233, lon: 68.2960968} },
    { pixel: {x: 236, y: 41}, expected: {lat: -22.8682513, lon: 64.3173752} },
    { pixel: {x: 315, y: 126}, expected: {lat: -25.6546517, lon: 61.7100661} },
    { pixel: {x: 200, y: 991}, expected: {lat: -52.3952103, lon: 68.4269718} },
    { pixel: {x: 411, y: 961}, expected: {lat: -51.6286841, lon: 57.7425847} },
    { pixel: {x: 524, y: 128}, expected: {lat: -25.5924115, lon: 54.5929786} },
    { pixel: {x: 150, y: 43}, expected: {lat: -22.8140442, lon: 67.1805016} },
    { pixel: {x: 263, y: 684}, expected: {lat: -42.9581164, lon: 64.2978424} },
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

for (let test of coordinatesTests) {
    const { longitude, latitude, rho, azimuth} = pixelToCoordinatesLambertAzimuthal(test.pixel.x, test.pixel.y, mapConfig);
    const latDiff = Math.abs(latitude - test.expected.lat);
    const lonDiff = Math.abs(longitude + test.expected.lon);  // Note: expecting negative (west), so add to expected
    // cummulativeError += latDiff;
    // Calculate what scale SHOULD be for this point
    // Angular distance from south pole: abs(lat - (-90))
    const expectedAngularDist = Math.abs(test.expected.lat - (-90)); // Should be positive
    const shouldBeScale = rho / (2 * Math.sin(expectedAngularDist * Math.PI / 180 / 2));
    
    console.log(`Test Pixel (${test.pixel.x}, ${test.pixel.y}): Expected (${test.expected.lat}°S, ${test.expected.lon}°W), Got (${latitude.toFixed(2)}°S, ${longitude.toFixed(2)}°W) -> Lat Diff: ${latDiff.toFixed(2)}, Lon Diff: ${lonDiff.toFixed(2)}`);
    console.log(`  rho=${rho.toFixed(2)}, azimuth=${azimuth?.toFixed(2) || 'N/A'}°, expectedDist=${expectedAngularDist}°, calculatedScale=${shouldBeScale.toFixed(0)}`);
}

// for (let test of coordinatesTests) {
//     const pixelCoords = coordinatesToPixelLambertAzimuthal(test.expected.lat, -test.expected.lon, mapConfig);
//     const xDiff = Math.abs(pixelCoords.actualPixelX - test.pixel.x);
//     const yDiff = Math.abs(pixelCoords.actualPixelY - test.pixel.y);
    
//     console.log(`Inverse Test Coord (${test.expected.lat}°S, ${test.expected.lon}°W): Expected Pixel (${test.pixel.x}, ${test.pixel.y}), Got Pixel (${pixelCoords.actualPixelX.toFixed(2)}, ${pixelCoords.actualPixelY.toFixed(2)}) -> X Diff: ${xDiff.toFixed(2)}, Y Diff: ${yDiff.toFixed(2)}`);
// }