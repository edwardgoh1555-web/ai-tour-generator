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
        const prompt = `You are a helpful tour guide assistant. Create a personalized tour with exactly ${numberOfStops} stops in ${location}.

Location: ${location}
Interests/Activities: ${interests}
Number of stops: ${numberOfStops}

IMPORTANT: You must recommend ONLY real, well-known, verifiable places that actually exist in ${location}. Do NOT make up or hallucinate locations.

For each stop, provide a JSON object with these exact fields:
- name: The actual name of the place/attraction
- description: What to do/see there and why it matches their interests
- duration: Approximate time to spend (e.g., "1-2 hours")
- address: The actual street address or area where it's located

Respond with a JSON object with a "stops" array containing ${numberOfStops} stops. Format:
{
  "stops": [
    {
      "name": "Real Place Name",
      "description": "Description here",
      "duration": "1-2 hours",
      "address": "123 Real Street, City"
    }
  ]
}`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'You are an enthusiastic and knowledgeable tour guide who creates personalized tour itineraries based on user preferences. You ONLY recommend real, verifiable places that actually exist. You always respond with a JSON object containing a "stops" array.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 2000,
            temperature: 0.7
        });

        let tourStops;
        try {
            const responseContent = completion.choices[0].message.content;
            console.log('OpenAI Response:', responseContent);
            const parsed = JSON.parse(responseContent);
            // Handle if response is wrapped in an object with a 'stops' key or similar
            tourStops = Array.isArray(parsed) ? parsed : (parsed.stops || parsed.tour || Object.values(parsed)[0]);
            
            if (!Array.isArray(tourStops)) {
                console.error('Tour stops is not an array:', tourStops);
                throw new Error('Invalid tour stops format');
            }
        } catch (parseError) {
            console.error('Failed to parse tour stops:', parseError);
            console.error('Raw response:', completion.choices[0].message.content);
            return res.status(500).json({ error: 'Failed to parse tour data', details: parseError.message });
        }

        res.json({ success: true, stops: tourStops, location, interests });
        
    } catch (error) {
        console.error('OpenAI API Error:', error);
        res.status(500).json({ 
            error: 'Failed to generate tour', 
            details: error.message 
        });
    }
});

// Refresh single tour stop endpoint
app.post('/api/refresh-stop', async (req, res) => {
    const { location, interests, currentStops } = req.body;
    
    if (!location || !interests) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const excludeList = currentStops ? currentStops.join(', ') : '';
        const prompt = `You are a helpful tour guide assistant. Generate ONE new tour stop for ${location}.

Location: ${location}
Interests/Activities: ${interests}
${excludeList ? `\nPlaces to AVOID (already suggested): ${excludeList}` : ''}

IMPORTANT: You must recommend ONLY a real, well-known, verifiable place that actually exists in ${location}. Do NOT make up or hallucinate locations. Try to suggest something different from what's already been recommended.

Provide a JSON object with these exact fields:
- name: The actual name of the place/attraction
- description: What to do/see there and why it matches their interests  
- duration: Approximate time to spend (e.g., "1-2 hours")
- address: The actual street address or area where it's located

Respond ONLY with a valid JSON object for one stop.`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'You are an enthusiastic and knowledgeable tour guide who creates personalized tour itineraries. You ONLY recommend real, verifiable places that actually exist. You always respond with valid JSON.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 500,
            temperature: 0.8
        });

        const responseContent = completion.choices[0].message.content;
        console.log('Refresh stop response:', responseContent);
        const newStop = JSON.parse(responseContent);
        res.json({ success: true, stop: newStop });
        
    } catch (error) {
        console.error('OpenAI API Error:', error);
        res.status(500).json({ 
            error: 'Failed to refresh stop', 
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
