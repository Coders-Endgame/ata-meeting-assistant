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

/* ── Inline SVG Illustrations for MainPage ── */

function ZoomMeetingIllustration() {
    return (
        <svg className="section-illustration zoom-illustration" viewBox="0 0 240 160" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Monitor */}
            <rect className="il-float-slow" x="30" y="10" width="180" height="110" rx="12" fill="var(--il-device)" stroke="var(--il-stroke)" strokeWidth="1.5" />
            <rect x="42" y="22" width="156" height="86" rx="6" fill="var(--il-screen)" />
            {/* Video tiles */}
            <rect className="il-tile-1" x="50" y="30" width="68" height="34" rx="4" fill="var(--il-accent1)" opacity="0.8" />
            <rect className="il-tile-2" x="122" y="30" width="68" height="34" rx="4" fill="var(--il-accent2)" opacity="0.8" />
            <rect className="il-tile-3" x="50" y="68" width="68" height="34" rx="4" fill="var(--il-accent3)" opacity="0.8" />
            <rect className="il-tile-4" x="122" y="68" width="68" height="34" rx="4" fill="var(--il-accent1)" opacity="0.5" />
            {/* People silhouettes */}
            <circle cx="84" cy="42" r="7" fill="var(--il-person)" />
            <path d="M74 54 Q84 62 94 54" fill="var(--il-person)" opacity="0.6" />
            <circle cx="156" cy="42" r="7" fill="var(--il-person)" />
            <path d="M146 54 Q156 62 166 54" fill="var(--il-person)" opacity="0.6" />
            <circle cx="84" cy="80" r="7" fill="var(--il-person)" />
            <path d="M74 92 Q84 100 94 92" fill="var(--il-person)" opacity="0.6" />
            <circle cx="156" cy="80" r="7" fill="var(--il-person)" />
            <path d="M146 92 Q156 100 166 92" fill="var(--il-person)" opacity="0.6" />
            {/* Stand */}
            <rect x="100" y="120" width="40" height="6" rx="2" fill="var(--il-device)" stroke="var(--il-stroke)" strokeWidth="1" />
            <rect x="85" y="126" width="70" height="6" rx="3" fill="var(--il-device)" stroke="var(--il-stroke)" strokeWidth="1" />
            {/* Connection lines */}
            <g className="il-pulse-ring">
                <circle cx="205" cy="25" r="10" fill="var(--il-accent2)" opacity="0.15" />
                <circle cx="205" cy="25" r="6" fill="var(--il-accent2)" opacity="0.3" />
                <circle cx="205" cy="25" r="3" fill="var(--il-accent2)" />
            </g>
        </svg>
    );
}

function AudioWaveIllustration() {
    return (
        <svg className="section-illustration audio-illustration" viewBox="0 0 240 160" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Microphone */}
            <rect className="il-float-slow" x="95" y="15" width="50" height="70" rx="25" fill="var(--il-device)" stroke="var(--il-stroke)" strokeWidth="1.5" />
            <rect x="105" y="25" width="30" height="40" rx="15" fill="var(--il-accent1)" opacity="0.3" />
            {/* Mic stand */}
            <line x1="120" y1="85" x2="120" y2="115" stroke="var(--il-stroke)" strokeWidth="2" />
            <line x1="100" y1="115" x2="140" y2="115" stroke="var(--il-stroke)" strokeWidth="2" strokeLinecap="round" />
            {/* Sound waves */}
            <path className="il-wave-1" d="M70 50 Q65 35 70 20" fill="none" stroke="var(--il-accent2)" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
            <path className="il-wave-2" d="M55 55 Q48 35 55 15" fill="none" stroke="var(--il-accent2)" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
            <path className="il-wave-3" d="M170 50 Q175 35 170 20" fill="none" stroke="var(--il-accent2)" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
            <path className="il-wave-4" d="M185 55 Q192 35 185 15" fill="none" stroke="var(--il-accent2)" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
            {/* Waveform bars (static) */}
            <g className="il-waveform">
                <rect x="30" y="132" width="6" height="16" rx="3" fill="var(--il-accent1)" opacity="0.5" />
                <rect x="42" y="126" width="6" height="28" rx="3" fill="var(--il-accent1)" opacity="0.6" />
                <rect x="54" y="122" width="6" height="36" rx="3" fill="var(--il-accent1)" opacity="0.7" />
                <rect x="66" y="128" width="6" height="24" rx="3" fill="var(--il-accent2)" opacity="0.5" />
                <rect x="78" y="120" width="6" height="38" rx="3" fill="var(--il-accent2)" opacity="0.6" />
                <rect x="150" y="126" width="6" height="28" rx="3" fill="var(--il-accent2)" opacity="0.5" />
                <rect x="162" y="122" width="6" height="36" rx="3" fill="var(--il-accent1)" opacity="0.7" />
                <rect x="174" y="128" width="6" height="24" rx="3" fill="var(--il-accent1)" opacity="0.6" />
                <rect x="186" y="132" width="6" height="16" rx="3" fill="var(--il-accent3)" opacity="0.5" />
                <rect x="198" y="130" width="6" height="20" rx="3" fill="var(--il-accent3)" opacity="0.6" />
            </g>
            {/* AI sparkle */}
            <g className="il-sparkle">
                <circle cx="120" cy="50" r="5" fill="var(--il-accent3)" opacity="0.8" />
                <line x1="120" y1="42" x2="120" y2="58" stroke="var(--il-accent3)" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="112" y1="50" x2="128" y2="50" stroke="var(--il-accent3)" strokeWidth="1.5" strokeLinecap="round" />
            </g>
        </svg>
    );
}

