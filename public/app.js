// State management
let tourData = {
    location: '',
    interests: '',
    numberOfStops: 0
};

let detectedLocation = null;
let currentPosition = null; // Store GPS coordinates
let generatedStops = []; // Store generated tour stops for map
let map = null; // Leaflet map instance

// Global image error handler
function handleImageError(imgElement) {
    const carousel = imgElement.parentElement;
    const stopTile = carousel.closest('.stop-tile');
    
    // Remove the failed image
    imgElement.remove();
    
    // Get remaining images
    const remainingImages = carousel.querySelectorAll('.carousel-image');
    
    // If no images left, hide the carousel container
    if (remainingImages.length === 0) {
        const carouselContainer = carousel.parentElement;
        if (carouselContainer) {
            carouselContainer.style.display = 'none';
        }
        return;
    }
    
    // Reindex remaining images - ensure at least one is active
    let hasActive = false;
    remainingImages.forEach((img, index) => {
        img.classList.remove('active');
        if (index === 0) {
            img.classList.add('active');
            hasActive = true;
        }
    });
    
    // Update indicators if they exist
    const indicatorsContainer = stopTile?.querySelector('.carousel-indicators');
    if (indicatorsContainer && remainingImages.length > 1) {
        indicatorsContainer.innerHTML = '';
        remainingImages.forEach((_, index) => {
            const indicator = document.createElement('span');
            indicator.className = `indicator ${index === 0 ? 'active' : ''}`;
            indicatorsContainer.appendChild(indicator);
        });
    } else if (indicatorsContainer) {
        // Hide indicators if only one image left
        indicatorsContainer.style.display = 'none';
    }
    
    // Hide navigation buttons if only one image left
    if (remainingImages.length === 1) {
        const navButtons = stopTile?.querySelectorAll('.carousel-btn');
        navButtons?.forEach(btn => btn.style.display = 'none');
    }
}

