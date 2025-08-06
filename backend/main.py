import base64
import csv
import io
import json
import logging
import os
import pickle
from datetime import datetime
from logging import getLogger
from typing import Any, Dict, List, Optional

import httpx
import openai
import PyPDF2
import requests
from database import (
    UserSession,
    cleanup_expired_sessions,
    create_or_update_user_session,
    create_tables,
    delete_user_session,
    get_db,
    get_user_session,
)
from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
from pydantic import BaseModel
from sqlalchemy.orm import Session

logger = getLogger(__name__)
logging.basicConfig(level=logging.INFO)

BASE_DOMAIN = os.getenv("BASE_DOMAIN", "http://localhost:8000")

app = FastAPI(title="CV Voting API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3123", 
        "http://localhost:3000",  # Keep for local development
        "http://127.0.0.1:3123",
        "http://127.0.0.1:3000",
        BASE_DOMAIN,
        "*"  # Allow all origins for development (remove in production)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# OAuth2 configuration
SCOPES = [
    'openid',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email'
]

# Google OAuth2 credentials - can be loaded from .env or credentials.json
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_CLIENT_SECRETS_FILE = os.getenv("GOOGLE_CLIENT_SECRETS_FILE", "credentials.json")
REDIRECT_URI = os.getenv("REDIRECT_URI", "http://localhost:8000/auth/callback")


# OpenAI configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if OPENAI_API_KEY:
    openai.api_key = OPENAI_API_KEY

# Initialize database on startup
create_tables()

# Pydantic models
class VoteRequest(BaseModel):
    document_id: str
    voter_name: str
    rating: int
    comment: Optional[str] = ""

class DocumentResponse(BaseModel):
    id: str
    name: str
    mimeType: str
    webViewLink: str
    webContentLink: str

class AuthUrl(BaseModel):
    auth_url: str

class UserProfile(BaseModel):
    name: str
    email: str
    picture: Optional[str] = None

class RejectionRequest(BaseModel):
    document_name: str
    candidate_name: Optional[str] = None
    language: str = "en"  # en, pl, es, fr, de, etc.
    comments: List[str] = []
    average_rating: Optional[float] = None
    company_name: Optional[str] = "Our Company"
    position: Optional[str] = "the position"

class RejectionResponse(BaseModel):
    letter: str
    language: str
    subject: str

class AcceptanceRequest(BaseModel):
    document_name: str
    language: str = "en"  
    comments: List[str] = []
    average_rating: Optional[float] = None
    candidate_name: Optional[str] = None
    company_name: str = "Our Company"
    position: str = "this position"

class AcceptanceResponse(BaseModel):
    letter: str
    language: str
    subject: str

class GradingRequest(BaseModel):
    document_id: str
    document_name: str
    position_description: str
    language: str = "en"

class GradingResponse(BaseModel):
    comment: str
    rating: int
    language: str

def get_google_drive_service(user_id: str, db: Session):
    """Get authenticated Google Drive service"""
    user_session = get_user_session(db, user_id)
    if not user_session or user_session.is_expired():
        raise HTTPException(status_code=401, detail="User not authenticated. Please authorize first.")
    
    creds = user_session.get_credentials()
    
    # Refresh token if expired
    if creds.expired and creds.refresh_token:
        creds.refresh(GoogleRequest())
        # Update credentials in database
        user_session.set_credentials(creds)
        db.commit()
    
    return build('drive', 'v3', credentials=creds)

def get_user_profile_service(user_id: str, db: Session):
    """Get authenticated Google OAuth2 service for user profile"""
    user_session = get_user_session(db, user_id)
    if not user_session or user_session.is_expired():
        raise HTTPException(status_code=401, detail="User not authenticated. Please authorize first.")
    
    creds = user_session.get_credentials()
    
    # Refresh token if expired
    if creds.expired and creds.refresh_token:
        creds.refresh(GoogleRequest())
        # Update credentials in database
        user_session.set_credentials(creds)
        db.commit()
    
    return build('oauth2', 'v2', credentials=creds)

@app.get("/")
async def root():
    return {"message": "CV Voting API is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}

@app.get("/auth/url", response_model=AuthUrl)
async def get_auth_url():
    """Get Google OAuth2 authorization URL"""
    try:
        # Try to use environment variables first, fall back to credentials.json
        if GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET:
            # Create flow from environment variables
            client_config = {
                "web": {
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [REDIRECT_URI]
                }
            }
            flow = Flow.from_client_config(client_config, scopes=SCOPES)
            logger.info("Using Google OAuth credentials from environment variables")
        else:
            # Fall back to credentials.json file
            if not os.path.exists(GOOGLE_CLIENT_SECRETS_FILE):
                logger.error(f"Google client secrets file not found: {GOOGLE_CLIENT_SECRETS_FILE}")
                raise HTTPException(
                    status_code=500, 
                    detail=f"Google OAuth credentials not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables or provide {GOOGLE_CLIENT_SECRETS_FILE}"
                )
            
            flow = Flow.from_client_secrets_file(
                GOOGLE_CLIENT_SECRETS_FILE,
                scopes=SCOPES
            )
            logger.info(f"Using Google OAuth credentials from file: {GOOGLE_CLIENT_SECRETS_FILE}")
        
        flow.redirect_uri = REDIRECT_URI
        
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true'
        )
        
        return AuthUrl(auth_url=authorization_url)
        
    except Exception as e:
        logger.exception("Failed to create authorization URL")
        raise HTTPException(status_code=500, detail=f"Failed to create authorization URL: {str(e)}")

@app.get("/auth/callback")
async def auth_callback(request: Request, db: Session = Depends(get_db)):
    """Handle OAuth2 callback"""
    try:
        # Get the authorization code from query parameters
        code = request.query_params.get('code')
        if not code:
            raise HTTPException(status_code=400, detail="Authorization code not found")
        
        # Use the same logic as get_auth_url for consistency
        if GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET:
            # Create flow from environment variables
            client_config = {
                "web": {
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [REDIRECT_URI]
                }
            }
            flow = Flow.from_client_config(client_config, scopes=SCOPES)
        else:
            # Fall back to credentials.json file
            flow = Flow.from_client_secrets_file(
                GOOGLE_CLIENT_SECRETS_FILE,
                scopes=SCOPES
            )
        flow.redirect_uri = REDIRECT_URI
        
        # Exchange authorization code for credentials
        flow.fetch_token(code=code)
        
        # Get user info to create session
        try:
            user_service = build('oauth2', 'v2', credentials=flow.credentials)
            user_info = user_service.userinfo().get().execute()
            
            user_id = user_info.get('email') or user_info.get('id')  # Use email or Google ID as user ID
            name = user_info.get('name', 'Unknown User')
            email = user_info.get('email', '')
            picture = user_info.get('picture', '')
            
            # Ensure we have a valid user_id
            if not user_id:
                logger.error("No valid user ID found in user info")
                return RedirectResponse(url=f"{BASE_DOMAIN}?auth=error")
            
            # Store credentials and user info in database
            create_or_update_user_session(
                db, user_id, name, email, picture, flow.credentials
            )
            
            # Redirect to frontend with success and user_id
            return RedirectResponse(url=f"{BASE_DOMAIN}?auth=success&user_id={user_id}")
            
        except Exception as user_error:
            logger.exception("Failed to get user info")
            return RedirectResponse(url=f"{BASE_DOMAIN}?auth=error")
        
    except Exception as e:
        logger.exception("Failed to handle OAuth callback")
        return RedirectResponse(url=f"{BASE_DOMAIN}?auth=error")

@app.get("/auth/status")
async def auth_status(user_id: str = None, db: Session = Depends(get_db)):
    """Check if user is authenticated"""
    if not user_id:
        return {"authenticated": False}
    
    user_session = get_user_session(db, user_id)
    if user_session and not user_session.is_expired():
        return {"authenticated": True, "user_id": user_id}
    
    return {"authenticated": False}

@app.get("/auth/profile", response_model=UserProfile)
async def get_user_profile(user_id: str, db: Session = Depends(get_db)):
    """Get user profile information from database"""
    try:
        user_session = get_user_session(db, user_id)
        if not user_session or user_session.is_expired():
            raise HTTPException(status_code=401, detail="User not authenticated")
        
        return UserProfile(
            name=user_session.name,
            email=user_session.email,
            picture=user_session.picture
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to get user profile")
        raise HTTPException(status_code=500, detail=f"Failed to get user profile: {str(e)}")

@app.get("/documents/{folder_id}", response_model=List[DocumentResponse])
async def get_documents(folder_id: str, user_id: str, db: Session = Depends(get_db)):
    """Get all PDF documents from a Google Drive folder"""
    try:
        service = get_google_drive_service(user_id, db)
        
        # List files in the folder
        query = f"'{folder_id}' in parents and mimeType='application/pdf' and name != 'scores.csv'"
        results = service.files().list(
            q=query,
            fields="files(id,name,mimeType,webViewLink,webContentLink)"
        ).execute()
        
        files = results.get('files', [])
        return [
            DocumentResponse(
                id=file['id'],
                name=file['name'],
                mimeType=file['mimeType'],
                webViewLink=file['webViewLink'],
                webContentLink=file['webContentLink']
            )
            for file in files
        ]
        
    except Exception as e:
        logger.exception("Failed to get documents")
        raise HTTPException(status_code=500, detail=f"Failed to get documents: {str(e)}")

@app.get("/scores/{folder_id}")
async def get_scores(folder_id: str, user_id: str, db: Session = Depends(get_db)):
    """Load existing scores from scores.csv in the Google Drive folder"""
    try:
        service = get_google_drive_service(user_id, db)
        
        # Find scores.csv file
        query = f"'{folder_id}' in parents and name='scores.csv'"
        results = service.files().list(q=query).execute()
        files = results.get('files', [])
        
        if not files:
            return {"votes": {}, "comments": {}}
        
        # Download the CSV content
        scores_file_id = files[0]['id']
        request = service.files().get_media(fileId=scores_file_id)
        
        # Execute the request and get content
        csv_content = request.execute().decode('utf-8')
        
        # Parse CSV data
        lines = csv_content.strip().split('\n')
        if len(lines) <= 1:  # Only header or empty
            return {"votes": {}, "comments": {}}
        
        votes = {}
        comments = {}
        
        # Parse CSV with proper handling
        csv_reader = csv.reader(lines)
        header = next(csv_reader)  # Skip header
        
        for row in csv_reader:
            if len(row) >= 3:
                doc_id, voter, rating = row[0], row[1], row[2]
                comment = row[3] if len(row) > 3 else ""
                
                try:
                    rating = int(rating)
                except ValueError:
                    continue
                
                if doc_id not in votes:
                    votes[doc_id] = {}
                if doc_id not in comments:
                    comments[doc_id] = {}
                
                votes[doc_id][voter] = rating
                if comment:
                    comments[doc_id][voter] = comment
        
        return {"votes": votes, "comments": comments}
        
    except Exception as e:
        logger.exception("Failed to load scores")
        # Return empty data on error - let the frontend handle it gracefully
        return {"votes": {}, "comments": {}}

@app.post("/scores/{folder_id}")
async def save_scores(folder_id: str, scores_data: dict[str, Any], user_id: str, db: Session = Depends(get_db)):
    """Save scores to scores.csv in the Google Drive folder"""
    try:
        service = get_google_drive_service(user_id, db)
        
        votes = scores_data.get("votes", {})
        comments = scores_data.get("comments", {})
        
        # Debug logging
        logger.info(f"Received votes: {votes}")
        logger.info(f"Received comments: {comments}")
        
        # Create CSV content
        csv_buffer = io.StringIO()
        csv_writer = csv.writer(csv_buffer)
        
        # Write header
        csv_writer.writerow(['document_id', 'voter_name', 'rating', 'comment'])
        
        # Write data - collect all voters from both votes and comments
        all_docs = set(votes.keys()) | set(comments.keys())
        
        for doc_id in all_docs:
            doc_votes = votes.get(doc_id, {})
            doc_comments = comments.get(doc_id, {})
            
            # Get all voters who either voted or commented
            all_voters = set(doc_votes.keys()) | set(doc_comments.keys())
            
            for voter in all_voters:
                rating = doc_votes.get(voter, 0)  # Default to 0 if no rating
                comment = doc_comments.get(voter, "")
                logger.info(f"Writing row: {doc_id}, {voter}, {rating}, '{comment}'")
                csv_writer.writerow([doc_id, voter, rating, comment])
        
        csv_content = csv_buffer.getvalue()
        logger.info(f"Generated CSV content:\n{csv_content}")
        csv_buffer.close()
        
        # Check if scores.csv already exists
        query = f"'{folder_id}' in parents and name='scores.csv'"
        results = service.files().list(q=query).execute()
        existing_files = results.get('files', [])
        
        # Create media upload
        media = MediaIoBaseUpload(
            io.BytesIO(csv_content.encode('utf-8')),
            mimetype='text/csv'
        )
        
        if existing_files:
            # Update existing file
            file_id = existing_files[0]['id']
            logger.info(f"Updating existing CSV file with ID: {file_id}")
            result = service.files().update(
                fileId=file_id,
                media_body=media
            ).execute()
            logger.info(f"Update result: {result}")
        else:
            # Create new file
            file_metadata = {
                'name': 'scores.csv',
                'parents': [folder_id]
            }
            logger.info(f"Creating new CSV file in folder: {folder_id}")
            result = service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id'
            ).execute()
            logger.info(f"Create result: {result}")
        
        logger.info("CSV file saved successfully to Google Drive")
        return {"message": "Scores saved successfully"}
        
    except Exception as e:
        logger.exception("Failed to save scores")
        raise HTTPException(status_code=500, detail=f"Failed to save scores: {str(e)}")

@app.post("/vote")
async def submit_vote(vote: VoteRequest):
    """Submit a vote (this endpoint could be used for real-time updates)"""
    if not (1 <= vote.rating <= 5):
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    
    return {"message": "Vote received", "vote": vote.dict()}

@app.get("/queue/{folder_id}")
async def get_queue(folder_id: str, user_id: str, db: Session = Depends(get_db)):
    """Load existing queue from queue.txt in the Google Drive folder"""
    try:
        service = get_google_drive_service(user_id, db)
        
        # Find queue.txt file
        query = f"'{folder_id}' in parents and name='queue.txt'"
        results = service.files().list(q=query).execute()
        files = results.get('files', [])
        
        if not files:
            return {"queue": []}
        
        # Download the txt content
        queue_file_id = files[0]['id']
        request = service.files().get_media(fileId=queue_file_id)
        
        # Execute the request and get content
        txt_content = request.execute().decode('utf-8')
        
        # Parse the queue data (JSON format)
        try:
            queue_data = json.loads(txt_content) if txt_content.strip() else []
            return {"queue": queue_data}
        except json.JSONDecodeError:
            logger.error("Failed to parse queue.txt content")
            return {"queue": []}
        
    except Exception as e:
        logger.exception("Failed to load queue")
        # Return empty queue on error
        return {"queue": []}

@app.post("/queue/{folder_id}")
async def save_queue(folder_id: str, queue_data: dict[str, Any], user_id: str, db: Session = Depends(get_db)):
    """Save queue to queue.txt in the Google Drive folder"""
    try:
        service = get_google_drive_service(user_id, db)
        
        queue = queue_data.get("queue", [])
        
        # Create JSON content
        json_content = json.dumps(queue, indent=2)
        
        # Check if queue.txt already exists
        query = f"'{folder_id}' in parents and name='queue.txt'"
        results = service.files().list(q=query).execute()
        existing_files = results.get('files', [])
        
        # Create media upload
        media = MediaIoBaseUpload(
            io.BytesIO(json_content.encode('utf-8')),
            mimetype='text/plain'
        )
        
        if existing_files:
            # Update existing file
            file_id = existing_files[0]['id']
            logger.info(f"Updating existing queue file with ID: {file_id}")
            result = service.files().update(
                fileId=file_id,
                media_body=media
            ).execute()
            logger.info(f"Update result: {result}")
        else:
            # Create new file
            file_metadata = {
                'name': 'queue.txt',
                'parents': [folder_id]
            }
            logger.info(f"Creating new queue file in folder: {folder_id}")
            result = service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id'
            ).execute()
            logger.info(f"Create result: {result}")
        
        logger.info("Queue file saved successfully to Google Drive")
        return {"message": "Queue saved successfully"}
        
    except Exception as e:
        logger.exception("Failed to save queue")
        raise HTTPException(status_code=500, detail=f"Failed to save queue: {str(e)}")

