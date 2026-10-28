import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { KeyRound, User, Hash, Lock, ArrowRight, CheckCircle2, Eye, EyeOff, X } from 'lucide-react';

export const ForgotPassword = ({ onNavigate }) => {
  const { forgotPassword } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    ssn: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Format 12-digit Aadhaar / SSN as XXXX-XXXX-XXXX
  const handleSSNChange = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 12) val = val.slice(0, 12);

    let formatted = val;
    if (val.length > 8) {
      formatted = `${val.slice(0, 4)}-${val.slice(4, 8)}-${val.slice(8)}`;
    } else if (val.length > 4) {
      formatted = `${val.slice(0, 4)}-${val.slice(4)}`;
    }

    setFormData({ ...formData, ssn: formatted });
  };

  const pw = formData.newPassword;
  const pwChecks = {
    length: pw.length >= 8,
    lower: /[a-z]/.test(pw),
    upper: /[A-Z]/.test(pw),
    number: /\d/.test(pw),
    symbol: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(pw)
  };
  const isPasswordStrong = Object.values(pwChecks).every(Boolean);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const { username, ssn, newPassword, confirmPassword } = formData;

    if (!username || !ssn || !newPassword) {
      setError('Please provide your Username, SSN, and New Password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    if (!isPasswordStrong) {
      setError('New password must be at least 8 characters and include uppercase, lowercase, a number, and a special symbol.');
      return;
    }

    const ssnDigits = ssn.replace(/\D/g, '');
    if (ssnDigits.length !== 12) {
      setError('Please provide a complete 12-digit Aadhaar / SSN (format: 0000-0000-0000).');
      return;
    }

    setLoading(true);

    try {
      const res = await forgotPassword({
        username: username.trim(),
        ssn: ssnDigits,
        newPassword,
        confirmPassword
      });
      setSuccess(res.message || 'Password successfully reset!');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Verification or password reset failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative'
    }}>
      <div className="ambient-glow" />

      <div style={{
        width: '100%',
        maxWidth: '440px',
        position: 'relative',
        zIndex: 10
      }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '50px',
            height: '50px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(99, 102, 241, 0.25) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            marginBottom: '10px'
          }}>
            <KeyRound size={26} color="#fbbf24" />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '4px' }}>
            Password <span className="gradient-text-indigo">Recovery</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px' }}>
            Verify your identity with your Username & SSN
          </p>
        </div>

        {/* Card */}
        <div className="glass-panel" style={{ padding: '30px' }}>
          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#fca5a5',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div style={{
                display: 'inline-flex',
                padding: '12px',
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.15)',
                marginBottom: '14px'
              }}>
                <CheckCircle2 size={36} color="#10b981" />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#34d399', marginBottom: '8px' }}>
                Password Reset Successfully!
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', marginBottom: '22px' }}>
                Your identity was verified via SSN and your password has been securely updated.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('login')}
                className="btn btn-primary"
                style={{ width: '100%', height: '44px' }}
              >
                <span>Back to Sign In</span>
                <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Username or Email Address</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Enter registered username or email"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    style={{ paddingLeft: '38px' }}
                    required
                  />
                  <User size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Aadhaar / SSN (12 Digits)</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="0000-0000-0000"
                    value={formData.ssn}
                    onChange={handleSSNChange}
                    style={{ paddingLeft: '38px', letterSpacing: '1px' }}
                    maxLength={14}
                    required
                  />
                  <Hash size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  12-digit Aadhaar / SSN matched against encrypted hash for identity verification.
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Enter new password (min 8 chars)"
                    value={formData.newPassword}
                    onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                    style={{ paddingLeft: '38px', paddingRight: '38px' }}
                    required
                  />
                  <Lock size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    title={showNewPassword ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '10px' }}>
                <label className="form-label">Confirm New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Confirm new password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    style={{ paddingLeft: '38px', paddingRight: '38px' }}
                    required
                  />
                  <Lock size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    title={showConfirmPassword ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Recommendations & Password Match Indicator */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                  Recommendation: 8+ characters, with uppercase, lowercase, number & symbol.
                </div>

                {formData.confirmPassword && (
                  <div style={{
                    fontSize: '12px',
                    marginTop: '6px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: formData.newPassword === formData.confirmPassword ? '#34d399' : '#f87171'
                  }}>
                    {formData.newPassword === formData.confirmPassword ? (
                      <>
                        <CheckCircle2 size={13} color="#34d399" />
                        <span>✓ Passwords match</span>
                      </>
                    ) : (
                      <>
                        <X size={13} color="#f87171" />
                        <span>✗ Passwords do not match</span>
                      </>
                    )}
                  </div>
                )}
              </div>


              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ width: '100%', height: '44px' }}
              >
                {loading ? 'Verifying SSN & Resetting...' : (
                  <>
                    <span>Verify SSN & Reset Password</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Back to Login */}
        <div style={{ textAlign: 'center', marginTop: '18px' }}>
          <button
            type="button"
            onClick={() => onNavigate('login')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            ← Remember your password? Back to Login
          </button>
        </div>
      </div>
    </div>
  );
};
