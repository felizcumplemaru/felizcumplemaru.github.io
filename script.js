const clues = {
    "clue-1": "",
    "clue-2": "",
    "clue-3": "",
    'lat': 0,
    'lon': 0
}

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

let clueIndex = 0;
let guessLat = 0;
let guessLon = 0;

document.addEventListener('DOMContentLoaded', async function() {
    const index = Math.floor(Math.random() * 156);
    console.log(`Selected tweet index: ${index}`);
    const response = await fetch("tweets.json");
    const tweets = await response.json();
    const tweet = tweets[index];
    clues['lat'] = tweet.lat;
    clues['lon'] = tweet.lon;
    clues['clue-1'] = tweet.ciudad;
    clues['clue-2'] = tweet.departamento;
    clues['clue-3'] = tweet.provincia;
    document.getElementById("tweet").textContent = tweet.text;
    const mapContainer = document.querySelector('.map-container');
    const mapImage = document.createElement("img");
    mapImage.src = tweet.newSrc;
    mapContainer.appendChild(mapImage);
    
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
        const { scaleX, scaleY } = getMapScale(mapImage);
        
        console.log(`Image loaded - Actual: ${mapImage.naturalWidth}x${mapImage.naturalHeight}, Displayed: ${mapImage.offsetWidth}x${mapImage.offsetHeight}, Scale: ${scaleX.toFixed(3)}x${scaleY.toFixed(3)}`);
        
        
        mapImage.addEventListener('click', function(event) {
            const answerMarker = document.querySelector('.marker-answer');
            if (answerMarker) {
                console.warn('The answer has already been revealed. No further guesses allowed.');
                return;
            }
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
            const existingMarker = document.querySelector('.marker-guess');
            if (existingMarker) {
                existingMarker.remove();
            }
            const marker = document.createElement("div");
            marker.className = "marker marker-guess";
            marker.style.left = `${event.clientX - rect.left}px`;
            marker.style.top = `${event.clientY - rect.top}px`;
            mapImage.parentNode.appendChild(marker);
            const guessButton = document.getElementById("guess-button");
            if (guessButton) {
                guessButton.disabled = false;
            }

            guessLat = latitude;
            guessLon = longitude;
        });
    }
});

function getClue() {
    if (clueIndex > 2) return;
    const clueElement = document.getElementById(`clue-${clueIndex}`);
    const clueValue = clues[`clue-${clueIndex}`];
    if (clueElement) {
        clueIndex++;
        document.getElementById("clue").textContent = `${clueIndex}/3`;
        clueElement.textContent = clueValue;
    }
}

function drawLine(x1, y1, x2, y2) {
    const svg = document.querySelector('.map-container svg');
    if (!svg) return;
    
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    svg.appendChild(line);
}

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
    const toRad = deg => deg * Math.PI / 180;
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function guess() {
    const mapImage = document.querySelector('.map-container img');
    const { scaleX, scaleY } = getMapScale(mapImage);
    const pixelCoords = coordinatesToPixelLambertAzimuthal(clues['lat'], clues['lon'], mapConfig);
    const marker = document.createElement("div");
    marker.className = "marker marker-answer";

    const realPixelX = pixelCoords.actualPixelX / scaleX;
    const realPixelY = pixelCoords.actualPixelY / scaleY;
    marker.style.left = `${realPixelX}px`;
    marker.style.top = `${realPixelY}px`;
    mapImage.parentNode.appendChild(marker);

    const guessMarker = document.querySelector('.marker-guess');
    if (guessMarker) {
        const guessRect = guessMarker.getBoundingClientRect();
        const guessPixelX = guessRect.left + guessRect.width / 2 - mapImage.getBoundingClientRect().left;
        const guessPixelY = guessRect.top + guessRect.height / 2 - mapImage.getBoundingClientRect().top;
        drawLine(guessPixelX, guessPixelY, realPixelX, realPixelY);
    } else {
        console.warn('No guess marker found to draw line from.');
    }

    showAnswer();
}

function showAnswer() {
    let distance = haversineDistanceKm(guessLat, guessLon, clues['lat'], clues['lon']);
    alert(`La respuesta es: ${clues['lat']}°S, ${Math.abs(clues['lon'])}°W\nTu distancia al objetivo es: ${distance.toFixed(2)} km`);
}