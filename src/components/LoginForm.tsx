'use client';

import React, { useState } from 'react';
import { db, UserSession } from '../lib/db';
import { 
  Building2, 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  LogIn, 
  AlertCircle 
} from 'lucide-react';

interface LoginFormProps {
  onLoginSuccess: (session: UserSession) => void;
  theme?: 'light' | 'dark';
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onLoginSuccess,
  theme = 'light'
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await db.signInWithPassword(email, password);
      if (res.success && res.session) {
        onLoginSuccess(res.session);
      } else {
        setErrorMsg(res.error || 'ログインに失敗しました。メールアドレスとパスワードをご確認ください。');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || '予期せぬエラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
        padding: '24px 16px',
        backgroundImage: 'radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.10) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(168, 85, 247, 0.10) 0px, transparent 50%)',
        backgroundAttachment: 'fixed'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
          borderRadius: '20px',
          boxShadow: '0 20px 45px -10px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(226, 232, 240, 0.8)',
          overflow: 'hidden',
          padding: '36px 28px'
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #4f46e5, #3b82f6)',
              color: '#ffffff',
              marginBottom: '12px',
              boxShadow: '0 6px 16px rgba(79, 70, 229, 0.28)'
            }}
          >
            <Building2 size={26} />
          </div>

          <h1
            style={{
              fontSize: '1.65rem',
              fontWeight: 900,
              letterSpacing: '0.04em',
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              margin: '0 0 4px 0'
            }}
          >
            TENTORU
          </h1>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>
            個別最適化・学習管理 司令塔システム
          </div>
          <div
            style={{
              display: 'inline-block',
              padding: '2px 10px',
              backgroundColor: '#e0e7ff',
              color: '#4338ca',
              fontSize: '0.72rem',
              fontWeight: 700,
              borderRadius: '20px'
            }}
          >
            校舎・管理者 ログイン
          </div>
        </div>

        {/* Error Message */}
        {errorMsg && (
          <div
            data-testid="login-error-alert"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              padding: '11px 13px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '10px',
              color: '#b91c1c',
              fontSize: '0.82rem',
              marginBottom: '20px',
              lineHeight: 1.4
            }}
          >
            <AlertCircle size={17} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{errorMsg}</div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Email Input */}
          <div>
            <label
              htmlFor="login-email"
              style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: theme === 'dark' ? '#cbd5e1' : '#334155',
                marginBottom: '6px'
              }}
            >
              ログインID / メールアドレス
            </label>
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <Mail size={17} />
              </div>
              <input
                id="login-email"
                type="email"
                required
                data-testid="login-email-input"
                placeholder="example@tentoru.jp"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '11px 12px 11px 38px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: theme === 'dark' ? '#334155' : '#ffffff',
                  color: theme === 'dark' ? '#ffffff' : '#1e293b',
                  fontSize: '0.88rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s ease'
                }}
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label
              htmlFor="login-password"
              style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: theme === 'dark' ? '#cbd5e1' : '#334155',
                marginBottom: '6px'
              }}
            >
              パスワード
            </label>
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <Lock size={17} />
              </div>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                required
                data-testid="login-password-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '11px 40px 11px 38px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: theme === 'dark' ? '#334155' : '#ffffff',
                  color: theme === 'dark' ? '#ffffff' : '#1e293b',
                  fontSize: '0.88rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: showPassword ? 'inherit' : 'monospace'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            data-testid="login-submit-btn"
            style={{
              marginTop: '10px',
              padding: '12px 20px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #4f46e5, #4338ca)',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.95rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'transform 0.1s ease, opacity 0.15s ease',
              opacity: loading ? 0.7 : 1
            }}
          >
            <LogIn size={18} />
            {loading ? '認証中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginForm;
