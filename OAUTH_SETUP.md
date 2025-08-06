# Google Drive OAuth2 Setup Guide

This guide will help you set up Google Drive OAuth2 authentication for the CV Voting application.

## Prerequisites

- Google account
- Access to [Google Cloud Console](https://console.cloud.google.com/)

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top
3. Click "New Project"
4. Enter a project name (e.g., "CV Voting App")
5. Click "Create"

## Step 2: Enable Google Drive API

1. In your Google Cloud project, go to "APIs & Services" > "Library"
2. Search for "Google Drive API"
3. Click on "Google Drive API" and click "Enable"

## Step 3: Configure OAuth Consent Screen

1. Go to "APIs & Services" > "OAuth consent screen"
2. Choose "External" (unless you have a Google Workspace account)
3. Fill in the required fields:
   - **App name**: CV Voting App
   - **User support email**: Your email
   - **Developer contact information**: Your email
4. Click "Save and Continue"
5. On the "Scopes" page, click "Add or Remove Scopes"
6. Search for and add: `https://www.googleapis.com/auth/drive`
7. Click "Save and Continue"
8. On "Test users" page, add your email address if the app is in testing mode
9. Click "Save and Continue"

## Step 4: Create OAuth2 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Choose "Web application"
4. Name it "CV Voting App"
5. Under "Authorized redirect URIs", add:
   - `http://localhost:8000/auth/callback`
   - `http://127.0.0.1:8000/auth/callback`
6. Click "Create"

## Step 5: Download Credentials

1. After creating the OAuth client, click the download button (📥) next to your client ID
2. Save the file as `credentials.json` in the `backend/` directory
3. The file should look like this:
   ```json
   {
     "web": {
       "client_id": "your-client-id.googleusercontent.com",
       "project_id": "your-project-id",
       "auth_uri": "https://accounts.google.com/o/oauth2/auth",
       "token_uri": "https://oauth2.googleapis.com/token",
       "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
       "client_secret": "your-client-secret",
       "redirect_uris": ["http://localhost:8000/auth/callback"]
     }
   }
   ```

## Step 6: Set Up Environment Variables

1. Copy the environment example file:
   ```bash
   cp env.example .env
   ```

2. Update the `.env` file:
   ```env
   GOOGLE_CLIENT_SECRETS_FILE=credentials.json
   REDIRECT_URI=http://localhost:8000/auth/callback
   ENVIRONMENT=development
   VITE_API_BASE_URL=http://localhost:8000
   ```

## Step 7: Update Docker Volume Mapping

Make sure your `docker-compose.dev.yml` includes the credentials file:

```yaml
services:
  backend:
    volumes:
      - ./backend:/app
      - ./backend/credentials.json:/app/credentials.json  # Add this line
```

## Step 8: Test the Setup

1. Start the application:
   ```bash
   docker-compose -f docker-compose.dev.yml up
   ```

2. Open your browser and go to `http://localhost:3123`

3. Enter your name and click "Continue"

4. Click "Authenticate with Google Drive"

5. You should be redirected to Google's OAuth consent screen

6. Grant permissions and you should be redirected back to the application

## Security Notes

### For Development:
- The credentials.json file contains sensitive information
- Add `credentials.json` to your `.gitignore` file
- Never commit credentials to version control

### For Production:
- Use environment variables for sensitive data
- Set up proper domain and HTTPS
- Update redirect URIs to match your production domain
- Consider using Google Cloud Secret Manager

## Troubleshooting

### Common Issues:

1. **"redirect_uri_mismatch" error**:
   - Check that the redirect URI in Google Cloud Console matches exactly
   - Make sure you're using the correct port (8000 for backend)

2. **"Access blocked" error**:
   - Make sure you've added your email to test users (if app is in testing mode)
   - Verify that Google Drive API is enabled

3. **"credentials.json not found" error**:
   - Ensure the file is in the `backend/` directory
   - Check that Docker volume mapping is correct

4. **CORS errors**:
   - Verify that the frontend and backend are running on the correct ports
   - Check that CORS origins in the backend match your frontend URL

### Getting Help:

- Check the browser developer console for error messages
- Look at Docker logs: `docker-compose logs backend`
- Verify that all APIs are enabled in Google Cloud Console

## File Structure After Setup

```
cv-voting/
├── backend/
│   ├── credentials.json          # ← Your OAuth credentials (don't commit!)
│   ├── main.py
│   └── requirements.txt
├── .env                          # ← Your environment variables (don't commit!)
├── docker-compose.dev.yml
└── README.md
```

Remember to add these files to `.gitignore`:
```
credentials.json
.env
``` 