// State management
let tourData = {
    location: '',
    interests: '',
    numberOfStops: 0
};

let detectedLocation = null;

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
    
    tile.innerHTML = `
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
        </div>
    `;
    
    // Add refresh button event listener
    const refreshBtn = tile.querySelector('.refresh-btn');
    refreshBtn.addEventListener('click', () => refreshStop(index));
    
    return tile;
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
