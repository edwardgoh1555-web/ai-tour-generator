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
            displayTour(data.tour);
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

// Display the generated tour
function displayTour(tourContent) {
    const summaryDiv = document.getElementById('tour-summary');
    const contentDiv = document.getElementById('tour-content');
    
    summaryDiv.innerHTML = `
        <h3> Tour Details</h3>
        <p><strong>Location:</strong> ${tourData.location}</p>
        <p><strong>Interests:</strong> ${tourData.interests}</p>
        <p><strong>Number of Stops:</strong> ${tourData.numberOfStops}</p>
    `;
    
    contentDiv.textContent = tourContent;
    
    showScreen('results-screen');
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
