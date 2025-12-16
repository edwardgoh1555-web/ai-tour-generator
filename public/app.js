// State management
let tourData = {
    location: '',
    interests: '',
    numberOfStops: 0
};

// Screen management
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

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
    tourData.location = document.getElementById('location').value;
    showScreen('interests-screen');
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
        <h3>📍 Tour Details</h3>
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
    
    // Clear form inputs
    document.getElementById('location').value = '';
    document.getElementById('interests').value = '';
    document.getElementById('stops').value = '';
    
    // Go back to location screen (already logged in)
    showScreen('location-screen');
});
