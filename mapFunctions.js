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

    // Choose scale regionally if available. We compute a provisional angular
    // distance from the south pole from `rho` using the base `config.scale`,
    // then pick the matching regional scale (supports 8 regions).
    let scale = config.scale;
    if (config.regionalScales) {
        // compute tentative angular distance (degrees) using base scale
        const asinArgTent = rho / (config.scale * 2);
        const clampedTent = Math.max(-1, Math.min(1, asinArgTent));
        const angularDistTent = 2 * Math.asin(clampedTent) * 180 / Math.PI;
        scale = getRegionalScaleForAngularDistance(config, angularDistTent);
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

function getMapScale(mapImage) {
    let actualImageWidth = mapImage.naturalWidth;
    let actualImageHeight = mapImage.naturalHeight;
    
    // Fallback if naturalWidth is not available
    if (!actualImageWidth || !actualImageHeight) {
        console.warn('naturalWidth/naturalHeight not available, using offsetWidth/offsetHeight');
        actualImageWidth = mapImage.offsetWidth;
        actualImageHeight = mapImage.offsetHeight;
    }
    const displayedWidth = mapImage.offsetWidth;
    const displayedHeight = mapImage.offsetHeight;
    const scaleX = actualImageWidth / displayedWidth;
    const scaleY = actualImageHeight / displayedHeight;
    return { scaleX, scaleY };
}