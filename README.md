# CV Voting App

A collaborative CV evaluation and voting application with AI-powered features that integrates with Google Drive for document management and automated score tracking.

## Features

### Core Functionality
- **Google OAuth2 Authentication**: Secure authentication with Google Drive integration
- **Google Drive Integration**: Load CVs directly from Google Drive folders with full API access
- **Star Rating System**: Rate CVs from 1-5 stars with visual feedback
- **Comments System**: Add, edit, and delete detailed feedback on each CV
- **Real-time Collaboration**: Multiple users can vote and comment simultaneously
- **Auto-save**: Automatic score saving with visual indicators
- **Manual Refresh**: Refresh scores from Google Drive without page reload
- **Document Preview**: View CVs directly in the app with full-screen modal preview

### AI-Powered Features
- **AI CV Grading**: Automated CV evaluation using OpenAI GPT-4o
- **Smart Rejection Letters**: Generate personalized rejection letters in multiple languages
- **Smart Acceptance Letters**: Generate welcoming acceptance letters in multiple languages
- **Multi-language Support**: Generate letters in English, Polish, Spanish, French, and German

### User Experience
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **User Profiles**: Display user avatars and information from Google accounts
- **Average Ratings**: See overall ratings and total voter count for each CV
- **Comment Management**: Edit and delete your own comments inline
- **Loading States**: Clear visual feedback during operations
- **Error Handling**: Comprehensive error messages and recovery options

## Technologies Used

### Frontend
- **React 18**: Modern React with hooks
- **Vite**: Fast development and build tool
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Beautiful icon library

### Backend
- **FastAPI**: Modern, fast Python web framework with async support
- **Uvicorn**: ASGI server for FastAPI
- **Google APIs**: Google Drive API, OAuth2, and user profile integration
- **OpenAI GPT-4**: AI-powered CV grading and letter generation
- **Pydantic**: Data validation and settings management
- **python-dotenv**: Environment variable management
- **SQLAlchemy**: Database ORM for user session management
- **PyPDF2**: PDF text extraction for AI analysis

### Infrastructure
- **Docker & Docker Compose**: Containerization and orchestration
- **Nginx**: Reverse proxy, static file serving, and API routing
- **PostgreSQL**: Database for user sessions and authentication
- **Google Drive API**: Document storage and management
- **Google OAuth2**: Secure authentication

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Google Cloud account (for OAuth2)
- OpenAI account (for AI features)

### Development Setup

1. **Clone and navigate to project**:
   ```bash
   cd misc/cv-voting
   ```

2. **Configure environment**:
   ```bash
   cp env.example .env
   # Edit .env with your API keys (see API Setup section below)
   ```

3. **Start development environment**:
   ```bash
   docker-compose -f docker-compose.dev.yml up --build
   ```

4. **Access the application**:
   - Frontend: http://localhost:3123
   - Backend API: http://localhost:8000

### Production Deployment with ngrok

1. **Set up environment variables for production**:
   ```bash
   # Update .env with production values
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   OPENAI_API_KEY=your_openai_key
   REDIRECT_URI=https://your-ngrok-domain.ngrok-free.app/auth/callback
   ```

2. **Start the application**:
   ```bash
   docker-compose up --build -d
   ```

3. **Expose with ngrok**:
   ```bash
   ngrok http 80
   ```

4. **Update redirect URI**:
   - Copy your ngrok URL (e.g., `https://abc123.ngrok-free.app`)
   - Update `REDIRECT_URI` in your `.env` file
   - Update the redirect URI in your Google Cloud Console
   - Restart the application

### API Setup (Required for Production)

#### Google OAuth2 Setup

1. **Create a Google Cloud Project**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one

2. **Enable Required APIs**:
   - Navigate to "APIs & Services" > "Library"
   - Enable "Google Drive API"
   - Enable "Google OAuth2 API"

3. **Create OAuth2 Credentials**:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Set authorized redirect URIs (e.g., `http://localhost:8000/auth/callback`)
   - Copy your Client ID and Client Secret

4. **Configure Environment Variables**:
   ```bash
   GOOGLE_CLIENT_ID=your_client_id_here
   GOOGLE_CLIENT_SECRET=your_client_secret_here
   REDIRECT_URI=http://localhost:8000/auth/callback
   ```

