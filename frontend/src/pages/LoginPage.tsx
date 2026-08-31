import React, { useState } from 'react';
import { Layers, ArrowRight, Lock, Mail, CheckSquare, Square, X, Shield, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Button } from '../components/ui/Button';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isRegisterMode) {
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (!acceptTerms) {
        setError('You must accept the Terms and Conditions to register');
        return;
      }
    }

    setIsLoading(true);

    try {
      if (isRegisterMode) {
        const { token } = await api.signup(email, password);
        login(token, email);
      } else {
        const { token } = await api.login(email, password);
        login(token, email);
      }
    } catch (err: any) {
      if (err.message === 'invalid credentials') {
        setError('Invalid email or password');
      } else if (err.message === 'user already exists') {
        setError('An account with this email already exists');
      } else {
        setError(err.message || 'Authentication failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-base p-4 select-none relative">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-10 h-10 rounded bg-surface border border-border flex items-center justify-center text-text-primary mb-3">
            <Layers className="w-5 h-5 text-accent" />
          </div>
          <h1 className="text-sm font-semibold tracking-wider text-text-primary uppercase">
            K8s Monitoring Tool
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            {isRegisterMode ? 'Operator Account Registration' : 'Operator Console Authentication'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface border border-border rounded p-6 shadow-none">
          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-base border border-border rounded mb-5">
            <button
              type="button"
              onClick={() => {
                setIsRegisterMode(false);
                setError(null);
              }}
              className={`py-1.5 text-xs font-medium rounded transition-colors ${
                !isRegisterMode
                  ? 'bg-surface text-text-primary border border-border/80 font-semibold'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRegisterMode(true);
                setError(null);
              }}
              className={`py-1.5 text-xs font-medium rounded transition-colors ${
                isRegisterMode
                  ? 'bg-surface text-text-primary border border-border/80 font-semibold'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-2.5 rounded bg-status-critical/10 border border-status-critical/30 text-status-critical text-xs font-mono">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-xxs font-semibold uppercase tracking-wider text-text-secondary mb-1.5"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-text-secondary/60 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@domain.com"
                  className="w-full bg-base border border-border rounded pl-9 pr-3 py-2 text-xs text-text-primary font-mono placeholder:text-text-secondary/40 focus:border-accent focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xxs font-semibold uppercase tracking-wider text-text-secondary mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 text-text-secondary/60 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-base border border-border rounded pl-9 pr-3 py-2 text-xs text-text-primary font-mono placeholder:text-text-secondary/40 focus:border-accent focus:outline-none transition-colors"
                />
              </div>
            </div>

            {isRegisterMode && (
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-xxs font-semibold uppercase tracking-wider text-text-secondary mb-1.5"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-text-secondary/60 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-base border border-border rounded pl-9 pr-3 py-2 text-xs text-text-primary font-mono placeholder:text-text-secondary/40 focus:border-accent focus:outline-none transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Terms and Conditions Acceptance Checkbox */}
            {isRegisterMode && (
              <div className="pt-1">
                <label className="flex items-start space-x-2.5 cursor-pointer select-none">
                  <button
                    type="button"
                    onClick={() => setAcceptTerms(!acceptTerms)}
                    className="mt-0.5 text-accent focus:outline-none"
                  >
                    {acceptTerms ? (
                      <CheckSquare className="w-4 h-4 text-accent" />
                    ) : (
                      <Square className="w-4 h-4 text-text-secondary/60 hover:text-text-secondary" />
                    )}
                  </button>
                  <span className="text-xs text-text-secondary leading-tight">
                    I accept the{' '}
                    <button
                      type="button"
                      onClick={() => setShowTermsModal(true)}
                      className="text-accent underline hover:text-accent-hover font-medium"
                    >
                      Terms & Conditions
                    </button>{' '}
                    and Monitoring Policy.
                  </span>
                </label>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isLoading}
              className="w-full mt-3 font-medium"
            >
              <span>{isRegisterMode ? 'Create Account' : 'Sign In'}</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </form>
        </div>

        {/* T&C Link */}
        <div className="mt-4 text-center space-y-1">
          <button
            type="button"
            onClick={() => setShowTermsModal(true)}
            className="text-xxs text-text-secondary hover:text-text-primary underline flex items-center justify-center mx-auto space-x-1"
          >
            <FileText className="w-3 h-3" />
            <span>Read Terms & Conditions</span>
          </button>
        </div>
      </div>

      {/* Terms and Conditions Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded max-w-lg w-full p-6 space-y-4 shadow-none animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4 text-accent" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
                  Terms & Conditions and Acceptable Use Policy
                </h3>
              </div>
              <button
                onClick={() => setShowTermsModal(false)}
                className="p-1 text-text-secondary hover:text-text-primary rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto pr-2 space-y-3 text-xs text-text-secondary leading-relaxed font-sans">
              <p>
                <strong className="text-text-primary">1. Operational Monitoring Access:</strong> This dashboard and its associated API endpoints are strictly intended for authorized cluster operators to observe, diagnose, and acknowledge operational alerts across monitored Kubernetes environments.
              </p>
              <p>
                <strong className="text-text-primary">2. Authentication & Credential Security:</strong> Operators are responsible for safeguarding their authentication tokens. Any action performed under an active operator session is attributed to that account.
              </p>
              <p>
                <strong className="text-text-primary">3. Alert Acknowledgment & Audit Trail:</strong> Acknowledging active threshold breaches updates persistent cluster incident records. False or unauthorized dismissals may delay automated incident escalation.
              </p>
              <p>
                <strong className="text-text-primary">4. Data Telemetry & Log Retrieval:</strong> Log extraction and Prometheus metrics queries are executed strictly within defined RBAC boundaries and cluster namespaces.
              </p>
            </div>

            <div className="border-t border-border pt-4 flex items-center justify-between">
              <span className="text-xxs font-mono text-text-secondary">
                Version 1.0 (Enterprise Monitoring)
              </span>
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    setAcceptTerms(true);
                    setShowTermsModal(false);
                  }}
                >
                  Accept & Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