@app.post("/generate-rejection", response_model=RejectionResponse)
async def generate_rejection_letter(request: RejectionRequest):
    """Generate AI-powered rejection letter based on comments and ratings"""
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")
    
    try:
        # Extract candidate name from document name if not provided
        candidate_name = request.candidate_name
        if not candidate_name:
            # Try to extract name from filename (remove .pdf, _CV, etc.)
            candidate_name = request.document_name.replace('.pdf', '').replace('_CV', '').replace('_Resume', '').replace('_', ' ').replace('-', ' ').strip()
        
        # Prepare context for AI
        comments_text = "\n".join([f"- {comment}" for comment in request.comments if comment.strip()])
        rating_context = ""
        if request.average_rating is not None:
            rating_context = f"Average rating: {request.average_rating:.1f}/5.0"
        
        # Language-specific prompts and templates
        language_configs = {
            "en": {
                "prompt_lang": "English",
                "subject_template": "Application Update - {position}",
                "salutation": "Dear {candidate_name},"
            },
            "pl": {
                "prompt_lang": "Polish",
                "subject_template": "Aktualizacja aplikacji - {position}",
                "salutation": "Szanowny/a {candidate_name},"
            },
            "es": {
                "prompt_lang": "Spanish",
                "subject_template": "Actualización de solicitud - {position}",
                "salutation": "Estimado/a {candidate_name},"
            },
            "fr": {
                "prompt_lang": "French",
                "subject_template": "Mise à jour de candidature - {position}",
                "salutation": "Cher/Chère {candidate_name},"
            },
            "de": {
                "prompt_lang": "German",
                "subject_template": "Bewerbungsupdate - {position}",
                "salutation": "Liebe/r {candidate_name},"
            }
        }
        
        lang_config = language_configs.get(request.language, language_configs["en"])
        
        # Create AI prompt
        prompt = f"""Write a professional, respectful job application rejection letter in {lang_config['prompt_lang']}.

Context:
- Candidate: {candidate_name}
- Company: {request.company_name}
- Position: {request.position}
{rating_context}

Feedback from reviewers:
{comments_text if comments_text else "No specific feedback provided"}

Requirements:
1. Be professional and respectful
2. Thank the candidate for their interest
3. If there are specific comments, incorporate constructive feedback tactfully
4. Encourage future applications if appropriate
5. Keep it concise but warm
6. Use proper business letter format
7. Write in {lang_config['prompt_lang']} language

Do not include company letterhead, addresses, or dates - just the letter content starting with the salutation."""

        # Generate letter using OpenAI
        response = openai.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a professional HR expert who writes empathetic and constructive rejection letters."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=800,
            temperature=0.7
        )
        
        letter_content = response.choices[0].message.content.strip()
        
        # Generate subject line
        subject = lang_config["subject_template"].format(position=request.position)
        
        return RejectionResponse(
            letter=letter_content,
            language=request.language,
            subject=subject
        )
        
    except Exception as e:
        logger.exception("Failed to generate rejection letter")
        raise HTTPException(status_code=500, detail=f"Failed to generate rejection letter: {str(e)}")