#### OpenAI API Setup (For AI Features)

1. **Get OpenAI API Key**:
   - Go to [OpenAI Platform](https://platform.openai.com/)
   - Create an account and get your API key

2. **Configure Environment Variable**:
   ```bash
   OPENAI_API_KEY=sk-your_openai_api_key_here
   ```

## Usage Guide

### Getting Started

1. **Authenticate with Google**:
   - Click "Authorize with Google" to connect your Google Drive account
   - Grant permissions for Drive access and user profile
   - You'll be redirected back to the app once authenticated

2. **Connect Google Drive Folder**:
   - Create a folder in Google Drive containing CV files (PDF format)
   - Copy the folder URL and paste it into the app
   - The app will automatically load all PDF files from the folder

3. **Start Evaluating CVs**:
   - **Rate CVs**: Use the star system (1-5 stars) to rate each CV
   - **Add Comments**: Provide detailed feedback on each CV
   - **Edit Comments**: Click the edit icon to modify your comments
   - **Preview CVs**: Click "Preview CV" to view documents in a modal
   - **Auto-save**: Your votes and comments are automatically saved

### AI-Powered Features

#### AI CV Grading
1. **Click "Grade with AI"** on any CV
2. **Provide a position description** that describes the role requirements
3. **Select language** for the AI analysis (English, Polish, Spanish, French, German)
4. **Get instant feedback** with a rating (1-5) and detailed analysis
5. **AI comments are added automatically** and labeled as "Grading bot"

#### Smart Letter Generation
1. **Generate Rejection Letters**:
   - Click "Generate Rejection Letter" for any CV
   - Choose language and customize company/position details
   - AI generates a professional, personalized rejection letter
   - Based on average rating and reviewer comments

2. **Generate Acceptance Letters**:
   - Click "Generate Acceptance Letter" for highly-rated CVs
   - Customize company and position information
   - AI creates welcoming, enthusiastic acceptance letters
   - Incorporates positive feedback from reviewers

#### Collaboration Features
- **Refresh Scores**: Click "Refresh Scores" to see latest votes from team members
- **Real-time Updates**: Auto-save ensures everyone sees current data
- **Comment Editing**: Edit or delete your own comments anytime
- **Multi-user Support**: Multiple team members can evaluate simultaneously

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

## Useful Commands

### Development
- `docker-compose -f docker-compose.dev.yml up --build`: Start development with rebuild
- `docker-compose -f docker-compose.dev.yml down`: Stop development environment
- `docker-compose -f docker-compose.dev.yml logs backend`: View backend logs
- `docker-compose -f docker-compose.dev.yml logs frontend`: View frontend logs

### Production
- `docker-compose up --build -d`: Start production environment
- `docker-compose down`: Stop production environment
- `docker-compose logs`: View all logs
- `ngrok http 80`: Expose local port 80 to internet

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

1. **Google OAuth2 Errors**: 
   - Ensure your Client ID and Client Secret are correct
   - Verify redirect URIs are properly configured in Google Cloud Console
   - Check that Google Drive API and OAuth2 API are enabled

2. **AI Features Not Working**: 
   - Verify your OpenAI API key is valid and has sufficient credits
   - Check that the OPENAI_API_KEY environment variable is properly set
   - Ensure you have access to GPT-4 API (required for AI grading)

3. **Authentication Issues**: 
   - Clear browser cookies and local storage if stuck in auth loop
   - Verify the REDIRECT_URI matches your Google Cloud Console settings
   - Check that your domain is authorized in Google Cloud Console

4. **File Access Problems**: 
   - Ensure the user has access to the Google Drive folder
   - Verify that PDF files are properly formatted and not corrupted
   - Check that the folder URL is correct and publicly accessible

5. **Database Connection**: 
   - Verify PostgreSQL is running (check Docker containers)
   - Ensure DATABASE_URL environment variable is correct
   - Check database permissions and connectivity

### Support

For issues and questions:
- Check the browser console for error messages
- Verify Google Drive folder permissions
- Ensure all dependencies are properly installed

## License

This project is licensed under the MIT License - see the package.json file for details. 