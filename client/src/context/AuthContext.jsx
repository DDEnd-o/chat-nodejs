import { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        const stored = localStorage.getItem('user');
        return stored ? JSON.parse(stored) : null;
    });

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token && user) {
            connectSocket(token);
        }
        return () => disconnectSocket();
    }, []);

    async function login(username, password) {
        const { data } = await api.post('/auth/login', { username, password });
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
        connectSocket(data.token);
        return data.user;
    }

    async function register(payload) {
        const { data } = await api.post('/auth/register', payload);
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
        connectSocket(data.token);
        return data.user;
    }

    function logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        disconnectSocket();
    }

    return (
        <AuthContext.Provider value={{ user, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