// Screen management
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// Geolocation functionality
async function getUserLocation() {
    const locationBtn = document.getElementById('use-location-btn');
    const locationStatus = document.getElementById('location-status');
    const locationInput = document.getElementById('location');
    
    // Check if geolocation is supported
    if (!navigator.geolocation) {
        locationStatus.textContent = 'Geolocation is not supported by your browser';
        locationStatus.className = 'location-status error';
        return;
    }
    
    // If we already have a detected location, use it and proceed
    if (detectedLocation) {
        tourData.location = detectedLocation;
        showScreen('interests-screen');
        return;
    }
    
    // Show loading state
    locationBtn.disabled = true;
    locationBtn.innerHTML = ' Getting location...';
    locationBtn.classList.add('loading');
    locationStatus.textContent = '';
    
    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000
            });
        });
        
        const { latitude, longitude } = position.coords;
        
        // Store current position for map
        currentPosition = { lat: latitude, lng: longitude };
        
        // Reverse geocode using OpenStreetMap Nominatim (free, no API key)
        locationBtn.innerHTML = ' Finding address...';
        
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`,
            {
                headers: {
                    'Accept-Language': 'en'
                }
            }
        );
        
        if (!response.ok) throw new Error('Geocoding failed');
        
        const data = await response.json();
        
        // Build a readable location string
        let locationString = '';
        if (data.address) {
            const parts = [];
            if (data.address.city || data.address.town || data.address.village) {
                parts.push(data.address.city || data.address.town || data.address.village);
            }
            if (data.address.state) {
                parts.push(data.address.state);
            }
            if (data.address.country) {
                parts.push(data.address.country);
            }
            locationString = parts.join(', ');
        } else {
            locationString = data.display_name;
        }
        
        // Store detected location and update button
        detectedLocation = locationString;
        locationBtn.innerHTML = ' ' + locationString;
        locationBtn.classList.remove('loading');
        locationBtn.classList.add('has-location');
        locationBtn.disabled = false;
        locationStatus.textContent = ' Click the button above to use this location';
        locationStatus.className = 'location-status success';
        
        // Clear manual input since we have auto location
        locationInput.value = '';
        
    } catch (error) {
        console.error('Geolocation error:', error);
        let errorMessage = 'Could not get your location. ';
        
        if (error.code === 1) {
            errorMessage = 'Location access denied. Please enter manually below.';
        } else if (error.code === 2) {
            errorMessage = 'Location unavailable. Please enter manually below.';
        } else if (error.code === 3) {
            errorMessage = 'Location request timed out. Please enter manually below.';
        } else {
            errorMessage = 'Could not detect location. Please enter manually below.';
        }
        
        locationStatus.textContent = errorMessage;
        locationStatus.className = 'location-status error';
        locationBtn.innerHTML = ' Allow Location';
        locationBtn.classList.remove('loading');
        locationBtn.disabled = false;
    }
}

// Set up location button
document.getElementById('use-location-btn').addEventListener('click', getUserLocation);

// Login handling
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('login-error');
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            errorDiv.textContent = '';
            showScreen('location-screen');
        } else {
            errorDiv.textContent = data.message || 'Invalid credentials';
        }
    } catch (error) {
        errorDiv.textContent = 'Connection error. Please try again.';
    }
});

// Location form handling
document.getElementById('location-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const manualLocation = document.getElementById('location').value.trim();
    const locationStatus = document.getElementById('location-status');
    
    // Use manual location if provided, otherwise use detected location
    if (manualLocation) {
        tourData.location = manualLocation;
        showScreen('interests-screen');
    } else if (detectedLocation) {
        tourData.location = detectedLocation;
        showScreen('interests-screen');
    } else {
        locationStatus.textContent = 'Please detect your location or enter one manually';
        locationStatus.className = 'location-status error';
    }
});

// Interests form handling
document.getElementById('interests-form').addEventListener('submit', (e) => {
    e.preventDefault();
    tourData.interests = document.getElementById('interests').value;
    showScreen('stops-screen');
});

// Stops form handling
document.getElementById('stops-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    tourData.numberOfStops = parseInt(document.getElementById('stops').value);
    
    // Show loading screen
    showScreen('loading-screen');
    
    try {
        const response = await fetch('/api/generate-tour', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(tourData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayTour(data);
        } else {
            alert('Error generating tour: ' + (data.error || 'Unknown error'));
            showScreen('stops-screen');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to generate tour. Please check your connection and try again.');
        showScreen('stops-screen');
    }
});

// Display the generated tour with individual tiles
function displayTour(data) {
    const summaryDiv = document.getElementById('tour-summary');
    const contentDiv = document.getElementById('tour-content');
    
    // Store stops for map
    generatedStops = data.stops;
    
    summaryDiv.innerHTML = `
        <h3> Tour Details</h3>
        <p><strong>Location:</strong> ${tourData.location}</p>
        <p><strong>Interests:</strong> ${tourData.interests}</p>
        <p><strong>Number of Stops:</strong> ${tourData.numberOfStops}</p>
    `;
    
    // Create individual tiles for each stop
    contentDiv.innerHTML = '';
    contentDiv.className = 'tour-tiles';
    
    data.stops.forEach((stop, index) => {
        const tile = createStopTile(stop, index);
        contentDiv.appendChild(tile);
    });
    
    showScreen('results-screen');
}

// Create a tile for a single tour stop
function createStopTile(stop, index) {
    const tile = document.createElement('div');
    tile.className = 'tour-stop-tile';
    tile.dataset.index = index;
    
    // Filter out any invalid image URLs and ensure we have valid images
    const validImages = (stop.images || []).filter(img => img && img.trim() !== '');
    
    // Create image carousel HTML only if there are images
    let carouselHTML = '';
    if (validImages.length > 0) {
        carouselHTML = `
            <div class="image-carousel">
                <div class="carousel-images">
                    ${validImages.map((img, i) => `
                        <img src="${img}" alt="${stop.name}" class="carousel-image ${i === 0 ? 'active' : ''}" loading="lazy" onerror="handleImageError(this)">
                    `).join('')}
                </div>
                ${validImages.length > 1 ? `
                    <button class="carousel-btn prev" aria-label="Previous image">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                    </button>
                    <button class="carousel-btn next" aria-label="Next image">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </button>
                    <div class="carousel-indicators">
                        ${validImages.map((_, i) => `<span class="indicator ${i === 0 ? 'active' : ''}" data-index="${i}"></span>`).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    tile.innerHTML = `
        ${carouselHTML}
        <div class="tile-header">
            <div class="stop-number">Stop ${index + 1}</div>
            <button class="refresh-btn" title="Get a different stop" aria-label="Refresh this stop">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                </svg>
            </button>
        </div>
        <h3 class="stop-name">${stop.name}</h3>
        <p class="stop-description">${stop.description}</p>
        <div class="stop-details">
            <div class="detail-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                </svg>
                <span>${stop.duration || 'Flexible'}</span>
            </div>
            <div class="detail-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                </svg>
                <span>${stop.address || tourData.location}</span>
            </div>
            ${stop.phone ? `
                <div class="detail-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                    <span>${stop.phone}</span>
                </div>
            ` : ''}
            ${stop.website ? `
                <div class="detail-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="2" y1="12" x2="22" y2="12"/>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                    </svg>
                    <a href="${stop.website}" target="_blank" rel="noopener noreferrer">Visit Website</a>
                </div>
            ` : ''}
        </div>
    `;
    
    // Add refresh button event listener
    const refreshBtn = tile.querySelector('.refresh-btn');
    refreshBtn.addEventListener('click', () => refreshStop(index));
    
    // Add carousel functionality if there are multiple images
    if (stop.images && stop.images.length > 1) {
        setupCarousel(tile);
    }
    
    return tile;
}

// Setup carousel functionality
function setupCarousel(tile) {
    const images = tile.querySelectorAll('.carousel-image');
    const indicators = tile.querySelectorAll('.indicator');
    const prevBtn = tile.querySelector('.carousel-btn.prev');
    const nextBtn = tile.querySelector('.carousel-btn.next');
    let currentIndex = 0;
    
    function showImage(index) {
        images.forEach((img, i) => {
            img.classList.toggle('active', i === index);
        });
        indicators.forEach((ind, i) => {
            ind.classList.toggle('active', i === index);
        });
        currentIndex = index;
    }
    
    if (prevBtn && nextBtn) {
        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const newIndex = (currentIndex - 1 + images.length) % images.length;
            showImage(newIndex);
        });
        
        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const newIndex = (currentIndex + 1) % images.length;
            showImage(newIndex);
        });
    }
    
    indicators.forEach((indicator, index) => {
        indicator.addEventListener('click', (e) => {
            e.stopPropagation();
            showImage(index);
        });
    });
}

// Refresh a single tour stop
async function refreshStop(index) {
    const tile = document.querySelector(`[data-index="${index}"]`);
    const refreshBtn = tile.querySelector('.refresh-btn');
    
    // Add loading state
    refreshBtn.classList.add('loading');
    refreshBtn.disabled = true;
    
    // Get current stop names to avoid duplicates
    const allTiles = document.querySelectorAll('.tour-stop-tile');
    const currentStops = Array.from(allTiles)
        .filter((_, i) => i !== index)
        .map(t => t.querySelector('.stop-name').textContent);
    
    try {
        const response = await fetch('/api/refresh-stop', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                location: tourData.location,
                interests: tourData.interests,
                currentStops
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Replace the tile with the new stop
            const newTile = createStopTile(data.stop, index);
            tile.parentNode.replaceChild(newTile, tile);
        } else {
            alert('Error refreshing stop: ' + (data.error || 'Unknown error'));
            refreshBtn.classList.remove('loading');
            refreshBtn.disabled = false;
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to refresh stop. Please try again.');
        refreshBtn.classList.remove('loading');
        refreshBtn.disabled = false;
    }
}

// New tour button
document.getElementById('new-tour-btn').addEventListener('click', () => {
    // Reset form data
    tourData = {
        location: '',
        interests: '',
        numberOfStops: 0
    };
    
    // Keep detected location for reuse, but reset UI
    const locationBtn = document.getElementById('use-location-btn');
    if (detectedLocation) {
        locationBtn.innerHTML = ' ' + detectedLocation;
        locationBtn.classList.add('has-location');
    } else {
        locationBtn.innerHTML = ' Allow Location';
        locationBtn.classList.remove('has-location');
    }
    
    // Clear form inputs
    document.getElementById('location').value = '';
    document.getElementById('interests').value = '';
    document.getElementById('stops').value = '';
    document.getElementById('location-status').textContent = '';
    document.getElementById('location-status').className = 'location-status';
    
    // Go back to location screen (already logged in)
    showScreen('location-screen');
});

// Start tour button - show map
document.getElementById('start-tour-btn').addEventListener('click', () => {
    initializeMap();
    showScreen('map-screen');
});

// Back to tour details button
document.getElementById('back-to-tour-btn').addEventListener('click', () => {
    showScreen('results-screen');
});

// Initialize and display map with tour stops
async function initializeMap() {
    const mapContainer = document.getElementById('map-container');
    
    // Get current location if not already available
    if (!currentPosition) {
        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                });
            });
            currentPosition = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
        } catch (error) {
            console.error('Could not get current location:', error);
            // Default to first stop or city center
            if (generatedStops.length > 0) {
                // Try to geocode the first stop's address
                currentPosition = await geocodeAddress(generatedStops[0].address);
            }
        }
    }
    
    // Create map if it doesn't exist
    if (!map) {
        map = L.map('map-container').setView([currentPosition.lat, currentPosition.lng], 13);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(map);
    } else {
        // Clear existing markers
        map.eachLayer((layer) => {
            if (layer instanceof L.Marker) {
                map.removeLayer(layer);
            }
        });
        map.setView([currentPosition.lat, currentPosition.lng], 13);
    }
    
    // Add current location marker
    const currentLocationIcon = L.divIcon({
        html: '<div style=\"background: #667eea; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);\"></div>',
        iconSize: [20, 20],
        className: ''
    });
    
    L.marker([currentPosition.lat, currentPosition.lng], { icon: currentLocationIcon })
        .addTo(map)
        .bindPopup('<b>📍 Your Location</b>')
        .openPopup();
    
    // Add markers for each tour stop
    for (let i = 0; i < generatedStops.length; i++) {
        const stop = generatedStops[i];
        const coords = await geocodeAddress(stop.address);
        
        if (coords) {
            const stopIcon = L.divIcon({
                html: `<div style=\"background: #764ba2; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);\">${i + 1}</div>`,
                iconSize: [30, 30],
                className: ''
            });
            
            L.marker([coords.lat, coords.lng], { icon: stopIcon })
                .addTo(map)
                .bindPopup(`
                    <div style="min-width: 200px;">
                        <h3 style="margin: 0 0 8px 0; color: #333;">Stop ${i + 1}: ${stop.name}</h3>
                        <p style="margin: 4px 0; color: #666; font-size: 0.9em;">${stop.description.substring(0, 100)}...</p>
                        <p style="margin: 4px 0; color: #667eea; font-size: 0.85em;"><b>⏱️ ${stop.duration}</b></p>
                    </div>
                `);
        }
    }
    
    // Fit map to show all markers
    if (generatedStops.length > 0) {
        const bounds = L.latLngBounds([currentPosition.lat, currentPosition.lng]);
        for (const stop of generatedStops) {
            const coords = await geocodeAddress(stop.address);
            if (coords) {
                bounds.extend([coords.lat, coords.lng]);
            }
        }
        map.fitBounds(bounds, { padding: [50, 50] });
    }
}

// Geocode address to coordinates
async function geocodeAddress(address) {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
            {
                headers: {
                    'Accept-Language': 'en'
                }
            }
        );
        
        const data = await response.json();
        
        if (data && data.length > 0) {
            return {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon)
            };
        }
    } catch (error) {
        console.error('Geocoding error:', error);
    }
    
    return null;
}
