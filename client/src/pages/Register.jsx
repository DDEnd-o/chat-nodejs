import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ username: '', password: '', fullName: '', email: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    function update(field) {
        return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await register(form);
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.message || 'Đăng ký thất bại');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="auth-screen">
            <div className="auth-card">
                <h1 className="app-logo">💬 Chat App</h1>
                <form onSubmit={handleSubmit}>
                    <input placeholder="Họ tên" value={form.fullName} onChange={update('fullName')} required />
                    <input placeholder="Username" value={form.username} onChange={update('username')} required />
                    <input placeholder="Email (tuỳ chọn)" value={form.email} onChange={update('email')} />
                    <input
                        type="password"
                        placeholder="Password"
                        value={form.password}
                        onChange={update('password')}
                        required
                    />
                    {error && <p className="error-text">{error}</p>}
                    <button type="submit" disabled={loading}>
                        {loading ? 'Đang tạo tài khoản...' : 'Đăng ký'}
                    </button>
                </form>
                <p className="auth-switch">
                    Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
                </p>
            </div>
        </div>
    );
}
