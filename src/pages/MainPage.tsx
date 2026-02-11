import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import HistoryIcon from '@mui/icons-material/History';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CloseIcon from '@mui/icons-material/Close';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    IconButton,
} from '@mui/material';
import './MainPage.css';


export default function MainPage({ session }: { session: any }) {
    const navigate = useNavigate();
    const [zoomUrl, setZoomUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [audioUrl, setAudioUrl] = useState<string>('');

    const [recentMeetings, setRecentMeetings] = useState<any[]>([]);
    const [allMeetings, setAllMeetings] = useState<any[]>([]);
    const [showAllSessionsDialog, setShowAllSessionsDialog] = useState(false);
    const [loadingAllSessions, setLoadingAllSessions] = useState(false);

    useEffect(() => {
        const fetchRecentMeetings = async () => {
            if (!session?.user?.id) return;

            const { data, error } = await supabase
                .from('session_member')
                .select(`
          session_id,
          sessions (
            source_type,
            created_at
          )
        `)
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false })
                .limit(5);

            if (error) {
                console.error('Error fetching recent meetings:', error);
            } else {
                setRecentMeetings(data || []);
            }
        };

        fetchRecentMeetings();
    }, [session]);

    const fetchAllMeetings = async () => {
        if (!session?.user?.id) return;
        setLoadingAllSessions(true);

        const { data, error } = await supabase
            .from('session_member')
            .select(`
          session_id,
          sessions (
            source_type,
            created_at
          )
        `)
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching all meetings:', error);
        } else {
            setAllMeetings(data || []);
        }
        setLoadingAllSessions(false);
    };

    const handleOpenAllSessions = () => {
        setShowAllSessionsDialog(true);
        fetchAllMeetings();
    };

    useEffect(() => {
        return () => {
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
            }
        };
    }, [audioUrl]);

    const handleAudioUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setAudioFile(file);
            const url = URL.createObjectURL(file);
            setAudioUrl(url);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('audio/')) {
            setAudioFile(file);
            const url = URL.createObjectURL(file);
            setAudioUrl(url);
        }
    };

    const handleSummarize = async () => {
        console.log('Summarizing audio:', audioFile?.name);
        if (!audioFile || !session?.user?.id) return;

        setLoading(true);
        try {
            // 1. Upload file to Supabase Storage
            // Path: {user_id}/{timestamp}-{filename}
            // Sanitize filename to be safe
            const fileExt = audioFile.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const filePath = `${session.user.id}/${fileName}`;

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('audio-uploads')
                .upload(filePath, audioFile);

            if (uploadError) {
                console.error('Error uploading file:', uploadError);
                throw new Error('Failed to upload audio file. Please ensure storage bucket "audio-uploads" exists and you are logged in.');
            }

            // 2. Create session with source_ref as the storage path
            const { data, error } = await supabase.from('sessions').insert([
                {
                    source_type: 'offline', // As requested
                    source_ref: uploadData.path, // Store the file path in storage
                }
            ]).select();

            if (error) throw error;

            const newSession = data[0];

            // Add user to session_member
            await supabase.from('session_member').insert({
                session_id: newSession.id,
                user_id: session.user.id
            });

            navigate(`/session/${newSession.id}`);

        } catch (error: any) {
            console.error('Error creating offline session:', error);
            alert(error.message || 'Error creating session');
        } finally {
            setLoading(false);
        }
    };


    const handleZoomSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        try {
            // 1. Check if session exists with this Zoom URL
            const { data: existingSessions, error: searchError } = await supabase
                .from('sessions')
                .select('id')
                .eq('source_ref', zoomUrl)
                .limit(1);

            if (searchError) throw searchError;

            let sessionIdToJoin = '';
            let isNewSession = false;

            if (existingSessions && existingSessions.length > 0) {
                // Session exists, join it
                sessionIdToJoin = existingSessions[0].id;
                console.log('Found existing session:', sessionIdToJoin);
            } else {
                // Session doesn't exist, create it
                const { data, error } = await supabase.from('sessions').insert([
                    {
                        source_type: 'Zoom',
                        source_ref: zoomUrl,
                    },
                ]).select();

                if (error) throw error;
                sessionIdToJoin = data[0].id;
                isNewSession = true;
            }

            // 2. Add user to session_member if not already
            // First check membership to avoid unique constraint violation error if we just try to insert

            const { data: existingMember } = await supabase
                .from('session_member')
                .select('id')
                .eq('session_id', sessionIdToJoin)
                .eq('user_id', session.user.id);

            const isAlreadyMember = existingMember && existingMember.length > 0;

            if (!isAlreadyMember) {
                const { error: joinError } = await supabase.from('session_member').insert({
                    session_id: sessionIdToJoin,
                    user_id: session.user.id
                });
                if (joinError) throw joinError;
            }

            // 3. Start the bot for new sessions
            if (isNewSession) {
                try {
                    const response = await fetch('http://localhost:3001/api/bot/start', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ zoomUrl, sessionId: sessionIdToJoin })
                    });

                    if (!response.ok) {
                        console.warn('Failed to start bot:', await response.text());
                    } else {
                        console.log('Bot started successfully');
                    }
                } catch (botError) {
                    console.warn('Could not connect to bot server:', botError);
                    // Don't block navigation - bot server might not be running
                }
            }

            setMessage('Session joined successfully!');
            setZoomUrl('');
            navigate(`/session/${sessionIdToJoin}`);
        } catch (error: any) {
            console.error('Error handling session:', error);
            setMessage(error.message || 'Error creating/joining session');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="main-page">
            <div className="main-content-logged-in main-content-area">
                <div className="split-container meetings-split-container">
                    <div className="recent-sessions-sidebar">
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <HistoryIcon /> Recent Sessions
                        </h2>
                        {recentMeetings.length === 0 ? (
                            <p>No recent meetings found.</p>
                        ) : (
                            <ul className="recent-meetings-list">
                                {recentMeetings.map((meeting, index) => (
                                    <li
                                        key={index}
                                        className="recent-meeting-item"
                                        onClick={() => navigate(`/session/${meeting.session_id}`)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <div className="meeting-source-type">
                                            {meeting.sessions?.source_type || 'Unknown Source'}
                                        </div>
                                        <div className="meeting-date">
                                            {meeting.sessions?.created_at
                                                ? new Date(meeting.sessions.created_at).toLocaleString()
                                                : 'Unknown Date'}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {recentMeetings.length > 0 && (
                            <button
                                className="show-more-btn"
                                onClick={handleOpenAllSessions}
                            >
                                <ExpandMoreIcon fontSize="small" />
                                Show more
                            </button>
                        )}
                    </div>
                    <div className="split-middle">
                        <h2>Start New Session</h2>
                        <form
                            className="form-widget form-container"
                            onSubmit={handleZoomSubmit}
                        >
                            <div>
                                <label htmlFor="zoomUrl">Zoom URL</label>
                                <input
                                    className="inputField"
                                    id="zoomUrl"
                                    type="url"
                                    placeholder="Enter Zoom Meeting URL"
                                    value={zoomUrl}
                                    required={true}
                                    onChange={(e) => setZoomUrl(e.target.value)}
                                />
                            </div>
                            <div>
                                <button className={'button block primary'} disabled={loading}>
                                    {loading ? 'Saving...' : 'Start Session'}
                                </button>
                            </div>
                        </form>
                        {message && (
                            <div
                                className="message feedback-message"
                            >
                                {message}
                            </div>
                        )}
                    </div>
                    <div className="split-right">
                        <h2>Analyze Audio</h2>
                        <div
                            className="form-widget form-container"
                        >
                            <div className="file-upload-container">
                                <label
                                    htmlFor="audioUpload"
                                    className="file-upload-label"
                                    onDragOver={handleDragOver}
                                    onDrop={handleDrop}
                                >
                                    <div className="file-upload-icon">
                                        <CloudUploadIcon fontSize="large" />
                                    </div>
                                    <span className="file-upload-text">
                                        {audioFile ? audioFile.name : 'Choose Audio File'}
                                    </span>
                                    <span className="file-upload-subtext">Supports MP3, WAV, M4A</span>
                                </label>
                                <input
                                    className="file-input-hidden"
                                    id="audioUpload"
                                    type="file"
                                    accept="audio/*"
                                    onChange={handleAudioUpload}
                                />
                            </div>

                            {audioUrl && (
                                <div className="audio-player-container">
                                    <audio controls src={audioUrl} className="audio-player">
                                        Your browser does not support the audio element.
                                    </audio>
                                </div>
                            )}

                            <div>
                                <button
                                    className={'button block primary'}
                                    onClick={handleSummarize}
                                    disabled={!audioFile}
                                >
                                    Summarize
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* All Sessions Dialog */}
            <Dialog
                open={showAllSessionsDialog}
                onClose={() => setShowAllSessionsDialog(false)}
                fullWidth
                maxWidth="sm"
                className="all-sessions-dialog"
            >
                <DialogTitle className="all-sessions-dialog-title">
                    <HistoryIcon style={{ marginRight: '8px' }} />
                    All Sessions
                    <IconButton
                        aria-label="close"
                        onClick={() => setShowAllSessionsDialog(false)}
                        sx={{ position: 'absolute', right: 8, top: 8 }}
                    >
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent className="all-sessions-dialog-content">
                    {loadingAllSessions ? (
                        <div className="loading-sessions">Loading sessions...</div>
                    ) : allMeetings.length === 0 ? (
                        <p>No sessions found.</p>
                    ) : (
                        <ul className="all-sessions-list">
                            {allMeetings.map((meeting, index) => (
                                <li
                                    key={index}
                                    className="all-sessions-item"
                                    onClick={() => {
                                        setShowAllSessionsDialog(false);
                                        navigate(`/session/${meeting.session_id}`);
                                    }}
                                >
                                    <div className="meeting-source-type">
                                        {meeting.sessions?.source_type || 'Unknown Source'}
                                    </div>
                                    <div className="meeting-date">
                                        {meeting.sessions?.created_at
                                            ? new Date(meeting.sessions.created_at).toLocaleString()
                                            : 'Unknown Date'}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
