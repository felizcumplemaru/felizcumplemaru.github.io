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