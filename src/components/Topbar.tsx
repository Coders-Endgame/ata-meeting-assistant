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
    Divider
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

    const user = session?.user;
    const userMetadata = user?.user_metadata || {};
    const { first_name, last_name } = userMetadata;

    // Use session metadata for the displayed name to avoid live updates while editing.
    // The topbar should only update when the session is refreshed (after a successful update).
    const displayName = (first_name && last_name) ? `${first_name} ${last_name}` : (user?.email || '');

    return (
        <div className="topbar">
            <div className="topbar-left">
                <h3 className="topbar-title" onClick={() => navigate(user ? '/dashboard' : '/')}>Meeting Assistant</h3>
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
                    </>
                )}
            </div>
        </div>
    );
}
