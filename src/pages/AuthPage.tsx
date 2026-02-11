import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import './AuthPage.css';

export default function AuthPage() {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            first_name: firstName,
                            last_name: lastName,
                        },
                    },
                });
                if (error) throw error;
                setMessage('Check your email for the verification link!');
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                // Navigation acts as a backup, but App.tsx session listener is primary
                navigate('/dashboard');
            }
        } catch (error: any) {
            setMessage(error.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container auth-page-container">
            <div className="auth-widget">
                <h2>{isSignUp ? 'Sign Up' : 'Sign In'}</h2>
                <form className="form-widget" onSubmit={handleAuth}>
                    {isSignUp && (
                        <>
                            <div>
                                <label htmlFor="firstName">First Name</label>
                                <input
                                    className="inputField"
                                    id="firstName"
                                    type="text"
                                    placeholder="First Name"
                                    value={firstName}
                                    required={true}
                                    onChange={(e) => setFirstName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label htmlFor="lastName">Last Name</label>
                                <input
                                    className="inputField"
                                    id="lastName"
                                    type="text"
                                    placeholder="Last Name"
                                    value={lastName}
                                    required={true}
                                    onChange={(e) => setLastName(e.target.value)}
                                />
                            </div>
                        </>
                    )}
                    <div>
                        <label htmlFor="email">Email</label>
                        <input
                            className="inputField"
                            id="email"
                            type="email"
                            placeholder="Your email"
                            value={email}
                            required={true}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <label htmlFor="password">Password</label>
                        <input
                            className="inputField"
                            id="password"
                            type="password"
                            placeholder="Your password"
                            value={password}
                            required={true}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <div>
                        <button className={'button block primary'} disabled={loading}>
                            {loading ? <span>Loading</span> : <span>{isSignUp ? 'Sign Up' : 'Sign In'}</span>}
                        </button>
                    </div>
                </form>
                <p>
                    {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                    <button
                        className="button-link"
                        type="button"
                        onClick={() => {
                            setIsSignUp(!isSignUp);
                            setMessage('');
                        }}
                    >
                        {isSignUp ? 'Sign In' : 'Sign Up'}
                    </button>
                </p>
                {message && <div className="message">{message}</div>}
            </div>
        </div>
    );
}
