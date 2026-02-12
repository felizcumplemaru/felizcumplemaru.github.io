// Helper: select a regional scale based on angular distance from the south pole.
// Supports legacy 4-key objects (`near`, `mid`, `far`, `vfar`) or an array of 8
// scales (ordered from center outward).
function getRegionalScaleForAngularDistance(config, angularDist) {
    const rs = config.regionalScales;
    if (!rs) return config.scale;

    if (Array.isArray(rs)) {
        const thresholds = [25, 30, 35, 40, 45, 50, 55];
        for (let i = 0; i < thresholds.length; i++) {
            if (angularDist <= thresholds[i]) return rs[i] || config.scale;
        }
        return rs[7] || config.scale;
    }

    if (typeof rs === 'object') {
        if (angularDist <= 40) return rs.near || config.scale;
        if (angularDist <= 50) return rs.mid || config.scale;
        if (angularDist <= 60) return rs.far || config.scale;
        return rs.vfar || config.scale;
    }

    return config.scale;
}

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
        scale = getRegionalScaleForAngularDistance(config, angularDist);
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

    // Choose scale regionally if available. Compute a tentative angular
    // distance using the base `config.scale`, then pick the matching regional scale.
    let scale = config.scale;
    if (config.regionalScales) {
        const asinArgTent = rho / (config.scale * 2);
        const clampedTent = Math.max(-1, Math.min(1, asinArgTent));
        const angularDistTent = 2 * Math.asin(clampedTent) * 180 / Math.PI;
        scale = getRegionalScaleForAngularDistance(config, angularDistTent);
        console.log(scale)
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
    // 20-30
    { pixel: {x: 150, y: 43}, expected: {lat: -22.8140442, lon: 67.1805016} },
    { pixel: {x: 236, y: 41}, expected: {lat: -22.8682513, lon: 64.3173752} },
    { pixel: {x: 365, y: 54}, expected: {lat: -23.43, lon: 60} },
    { pixel: {x: 67, y: 70}, expected: {lat: -23.43, lon: 70} },
    { pixel: {x: 524, y: 128}, expected: {lat: -25.5924115, lon: 54.5929786} },
    { pixel: {x: 315, y: 126}, expected: {lat: -25.6546517, lon: 61.7100661} },
    { pixel: {x: 244, y: 251}, expected: {lat: -29.4958206, lon: 64.3404028} },
    // 30-40
    { pixel: {x: 365, y: 264}, expected: {lat: -30, lon: 60} },
    { pixel: {x: 85, y: 280}, expected: {lat: -30, lon: 70} },
    { pixel: {x: 275, y: 407}, expected: {lat: -34.3832745, lon: 63.3850129} },
    { pixel: {x: 276, y: 426}, expected: {lat: -35.000061, lon: 63.3855941} },
    { pixel: {x: 149, y: 466}, expected: {lat: -35.9995233, lon: 68.2960968} },
    { pixel: {x: 165, y: 562}, expected: {lat: -38.9866808, lon: 68.0042446} },
    // 40-50
    { pixel: {x: 365, y: 585}, expected: {lat: -40, lon: 60} },
    { pixel: {x: 118, y: 599}, expected: {lat: -40, lon: 70} },
    { pixel: {x: 263, y: 684}, expected: {lat: -42.9581164, lon: 64.2978424} },
    { pixel: {x: 194, y: 786}, expected: {lat: -45.9989444, lon: 67.5889419} },
    { pixel: {x: 104, y: 796}, expected: {lat: -45.9995282, lon: 71.6465389} },
    { pixel: {x: 185, y: 910}, expected: {lat: -49.7863612, lon: 68.6268418} },
    // 50-60
    { pixel: {x: 365, y: 906}, expected: {lat: -50, lon: 60} },
    { pixel: {x: 158, y: 919}, expected: {lat: -50, lon: 70} },
    { pixel: {x: 411, y: 961}, expected: {lat: -51.6286841, lon: 57.7425847} },
    { pixel: {x: 200, y: 991}, expected: {lat: -52.3952103, lon: 68.4269718} },
    // South pole
    { pixel: {x: 366, y: 2615}, expected: {lat: -90, lon: 60} },
]


const mapConfig = {
    centerPixelX: 366,
    centerPixelY: 2615,
    centerLongitude: -60,
    scale: 2400,
    longitudeCorrectionFactor: 1.43,
    // regionalScales can be an array of 8 values (center outward) which
    // you can fill with the precise numbers you'll calculate. Example
    // placeholder array below — replace with your computed values.
    regionalScales: [2498, 2475, 2450, 2535, 2505, 2440, 2385, 2340],
    orientation: 0
};

let totalLatDiff = 0;
let totalLonDiff = 0;

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
    totalLatDiff += latDiff;
    totalLonDiff += lonDiff;
}

console.log(`Average Latitude Diff: ${(totalLatDiff / coordinatesTests.length).toFixed(2)}°, Average Longitude Diff: ${(totalLonDiff / coordinatesTests.length).toFixed(2)}°`);

// for (let test of coordinatesTests) {
//     const pixelCoords = coordinatesToPixelLambertAzimuthal(test.expected.lat, -test.expected.lon, mapConfig);
//     const xDiff = Math.abs(pixelCoords.actualPixelX - test.pixel.x);
//     const yDiff = Math.abs(pixelCoords.actualPixelY - test.pixel.y);
    
//     console.log(`Inverse Test Coord (${test.expected.lat}°S, ${test.expected.lon}°W): Expected Pixel (${test.pixel.x}, ${test.pixel.y}), Got Pixel (${pixelCoords.actualPixelX.toFixed(2)}, ${pixelCoords.actualPixelY.toFixed(2)}) -> X Diff: ${xDiff.toFixed(2)}, Y Diff: ${yDiff.toFixed(2)}`);
// }