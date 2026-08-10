'use client';

import React, { useState, useEffect } from 'react';
import { db, Branch, UserRole } from '../lib/db';
import { 
  Building2, 
  Plus, 
  Search, 
  KeyRound, 
  Power, 
  Trash2, 
  LogIn, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  Users, 
  Mail, 
  Phone, 
  MapPin,
  X
} from 'lucide-react';

interface BranchManagementProps {
  onSelectBranch?: (branch: Branch) => void;
  onBranchesUpdated?: (branches: Branch[]) => void;
  onBack?: () => void;
}

export const BranchManagement: React.FC<BranchManagementProps> = ({
  onSelectBranch,
  onBranchesUpdated,
  onBack,
}) => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('Tentoru2026!');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Load branches
  const loadBranches = async () => {
    const list = await db.fetchBranches();
    setBranches(list);
    onBranchesUpdated?.(list);
  };

  useEffect(() => {
    loadBranches();

    const handleBranchesUpdate = (e: any) => {
      if (e.detail?.branches) {
        setBranches(e.detail.branches);
        onBranchesUpdated?.(e.detail.branches);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('tentoru_branches_updated', handleBranchesUpdate);
      return () => window.removeEventListener('tentoru_branches_updated', handleBranchesUpdate);
    }
  }, []);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Generate random strong password
  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let res = '';
    for (let i = 0; i < 10; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormPassword(res + '1!');
  };

  // Create new branch
  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) {
      showToast('校舎名とメールアドレスは必須です', 'error');
      return;
    }

    setLoading(true);
    try {
      // Call API route or DB directly
      const res = await fetch('/api/admin/branches/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          code: formCode,
          email: formEmail,
          password: formPassword,
          phone: formPhone,
          address: formAddress
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'アカウント発行に失敗しました');
      }

      const resData = await res.json();
      if (resData?.branch) {
        await db.saveBranch(resData.branch);
      }

      showToast(`校舎アカウント「${formName}」を発行しました。`, 'success');
      setIsCreateModalOpen(false);
      // Reset form
      setFormName('');
      setFormCode('');
      setFormEmail('');
      setFormPassword('Tentoru2026!');
      setFormPhone('');
      setFormAddress('');
      await loadBranches();
    } catch (err: any) {
      console.warn('API error falling back to direct db save:', err);
      try {
        const createdBranch = await db.createBranchAccount({
          name: formName,
          code: formCode,
          email: formEmail,
          password: formPassword,
          phone: formPhone,
          address: formAddress
        });
        showToast(`校舎アカウント「${formName}」を発行しました。`, 'success');
        setIsCreateModalOpen(false);
        setFormName('');
        setFormCode('');
        setFormEmail('');
        setFormPassword('Tentoru2026!');
        setFormPhone('');
        setFormAddress('');
        await loadBranches();
      } catch (innerErr: any) {
        showToast(`エラー: ${innerErr?.message || 'アカウント作成に失敗しました'}`, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // Toggle status
  const handleToggleStatus = async (branch: Branch) => {
    try {
      await db.toggleBranchStatus(branch.id);
      showToast(`「${branch.name}」のアカウントを${branch.status === 'active' ? '一時停止' : '有効化'}しました。`, 'success');
      loadBranches();
    } catch (err: any) {
      showToast(`ステータス更新失敗: ${err.message}`, 'error');
    }
  };

  // Password reset
  const handleResetPassword = async (branch: Branch) => {
    try {
      const res = await db.sendBranchPasswordReset(branch.email);
      showToast(res.message, 'success');
    } catch (err: any) {
      showToast(`送信失敗: ${err.message}`, 'error');
    }
  };

  // Delete branch
  const handleDeleteBranch = async (branch: Branch) => {
    if (confirm(`校舎「${branch.name}」のアカウントを削除しますか？\n（所属生徒のデータは保持されます）`)) {
      try {
        await db.deleteBranch(branch.id);
        showToast(`「${branch.name}」を削除しました。`, 'success');
        loadBranches();
      } catch (err: any) {
        showToast(`削除失敗: ${err.message}`, 'error');
      }
    }
  };

  // Filtered branches
  const filteredBranches = branches.filter(b => {
    const matchesSearch = 
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalStudents = branches.reduce((acc, b) => acc + (b.student_count || 0), 0);
  const activeBranchesCount = branches.filter(b => b.status === 'active').length;
  const suspendedBranchesCount = branches.filter(b => b.status === 'suspended').length;

  return (
    <div style={{ padding: '4px 0' }}>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            backgroundColor: toast.type === 'success' ? '#10b981' : '#ef4444',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 600,
            fontSize: '0.9rem'
          }}
        >
          {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          {toast.message}
        </div>
      )}

      {/* Header Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '20px',
          backgroundColor: '#ffffff',
          padding: '18px 24px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #4f46e5, #3730a3)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Building2 size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#1e293b' }}>
                本部専用 校舎アカウント管理
              </h2>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                マルチテナント対応・校舎別アクセス制御・権限マネジメント
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#475569',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              ダッシュボードへ戻る
            </button>
          )}
          <button
            type="button"
            data-testid="open-create-branch-modal"
            onClick={() => setIsCreateModalOpen(true)}
            style={{
              padding: '9px 18px',
              borderRadius: '8px',
              border: 'none',
              background: 'linear-gradient(135deg, #4f46e5, #4338ca)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(79, 70, 229, 0.35)'
            }}
          >
            <Plus size={18} />
            新規校舎アカウント発行
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <div style={{ backgroundColor: '#ffffff', padding: '16px 18px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: '#e0e7ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Building2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>登録校舎総数</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e293b' }}>{branches.length} <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>校舎</span></div>
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '16px 18px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>稼働中 (有効)</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#16a34a' }}>{activeBranchesCount} <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>校舎</span></div>
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '16px 18px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Power size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>一時停止中</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#dc2626' }}>{suspendedBranchesCount} <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>校舎</span></div>
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '16px 18px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>全校舎 所属生徒数</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e293b' }}>{totalStudents} <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>名</span></div>
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '16px',
          backgroundColor: '#ffffff',
          padding: '12px 18px',
          borderRadius: '10px',
          border: '1px solid #e2e8f0'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '240px' }}>
          <Search size={18} color="#94a3b8" />
          <input
            type="text"
            data-testid="branch-search-input"
            placeholder="校舎名、コード、メールアドレスで検索..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              border: 'none',
              outline: 'none',
              width: '100%',
              fontSize: '0.85rem',
              color: '#1e293b'
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {(['all', 'active', 'suspended'] as const).map(st => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: statusFilter === st ? '1px solid #4f46e5' : '1px solid #cbd5e1',
                backgroundColor: statusFilter === st ? '#4f46e5' : '#ffffff',
                color: statusFilter === st ? '#ffffff' : '#64748b'
              }}
            >
              {st === 'all' ? 'すべて' : st === 'active' ? '● 稼働中' : '● 停止中'}
            </button>
          ))}
        </div>
      </div>

      {/* Branches Table */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>校舎名 / コード</th>
              <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>ログインメールアドレス</th>
              <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>ステータス</th>
              <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>所属生徒</th>
              <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>最終ログイン</th>
              <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 700, color: '#475569', textAlign: 'right' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredBranches.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
                  該当する校舎アカウントが見つかりません。
                </td>
              </tr>
            ) : (
              filteredBranches.map(branch => {
                const isActive = branch.status === 'active';
                return (
                  <tr
                    key={branch.id}
                    data-testid={`branch-row-${branch.id}`}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      transition: 'background-color 0.15s ease'
                    }}
                  >
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '6px',
                            backgroundColor: isActive ? '#e0e7ff' : '#f1f5f9',
                            color: isActive ? '#4338ca' : '#94a3b8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <Building2 size={18} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.92rem' }}>
                            {branch.name}
                          </div>
                          <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                            CODE: {branch.code}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#334155' }}>
                        <Mail size={15} color="#94a3b8" />
                        <span>{branch.email}</span>
                      </div>
                      {branch.phone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                          <Phone size={13} color="#94a3b8" />
                          <span>{branch.phone}</span>
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '3px 9px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          backgroundColor: isActive ? '#dcfce7' : '#fee2e2',
                          color: isActive ? '#15803d' : '#b91c1c',
                          border: isActive ? '1px solid #bbf7d0' : '1px solid #fecaca'
                        }}
                      >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isActive ? '#16a34a' : '#dc2626' }} />
                        {isActive ? '稼働中 (有効)' : '一時停止中'}
                      </span>
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1e293b' }}>
                          {branch.student_count || 0}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>名</span>
                      </div>
                    </td>

                    <td style={{ padding: '14px 16px', fontSize: '0.78rem', color: '#64748b' }}>
                      {branch.last_login_at ? (
                        new Date(branch.last_login_at).toLocaleString('ja-JP', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      ) : (
                        <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>未ログイン</span>
                      )}
                    </td>

                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                        {/* Switch / Preview as this branch */}
                        {onSelectBranch && (
                          <button
                            type="button"
                            title="この校舎のダッシュボードに切り替え"
                            onClick={() => onSelectBranch(branch)}
                            style={{
                              padding: '5px 9px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              backgroundColor: '#ffffff',
                              color: '#334155',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            <LogIn size={14} color="#4f46e5" />
                            校舎表示
                          </button>
                        )}

                        {/* Reset password email */}
                        <button
                          type="button"
                          title="パスワード再設定メールを送信"
                          onClick={() => handleResetPassword(branch)}
                          style={{
                            padding: '5px 9px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: '#ffffff',
                            color: '#334155',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          <KeyRound size={14} color="#d97706" />
                          再設定
                        </button>

                        {/* Toggle active / suspend */}
                        <button
                          type="button"
                          title={isActive ? 'アカウントを一時停止' : 'アカウントを有効化'}
                          onClick={() => handleToggleStatus(branch)}
                          style={{
                            padding: '5px 9px',
                            borderRadius: '6px',
                            border: isActive ? '1px solid #fecaca' : '1px solid #bbf7d0',
                            backgroundColor: isActive ? '#fff5f5' : '#f0fdf4',
                            color: isActive ? '#dc2626' : '#16a34a',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          <Power size={14} />
                          {isActive ? '停止' : '再開'}
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          title="校舎を削除"
                          onClick={() => handleDeleteBranch(branch)}
                          style={{
                            padding: '5px 7px',
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0',
                            backgroundColor: '#ffffff',
                            color: '#94a3b8',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create Branch Modal */}
      {isCreateModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px'
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '520px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              border: '1px solid #e2e8f0',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '18px 24px',
                borderBottom: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 size={20} color="#4f46e5" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#1e293b' }}>
                  新規校舎アカウント発行
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateBranch} style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Branch Name & Code */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      校舎名 <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="例: 横浜教室"
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.88rem'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      校舎コード
                    </label>
                    <input
                      type="text"
                      placeholder="例: YOKOHAMA"
                      value={formCode}
                      onChange={e => setFormCode(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.88rem',
                        textTransform: 'uppercase'
                      }}
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    ログインメールアドレス <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="例: yokohama@tentoru.jp"
                    value={formEmail}
                    onChange={e => setFormEmail(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.88rem'
                    }}
                  />
                </div>

                {/* Password */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                      初期パスワード <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleGeneratePassword}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#4f46e5',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <RefreshCw size={12} />
                      自動生成
                    </button>
                  </div>

                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={formPassword}
                      onChange={e => setFormPassword(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 40px 9px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.88rem',
                        fontFamily: showPassword ? 'inherit' : 'monospace'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer'
                      }}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Phone & Address */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      電話番号
                    </label>
                    <input
                      type="tel"
                      placeholder="045-123-4567"
                      value={formPhone}
                      onChange={e => setFormPhone(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.88rem'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      所在地・教室住所
                    </label>
                    <input
                      type="text"
                      placeholder="例: 神奈川県横浜市西区..."
                      value={formAddress}
                      onChange={e => setFormAddress(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.88rem'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  marginTop: '24px',
                  paddingTop: '16px',
                  borderTop: '1px solid #f1f5f9'
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#64748b',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  キャンセル
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #4f46e5, #4338ca)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {loading ? '発行中...' : 'アカウントを発行する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BranchManagement;