@app.post("/generate-acceptance", response_model=AcceptanceResponse)
async def generate_acceptance_letter(request: AcceptanceRequest):
    """Generate AI-powered acceptance letter based on comments and ratings"""
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")
    
    try:
        # Extract candidate name from document name if not provided
        candidate_name = request.candidate_name
        if not candidate_name:
            # Try to extract name from filename (remove .pdf, _CV, etc.)
            candidate_name = request.document_name.replace('.pdf', '').replace('_CV', '').replace('_Resume', '').replace('_', ' ').replace('-', ' ').strip()
        
        # Prepare context for AI
        comments_text = "\n".join([f"- {comment}" for comment in request.comments if comment.strip()])
        rating_context = ""
        if request.average_rating is not None:
            rating_context = f"Average rating: {request.average_rating:.1f}/5.0"
        
        # Language-specific prompts and templates
        language_configs = {
            "en": {
                "prompt_lang": "English",
                "subject_template": "Job Offer - {position} Position",
                "salutation": "Dear {candidate_name},"
            },
            "pl": {
                "prompt_lang": "Polish",
                "subject_template": "Oferta pracy - stanowisko {position}",
                "salutation": "Szanowny/a {candidate_name},"
            },
            "es": {
                "prompt_lang": "Spanish",
                "subject_template": "Oferta de trabajo - Posición {position}",
                "salutation": "Estimado/a {candidate_name},"
            },
            "fr": {
                "prompt_lang": "French",
                "subject_template": "Offre d'emploi - Poste {position}",
                "salutation": "Cher/Chère {candidate_name},"
            },
            "de": {
                "prompt_lang": "German",
                "subject_template": "Stellenangebot - Position {position}",
                "salutation": "Liebe/r {candidate_name},"
            }
        }
        
        lang_config = language_configs.get(request.language, language_configs["en"])
        
        # Create AI prompt for acceptance letter
        prompt = f"""Write a professional, welcoming job offer acceptance letter in {lang_config['prompt_lang']}.

Context:
- Candidate: {candidate_name}
- Company: {request.company_name}
- Position: {request.position}
{rating_context}

Positive feedback from reviewers:
{comments_text if comments_text else "Strong positive impression from the review team"}

Requirements:
1. Be professional and enthusiastic
2. Congratulate the candidate on being selected
3. If there are specific positive comments, incorporate them to highlight strengths
4. Express excitement about having them join the team
5. Mention next steps (HR will contact them soon)
6. Keep it warm and welcoming but professional
7. Use proper business letter format
8. Write in {lang_config['prompt_lang']} language

Do not include company letterhead, addresses, or dates - just the letter content starting with the salutation."""

        # Generate letter using OpenAI
        response = openai.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a professional HR expert who writes welcoming and enthusiastic job offer letters."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=800,
            temperature=0.7
        )
        
        letter_content = response.choices[0].message.content.strip()
        
        # Generate subject line
        subject = lang_config["subject_template"].format(position=request.position)
        
        return AcceptanceResponse(
            letter=letter_content,
            language=request.language,
            subject=subject
        )
        
    except Exception as e:
        logger.exception("Failed to generate acceptance letter")
        raise HTTPException(status_code=500, detail=f"Failed to generate acceptance letter: {str(e)}")

