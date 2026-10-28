import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, User, Mail, Hash, ArrowRight, CheckCircle2, ShieldCheck, Eye, EyeOff, X } from 'lucide-react';

export const Register = ({ onNavigate }) => {
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    email: '',
    ssn: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
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

  const pw = formData.password;
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

    const { username, fullName, email, ssn, password, confirmPassword } = formData;

    if (!username || !fullName || !email || !ssn || !password) {
      setError('Please complete all registration fields.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!isPasswordStrong) {
      setError('Password does not meet strong security requirements (min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special symbol).');
      return;
    }

    const ssnDigits = ssn.replace(/\D/g, '');
    if (ssnDigits.length !== 12) {
      setError('Please provide a complete 12-digit Aadhaar / SSN (format: 0000-0000-0000).');
      return;
    }

    setLoading(true);
    try {
      await register({
        username: username.trim(),
        fullName: fullName.trim(),
        email: email.trim(),
        ssn: ssnDigits,
        password,
        confirmPassword
      });
      onNavigate('chat');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Registration failed.');
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
        maxWidth: '480px',
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
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(14, 165, 233, 0.25) 100%)',
            border: '1px solid rgba(129, 140, 248, 0.4)',
            marginBottom: '10px'
          }}>
            <ShieldCheck size={26} color="#818cf8" />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '4px' }}>
            Citizen <span className="gradient-text-indigo">Registration</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px' }}>
            Create your private government schemes AI account
          </p>
        </div>

        {/* Form Card */}
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

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Priya Patel"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Username</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. priyap"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  className="form-input"
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={{ paddingLeft: '38px' }}
                  required
                />
                <Mail size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '13px' }} />
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
                12-digit Aadhaar / SSN required for identity verification and password recovery.
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Min 8 characters"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    style={{ paddingRight: '38px' }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Hide password' : 'Show password'}
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
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Re-enter password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    style={{ paddingRight: '38px' }}
                    required
                  />
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
                  color: formData.password === formData.confirmPassword ? '#34d399' : '#f87171'
                }}>
                  {formData.password === formData.confirmPassword ? (
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
              {loading ? 'Creating Account...' : (
                <>
                  <span>Complete Registration</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Back to Login */}
        <div style={{ textAlign: 'center', marginTop: '18px' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Already have an account?{' '}
          </span>
          <button
            type="button"
            onClick={() => onNavigate('login')}
            style={{
              background: 'none',
              border: 'none',
              color: '#818cf8',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            Sign In Here
          </button>
        </div>
      </div>
    </div>
  );
};
