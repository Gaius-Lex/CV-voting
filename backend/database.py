import json
import os
from datetime import datetime, timedelta

from google.oauth2.credentials import Credentials
from sqlalchemy import JSON, Column, DateTime, String, Text, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://cvvoting:cvvoting@db:5432/cvvoting")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class UserSession(Base):
    __tablename__ = "user_sessions"
    
    user_id = Column(String, primary_key=True)  # Using email as primary key
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    picture = Column(String, nullable=True)
    credentials_json = Column(Text, nullable=False)  # Serialized credentials
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
    
    def set_credentials(self, credentials: Credentials):
        """Store Google credentials as JSON"""
        creds_dict = {
            'token': credentials.token,
            'refresh_token': credentials.refresh_token,
            'token_uri': credentials.token_uri,
            'client_id': credentials.client_id,
            'client_secret': credentials.client_secret,
            'scopes': credentials.scopes,
            'expiry': credentials.expiry.isoformat() if credentials.expiry else None
        }
        self.credentials_json = json.dumps(creds_dict)
        
        # Set session expiry based on token expiry
        if credentials.expiry:
            self.expires_at = credentials.expiry
        else:
            # Default to 1 hour if no expiry
            self.expires_at = datetime.utcnow() + timedelta(hours=1)
    
    def get_credentials(self) -> Credentials:
        """Retrieve Google credentials from JSON"""
        creds_dict = json.loads(self.credentials_json)
        
        # Parse expiry back to datetime
        expiry = None
        if creds_dict.get('expiry'):
            from datetime import datetime
            expiry = datetime.fromisoformat(creds_dict['expiry'])
        
        return Credentials(
            token=creds_dict.get('token'),
            refresh_token=creds_dict.get('refresh_token'),
            token_uri=creds_dict.get('token_uri'),
            client_id=creds_dict.get('client_id'),
            client_secret=creds_dict.get('client_secret'),
            scopes=creds_dict.get('scopes'),
            expiry=expiry
        )
    
    def is_expired(self) -> bool:
        """Check if the session has expired"""
        if not self.expires_at:
            return False
        return datetime.utcnow() > self.expires_at

def create_tables():
    """Create database tables"""
    Base.metadata.create_all(bind=engine)

def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_user_session(db, user_id: str) -> UserSession:
    """Get user session by user_id"""
    return db.query(UserSession).filter(UserSession.user_id == user_id).first()

def create_or_update_user_session(db, user_id: str, name: str, email: str, picture: str, credentials: Credentials) -> UserSession:
    """Create or update user session"""
    session = get_user_session(db, user_id)
    
    if session:
        # Update existing session
        session.name = name
        session.email = email
        session.picture = picture
        session.set_credentials(credentials)
        session.updated_at = datetime.utcnow()
    else:
        # Create new session
        session = UserSession(
            user_id=user_id,
            name=name,
            email=email,
            picture=picture
        )
        session.set_credentials(credentials)
        db.add(session)
    
    db.commit()
    db.refresh(session)
    return session

def delete_user_session(db, user_id: str):
    """Delete user session"""
    session = get_user_session(db, user_id)
    if session:
        db.delete(session)
        db.commit()

def cleanup_expired_sessions(db):
    """Remove expired sessions"""
    expired_sessions = db.query(UserSession).filter(
        UserSession.expires_at < datetime.utcnow()
    ).all()
    
    for session in expired_sessions:
        db.delete(session)
    
    db.commit()
    return len(expired_sessions) 