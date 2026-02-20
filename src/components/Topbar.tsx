import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Avatar,
    Menu,
    MenuItem,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Button,
    TextField,
    Typography,
    Divider,
    Select,
    FormControl,
    InputLabel,
    CircularProgress
} from '@mui/material';
import { supabase } from '../supabaseClient';
import './Topbar.css';

interface TopbarProps {
    session: any;
    theme: string;
    toggleTheme: () => void;
}

export default function Topbar({ session, theme, toggleTheme }: TopbarProps) {
    const navigate = useNavigate();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);

    // Account Dialog State
    const [accountOpen, setAccountOpen] = useState(false);
    const [accountFirstName, setAccountFirstName] = useState('');
    const [accountLastName, setAccountLastName] = useState('');
    const [accountEmail, setAccountEmail] = useState('');
    const [lastSignIn, setLastSignIn] = useState('');
    const [accountCreated, setAccountCreated] = useState('');
    const [accountMessage, setAccountMessage] = useState('');

    // Settings Dialog State
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [selectedModel, setSelectedModel] = useState('');
    const [settingsLoading, setSettingsLoading] = useState(false);
    const [settingsMessage, setSettingsMessage] = useState('');

    const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };
    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleAccountOpen = async () => {
        const { user } = session;
        // Try to fetch profile details first if available, otherwise fallback to metadata
        let firstName = user.user_metadata?.first_name || '';
        let lastName = user.user_metadata?.last_name || '';

        // Fetch latest profile data
        const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name, email')
            .eq('id', user.id)
            .single();

        if (profile) {
            firstName = profile.first_name || firstName;
            lastName = profile.last_name || lastName;
        }

        setAccountFirstName(firstName);
        setAccountLastName(lastName);
        setAccountEmail(user.email || '');
        setLastSignIn(user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Never');
        setAccountCreated(user.created_at ? new Date(user.created_at).toLocaleString() : 'Unknown');
        setAccountMessage('');
        setAccountOpen(true);
        handleMenuClose();
    };

    const handleAccountClose = () => {
        setAccountOpen(false);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    const handleUpdateAccount = async () => {
        setAccountMessage('Updating...');
        try {
            const updates: any = {
                data: {
                    first_name: accountFirstName,
                    last_name: accountLastName,
                }
            };

            if (accountEmail !== session.user.email) {
                updates.email = accountEmail;
            }

            const { error } = await supabase.auth.updateUser(updates);

            if (error) {
                throw error;
            }

            // Also update profiles table
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: session.user.id,
                    first_name: accountFirstName,
                    last_name: accountLastName,
                    email: accountEmail
                });

            if (profileError) {
                console.error('Error updating profile:', profileError);
            }

            setAccountMessage('Account updated successfully!');
        } catch (error: any) {
            setAccountMessage(`Error: ${error.message}`);
        }
    };

    const handleDeleteAccount = async () => {
        if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
            try {
                const { error } = await supabase.rpc('delete_account');
                if (error) throw error;
                await supabase.auth.signOut();
            } catch (error: any) {
                setAccountMessage(`Error deleting account: ${error.message}.`);
            }
        }
    };

    // Settings handlers
    const handleSettingsOpen = async () => {
        setSettingsLoading(true);
        setSettingsMessage('');
        setSettingsOpen(true);
        handleMenuClose();

        try {
            // Fetch available models
            const modelsRes = await fetch('http://localhost:3001/api/models');
            if (modelsRes.ok) {
                const modelsData = await modelsRes.json();
                setAvailableModels(modelsData.models || []);
            } else {
                setSettingsMessage('Could not load models. Is Ollama running?');
            }

            // Fetch current preference
            const userId = session?.user?.id;
            if (userId) {
                const prefRes = await fetch(`http://localhost:3001/api/preferences/${userId}`);
                if (prefRes.ok) {
                    const prefData = await prefRes.json();
                    setSelectedModel(prefData.preferred_model || '');
                }
            }
        } catch (err: any) {
            setSettingsMessage(`Error loading settings: ${err.message}`);
        } finally {
            setSettingsLoading(false);
        }
    };

    const handleSettingsClose = () => {
        setSettingsOpen(false);
    };

    const handleSaveSettings = async () => {
        setSettingsMessage('Saving...');
        try {
            const userId = session?.user?.id;
            if (!userId) throw new Error('Not logged in');

            const res = await fetch(`http://localhost:3001/api/preferences/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ preferred_model: selectedModel }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to save');
            }

            setSettingsMessage('Settings saved successfully!');
        } catch (error: any) {
            setSettingsMessage(`Error: ${error.message}`);
        }
    };

    const user = session?.user;
    const userMetadata = user?.user_metadata || {};
    const { first_name, last_name } = userMetadata;

    // Use session metadata for the displayed name to avoid live updates while editing.
    // The topbar should only update when the session is refreshed (after a successful update).
    const displayName = (first_name && last_name) ? `${first_name} ${last_name}` : (user?.email || '');

    return (
        <div className="topbar">
            <div className="topbar-left">
                <div className="topbar-brand" onClick={() => navigate(user ? '/dashboard' : '/')}>
                    <img src="/SummarAIzeLogo.svg" alt="SummarAIze Logo" className="topbar-logo" />
                    <h3 className="topbar-title">Meeting Assistant</h3>
                </div>
            </div>
            <div className="topbar-right">
                <button
                    className="theme-toggle"
                    onClick={toggleTheme}
                >
                    {theme === 'light' ? '🌙' : '☀️'}
                </button>

                {user && (
                    <>
                        <div
                            onClick={handleMenuClick}
                            className="user-profile-widget"
                        >
                            <Avatar sx={{ width: 32, height: 32 }}>
                                {displayName ? displayName.charAt(0).toUpperCase() : 'U'}
                            </Avatar>
                            <span className="user-name">{displayName}</span>
                        </div>

                        <Menu
                            anchorEl={anchorEl}
                            open={open}
                            onClose={handleMenuClose}
                            onClick={handleMenuClose}
                            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                            slotProps={{
                                paper: {
                                    className: 'user-menu-paper',
                                    elevation: 2
                                }
                            }}
                        >
                            <MenuItem onClick={handleAccountOpen} className="user-menu-item">Account</MenuItem>
                            <MenuItem onClick={handleSettingsOpen} className="user-menu-item">Settings</MenuItem>
                            <MenuItem onClick={handleLogout} className="user-menu-item">Sign Out</MenuItem>
                        </Menu>

                        <Dialog open={accountOpen} onClose={handleAccountClose} fullWidth maxWidth="sm" className="account-dialog">
                            <DialogTitle className="account-dialog-title">Account</DialogTitle>
                            <DialogContent>
                                <TextField
                                    margin="dense"
                                    label="Email Address"
                                    type="email"
                                    fullWidth
                                    variant="outlined"
                                    value={accountEmail}
                                    onChange={(e) => setAccountEmail(e.target.value)}
                                    className="account-input"
                                />
                                <TextField
                                    margin="dense"
                                    label="First Name"
                                    type="text"
                                    fullWidth
                                    variant="outlined"
                                    value={accountFirstName}
                                    onChange={(e) => setAccountFirstName(e.target.value)}
                                    className="account-input"
                                />
                                <TextField
                                    margin="dense"
                                    label="Last Name"
                                    type="text"
                                    fullWidth
                                    variant="outlined"
                                    value={accountLastName}
                                    onChange={(e) => setAccountLastName(e.target.value)}
                                    className="account-input"
                                />

                                <div style={{ marginTop: 20 }}>
                                    <Typography variant="caption" display="block" sx={{ color: 'var(--text-color-secondary)' }}>
                                        Account Created: {accountCreated}
                                    </Typography>
                                    <Typography variant="caption" display="block" sx={{ color: 'var(--text-color-secondary)' }}>
                                        Last Sign In: {lastSignIn}
                                    </Typography>
                                </div>

                                {accountMessage && (
                                    <Typography color="primary" variant="body2" style={{ marginTop: 10 }}>
                                        {accountMessage}
                                    </Typography>
                                )}

                                <Divider style={{ margin: '20px 0' }} className="account-divider" />

                                <Typography variant="subtitle2" color="error" gutterBottom>
                                    Danger Zone
                                </Typography>
                                <Button
                                    variant="outlined"
                                    color="error"
                                    size="small"
                                    onClick={handleDeleteAccount}
                                    className="account-delete-btn"
                                >
                                    Delete Account
                                </Button>
                            </DialogContent>
                            <DialogActions>
                                <Button onClick={handleAccountClose} className="account-close-btn">Close</Button>
                                <Button onClick={handleUpdateAccount} variant="contained" className="account-update-btn">Update Account</Button>
                            </DialogActions>
                        </Dialog>

                        {/* Settings Dialog */}
                        <Dialog open={settingsOpen} onClose={handleSettingsClose} fullWidth maxWidth="sm" className="settings-dialog">
                            <DialogTitle className="settings-dialog-title">Settings</DialogTitle>
                            <DialogContent>
                                <Typography variant="subtitle2" sx={{ color: 'var(--text-color-secondary)', mt: 1, mb: 2 }}>
                                    Choose which LLM model to use for summarization and chat.
                                </Typography>

                                {settingsLoading ? (
                                    <div className="settings-loading">
                                        <CircularProgress size={28} />
                                        <Typography variant="body2" sx={{ ml: 2, color: 'var(--text-color-secondary)' }}>
                                            Loading models...
                                        </Typography>
                                    </div>
                                ) : (
                                    <FormControl fullWidth variant="outlined" className="settings-select">
                                        <InputLabel id="model-select-label">Preferred Model</InputLabel>
                                        <Select
                                            labelId="model-select-label"
                                            value={selectedModel}
                                            onChange={(e) => setSelectedModel(e.target.value)}
                                            label="Preferred Model"
                                        >
                                            {availableModels.map((model) => (
                                                <MenuItem key={model} value={model}>{model}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                )}

                                {settingsMessage && (
                                    <Typography color="primary" variant="body2" style={{ marginTop: 12 }}>
                                        {settingsMessage}
                                    </Typography>
                                )}
                            </DialogContent>
                            <DialogActions>
                                <Button onClick={handleSettingsClose} className="settings-close-btn">Close</Button>
                                <Button
                                    onClick={handleSaveSettings}
                                    variant="contained"
                                    className="settings-save-btn"
                                    disabled={settingsLoading || !selectedModel}
                                >
                                    Save
                                </Button>
                            </DialogActions>
                        </Dialog>
                    </>
                )}
            </div>
        </div>
    );
}