@app.post("/grade-cv", response_model=GradingResponse)
async def grade_cv(request: GradingRequest, user_id: str, db: Session = Depends(get_db)):
    """AI-powered CV grading agent that analyzes CV against position description"""
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")
    
    try:
        # Get Google Drive service for the user
        service = get_google_drive_service(user_id, db)
        
        # Download the PDF file from Google Drive
        pdf_request = service.files().get_media(fileId=request.document_id)
        pdf_content = pdf_request.execute()
        
        # Extract text from PDF
        pdf_text = ""
        try:
            pdf_file = io.BytesIO(pdf_content)
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            
            for page in pdf_reader.pages:
                pdf_text += page.extract_text() + "\n"
                
        except Exception as pdf_error:
            logger.error(f"Failed to extract text from PDF: {pdf_error}")
            pdf_text = "[Could not extract text from PDF - file may be image-based or corrupted]"
        
        # Extract candidate name from document name if possible
        candidate_name = request.document_name.replace('.pdf', '').replace('_CV', '').replace('_Resume', '').replace('_', ' ').replace('-', ' ').strip()
        
        # Language-specific prompts
        language_configs = {
            "en": {
                "prompt_lang": "English",
                "grade_intro": "Professional CV Analysis",
            },
            "pl": {
                "prompt_lang": "Polish", 
                "grade_intro": "Profesjonalna Analiza CV",
            },
            "es": {
                "prompt_lang": "Spanish",
                "grade_intro": "Análisis Profesional de CV",
            },
            "fr": {
                "prompt_lang": "French",
                "grade_intro": "Analyse Professionnelle de CV",
            },
            "de": {
                "prompt_lang": "German", 
                "grade_intro": "Professionelle CV-Analyse",
            }
        }
        
        lang_config = language_configs.get(request.language, language_configs["en"])
        
        # Create AI prompt for CV grading
        prompt = f"""You are an expert HR professional and CV evaluator. Analyze this CV against the given position requirements and provide a comprehensive evaluation in {lang_config['prompt_lang']}.

Position Description:
{request.position_description}

CV Content:
{pdf_text[:4000]}  # Limit text to avoid token limits

Candidate: {candidate_name}

Please provide:
1. A detailed evaluation comment (2-3 paragraphs) covering:
   - How well the candidate matches the position requirements
   - Key strengths and relevant experience
   - Areas where the candidate may need development
   - Overall assessment of fit for the role

2. A numerical rating from 1-5 where:
   - 1 = Poor fit, major gaps in requirements
   - 2 = Below average fit, several important gaps
   - 3 = Average fit, meets basic requirements
   - 4 = Good fit, meets most requirements well
   - 5 = Excellent fit, exceeds requirements

Requirements:
- Be objective and professional
- Focus on job-relevant skills and experience
- Provide constructive feedback
- Write in {lang_config['prompt_lang']} language
- Be specific about strengths and weaknesses
- Consider both technical and soft skills

Format your response as:
RATING: [1-5]
COMMENT: [Your detailed evaluation]"""

        # Generate evaluation using OpenAI
        response = openai.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": f"You are a professional HR expert and CV evaluator. Provide thorough, objective assessments in {lang_config['prompt_lang']}."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=1000,
            temperature=0.3  # Lower temperature for more consistent evaluations
        )
        
        ai_response = response.choices[0].message.content.strip()
        
        # Parse the response to extract rating and comment
        lines = ai_response.split('\n')
        rating = 3  # Default rating
        comment = ai_response  # Default to full response
        
        for line in lines:
            if line.startswith('RATING:'):
                try:
                    rating = int(line.split(':')[1].strip())
                    rating = max(1, min(5, rating))  # Ensure rating is between 1-5
                except (ValueError, IndexError):
                    pass
            elif line.startswith('COMMENT:'):
                comment = line.split(':', 1)[1].strip()
                # Get remaining lines too
                remaining_lines = lines[lines.index(line)+1:]
                if remaining_lines:
                    comment += '\n' + '\n'.join(remaining_lines)
                break
        
        # Clean up comment - remove any remaining RATING: lines
        comment_lines = [line for line in comment.split('\n') if not line.startswith('RATING:')]
        comment = '\n'.join(comment_lines).strip()
        
        return GradingResponse(
            comment=comment,
            rating=rating,
            language=request.language
        )
        
    except Exception as e:
        logger.exception("Failed to grade CV")
        raise HTTPException(status_code=500, detail=f"Failed to grade CV: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 