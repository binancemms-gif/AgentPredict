import React, { useState, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  Check,
  ExternalLink,
  Plus,
  RefreshCw,
  LogOut,
  Upload,
  Layers,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  googleSignIn,
  logout,
  getAccessToken,
  getCurrentUser,
} from '../services/googleAuth';
import {
  createPredictionSpreadsheet,
  appendRoundsToSheet,
  listUserSpreadsheets,
  SheetFile,
  CreatedSheetInfo,
} from '../services/googleSheets';
import { RoundHistoryItem } from '../types';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onUserChange: (user: User | null) => void;
  history: RoundHistoryItem[];
  marketId: string;
  autoSyncEnabled: boolean;
  onToggleAutoSync: (enabled: boolean) => void;
  activeSheet: CreatedSheetInfo | null;
  onSetActiveSheet: (sheet: CreatedSheetInfo | null) => void;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  onClose,
  user,
  onUserChange,
  history,
  marketId,
  autoSyncEnabled,
  onToggleAutoSync,
  activeSheet,
  onSetActiveSheet,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [existingSheets, setExistingSheets] = useState<SheetFile[]>([]);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (user && isOpen) {
      loadDriveSheets();
    }
  }, [user, isOpen]);

  const loadDriveSheets = async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;
      const files = await listUserSpreadsheets(token);
      setExistingSheets(files);
    } catch (err) {
      console.error('Failed to load drive sheets:', err);
    }
  };

  const handleSignIn = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await googleSignIn();
      if (res) {
        onUserChange(res.user);
        const files = await listUserSpreadsheets(res.accessToken);
        setExistingSheets(files);
        setMessage({ text: `Signed in as ${res.user.email}`, type: 'success' });
      }
    } catch (err: unknown) {
      setMessage({
        text: (err as Error)?.message || 'Failed to sign in with Google',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await logout();
      onUserChange(null);
      onSetActiveSheet(null);
      onToggleAutoSync(false);
      setMessage({ text: 'Signed out successfully', type: 'success' });
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSheet = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication expired. Please sign in again.');

      const newSheet = await createPredictionSpreadsheet(
        token,
        `Up or Down · BTC & SOL Prediction Journal (${marketId})`
      );

      onSetActiveSheet(newSheet);

      // Immediately export existing history
      if (history.length > 0) {
        setSyncing(true);
        const count = await appendRoundsToSheet(
          token,
          newSheet.spreadsheetId,
          newSheet.firstSheetName,
          marketId,
          history
        );
        setMessage({
          text: `Created new spreadsheet and synced ${count} rounds!`,
          type: 'success',
        });
      } else {
        setMessage({
          text: 'New Google Sheet created and formatted with headers.',
          type: 'success',
        });
      }

      await loadDriveSheets();
    } catch (err: unknown) {
      setMessage({
        text: (err as Error)?.message || 'Failed to create spreadsheet',
        type: 'error',
      });
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  const handleSelectExisting = (file: SheetFile) => {
    onSetActiveSheet({
      spreadsheetId: file.id,
      spreadsheetUrl: file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}`,
      title: file.name,
      firstSheetName: 'Prediction History',
    });
    setMessage({ text: `Connected to "${file.name}"`, type: 'success' });
  };

  const handleExportRounds = async () => {
    if (!activeSheet) return;
    setSyncing(true);
    setMessage(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication expired');

      const count = await appendRoundsToSheet(
        token,
        activeSheet.spreadsheetId,
        activeSheet.firstSheetName || 'Prediction History',
        marketId,
        history
      );

      setMessage({
        text: `Exported ${count} rounds to "${activeSheet.title}"`,
        type: 'success',
      });
    } catch (err: unknown) {
      setMessage({
        text: (err as Error)?.message || 'Export failed',
        type: 'error',
      });
    } finally {
      setSyncing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-[#0e0e12] border border-[#262633] rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1f1f2a] bg-[#121218]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0f9d58]/15 border border-[#0f9d58]/30 flex items-center justify-center text-[#0f9d58]">
              <FileSpreadsheet className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Google Sheets Sync</h3>
              <p className="text-xs text-[#8b8b92] font-mono">Export and log prediction rounds</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8b8b92] hover:text-white hover:bg-[#1f1f2a] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-sm">
          {message && (
            <div
              className={`p-3 rounded-xl text-xs font-mono flex items-center gap-2 ${
                message.type === 'success'
                  ? 'bg-[#5ee26a]/10 border border-[#5ee26a]/30 text-[#5ee26a]'
                  : 'bg-[#ee3344]/10 border border-[#ee3344]/30 text-[#ee3344]'
              }`}
            >
              <span>{message.text}</span>
            </div>
          )}

          {/* Not signed in state */}
          {!user ? (
            <div className="p-4 rounded-xl bg-[#14141c] border border-[#252536] text-center space-y-3">
              <p className="text-xs text-[#cfcfd4] leading-relaxed">
                Connect your Google Account to create a live <strong>Prediction Journal</strong> in Google Sheets, automatically logging strike targets, win rates, payouts, and AI probabilities.
              </p>

              {/* Official Google Sign-In Button */}
              <button
                onClick={handleSignIn}
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-[#f1f1f5] text-[#1f1f1f] font-sans font-medium text-xs flex items-center justify-center gap-3 shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 48 48">
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                </svg>
                <span>{loading ? 'Signing in…' : 'Sign in with Google'}</span>
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[10px] text-[#8b8b92] font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-[#5ee26a]" />
                <span>Accesses Google Sheets with your explicit permission</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* User Account Info */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#14141c] border border-[#252536]">
                <div className="flex items-center gap-2.5">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full border border-[#3a3a4c]" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#2a2a38] text-white flex items-center justify-center font-bold text-xs">
                      {user.email?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="text-left">
                    <div className="text-xs font-bold text-white truncate max-w-[180px]">{user.displayName || 'Google User'}</div>
                    <div className="text-[10px] text-[#8b8b92] font-mono truncate max-w-[180px]">{user.email}</div>
                  </div>
                </div>

                <button
                  onClick={handleSignOut}
                  disabled={loading}
                  className="p-1.5 text-[#8b8b92] hover:text-[#ee3344] transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>

              {/* Active Connected Spreadsheet */}
              {activeSheet ? (
                <div className="p-3.5 rounded-xl bg-[#0f1912] border border-[#1e4d2b] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-[#5ee26a] font-semibold flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4" />
                      Connected Spreadsheet
                    </span>
                    <a
                      href={activeSheet.spreadsheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#5ee26a] hover:underline flex items-center gap-1 font-mono"
                    >
                      <span>Open</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="text-xs font-bold text-white truncate">{activeSheet.title}</div>

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <button
                      onClick={handleExportRounds}
                      disabled={syncing || history.length === 0}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#5ee26a]/20 hover:bg-[#5ee26a]/30 text-[#5ee26a] font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{syncing ? 'Exporting…' : `Export ${history.length} Rounds`}</span>
                    </button>

                    <label className="flex items-center gap-2 cursor-pointer font-mono text-[11px] text-[#cfcfd4]">
                      <input
                        type="checkbox"
                        checked={autoSyncEnabled}
                        onChange={(e) => onToggleAutoSync(e.target.checked)}
                        className="rounded border-[#3a3a4c] text-[#5ee26a] focus:ring-0"
                      />
                      <span>Auto-sync live</span>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-[#14141c] border border-[#252536] space-y-2">
                  <div className="text-xs font-bold text-white">No Spreadsheet Connected</div>
                  <p className="text-[11px] text-[#8b8b92] leading-relaxed">
                    Create a dedicated prediction journal spreadsheet with pre-formatted headers, or select an existing sheet from your Google Drive.
                  </p>
                  <button
                    onClick={handleCreateSheet}
                    disabled={loading}
                    className="w-full py-2 px-3 rounded-xl bg-[#0f9d58] hover:bg-[#0dae62] text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create New Prediction Journal Sheet</span>
                  </button>
                </div>
              )}

              {/* Existing Spreadsheets from Drive */}
              {existingSheets.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-mono font-semibold text-[#8b8b92] flex items-center justify-between">
                    <span>Recent Spreadsheets in Drive:</span>
                    <button
                      onClick={loadDriveSheets}
                      className="text-[10px] text-[#0f9d58] hover:underline"
                    >
                      Refresh
                    </button>
                  </div>
                  <div className="max-h-36 overflow-y-auto divide-y divide-[#1e1e28] border border-[#1e1e28] rounded-xl bg-[#121218]">
                    {existingSheets.map((file) => (
                      <div
                        key={file.id}
                        className="p-2.5 flex items-center justify-between text-xs hover:bg-[#1a1a24] transition-colors"
                      >
                        <div className="truncate max-w-[220px]">
                          <div className="text-white truncate font-medium">{file.name}</div>
                          <div className="text-[10px] text-[#8b8b92] font-mono">
                            {new Date(file.modifiedTime).toLocaleDateString()}
                          </div>
                        </div>

                        <button
                          onClick={() => handleSelectExisting(file)}
                          className="px-2.5 py-1 rounded-lg bg-[#252533] hover:bg-[#323245] text-white text-[11px] font-mono transition-colors"
                        >
                          Select
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#1f1f2a] bg-[#121218] flex justify-between items-center text-xs">
          <span className="text-[11px] text-[#8b8b92] font-mono">Google Sheets API v4</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#252533] hover:bg-[#323245] text-white font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
