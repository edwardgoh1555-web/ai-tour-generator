# 🗺️ AI Tour Generator

An AI-powered tour generator that creates personalized travel itineraries based on your location, interests, and preferences.

## Features

- Simple login system (test credentials provided)
- Step-by-step tour customization:
  - Location input
  - Interest/activity preferences
  - Number of stops
- AI-generated personalized tour itinerary
- Clean, responsive UI

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
Create a `.env` file in the root directory:
```
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. Run the application
```bash
npm start
```

### 4. Open in browser
Navigate to `http://localhost:3000`

### Test Credentials
- **Username:** `demo`
- **Password:** `tour123`

## Deployment to Railway

1. Push your code to GitHub
2. Connect your Railway account to GitHub
3. Create a new project from your repository
4. Add the `OPENAI_API_KEY` environment variable in Railway settings
5. Deploy!

## Tech Stack

- **Backend:** Node.js, Express
- **Frontend:** HTML, CSS, JavaScript
- **AI:** OpenAI GPT-3.5-turbo

## License

MIT
