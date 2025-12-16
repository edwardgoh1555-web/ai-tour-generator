require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Test credentials
const TEST_USER = {
    username: 'demo',
    password: 'tour123'
};

// Health check endpoint for Railway
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Login endpoint
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    if (username === TEST_USER.username && password === TEST_USER.password) {
        res.json({ success: true, message: 'Login successful!' });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// Generate tour endpoint
app.post('/api/generate-tour', async (req, res) => {
    const { location, interests, numberOfStops } = req.body;
    
    if (!location || !interests || !numberOfStops) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const prompt = `You are a helpful tour guide assistant. Create a personalized tour with exactly ${numberOfStops} stops.

Location: ${location}
Interests/Activities: ${interests}
Number of stops: ${numberOfStops}

Please create an engaging tour itinerary with the following format for each stop:
- Stop number and name
- Brief description of what to do/see there
- Why it matches their interests
- Approximate time to spend there

Make the tour feel personal and exciting. Include practical tips where relevant.`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: 'You are an enthusiastic and knowledgeable tour guide who creates personalized tour itineraries based on user preferences.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 1500,
            temperature: 0.7
        });

        const tourContent = completion.choices[0].message.content;
        res.json({ success: true, tour: tourContent });
        
    } catch (error) {
        console.error('OpenAI API Error:', error);
        res.status(500).json({ 
            error: 'Failed to generate tour', 
            details: error.message 
        });
    }
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, HOST, () => {
    console.log(`AI Tour Generator running on http://${HOST}:${PORT}`);
    console.log(`Test credentials - Username: ${TEST_USER.username} | Password: ${TEST_USER.password}`);
});
