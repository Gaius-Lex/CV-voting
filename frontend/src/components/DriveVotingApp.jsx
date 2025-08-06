import React, { useState, useEffect } from 'react';
import { Star, FileText, Download, Users, BarChart3, MessageSquare, Save, RefreshCw, Shield, Sparkles, Copy, Mail, X, Edit3, Trash2, Check, Bot, Zap, Plus, List, GripVertical } from 'lucide-react';

const DriveVotingApp = () => {
  const [userId, setUserId] = useState('');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPicture, setUserPicture] = useState('');
  const [driveLink, setDriveLink] = useState('');
  const [folderId, setFolderId] = useState('');
  const [documents, setDocuments] = useState([]);
  const [votes, setVotes] = useState({});
  const [comments, setComments] = useState({});
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showComments, setShowComments] = useState({});
  const [newComment, setNewComment] = useState({});
  const [autoSaving, setAutoSaving] = useState(false);
  const [rejectionModal, setRejectionModal] = useState(null);
  const [generatingLetter, setGeneratingLetter] = useState(false);
  const [rejectionLetter, setRejectionLetter] = useState(null);
  const [editingComment, setEditingComment] = useState(null); // {docId, voter}
  const [editCommentText, setEditCommentText] = useState('');
  const [useAI, setUseAI] = useState(false);
  const [gradingModal, setGradingModal] = useState(null);
  const [positionDescription, setPositionDescription] = useState('');
  
  // Queue management state
  const [queue, setQueue] = useState([]);

  // Handle escape key to close modals
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setSelectedDoc(null);
        setRejectionModal(null);
        setGradingModal(null);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Check authentication status on page load
  useEffect(() => {
    checkAuthStatus();
    
    // Check for auth callback parameters
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('auth') === 'success') {
      const callbackUserId = urlParams.get('user_id');
      if (callbackUserId) {
        setUserId(callbackUserId);
        localStorage.setItem('userId', callbackUserId);
        setIsAuthenticated(true);
        fetchUserProfile(callbackUserId); // Fetch user profile after successful auth
        setError('Successfully authenticated with Google Drive!');
        setTimeout(() => setError(''), 3000);
      }
      // Remove auth parameters from URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get('auth') === 'error') {
      setError('Authentication failed. Please try again.');
    }

    // Check for stored user ID
    const storedUserId = localStorage.getItem('userId');
    if (storedUserId && !userId) {
      setUserId(storedUserId);
    }
  }, []);

  // Auto-save when votes or comments change
  useEffect(() => {
    // Only auto-save if we have data and are authenticated
    if (folderId && isAuthenticated && (Object.keys(votes).length > 0 || Object.keys(comments).length > 0)) {
      // Debounce auto-save to avoid too many API calls
      const timeoutId = setTimeout(() => {
        autoSave();
      }, 1000); // Save after 1 second of inactivity

      return () => clearTimeout(timeoutId);
    }
  }, [votes, comments, folderId, isAuthenticated]);

  // Check authentication status
  const checkAuthStatus = async (checkUserId = null) => {
    const userIdToCheck = checkUserId || userId || localStorage.getItem('userId');
    if (!userIdToCheck) {
      setIsAuthenticated(false);
      return;
    }

    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || '/api';
      const response = await fetch(`${apiUrl}/auth/status?user_id=${encodeURIComponent(userIdToCheck)}`);
      if (response.ok) {
        const data = await response.json();
        setIsAuthenticated(data.authenticated);
        
        // If authenticated, fetch user profile
        if (data.authenticated) {
          setUserId(userIdToCheck);
          await fetchUserProfile(userIdToCheck);
        } else {
          // Clear stored user ID if not authenticated
          localStorage.removeItem('userId');
          setUserId('');
        }
      }
    } catch (err) {
      console.log('Could not check auth status:', err);
      setIsAuthenticated(false);
    }
  };

  // Fetch user profile information from database
  const fetchUserProfile = async (profileUserId = null) => {
    const userIdToUse = profileUserId || userId;
    if (!userIdToUse) return;

    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || '/api';
      const response = await fetch(`${apiUrl}/auth/profile?user_id=${encodeURIComponent(userIdToUse)}`);
      if (response.ok) {
        const profile = await response.json();
        setUserName(profile.name);
        setUserEmail(profile.email);
        setUserPicture(profile.picture);
      }
    } catch (err) {
      console.log('Could not fetch user profile:', err);
      // Fallback to a default name if profile fetch fails
      setUserName('Unknown User');
    }
  };

  // Handle Google OAuth authentication
  const handleGoogleAuth = async () => {
    try {
      setLoading(true);
      const apiUrl = import.meta.env.VITE_API_BASE_URL || '/api';
      const response = await fetch(`${apiUrl}/auth/url`);
      
      if (response.ok) {
        const data = await response.json();
        // Redirect to Google OAuth
        window.location.href = data.auth_url;
      } else {
        const errorData = await response.json();
        setError('Failed to get authorization URL: ' + (errorData.detail || 'Unknown error'));
      }
    } catch (err) {
      setError('Failed to initialize authentication: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Extract folder ID from Google Drive URL
  const extractFolderId = (url) => {
    const match = url.match(/folders\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  };

  // Load scores from backend API
  const loadScoresFromDrive = async (folderId) => {
    if (!userId) return;
    
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || '/api';
      const response = await fetch(`${apiUrl}/scores/${folderId}?user_id=${encodeURIComponent(userId)}`);
      
      if (response.ok) {
        const data = await response.json();
        setVotes(data.votes || {});
        setComments(data.comments || {});
      }
    } catch (err) {
      console.log('No existing scores found, starting fresh');
    }
  };

  // Refresh scores from drive
  const refreshScores = async () => {
    if (!folderId || !userId) {
      setError('No folder loaded or user not authenticated');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      await loadScoresFromDrive(folderId);
      
      setError('✅ Scores refreshed successfully!');
      setTimeout(() => setError(''), 3000);
    } catch (err) {
      setError('Failed to refresh scores: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load queue from backend API
  const loadQueueFromDrive = async (folderId) => {
    if (!userId) return;
    
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || '/api';
      const response = await fetch(`${apiUrl}/queue/${folderId}?user_id=${encodeURIComponent(userId)}`);
      
      if (response.ok) {
        const data = await response.json();
        setQueue(data.queue || []);
      }
    } catch (err) {
      console.log('No existing queue found, starting fresh');
    }
  };

  // Save queue to backend API
  const saveQueueToDrive = async () => {
    if (!folderId || !userId) return;
    
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || '/api';
      const response = await fetch(`${apiUrl}/queue/${folderId}?user_id=${encodeURIComponent(userId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          queue
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to save queue:', errorData.detail || 'Unknown error');
      }
    } catch (err) {
      console.error('Failed to save queue:', err.message);
    }
  };

  // Add document to queue
  const addToQueue = async (doc) => {
    // Check if document is already in queue
    if (queue.find(item => item.id === doc.id)) {
      setError('Document is already in the queue');
      setTimeout(() => setError(''), 3000);
      return;
    }

    const newQueue = [...queue, {
      id: doc.id,
      name: doc.name,
      webViewLink: doc.webViewLink,
      webContentLink: doc.webContentLink,
      addedAt: new Date().toISOString()
    }];

    setQueue(newQueue);
    
    // Auto-save queue
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || '/api';
      await fetch(`${apiUrl}/queue/${folderId}?user_id=${encodeURIComponent(userId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          queue: newQueue
        })
      });
      
      setError('✅ Added to queue!');
      setTimeout(() => setError(''), 2000);
    } catch (err) {
      setError('Failed to save queue: ' + err.message);
    }
  };

  // Remove document from queue
  const removeFromQueue = async (docId) => {
    const newQueue = queue.filter(item => item.id !== docId);
    setQueue(newQueue);
    await saveQueueToDrive();
  };

  // Reorder queue items
  const reorderQueue = async (fromIndex, toIndex) => {
    const newQueue = [...queue];
    const [removed] = newQueue.splice(fromIndex, 1);
    newQueue.splice(toIndex, 0, removed);
    setQueue(newQueue);
    await saveQueueToDrive();
  };

  // Save scores via backend API
  const saveScoresToDrive = async (showSuccessMessage = true) => {
    try {
      setLoading(true);
      
      const apiUrl = import.meta.env.VITE_API_BASE_URL || '/api';
      const response = await fetch(`${apiUrl}/scores/${folderId}?user_id=${encodeURIComponent(userId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          votes,
          comments
        })
      });
      
      if (response.ok) {
        if (showSuccessMessage) {
          setError('Scores saved successfully!');
          setTimeout(() => setError(''), 3000);
        }
      } else {
        const errorData = await response.json();
        setError('Failed to save scores: ' + (errorData.detail || 'Unknown error'));
      }
    } catch (err) {
      setError('Failed to save scores: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Auto-save function (without success message)
  const autoSave = async () => {
    if (!folderId || autoSaving || !userId) return;
    
    try {
      setAutoSaving(true);
      const apiUrl = import.meta.env.VITE_API_BASE_URL || '/api';
      const response = await fetch(`${apiUrl}/scores/${folderId}?user_id=${encodeURIComponent(userId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          votes,
          comments
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Auto-save failed:', errorData.detail || 'Unknown error');
      }
    } catch (err) {
      console.error('Auto-save failed:', err.message);
    } finally {
      setAutoSaving(false);
    }
  };

  // Load documents from backend API
  const loadDocuments = async (folderId) => {
    if (!userId) {
      setError('Please authenticate first');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const apiUrl = import.meta.env.VITE_API_BASE_URL || '/api';
      const response = await fetch(`${apiUrl}/documents/${folderId}?user_id=${encodeURIComponent(userId)}`);
      
      if (response.ok) {
        const documents = await response.json();
        setDocuments(documents);
        
        // Load existing scores and queue
        await loadScoresFromDrive(folderId);
        await loadQueueFromDrive(folderId);
      } else {
        const errorData = await response.json();
        setError('Failed to load documents: ' + (errorData.detail || 'Unknown error'));
      }
    } catch (err) {
      setError('Failed to load documents: ' + err.message);
    } finally {
      setLoading(false);
    }
  };



  const handleDriveLink = (e) => {
    e.preventDefault();
    const id = extractFolderId(driveLink);
    if (id) {
      setFolderId(id);
      loadDocuments(id);
    } else {
      setError('Please enter a valid Google Drive folder link');
    }
  };

  const handleVote = (docId, rating, voter = userName) => {
    setVotes(prev => ({
      ...prev,
      [docId]: {
        ...prev[docId],
        [voter]: rating
      }
    }));
  };

  const handleComment = (docId, comment, voter = userName) => {
    // Don't save empty comments
    if (!comment || !comment.trim()) {
      return;
    }
    
    setComments(prev => ({
      ...prev,
      [docId]: {
        ...prev[docId],
        [voter]: comment.trim()
      }
    }));
    if (voter === userName) {
      setNewComment(prev => ({ ...prev, [docId]: '' }));
    }
  };

  // Start editing a comment
  const startEditComment = (docId, voter, currentComment) => {
    setEditingComment({ docId, voter });
    setEditCommentText(currentComment);
  };

  // Save edited comment
  const saveEditComment = (docId, voter) => {
    if (!editCommentText || !editCommentText.trim()) {
      // If empty, delete the comment
      deleteComment(docId, voter);
    } else {
      setComments(prev => ({
        ...prev,
        [docId]: {
          ...prev[docId],
          [voter]: editCommentText.trim()
        }
      }));
    }
    setEditingComment(null);
    setEditCommentText('');
  };

  // Cancel editing
  const cancelEditComment = () => {
    setEditingComment(null);
    setEditCommentText('');
  };

  // Delete a comment
  const deleteComment = (docId, voter) => {
    setComments(prev => {
      const newComments = { ...prev };
      if (newComments[docId]) {
        const docComments = { ...newComments[docId] };
        delete docComments[voter];
        
        // If no comments left for this document, remove the document key
        if (Object.keys(docComments).length === 0) {
          delete newComments[docId];
        } else {
          newComments[docId] = docComments;
        }
      }
      return newComments;
    });
    setEditingComment(null);
  };

  const getAverageRating = (docId) => {
    const docVotes = votes[docId];
    if (!docVotes) return 0;
    
    const ratings = Object.values(docVotes);
    return ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
  };

  const getUserVote = (docId) => {
    return votes[docId]?.[userName] || 0;
  };

  const getUserComment = (docId) => {
    return comments[docId]?.[userName] || '';
  };

  const getTotalVoters = (docId) => {
    return votes[docId] ? Object.keys(votes[docId]).length : 0;
  };

  const getTotalVotes = (docId) => {
    return votes[docId] ? Object.keys(votes[docId]).length : 0;
  };

  const getCommentCount = (docId) => {
    return comments[docId] ? Object.keys(comments[docId]).length : 0;
  };

  // Generate AI letter (rejection or acceptance)
  const generateLetter = async (doc, letterType, language = 'en', companyName = 'Our Company', position = 'this position') => {
    setGeneratingLetter(true);
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || '/api';
      
      // Collect all comments for this document
      const docComments = comments[doc.id] || {};
      const allComments = Object.values(docComments).filter(comment => comment.trim());
      
      const endpoint = letterType === 'acceptance' ? '/generate-acceptance' : '/generate-rejection';
      
      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document_name: doc.name,
          language: language,
          comments: allComments,
          average_rating: getAverageRating(doc.id),
          company_name: companyName,
          position: position
        })
      });
      
      if (response.ok) {
        const letterData = await response.json();
        setRejectionLetter(letterData);
      } else {
        const errorData = await response.json();
        setError(`Failed to generate ${letterType} letter: ` + (errorData.detail || 'Unknown error'));
      }
    } catch (err) {
      setError(`Failed to generate ${letterType} letter: ` + err.message);
    } finally {
      setGeneratingLetter(false);
    }
  };

  // Legacy function for backward compatibility
  const generateRejectionLetter = async (doc, language = 'en', companyName = 'Our Company', position = 'this position') => {
    return generateLetter(doc, 'rejection', language, companyName, position);
  };

  // Grading agent function
  const gradeCV = async (doc, positionDesc, language = 'en') => {
    if (!positionDesc.trim()) {
      setError('Please provide a position description');
      return;
    }

    setGeneratingLetter(true);
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || '/api';
      
      const response = await fetch(`${apiUrl}/grade-cv?user_id=${encodeURIComponent(userId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document_id: doc.id,
          document_name: doc.name,
          position_description: positionDesc,
          language: language
        })
      });
      
      if (response.ok) {
        const gradingData = await response.json();
        
        // Add the grading bot comment and rating
        handleComment(doc.id, gradingData.comment, 'Grading bot');
        handleVote(doc.id, gradingData.rating, 'Grading bot');
        
        setGradingModal(null);
        setError('✅ CV has been graded by the AI agent!');
        setTimeout(() => setError(''), 3000);
      } else {
        const errorData = await response.json();
        setError('Failed to grade CV: ' + (errorData.detail || 'Unknown error'));
      }
    } catch (err) {
      setError('Failed to grade CV: ' + err.message);
    } finally {
      setGeneratingLetter(false);
    }
  };

  // Copy letter to clipboard
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setError('Letter copied to clipboard!');
      setTimeout(() => setError(''), 2000);
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  };

  const StarRating = ({ rating, onRate, interactive = true }) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-6 h-6 cursor-pointer transition-colors ${
              star <= rating 
                ? 'fill-yellow-400 text-yellow-400' 
                : 'text-gray-300 hover:text-yellow-400'
            } ${!interactive ? 'cursor-default' : ''}`}
            onClick={interactive ? () => onRate(star) : undefined}
          />
        ))}
      </div>
    );
  };



  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-indigo-600" />
              <h1 className="text-xl font-bold text-gray-900">CV Voting</h1>
            </div>
            <div className="flex items-center gap-4">
              {/* AI Features Toggle */}
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useAI}
                    onChange={(e) => setUseAI(e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <span>Use AI</span>
                </label>
              </div>
              
              {documents.length > 0 && (
                <>
                  {/* Auto-save status indicator */}
                  <div className="flex items-center gap-2 text-sm">
                    {autoSaving ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                        <span className="text-blue-600">Saving...</span>
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-green-600">Auto-saved</span>
                      </>
                    )}
                  </div>
                  
                  {/* Manual save button (now secondary) */}
                  <button
                    onClick={() => saveScoresToDrive(true)}
                    disabled={loading || autoSaving}
                    className="flex items-center gap-2 bg-gray-600 text-white px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 text-sm"
                    title="Manual save (auto-save is already active)"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Manual Save
                  </button>
                  
                  {/* Refresh scores button */}
                  <button
                    onClick={refreshScores}
                    disabled={loading || autoSaving}
                    className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
                    title="Refresh scores from Google Drive"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh Scores
                  </button>
                  
                  {/* Queue info display */}
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <List className="w-4 h-4 text-purple-600" />
                    <span>Queue: {queue.length} CV{queue.length !== 1 ? 's' : ''}</span>
                  </div>
                </>
              )}
              <div className="flex items-center gap-3 text-sm text-gray-600">
                {userPicture ? (
                  <img 
                    src={userPicture} 
                    alt={userName}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <Users className="w-4 h-4" />
                )}
                                 <div className="flex flex-col">
                  <span>Voting as: <strong>{userName || 'Loading...'}</strong></span>
                  {userEmail && <span className="text-xs text-gray-500">{userEmail}</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        {/* Error/Success Message */}
        {error && (
          <div className="max-w-5xl mx-auto px-6 mb-6">
            <div className={`p-4 rounded-lg ${error.includes('successfully') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {error}
            </div>
          </div>
        )}

        {/* Authentication Required */}
        {!isAuthenticated && (
          <div className="max-w-5xl mx-auto px-6 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-center mb-6">
              <Shield className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">Google Drive Authentication Required</h2>
              <p className="text-gray-600 mb-4">
                To access and manage CV files, you need to authenticate with Google Drive.
              </p>
            </div>
            <button
              onClick={handleGoogleAuth}
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              Authenticate with Google Drive
            </button>
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700 font-medium mb-2">What this allows:</p>
              <ul className="text-sm text-blue-700 space-y-1 ml-4 list-disc">
                <li>Access PDF files in your Google Drive folders</li>
                <li>Create and update voting scores CSV file</li>
                <li>View and download CV documents</li>
              </ul>
            </div>
            </div>
          </div>
        )}

        {/* Drive Link Input */}
        {isAuthenticated && documents.length === 0 && (
          <div className="max-w-5xl mx-auto px-6 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Connect Google Drive Folder</h2>
            <form onSubmit={handleDriveLink} className="flex gap-4">
              <input
                type="url"
                value={driveLink}
                onChange={(e) => setDriveLink(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Paste Google Drive folder link here..."
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                Load CVs
              </button>
            </form>
            <div className="mt-4 space-y-3">             
              <div className="p-4 bg-yellow-50 rounded-lg">
                <p className="text-sm text-yellow-700 font-medium mb-2">Setup Instructions:</p>
                <ol className="text-sm text-yellow-700 space-y-1 ml-4 list-decimal">
                  <li>Make sure your Google Drive folder is shared with "Anyone with the link can view"</li>
                  <li>Upload CV files (PDF format) to the folder</li>
                  <li>The app will create a "scores.csv" file in your folder to store voting data</li>
                  <li>You'll need to set up Google Drive API credentials for production use</li>
                </ol>
              </div>
            </div>
            </div>
          </div>
        )}

        {/* Position Description Section */}
        {useAI && isAuthenticated && (
          <div className="max-w-6xl mx-auto px-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Bot className="w-5 h-5 text-blue-600" />
                Position Description for AI Grading
              </h2>
              <textarea
                value={positionDescription}
                onChange={(e) => setPositionDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows="4"
                placeholder="Describe the position requirements, key skills, experience needed, etc. This will help the AI agent grade CVs more accurately..."
              />
              <div className="mt-2 text-sm text-gray-600">
                💡 The more detailed your position description, the more accurate the AI grading will be.
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && documents.length === 0 && (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-indigo-600" />
            <p className="text-gray-600">Loading CVs from Google Drive...</p>
          </div>
        )}

        {/* Documents and Queue Layout */}
        {isAuthenticated && documents.length > 0 && (
          <div className="flex gap-0" style={{ height: 'calc(100vh - 60px)' }}>
            {/* Documents Grid Container */}
            <div className="flex-1 py-6 overflow-y-auto">
              <div className="max-w-5xl mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {documents.map((doc) => (
              <div key={doc.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-start gap-3 mb-4">
                    {/* PDF Thumbnail */}
                    <div className="flex-shrink-0">
                      <div className="w-12 h-16 bg-gray-100 border border-gray-200 rounded overflow-hidden relative">
                        <iframe
                          src={`${doc.webViewLink.replace('/view', '/preview')}#view=FitH&toolbar=0&navpanes=0&scrollbar=0&page=1`}
                          className="w-full h-full scale-[0.3] origin-top-left pointer-events-none"
                          style={{ width: '400%', height: '400%' }}
                          title={`Preview of ${doc.name}`}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent pointer-events-none"></div>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{doc.name}</h3>
                      <p className="text-sm text-gray-500">CV Document</p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2 mb-4">
                    <button
                      onClick={() => setSelectedDoc(doc)}
                      className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Preview CV
                    </button>
                    <button
                      onClick={() => addToQueue(doc)}
                      disabled={queue.find(item => item.id === doc.id)}
                      className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {queue.find(item => item.id === doc.id) ? (
                        <>
                          <Check className="w-4 h-4" />
                          In Queue
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          Add to Queue
                        </>
                      )}
                    </button>
                  </div>

                  {/* Your Rating */}
                  <div className="mb-4">
                    <div className="text-sm font-medium text-gray-700 mb-2">Your Rating:</div>
                    <StarRating
                      rating={getUserVote(doc.id)}
                      onRate={(rating) => handleVote(doc.id, rating)}
                    />
                  </div>

                  {/* Your Comment */}
                  <div className="mb-4">
                    <div className="text-sm font-medium text-gray-700 mb-2">Your Comment:</div>
                    {getUserComment(doc.id) ? (
                      <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg mb-2 relative group">
                        {editingComment?.docId === doc.id && editingComment?.voter === userName ? (
                          <div className="space-y-2">
                            <textarea
                              value={editCommentText}
                              onChange={(e) => setEditCommentText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.ctrlKey) {
                                  e.preventDefault();
                                  saveEditComment(doc.id, userName);
                                } else if (e.key === 'Escape') {
                                  e.preventDefault();
                                  cancelEditComment();
                                }
                              }}
                              className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                              rows="3"
                              placeholder="Edit your comment... (Ctrl+Enter to save, Esc to cancel)"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveEditComment(doc.id, userName)}
                                className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" />
                                Save
                              </button>
                              <button
                                onClick={cancelEditComment}
                                className="px-3 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {getUserComment(doc.id)}
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                              <button
                                onClick={() => startEditComment(doc.id, userName, getUserComment(doc.id))}
                                className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                                title="Edit comment"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => deleteComment(doc.id, userName)}
                                className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                                title="Delete comment"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ) : null}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newComment[doc.id] || ''}
                        onChange={(e) => setNewComment(prev => ({ ...prev, [doc.id]: e.target.value }))}
                        className="flex-1 text-sm px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Add a comment..."
                        onKeyPress={(e) => e.key === 'Enter' && newComment[doc.id]?.trim() && handleComment(doc.id, newComment[doc.id])}
                      />
                      <button
                        onClick={() => handleComment(doc.id, newComment[doc.id])}
                        disabled={!newComment[doc.id]?.trim()}
                        className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {/* All Comments Toggle */}
                  {Object.keys(comments[doc.id] || {}).length > 0 && (
                    <button
                      onClick={() => setShowComments(prev => ({ ...prev, [doc.id]: !prev[doc.id] }))}
                      className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 mb-4"
                    >
                      <MessageSquare className="w-4 h-4" />
                      {showComments[doc.id] ? 'Hide' : 'Show'} all comments ({Object.keys(comments[doc.id] || {}).length})
                    </button>
                  )}

                  {/* All Comments */}
                  {showComments[doc.id] && comments[doc.id] && (
                    <div className="mb-4 space-y-2">
                      {Object.entries(comments[doc.id]).map(([voter, comment]) => (
                        <div key={voter} className="text-sm bg-gray-50 p-3 rounded-lg relative group">
                          {editingComment?.docId === doc.id && editingComment?.voter === voter ? (
                            <div className="space-y-2">
                              <div className="font-medium text-gray-700">{voter}:</div>
                              <textarea
                                value={editCommentText}
                                onChange={(e) => setEditCommentText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && e.ctrlKey) {
                                    e.preventDefault();
                                    saveEditComment(doc.id, voter);
                                  } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    cancelEditComment();
                                  }
                                }}
                                className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                rows="3"
                                placeholder="Edit comment... (Ctrl+Enter to save, Esc to cancel)"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => saveEditComment(doc.id, voter)}
                                  className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors flex items-center gap-1"
                                >
                                  <Check className="w-3 h-3" />
                                  Save
                                </button>
                                <button
                                  onClick={cancelEditComment}
                                  className="px-3 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="font-medium text-gray-700">{voter}:</div>
                              <div className="text-gray-600">{comment}</div>
                              {voter === userName && (
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                  <button
                                    onClick={() => startEditComment(doc.id, voter, comment)}
                                    className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                                    title="Edit comment"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => deleteComment(doc.id, voter)}
                                    className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                                    title="Delete comment"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Average Rating */}
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                      <span>Average Rating:</span>
                      <span>{getTotalVoters(doc.id)} voter(s)</span>
                    </div>
                    <div className="flex items-center gap-2 mb-4">
                      <StarRating
                        rating={getAverageRating(doc.id)}
                        interactive={false}
                      />
                      <span className="text-sm font-medium">
                        {getAverageRating(doc.id).toFixed(1)}
                      </span>
                    </div>
                    
                    {/* AI Letter Buttons */}
                    {useAI && (
                      <div className="space-y-2">
                        <button
                          onClick={() => setRejectionModal({...doc, letterType: 'rejection'})}
                          className="w-full bg-amber-500 text-white py-2 px-4 rounded-lg hover:bg-amber-600 transition-colors flex items-center justify-center gap-2 text-sm"
                        >
                          <Sparkles className="w-4 h-4" />
                          Generate Rejection Letter
                        </button>
                        <button
                          onClick={() => setRejectionModal({...doc, letterType: 'acceptance'})}
                          className="w-full bg-emerald-500 text-white py-2 px-4 rounded-lg hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2 text-sm"
                        >
                          <Sparkles className="w-4 h-4" />
                          Generate Acceptance Letter
                        </button>
                          <button
                          onClick={() => setGradingModal(doc)}
                          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm"
                        >
                          <Bot className="w-4 h-4" />
                          Grade with AI
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
                </div>
              </div>
            </div>

            {/* Queue Sidebar */}
            <div className="w-80 bg-white shadow-sm border-l border-t border-b h-full flex flex-col">
              <div className="bg-purple-600 text-white p-4 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <List className="w-5 h-5" />
                  <h3 className="font-semibold">CV Queue ({queue.length})</h3>
                </div>
              </div>

              <div className="p-4 flex-1 overflow-y-auto">
                {queue.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <List className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No CVs in queue</p>
                    <p className="text-sm mt-2">Click "Add to Queue" on any CV to get started</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {queue.map((doc, index) => (
                      <div
                        key={doc.id}
                        className="bg-gray-50 rounded-lg p-3 border hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex items-center gap-2 text-gray-400">
                            <span className="text-sm font-medium">{index + 1}</span>
                            <GripVertical className="w-4 h-4 cursor-move" />
                          </div>
                          
                          {/* Small PDF Thumbnail for Queue */}
                          <div className="flex-shrink-0">
                            <div className="w-6 h-8 bg-gray-100 border border-gray-200 rounded overflow-hidden relative">
                              <iframe
                                src={`${doc.webViewLink.replace('/view', '/preview')}#view=FitH&toolbar=0&navpanes=0&scrollbar=0&page=1`}
                                className="w-full h-full scale-[0.15] origin-top-left pointer-events-none"
                                style={{ width: '667%', height: '667%' }}
                                title={`Preview of ${doc.name}`}
                              />
                            </div>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-900 text-sm truncate">{doc.name}</h4>
                            <p className="text-xs text-gray-500 mt-1">
                              Added {new Date(doc.addedAt).toLocaleDateString()}
                            </p>
                            
                            {/* Quick Actions */}
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => setSelectedDoc(doc)}
                                className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded hover:bg-gray-300 transition-colors"
                              >
                                Preview
                              </button>
                              <button
                                onClick={() => removeFromQueue(doc.id)}
                                className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200 transition-colors"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

                             {/* Queue Actions */}
               {queue.length > 0 && (
                 <div className="border-t p-4 bg-gray-50 flex-shrink-0">
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => {
                        setQueue([]);
                        saveQueueToDrive();
                      }}
                      className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors text-sm"
                    >
                      Clear Queue
                    </button>
                    <p className="text-xs text-gray-500 text-center">
                      Drag items to reorder • {queue.length} CV{queue.length !== 1 ? 's' : ''} in queue
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* AI Rejection Letter Modal */}
        {rejectionModal && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => {
              setRejectionModal(null);
              setRejectionLetter(null);
            }}
          >
            <div 
              className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-5/6 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Sparkles className={`w-5 h-5 ${rejectionModal.letterType === 'acceptance' ? 'text-emerald-600' : 'text-amber-600'}`} />
                  AI {rejectionModal.letterType === 'acceptance' ? 'Acceptance' : 'Rejection'} Letter Generator
                </h3>
                <button
                  onClick={() => {
                    setRejectionModal(null);
                    setRejectionLetter(null);
                  }}
                  className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 p-4 overflow-y-auto">
                {!rejectionLetter ? (
                  <div className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="font-medium text-blue-900 mb-2">Document: {rejectionModal.name}</h4>
                      <p className="text-sm text-blue-700">
                        Average Rating: {getAverageRating(rejectionModal.id).toFixed(1)}/5.0 
                        ({getTotalVoters(rejectionModal.id)} voters)
                      </p>
                      {comments[rejectionModal.id] && Object.keys(comments[rejectionModal.id]).length > 0 && (
                        <div className="mt-2">
                          <p className="text-sm text-blue-700 font-medium">Comments to consider:</p>
                          <ul className="text-sm text-blue-700 ml-4 list-disc">
                            {Object.values(comments[rejectionModal.id]).map((comment, idx) => (
                              <li key={idx}>{comment}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.target);
                      generateLetter(
                        rejectionModal,
                        rejectionModal.letterType,
                        formData.get('language'),
                        formData.get('company'),
                        formData.get('position')
                      );
                    }}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Language
                          </label>
                          <select 
                            name="language"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            defaultValue="en"
                          >
                            <option value="en">English</option>
                            <option value="pl">Polish</option>
                            <option value="es">Spanish</option>
                            <option value="fr">French</option>
                            <option value="de">German</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Company Name
                          </label>
                          <input
                            type="text"
                            name="company"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="Your Company Name"
                            defaultValue="Our Company"
                          />
                        </div>
                        
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Position
                          </label>
                          <input
                            type="text"
                            name="position"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="Software Developer, Marketing Manager, etc."
                            defaultValue="this position"
                          />
                        </div>
                      </div>
                      
                      <button
                        type="submit"
                        disabled={generatingLetter}
                        className={`w-full mt-4 ${rejectionModal.letterType === 'acceptance' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-amber-500 hover:bg-amber-600'} text-white py-3 px-4 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2`}
                      >
                        {generatingLetter ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            Generate {rejectionModal.letterType === 'acceptance' ? 'Acceptance' : 'Rejection'} Letter
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h4 className="font-medium text-green-900 mb-2">
                        Generated {rejectionModal.letterType === 'acceptance' ? 'Acceptance' : 'Rejection'} Letter
                      </h4>
                      <p className="text-sm text-green-700">
                        Subject: {rejectionLetter.subject}
                      </p>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans">
                        {rejectionLetter.letter}
                      </pre>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyToClipboard(rejectionLetter.letter)}
                        className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <Copy className="w-4 h-4" />
                        Copy Letter
                      </button>
                      
                      <button
                        onClick={() => {
                          const subject = encodeURIComponent(rejectionLetter.subject);
                          const body = encodeURIComponent(rejectionLetter.letter);
                          window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
                        }}
                        className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <Mail className="w-4 h-4" />
                        Open in Email
                      </button>
                    </div>
                    
                    <button
                      onClick={() => setRejectionLetter(null)}
                      className="w-full bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      Generate Another
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Document Preview Modal */}
        {selectedDoc && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedDoc(null)}
          >
            <div 
              className="bg-white rounded-lg shadow-xl w-full max-w-7xl h-5/6 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-semibold">{selectedDoc.name}</h3>
                <div className="flex gap-2">
                  <a
                    href={selectedDoc.webContentLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
                    title="Download"
                  >
                    <Download className="w-5 h-5" />
                  </a>
                  <button
                    onClick={() => setSelectedDoc(null)}
                    className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
                  >
                    ✕
                  </button>
                </div>
              </div>
              
              <div className="flex-1 flex overflow-hidden">
                {/* PDF Viewer */}
                <div className="flex-1 p-4 bg-gray-100">
                  <iframe
                    src={`${selectedDoc.webViewLink.replace('/view', '/preview')}`}
                    className="w-full h-full border rounded"
                    title={selectedDoc.name}
                  />
                </div>
                
                {/* Comment Pane */}
                <div className="w-96 border-l bg-white flex flex-col">
                  <div className="p-4 border-b bg-gray-50">
                    <h4 className="font-semibold text-gray-900 mb-2">Comments & Rating</h4>
                    
                    {/* Quick Rating */}
                    <div className="mb-4">
                      <div className="text-sm font-medium text-gray-700 mb-2">Your Rating:</div>
                      <StarRating
                        rating={getUserVote(selectedDoc.id)}
                        onRate={(rating) => handleVote(selectedDoc.id, rating)}
                      />
                    </div>
                    
                    {/* Stats */}
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>Average: {getAverageRating(selectedDoc.id).toFixed(1)} ⭐</div>
                      <div>Total Votes: {getTotalVotes(selectedDoc.id)}</div>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto">
                    {/* Your Comment Section */}
                    <div className="p-4 border-b">
                      <div className="text-sm font-medium text-gray-700 mb-2">Your Comment:</div>
                      {getUserComment(selectedDoc.id) ? (
                        <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg mb-2 relative group">
                          {editingComment?.docId === selectedDoc.id && editingComment?.voter === userName ? (
                            <div className="space-y-2">
                              <textarea
                                value={editCommentText}
                                onChange={(e) => setEditCommentText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && e.ctrlKey) {
                                    e.preventDefault();
                                    saveEditComment(selectedDoc.id, userName);
                                  } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    cancelEditComment();
                                  }
                                }}
                                className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                rows="3"
                                placeholder="Edit your comment... (Ctrl+Enter to save, Esc to cancel)"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => saveEditComment(selectedDoc.id, userName)}
                                  className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors flex items-center gap-1"
                                >
                                  <Check className="w-3 h-3" />
                                  Save
                                </button>
                                <button
                                  onClick={cancelEditComment}
                                  className="px-3 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <span>{getUserComment(selectedDoc.id)}</span>
                              <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                <button
                                  onClick={() => startEditComment(selectedDoc.id, userName, getUserComment(selectedDoc.id))}
                                  className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                                  title="Edit comment"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => deleteComment(selectedDoc.id, userName)}
                                  className="p-1 text-red-600 hover:bg-red-100 rounded"
                                  title="Delete comment"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <textarea
                          value={newComment[selectedDoc.id] || ''}
                          onChange={(e) => setNewComment(prev => ({ ...prev, [selectedDoc.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.ctrlKey) {
                              e.preventDefault();
                              handleComment(selectedDoc.id, newComment[selectedDoc.id]);
                              setNewComment(prev => ({ ...prev, [selectedDoc.id]: '' }));
                            }
                          }}
                          className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                          rows="3"
                          placeholder="Add your comment... (Ctrl+Enter to save)"
                        />
                      )}
                      
                      {!getUserComment(selectedDoc.id) && newComment[selectedDoc.id]?.trim() && (
                        <button
                          onClick={() => {
                            handleComment(selectedDoc.id, newComment[selectedDoc.id]);
                            setNewComment(prev => ({ ...prev, [selectedDoc.id]: '' }));
                          }}
                          className="mt-2 px-3 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 transition-colors"
                        >
                          Add Comment
                        </button>
                      )}
                    </div>
                    
                    {/* All Comments Section */}
                    <div className="p-4">
                      <div className="text-sm font-medium text-gray-700 mb-3">All Comments ({getCommentCount(selectedDoc.id)}):</div>
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {Object.entries(comments[selectedDoc.id] || {}).map(([voter, comment]) => (
                          <div key={voter} className="bg-gray-50 p-3 rounded-lg text-sm relative group">
                            {editingComment?.docId === selectedDoc.id && editingComment?.voter === voter ? (
                              <div className="space-y-2">
                                <textarea
                                  value={editCommentText}
                                  onChange={(e) => setEditCommentText(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && e.ctrlKey) {
                                      e.preventDefault();
                                      saveEditComment(selectedDoc.id, voter);
                                    } else if (e.key === 'Escape') {
                                      e.preventDefault();
                                      cancelEditComment();
                                    }
                                  }}
                                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                  rows="3"
                                  placeholder="Edit comment... (Ctrl+Enter to save, Esc to cancel)"
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => saveEditComment(selectedDoc.id, voter)}
                                    className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors flex items-center gap-1"
                                  >
                                    <Check className="w-3 h-3" />
                                    Save
                                  </button>
                                  <button
                                    onClick={cancelEditComment}
                                    className="px-3 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="font-medium text-gray-900 mb-1">{voter}</div>
                                <div className="text-gray-700">{comment}</div>
                                {voter === userName && (
                                  <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                    <button
                                      onClick={() => startEditComment(selectedDoc.id, voter, comment)}
                                      className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                                      title="Edit comment"
                                    >
                                      <Edit3 className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => deleteComment(selectedDoc.id, voter)}
                                      className="p-1 text-red-600 hover:bg-red-100 rounded"
                                      title="Delete comment"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        ))}
                        
                        {getCommentCount(selectedDoc.id) === 0 && (
                          <div className="text-gray-500 text-center py-4">
                            No comments yet. Be the first to add one!
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Grading Agent Modal */}
        {gradingModal && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setGradingModal(null)}
          >
            <div 
              className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-5/6 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Bot className="w-5 h-5 text-blue-600" />
                  AI CV Grading Agent
                </h3>
                <button
                  onClick={() => setGradingModal(null)}
                  className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 p-4 overflow-y-auto">
                <div className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Document: {gradingModal.name}</h4>
                    <p className="text-sm text-blue-700">
                      The AI agent will analyze this CV against your position description and provide a detailed evaluation with a rating.
                    </p>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Position Description:</h4>
                    <div className="text-sm text-gray-700 max-h-32 overflow-y-auto bg-white p-3 rounded border">
                      {positionDescription}
                    </div>
                  </div>
                  
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target);
                    gradeCV(
                      gradingModal,
                      positionDescription,
                      formData.get('language')
                    );
                  }}>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Language for Analysis
                      </label>
                      <select 
                        name="language"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        defaultValue="en"
                      >
                        <option value="en">English</option>
                        <option value="pl">Polish</option>
                        <option value="es">Spanish</option>
                        <option value="fr">French</option>
                        <option value="de">German</option>
                      </select>
                    </div>
                    
                    <button
                      type="submit"
                      disabled={generatingLetter}
                      className="w-full mt-4 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {generatingLetter ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Analyzing CV...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4" />
                          Start AI Analysis
                        </>
                      )}
                    </button>
                  </form>
                  
                  <div className="text-xs text-gray-500">
                    ⚡ The AI will read the PDF content and provide a detailed assessment with rating (1-5 stars) and comments as "Grading bot".
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>


    </div>
  );
};

export default DriveVotingApp; 