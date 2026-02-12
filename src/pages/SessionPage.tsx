import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import {
    List,
    ListItem,
    ListItemText,
    Avatar,
    Typography,
    Button,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Snackbar,
    Alert,
    IconButton,
    Box,
    Paper,
    Divider,
    TextField,
    Tooltip,
    AvatarGroup,
    Chip
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import GroupIcon from '@mui/icons-material/Group';
import './SessionPage.css';

interface Participant {
    user_id: string;
    display_name: string;
}

interface TranscriptItem {
    id: string;
    speaker: string;
    transcript: string;
    created_at: string;
}

interface BotStatus {
    running: boolean;
    sessionId?: string;
    status?: 'starting' | 'joining' | 'active' | 'stopped';
    zoomUrl?: string;
    startedAt?: string;
}

export default function SessionPage() {
    const { sessionId } = useParams<{ sessionId: string }>();
    const navigate = useNavigate();
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [summary, setSummary] = useState<string>('');
    const [sourceType, setSourceType] = useState<string>('');
    const [audioUrl, setAudioUrl] = useState<string>('');

    // Bot status states
    const [botStatus, setBotStatus] = useState<BotStatus>({ running: false });
    const [botLoading, setBotLoading] = useState(true);

    const [loading, setLoading] = useState(true);
    const [openShareDialog, setOpenShareDialog] = useState(false);
    const [shareEmail, setShareEmail] = useState('');
    const [snackbar, setSnackbar] = useState<{ open: boolean, message: string, severity: 'success' | 'warning' | 'error' | 'info' }>({
        open: false,
        message: '',
        severity: 'info'
    });

    // Layout states
    const [leftPanelWidth, setLeftPanelWidth] = useState(50);
    const [showParticipants, setShowParticipants] = useState(false);
    const isResizing = useRef(false);
    const transcriptRef = useRef<HTMLDivElement>(null);
    const summaryRef = useRef<HTMLDivElement>(null);
    const transcriptScrollRef = useRef<HTMLDivElement>(null);
    const dragInfo = useRef<{ startX: number, startRatio: number, totalWidth: number } | null>(null);

    // Fetch bot status
    const fetchBotStatus = useCallback(async () => {
        if (!sessionId) return;
        try {
            const response = await fetch(`http://localhost:3001/api/bot/status/${sessionId}`);
            if (response.ok) {
                const data = await response.json();
                setBotStatus(data);
            }
        } catch (error) {
            console.warn('Could not fetch bot status:', error);
            setBotStatus({ running: false });
        } finally {
            setBotLoading(false);
        }
    }, [sessionId]);

    useEffect(() => {
        if (sessionId) {
            fetchSessionData(sessionId);
            fetchBotStatus();
        }
    }, [sessionId, fetchBotStatus]);

    // Poll bot status every 5 seconds for Zoom sessions
    useEffect(() => {
        if (!sessionId || sourceType !== 'Zoom') return;

        const interval = setInterval(fetchBotStatus, 5000);
        return () => clearInterval(interval);
    }, [sessionId, sourceType, fetchBotStatus]);

    // Real-time subscription for new transcripts
    useEffect(() => {
        if (!sessionId) return;

        const channel = supabase
            .channel(`transcripts-${sessionId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'transcripts',
                    filter: `session_id=eq.${sessionId}`
                },
                (payload) => {
                    const newTranscript = payload.new as TranscriptItem;
                    setTranscripts(prev => [...prev, newTranscript]);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [sessionId]);

    // Auto-scroll transcript panel when new transcripts arrive
    useEffect(() => {
        if (transcriptScrollRef.current) {
            transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
        }
    }, [transcripts]);

    const startResizing = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        if (transcriptRef.current && summaryRef.current) {
            const totalWidth = transcriptRef.current.offsetWidth + summaryRef.current.offsetWidth;
            dragInfo.current = {
                startX: e.clientX,
                startRatio: leftPanelWidth,
                totalWidth
            };
            isResizing.current = true;
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', stopResizing);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        }
    }, [leftPanelWidth]);

    const stopResizing = useCallback(() => {
        isResizing.current = false;
        dragInfo.current = null;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', stopResizing);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }, []);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isResizing.current || !dragInfo.current) return;

        const { startX, startRatio, totalWidth } = dragInfo.current;
        const deltaX = e.clientX - startX;
        const deltaRatio = (deltaX / totalWidth) * 100;

        let newRatio = startRatio + deltaRatio;
        // Constrain between 20% and 80%
        if (newRatio < 20) newRatio = 20;
        if (newRatio > 80) newRatio = 80;

        setLeftPanelWidth(newRatio);
    }, []);


    const fetchSessionData = async (id: string) => {
        setLoading(true);

        try {
            // Fetch Session Details (Source Type)
            const { data: sessionData, error: sessionError } = await supabase
                .from('sessions')
                .select('source_type, source_ref')
                .eq('id', id)
                .single();

            if (!sessionError && sessionData) {
                setSourceType(sessionData.source_type || '');

                // If offline audio, fetch the signed URL
                if (sessionData.source_type === 'offline' && sessionData.source_ref) {
                    try {
                        // Attempt to get a signed URL (valid for 24 hours)
                        const { data, error } = await supabase.storage
                            .from('audio-uploads')
                            .createSignedUrl(sessionData.source_ref, 3600 * 24);

                        if (error) {
                            console.error('Error getting signed URL:', error);
                        } else if (data) {
                            setAudioUrl(data.signedUrl);
                        }
                    } catch (err) {
                        console.error('Exception getting signed URL:', err);
                    }
                }
            }

            // Fetch Summary
            const { data: summaryData, error: summaryError } = await supabase
                .from('summaries')
                .select('summary')
                .eq('session_id', id)
                .single();

            if (!summaryError && summaryData) {
                setSummary(summaryData.summary);
            } else {
                setSummary('');
            }

            // Fetch Transcripts
            const { data: transcriptData, error: transcriptError } = await supabase
                .from('transcripts')
                .select('*')
                .eq('session_id', id)
                .order('created_at', { ascending: true });

            if (!transcriptError && transcriptData) {
                setTranscripts(transcriptData);
            }

            // Fetch Participants from session_member

            const { data: members, error: membersError } = await supabase
                .from('session_member')
                .select('user_id')
                .eq('session_id', id);

            if (members && !membersError) {
                const userIds = members.map(m => m.user_id);

                // Fetch profiles for these users
                const { data: profiles, error: profilesError } = await supabase
                    .from('profiles')
                    .select('id, first_name, last_name, email')
                    .in('id', userIds);

                const profileMap = new Map();
                if (profiles && !profilesError) {
                    profiles.forEach(p => {
                        profileMap.set(p.id, p);
                    });
                }

                const { data: { user: currentUser } } = await supabase.auth.getUser();

                const mappedMembers = members.map((m: any) => {
                    const profile = profileMap.get(m.user_id);
                    let name = '';

                    if (profile) {
                        if (profile.first_name && profile.last_name) {
                            name = `${profile.first_name} ${profile.last_name}`;
                        } else if (profile.email) {
                            name = profile.email;
                        }
                    }

                    // Fallback if no profile found
                    if (!name) {
                        name = `User ${m.user_id.slice(0, 8)}`;
                    }

                    // Append (You) if it's the current user
                    if (currentUser && m.user_id === currentUser.id) {
                        name += " (You)";
                    }

                    return {
                        user_id: m.user_id,
                        display_name: name
                    };
                });
                setParticipants(mappedMembers);
            }
        } catch (error) {
            console.error("Error fetching session details:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSnackbarClose = () => {
        setSnackbar({ ...snackbar, open: false });
    };

    const handleAddUser = async () => {
        if (!shareEmail) return;

        try {
            // 1. Check if user exists
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', shareEmail)
                .single();

            if (profileError || !profileData) {
                setSnackbar({ open: true, message: 'User with this email not found.', severity: 'error' });
                return;
            }

            const userIdToAdd = profileData.id;

            // 2. Check if already member
            const isMember = participants.some(p => p.user_id === userIdToAdd);
            if (isMember) {
                setSnackbar({ open: true, message: 'User is already a member.', severity: 'warning' });
                return;
            }

            // 3. Add to session
            const { error: addError } = await supabase
                .from('session_member')
                .insert({
                    session_id: sessionId,
                    user_id: userIdToAdd
                });

            if (addError) {
                console.error("Error adding user:", addError);
                setSnackbar({ open: true, message: 'Failed to add user.', severity: 'error' });
            } else {
                setSnackbar({ open: true, message: 'User added successfully.', severity: 'success' });
                setOpenShareDialog(false);
                setShareEmail('');
                if (sessionId) fetchSessionData(sessionId);
            }
        } catch (error) {
            console.error("Error in handleAddUser:", error);
            setSnackbar({ open: true, message: 'An unexpected error occurred.', severity: 'error' });
        }
    };

    const filteredParticipants = participants.filter(p =>
        p.display_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="session-page">
            {/* Top Toolbar */}
            <div className="session-toolbar">
                <div className="toolbar-left">
                    <Tooltip title="Back to Dashboard">
                        <IconButton onClick={() => navigate('/dashboard')} className="back-button" size="small">
                            <ArrowBackIcon />
                        </IconButton>
                    </Tooltip>

                    {/* Participants */}
                    <div className="toolbar-participants">
                        <Tooltip title="View participants">
                            <Chip
                                icon={<GroupIcon sx={{ fontSize: '1rem' }} />}
                                label={`${participants.length} participant${participants.length !== 1 ? 's' : ''}`}
                                variant="outlined"
                                size="small"
                                onClick={() => setShowParticipants(!showParticipants)}
                                className="participants-chip"
                            />
                        </Tooltip>
                        <AvatarGroup
                            max={5}
                            sx={{ cursor: 'pointer' }}
                            onClick={() => setShowParticipants(!showParticipants)}
                        >
                            {participants.map((p) => (
                                <Tooltip key={p.user_id} title={p.display_name}>
                                    <Avatar
                                        sx={{
                                            width: 28,
                                            height: 28,
                                            fontSize: '0.75rem',
                                            bgcolor: 'var(--primary-color)',
                                            color: '#fff',
                                            border: '2px solid var(--widget-bg) !important'
                                        }}
                                    >
                                        {p.display_name[0].toUpperCase()}
                                    </Avatar>
                                </Tooltip>
                            ))}
                        </AvatarGroup>
                        <Tooltip title="Share session">
                            <IconButton size="small" onClick={() => setOpenShareDialog(true)} className="share-button">
                                <PersonAddIcon sx={{ fontSize: '1.1rem' }} />
                            </IconButton>
                        </Tooltip>
                    </div>
                </div>

                <div className="toolbar-right">
                    {/* Bot Status for Zoom sessions */}
                    {sourceType === 'Zoom' && (
                        <div className="toolbar-bot-status">
                            <SmartToyIcon className="bot-icon" />
                            {botLoading ? (
                                <div className="bot-status-loading">
                                    <CircularProgress size={12} />
                                    <span>Checking...</span>
                                </div>
                            ) : (
                                <div className={`bot-status-badge ${botStatus.status === 'active' ? 'active' : botStatus.running ? 'preparing' : 'inactive'}`}>
                                    <span className="bot-status-dot"></span>
                                    {botStatus.status === 'starting' && 'Starting...'}
                                    {botStatus.status === 'joining' && 'Joining...'}
                                    {botStatus.status === 'active' && 'Bot Active'}
                                    {(!botStatus.running || botStatus.status === 'stopped') && 'Bot Offline'}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Audio Player for offline sessions */}
                    {audioUrl && (
                        <div className="toolbar-audio">
                            <audio controls src={audioUrl} className="audio-player">
                                Your browser does not support the audio element.
                            </audio>
                        </div>
                    )}
                </div>
            </div>

            {/* Participants dropdown panel */}
            {showParticipants && (
                <div className="participants-backdrop" onClick={() => setShowParticipants(false)} />
            )}
            {showParticipants && (
                <div className="participants-dropdown">
                    <div className="participants-dropdown-header">
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'var(--heading-color)' }}>
                            Participants ({participants.length})
                        </Typography>
                        <TextField
                            variant="outlined"
                            placeholder="Search..."
                            size="small"
                            className="search-bar"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            sx={{ width: 160 }}
                        />
                    </div>
                    <Divider sx={{ borderColor: 'var(--border-color)' }} />
                    <List className="participants-dropdown-list" dense>
                        {filteredParticipants.map((p) => (
                            <ListItem key={p.user_id} className="participant-item-compact">
                                <Avatar
                                    sx={{
                                        width: 26,
                                        height: 26,
                                        fontSize: '0.7rem',
                                        bgcolor: 'var(--primary-color)',
                                        color: '#fff',
                                        mr: 1.5
                                    }}
                                >
                                    {p.display_name[0].toUpperCase()}
                                </Avatar>
                                <ListItemText
                                    primary={p.display_name}
                                    primaryTypographyProps={{
                                        noWrap: true,
                                        variant: 'body2',
                                        sx: { fontWeight: 500, color: 'var(--text-color)' }
                                    }}
                                />
                            </ListItem>
                        ))}
                        {filteredParticipants.length === 0 && (
                            <Typography variant="body2" sx={{ color: 'var(--text-color-secondary)', p: 2, textAlign: 'center' }}>
                                {searchTerm ? 'No participants found' : 'No participants yet'}
                            </Typography>
                        )}
                    </List>
                </div>
            )}

            {/* Main Content Area */}
            <div className="session-content">
                {/* Transcript Panel */}
                <Paper
                    className="panel transcript"
                    elevation={0}
                    style={{ flex: leftPanelWidth }}
                    ref={transcriptRef}
                    sx={{ backgroundColor: 'var(--widget-bg)' }}
                >
                    <Box p={2.5} height="100%" display="flex" flexDirection="column">
                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'var(--heading-color)' }}>
                            Transcript
                        </Typography>
                        <Divider sx={{ mb: 2, borderColor: 'var(--border-color)' }} />
                        <div className="scrollable-content" ref={transcriptScrollRef}>
                            {loading ? (
                                <Box className="loading-container">
                                    <CircularProgress size={32} />
                                </Box>
                            ) : transcripts.length > 0 ? (
                                <List sx={{ py: 0 }}>
                                    {transcripts.map((t) => (
                                        <ListItem
                                            key={t.id}
                                            alignItems="flex-start"
                                            sx={{
                                                px: 0,
                                                py: 1.5,
                                                borderBottom: '1px solid var(--border-color)',
                                                '&:last-child': { borderBottom: 'none' }
                                            }}
                                        >
                                            <ListItemText
                                                primary={
                                                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                                                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'var(--primary-color)' }}>
                                                            {t.speaker || 'Unknown Speaker'}
                                                        </Typography>
                                                        <Typography variant="caption" sx={{ color: 'var(--text-color-secondary)' }}>
                                                            {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </Typography>
                                                    </Box>
                                                }
                                                secondary={
                                                    <Typography variant="body2" sx={{ color: 'var(--text-color)', lineHeight: 1.6 }}>
                                                        {t.transcript}
                                                    </Typography>
                                                }
                                            />
                                        </ListItem>
                                    ))}
                                </List>
                            ) : (
                                <Box className="empty-state">
                                    <Typography variant="body2" sx={{ color: 'var(--text-color-secondary)' }}>
                                        No transcript available.
                                    </Typography>
                                </Box>
                            )}
                        </div>
                    </Box>
                </Paper>

                {/* Resizer */}
                <div className="resizer" onMouseDown={startResizing}>
                    <div className="resizer-bar"></div>
                </div>

                {/* Summary Panel */}
                <Paper
                    className="panel summary"
                    elevation={0}
                    style={{ flex: 100 - leftPanelWidth }}
                    ref={summaryRef}
                    sx={{ backgroundColor: 'var(--widget-bg)' }}
                >
                    <Box p={2.5} height="100%" display="flex" flexDirection="column">
                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'var(--heading-color)' }}>
                            Meeting Summary
                        </Typography>
                        <Divider sx={{ mb: 2, borderColor: 'var(--border-color)' }} />
                        <div className="scrollable-content">
                            {loading ? (
                                <Box className="loading-container">
                                    <CircularProgress size={32} />
                                </Box>
                            ) : summary ? (
                                <Typography variant="body1" className="summary-text">
                                    {summary}
                                </Typography>
                            ) : (
                                <Box className="empty-state">
                                    <Typography variant="body2" className="no-summary-text">
                                        No summary available for this session.
                                    </Typography>
                                </Box>
                            )}
                        </div>
                    </Box>
                </Paper>
            </div>

            <Dialog
                open={openShareDialog}
                onClose={() => setOpenShareDialog(false)}
                className="share-dialog"
            >
                <DialogTitle className="share-dialog-title">Share Session</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="User Email"
                        type="email"
                        fullWidth
                        variant="outlined"
                        value={shareEmail}
                        onChange={(e) => setShareEmail(e.target.value)}
                        className="share-email-input"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenShareDialog(false)} className="dialog-cancel-btn">Cancel</Button>
                    <Button onClick={handleAddUser} variant="contained" className="dialog-add-btn">Add</Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleSnackbarClose}>
                <Alert onClose={handleSnackbarClose} severity={snackbar.severity} className="snackbar-alert">
                    {snackbar.message}
                </Alert>
            </Snackbar>

            {/* Bot Loading Overlay */}
            {sourceType === 'Zoom' && !botLoading && botStatus.running && (botStatus.status === 'starting' || botStatus.status === 'joining') && (
                <div className="bot-loading-overlay">
                    <div className="bot-loading-content">
                        <SmartToyIcon className="bot-loading-icon" />
                        <CircularProgress size={40} />
                        <Typography variant="h6" className="bot-loading-text">
                            {botStatus.status === 'starting' ? 'Starting Zoom Bot' : 'Joining Meeting'}
                        </Typography>
                        <Typography variant="body2" className="bot-loading-subtext">
                            {botStatus.status === 'starting'
                                ? 'Initializing bot container...'
                                : 'Connecting to your meeting...'}
                        </Typography>
                    </div>
                </div>
            )}
        </div>
    );
}
