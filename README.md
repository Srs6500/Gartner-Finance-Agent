# Bedrock Chat Frontend

A modern React + TypeScript + Vite + Tailwind CSS frontend for interacting with your AWS Bedrock Agent through API Gateway.

## Features

- 🚀 Modern React with TypeScript
- ⚡ Fast development with Vite
- 🎨 Beautiful UI with Tailwind CSS
- 💬 Real-time chat interface
- 📱 Responsive design

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Open your browser:**
   Navigate to `http://localhost:5173`

## Build for Production

```bash
npm run build
```

The built files will be in the `dist` folder.

## API Configuration

The API endpoint is configured in `src/components/ChatInterface.tsx`:

```typescript
const API_ENDPOINT = 'https://zuev4x49wh.execute-api.us-east-1.amazonaws.com/Production/chat'
```

## Project Structure

```
├── src/
│   ├── components/
│   │   └── ChatInterface.tsx  # Main chat component
│   ├── App.tsx                 # Root component
│   ├── main.tsx                # Entry point
│   └── index.css               # Tailwind imports
├── index.html                  # HTML template
├── package.json                # Dependencies
├── tsconfig.json               # TypeScript config
├── vite.config.ts              # Vite config
└── tailwind.config.js          # Tailwind config
```

## Usage

1. Type your message in the input field
2. Press Enter or click Send
3. View the response from your Bedrock Agent

The interface automatically handles:
- Loading states
- Error handling
- Message timestamps
- Auto-scrolling to latest message



