# CV Voting App

A collaborative CV evaluation and voting application that integrates with Google Drive for document management and score tracking.

## Features

- **User Authentication**: Simple name-based user identification
- **Google Drive Integration**: Load CVs directly from Google Drive folders
- **Star Rating System**: Rate CVs from 1-5 stars
- **Comments**: Add detailed feedback on each CV
- **Real-time Collaboration**: Multiple users can vote and comment simultaneously
- **Automatic Score Tracking**: Scores are automatically saved to a CSV file in your Google Drive
- **Document Preview**: View CVs directly in the app with modal preview
- **Average Ratings**: See overall ratings and total voter count for each CV
- **Responsive Design**: Works on desktop and mobile devices

## Technologies Used

### Frontend
- **React 18**: Modern React with hooks
- **Vite**: Fast development and build tool
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Beautiful icon library

### Backend
- **FastAPI**: Modern, fast Python web framework
- **Uvicorn**: ASGI server for FastAPI
- **httpx**: Async HTTP client for Google Drive API calls
- **Pydantic**: Data validation and settings management

### Infrastructure
- **Docker & Docker Compose**: Containerization and orchestration
- **Nginx**: Reverse proxy, static file serving, and API routing
- **PostgreSQL**: Database for user sessions and authentication
- **Google Drive API**: Document storage and management
- **Google OAuth2**: Secure authentication

## Setup Instructions

### Prerequisites

- Docker and Docker Compose
- Google Drive account
- Google Drive API key

### Production Deployment

For production deployment with unified nginx proxy:

1. **Clone or navigate to the project directory**:
   ```bash
   cd misc/cv-voting
   ```

2. **Set up environment variables**:
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

3. **Build and start the production environment**:
   ```bash
   docker-compose up --build -d
   ```

4. **Access the application**:
   - Frontend: http://localhost:80
   - API: http://localhost:80/api/*
   - All requests are handled by nginx proxy

5. **Test the setup**:
   ```bash
   ./test-production.sh
   ```

### Development Setup

For local development with hot reloading:

1. **Clone or navigate to the project directory**:
   ```bash
   cd misc/cv-voting
   ```

2. **Set up environment variables**:
   ```bash
   cp env.example .env
   # Edit .env and add your Google Drive API key
   ```

3. **Start the development environment**:
   ```bash
   docker-compose -f docker-compose.dev.yml up --build
   ```

4. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000

> **Note**: The frontend is now in its own `frontend/` directory, and the backend is in the `backend/` directory. Docker Compose handles the orchestration automatically.

### Local Development (without Docker)

#### Prerequisites
- Node.js (version 16 or higher)
- Python 3.11+
- npm or yarn package manager

#### Frontend Setup
1. **Navigate to frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install frontend dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

#### Backend Setup
1. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Set environment variable**:
   ```bash
   export GOOGLE_DRIVE_API_KEY=your_api_key_here
   ```

4. **Start the FastAPI server**:
   ```bash
   uvicorn main:app --reload
   ```

### Google Drive API Setup (For Production)

To enable real Google Drive integration, you'll need to:

1. **Create a Google Cloud Project**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one

2. **Enable Google Drive API**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Drive API" and enable it

3. **Create API Credentials**:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API Key"
   - Copy your API key

4. **Update the Application**:
   - Replace `YOUR_API_KEY` in the code with your actual API key
   - Consider using environment variables for security

## Usage Guide

### Getting Started

1. **Enter Your Name**: When you first open the app, enter your name to identify your votes and comments.

2. **Connect Google Drive Folder**:
   - Create a folder in Google Drive containing CV files (PDF format)
   - Share the folder with "Anyone with the link can view" permissions
   - Copy the folder URL and paste it into the app

3. **Start Voting**:
   - The app will load all PDF files from the folder
   - Click "Preview CV" to view each document
   - Rate each CV using the star system (1-5 stars)
   - Add comments with your feedback

### Collaboration Features

- **Multiple Users**: Share the app URL with team members for collaborative evaluation
- **Real-time Updates**: Votes and comments are saved to a CSV file in your Google Drive
- **Score Persistence**: All ratings are automatically saved and loaded when returning to the app

### Data Management

- **Automatic Backups**: A `scores.csv` file is created in your Google Drive folder
- **Export Data**: Download the CSV file directly from Google Drive for analysis
- **Data Format**: The CSV contains columns for document ID, voter name, rating, and comments

## File Structure

```
cv-voting/
├── backend/                      # FastAPI Backend
│   ├── main.py                  # FastAPI application
│   ├── requirements.txt         # Python dependencies
│   └── Dockerfile              # Backend Docker configuration
├── frontend/                    # React Frontend
│   ├── src/                     # React source code
│   │   ├── components/
│   │   │   └── DriveVotingApp.jsx # Main application component
│   │   ├── App.jsx              # Root component
│   │   ├── main.jsx             # React entry point
│   │   └── index.css            # Tailwind CSS imports
│   ├── index.html               # HTML template
│   ├── package.json             # Frontend dependencies and scripts
│   ├── Dockerfile               # Frontend Docker configuration
│   ├── nginx.conf               # Nginx configuration
│   ├── vite.config.js           # Vite configuration
│   ├── tailwind.config.js       # Tailwind configuration
│   └── postcss.config.js        # PostCSS configuration
├── docker-compose.yml           # Production Docker setup
├── docker-compose.dev.yml       # Development Docker setup
├── env.example                  # Environment variables template
├── .dockerignore                # Docker ignore file
└── README.md                    # This file
```

## Development Scripts

### Frontend Scripts (run from frontend/ directory)
- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run preview`: Preview production build

### Docker Commands
- `docker-compose up`: Start production environment
- `docker-compose -f docker-compose.dev.yml up`: Start development environment
- `docker-compose down`: Stop all services
- `docker-compose logs backend`: View backend logs
- `docker-compose logs frontend`: View frontend logs

### Backend Commands (if running locally)
- `uvicorn main:app --reload`: Start FastAPI development server
- `python main.py`: Alternative way to start the server

## Production Deployment

The application is fully containerized and ready for production deployment:

1. **Set up environment variables**:
   - Copy `env.example` to `.env`
   - Add your Google Drive API key
   - Configure any additional environment variables

2. **Deploy with Docker Compose**:
   ```bash
   docker-compose up -d
   ```

3. **Behind a reverse proxy** (recommended):
   - Configure your reverse proxy to forward requests to port 3000
   - Set up SSL/TLS termination
   - Configure domain routing

## Customization

### Adding New Features

The app is built with modularity in mind. You can easily:

- Add new rating scales (beyond 1-5 stars)
- Implement different document types
- Add user roles and permissions
- Include advanced analytics and reporting

### Styling

The app uses Tailwind CSS for styling. You can customize:

- Color schemes in `tailwind.config.js`
- Component styles in the React components
- Layout and responsive design

## Security Considerations

For production deployment:

1. **API Key Security**: Store API keys in environment variables
2. **Access Control**: Implement proper user authentication
3. **Data Privacy**: Ensure compliance with data protection regulations
4. **HTTPS**: Use secure connections for all API calls

## Troubleshooting

### Common Issues

1. **Google Drive API Errors**: Ensure your API key is valid and the Drive API is enabled
2. **CORS Issues**: Make sure your domain is authorized in Google Cloud Console
3. **File Access**: Verify that the Google Drive folder has proper sharing permissions

### Support

For issues and questions:
- Check the browser console for error messages
- Verify Google Drive folder permissions
- Ensure all dependencies are properly installed

## License

This project is licensed under the MIT License - see the package.json file for details. 