function RecentSessionsIllustration() {
    return (
        <svg className="section-illustration recent-illustration" viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Clock face */}
            <circle className="il-float-slow" cx="100" cy="52" r="40" fill="var(--il-device)" stroke="var(--il-stroke)" strokeWidth="1.5" />
            <circle cx="100" cy="52" r="34" fill="var(--il-screen)" />
            {/* Clock hands */}
            <line className="il-clock-hour" x1="100" y1="52" x2="100" y2="30" stroke="var(--il-accent1)" strokeWidth="2.5" strokeLinecap="round" />
            <line className="il-clock-minute" x1="100" y1="52" x2="118" y2="42" stroke="var(--il-accent2)" strokeWidth="2" strokeLinecap="round" />
            <circle cx="100" cy="52" r="3" fill="var(--il-accent1)" />
            {/* Hour markers */}
            <circle cx="100" cy="22" r="2" fill="var(--il-accent1)" opacity="0.6" />
            <circle cx="130" cy="52" r="2" fill="var(--il-accent1)" opacity="0.6" />
            <circle cx="100" cy="82" r="2" fill="var(--il-accent1)" opacity="0.6" />
            <circle cx="70" cy="52" r="2" fill="var(--il-accent1)" opacity="0.6" />
            {/* Document cards floating around */}
            <g className="il-orbit-card-1">
                <rect x="148" y="18" width="44" height="30" rx="5" fill="var(--il-card)" stroke="var(--il-stroke)" strokeWidth="1" />
                <line x1="155" y1="28" x2="183" y2="28" stroke="var(--il-text-line)" strokeWidth="2" strokeLinecap="round" />
                <line x1="155" y1="36" x2="175" y2="36" stroke="var(--il-text-line)" strokeWidth="2" strokeLinecap="round" />
            </g>
            <g className="il-orbit-card-2">
                <rect x="8" y="22" width="44" height="30" rx="5" fill="var(--il-card)" stroke="var(--il-stroke)" strokeWidth="1" />
                <line x1="15" y1="32" x2="43" y2="32" stroke="var(--il-accent2)" strokeWidth="2" strokeLinecap="round" />
                <line x1="15" y1="40" x2="37" y2="40" stroke="var(--il-text-line)" strokeWidth="2" strokeLinecap="round" />
            </g>
            {/* Progress dots at bottom */}
            <circle cx="80" cy="108" r="4" fill="var(--il-accent1)" opacity="0.8" />
            <circle cx="100" cy="108" r="4" fill="var(--il-accent2)" opacity="0.6" />
            <circle cx="120" cy="108" r="4" fill="var(--il-accent3)" opacity="0.4" />
        </svg>
    );
}

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
                    processing_status: 'transcribing', // Mark as processing from the start
                }
            ]).select();

            if (error) throw error;

            const newSession = data[0];

            // Add user to session_member
            await supabase.from('session_member').insert({
                session_id: newSession.id,
                user_id: session.user.id
            });

            // Navigate immediately — processing happens in background
            navigate(`/session/${newSession.id}`);

            // 3. Fire background transcription request (don't await)
            fetch('http://localhost:3001/api/transcribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: newSession.id }),
            }).catch(err => {
                console.warn('Could not start transcription:', err);
            });

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
            {/* Animated background decoration */}
            <div className="main-bg-decor">
                <div className="bg-orb bg-orb-1"></div>
                <div className="bg-orb bg-orb-2"></div>
                <div className="bg-orb bg-orb-3"></div>
            </div>

            <div className="main-content-logged-in main-content-area">
                <div className="split-container meetings-split-container">
                    <div className="recent-sessions-sidebar anim-slide-left">
                        <div className="sidebar-header">
                            <RecentSessionsIllustration />
                            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <HistoryIcon /> Recent Sessions
                            </h2>
                        </div>
                        {recentMeetings.length === 0 ? (
                            <p className="empty-state-text">No recent meetings found.</p>
                        ) : (
                            <ul className="recent-meetings-list">
                                {recentMeetings.map((meeting, index) => (
                                    <li
                                        key={index}
                                        className="recent-meeting-item anim-fade-up"
                                        style={{ animationDelay: `${index * 0.08}s` }}
                                        onClick={() => navigate(`/session/${meeting.session_id}`)}
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
                    <div className="split-middle anim-fade-up">
                        <div className="section-card zoom-section-card">
                            <ZoomMeetingIllustration />
                            <h2>Start New Session</h2>
                            <p className="section-subtitle">Connect to a live Zoom meeting and let AI capture everything.</p>
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
                                    <button className={'button block primary pulse-btn'} disabled={loading}>
                                        {loading ? 'Saving...' : 'Start Session'}
                                    </button>
                                </div>
                            </form>
                            {message && (
                                <div className="message feedback-message">
                                    {message}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="split-right anim-slide-right">
                        <div className="section-card audio-section-card">
                            <AudioWaveIllustration />
                            <h2>Analyze Audio</h2>
                            <p className="section-subtitle">Upload a recording and get instant AI-powered summaries.</p>
                            <div className="form-widget form-container">
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
                                        className={'button block primary pulse-btn'}
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
