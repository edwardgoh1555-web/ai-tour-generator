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

// Helper function to clean JSON response from markdown code blocks
function cleanJsonResponse(text) {
    // Remove markdown code blocks if present
    let cleaned = text.trim();
    
    // If there's a code block, extract it
    if (cleaned.includes('```')) {
        const match = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (match && match[1]) {
            cleaned = match[1].trim();
        }
    }
    
    // Try to extract JSON object from the text
    // Look for the first { and last }
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
    
    return cleaned.trim();
}

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
        const prompt = `You are a helpful tour guide assistant with web search access. Create a personalized tour with exactly ${numberOfStops} stops in ${location}.

Location: ${location}
Interests/Activities: ${interests}
Number of stops: ${numberOfStops}

CRITICAL INSTRUCTIONS:
1. You MUST search the web to find REAL places that actually exist in ${location}
2. For each place, verify BOTH that it exists AND what type of cuisine/activity it actually offers
3. ONLY include places that ACTUALLY match the interests "${interests}"
4. Do NOT include a place if it doesn't match - for example, don't include a Spanish tapas bar on an Asian food tour
5. Get the actual address, phone number, website, and verify what they actually serve/offer from your search
6. For images: Try to find real image URLs, but if not available, use empty array []
7. Do NOT make up or hallucinate any information about what a place offers
8. If you cannot find ${numberOfStops} real matching places, return fewer stops

For each stop, provide a JSON object with these exact fields:
- name: The actual name of the place/attraction (verified via web search)
- description: What to do/see there and why it matches their interests
- duration: Approximate time to spend (e.g., "1-2 hours")
- address: The actual complete street address (verified via web search)
- phone: Phone number if available from search
- website: Website URL if available from search

Respond with a JSON object with a "stops" array containing ${numberOfStops} stops. Format:
{
  "stops": [
    {
      "name": "Real Place Name",
      "description": "Description here",
      "duration": "1-2 hours",
      "address": "123 Real Street, City",
      "phone": "+1234567890",
      "website": "https://example.com"
    }
  ]
}`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',  // Use gpt-4o for web search capabilities
            messages: [
                {
                    role: 'system',
                    content: 'You are a tour guide API that returns ONLY valid JSON. You have web search access. Search the web to find and verify real places. Respond with ONLY the JSON object, no explanations, no markdown, no extra text before or after.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 3000,
            temperature: 0.7
        });

        let tourStops;
        try {
            const responseContent = completion.choices[0].message.content;
            console.log('OpenAI Response:', responseContent);
            const cleanedContent = cleanJsonResponse(responseContent);
            const parsed = JSON.parse(cleanedContent);
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
        const prompt = `You are a helpful tour guide assistant with web search access. Generate ONE new tour stop for ${location}.

Location: ${location}
Interests/Activities: ${interests}
${excludeList ? `\nPlaces to AVOID (already suggested): ${excludeList}` : ''}

CRITICAL INSTRUCTIONS:
1. You MUST search the web to find a REAL place that actually exists in ${location}
2. Verify it exists by searching for it online
3. Get the actual address and other real details from your search
4. Do NOT make up or hallucinate any information
5. Make sure it's different from the excluded places

Provide a JSON object with these exact fields:
- name: The actual name of the place/attraction (verified via web search)
- description: What to do/see there and why it matches their interests  
- duration: Approximate time to spend (e.g., "1-2 hours")
- address: The actual complete street address (verified via web search)
- phone: Phone number if available from search
- website: Website URL if available from search

Respond ONLY with the raw JSON object, no markdown formatting, no code blocks, no extra text.`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',  // Use gpt-4o for web search
            messages: [
                {
                    role: 'system',
                    content: 'You are a tour guide API that returns ONLY valid JSON. You have web search access. Search the web to find and verify real places. Respond with ONLY the JSON object, no explanations, no markdown, no extra text.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 800,
            temperature: 0.8
        });

        const responseContent = completion.choices[0].message.content;
        console.log('Refresh stop response:', responseContent);
        const cleanedContent = cleanJsonResponse(responseContent);
        const newStop = JSON.parse(cleanedContent);
        
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
