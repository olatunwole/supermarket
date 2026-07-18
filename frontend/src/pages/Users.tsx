import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, 
  UserPlus, 
  X, 
  Edit2, 
  Key, 
  Check, 
  UserCheck, 
  UserMinus,
  Mail,
  User as UserIcon,
  ShieldCheck,
  Coins
} from 'lucide-react';

interface StaffUser {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'manager' | 'cashier' | 'stock_clerk';
  is_active: boolean;
  created_at: string;
}

export const Users: React.FC = () => {
  const { apiFetch, showNotification } = useAuth();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<StaffUser | null>(null);

  // Forms data
  const [addForm, setAddForm] = useState({ username: '', email: '', password: '', role: 'cashier' });
  const [editForm, setEditForm] = useState({ email: '', role: 'cashier', is_active: true });
  const [passwordForm, setPasswordForm] = useState({ password: '', confirmPassword: '' });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await apiFetch<StaffUser[]>('/api/users');
      setUsers(res);
    } catch (err: any) {
      showNotification(err.message || 'Failed to load users list', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.username || !addForm.email || !addForm.password || !addForm.role) {
      showNotification('Please fill in all fields', 'warning');
      return;
    }

    try {
      await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(addForm)
      });
      showNotification('User created successfully!', 'success');
      setIsAddModalOpen(false);
      setAddForm({ username: '', email: '', password: '', role: 'cashier' });
      fetchUsers();
    } catch (err: any) {
      showNotification(err.message || 'Failed to create user', 'error');
    }
  };

  const handleOpenEdit = (user: StaffUser) => {
    setSelectedUser(user);
    setEditForm({
      email: user.email,
      role: user.role,
      is_active: user.is_active
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      await apiFetch(`/api/users/${selectedUser.id}`, {
        method: 'PUT',
        body: JSON.stringify(editForm)
      });
      showNotification('User profile updated successfully!', 'success');
      setIsEditModalOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err: any) {
      showNotification(err.message || 'Failed to update user', 'error');
    }
  };

  const handleOpenPassword = (user: StaffUser) => {
    setSelectedUser(user);
    setPasswordForm({ password: '', confirmPassword: '' });
    setIsPasswordModalOpen(true);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (passwordForm.password !== passwordForm.confirmPassword) {
      showNotification('Passwords do not match', 'warning');
      return;
    }

    try {
      await apiFetch(`/api/users/${selectedUser.id}/password`, {
        method: 'PUT',
        body: JSON.stringify({ password: passwordForm.password })
      });
      showNotification('Password changed successfully!', 'success');
      setIsPasswordModalOpen(false);
      setSelectedUser(null);
    } catch (err: any) {
      showNotification(err.message || 'Failed to change password', 'error');
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'manager': return 'Manager';
      case 'cashier': return 'Cashier';
      case 'stock_clerk': return 'Stock Clerk';
      default: return role;
    }
  };

  return (
    <div className="users-wrapper">
      {/* Controls */}
      <div className="users-header-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '1.25rem', color: 'var(--text-secondary)' }}>Staff Accounts Registry</h3>
        {!isAddModalOpen && (
          <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}>
            <UserPlus size={18} />
            <span>Add Staff Member</span>
          </button>
        )}
      </div>

      {/* Inline Create Staff Account Form */}
      {isAddModalOpen && (
        <div className="glass-card inline-form-card" style={{ padding: '24px', marginBottom: '24px', position: 'relative', background: 'rgba(19, 26, 46, 0.45)' }}>
          <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}><UserPlus size={20} className="text-cyan" /> Create Staff Account</h3>
            <button type="button" className="btn-icon" onClick={() => setIsAddModalOpen(false)}>
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleAddSubmit} className="modal-form">
            <div className="modal-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Username *</label>
                <div className="input-with-icon" style={{ position: 'relative' }}>
                  <UserIcon size={16} className="input-icon" style={{ left: '12px', position: 'absolute', top: '15px', color: 'var(--text-muted)' }} />
                  <input 
                    type="text" 
                    className="form-input" 
                    style={{ paddingLeft: '36px' }}
                    required 
                    placeholder="e.g. jdoe"
                    value={addForm.username} 
                    onChange={e => setAddForm({ ...addForm, username: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Email Address *</label>
                <div className="input-with-icon" style={{ position: 'relative' }}>
                  <Mail size={16} className="input-icon" style={{ left: '12px', position: 'absolute', top: '15px', color: 'var(--text-muted)' }} />
                  <input 
                    type="email" 
                    className="form-input" 
                    style={{ paddingLeft: '36px' }}
                    required 
                    placeholder="e.g. john@supermarket.com"
                    value={addForm.email} 
                    onChange={e => setAddForm({ ...addForm, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Temporary Password *</label>
                <input 
                  type="password" 
                  className="form-input" 
                  required 
                  placeholder="••••••••"
                  value={addForm.password} 
                  onChange={e => setAddForm({ ...addForm, password: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Access Role *</label>
                <select 
                  className="form-select"
                  value={addForm.role}
                  onChange={e => setAddForm({ ...addForm, role: e.target.value })}
                >
                  <option value="cashier">Cashier</option>
                  <option value="stock_clerk">Stock Clerk</option>
                  <option value="manager">Store Manager</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
            </div>

            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px', borderTop: '1px solid var(--glass-border)', paddingTop: '16px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Create User Account
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users List */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading accounts list...</p>
        </div>
      ) : (
        <div className="table-container glass-card">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Email Address</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created Date</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(userItem => (
                <tr key={userItem.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="avatar-small">
                        {userItem.username.substring(0, 2).toUpperCase()}
                      </div>
                      <strong>{userItem.username}</strong>
                    </div>
                  </td>
                  <td>{userItem.email}</td>
                  <td>
                    <span className="badge badge-info">{getRoleLabel(userItem.role)}</span>
                  </td>
                  <td>
                    {userItem.is_active ? (
                      <span className="badge badge-success" style={{ gap: '4px' }}>
                        <UserCheck size={12} /> Active
                      </span>
                    ) : (
                      <span className="badge badge-danger" style={{ gap: '4px' }}>
                        <UserMinus size={12} /> Suspended
                      </span>
                    )}
                  </td>
                  <td>{new Date(userItem.created_at).toLocaleDateString('en-GB')}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="actions-cell">
                      <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => handleOpenEdit(userItem)}>
                        <Edit2 size={12} /> Edit
                      </button>
                      <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', gap: '4px' }} onClick={() => handleOpenPassword(userItem)}>
                        <Key size={12} /> Key
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit User Modal */}
      {isEditModalOpen && selectedUser && (
        <div className="modal-backdrop">
          <div className="modal-content glass-card" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3>Edit Account: {selectedUser.username}</h3>
              <button className="btn-icon" onClick={() => setIsEditModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="modal-form">
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input 
                  type="email" 
                  className="form-input" 
                  required 
                  value={editForm.email} 
                  onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">System Role *</label>
                <select 
                  className="form-select"
                  value={editForm.role}
                  onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                >
                  <option value="cashier">Cashier</option>
                  <option value="stock_clerk">Stock Clerk</option>
                  <option value="manager">Store Manager</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
                <input 
                  type="checkbox" 
                  id="isActive"
                  checked={editForm.is_active} 
                  onChange={e => setEditForm({ ...editForm, is_active: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="isActive" style={{ cursor: 'pointer', fontWeight: 600 }}>Active User Account</label>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsEditModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Modal */}
      {isPasswordModalOpen && selectedUser && (
        <div className="modal-backdrop">
          <div className="modal-content glass-card" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3>Change Password for: {selectedUser.username}</h3>
              <button className="btn-icon" onClick={() => setIsPasswordModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handlePasswordSubmit} className="modal-form">
              <div className="form-group">
                <label className="form-label">New Password *</label>
                <input 
                  type="password" 
                  className="form-input" 
                  required 
                  placeholder="••••••••"
                  value={passwordForm.password} 
                  onChange={e => setPasswordForm({ ...passwordForm, password: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirm New Password *</label>
                <input 
                  type="password" 
                  className="form-input" 
                  required 
                  placeholder="••••••••"
                  value={passwordForm.confirmPassword} 
                  onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsPasswordModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .avatar-small {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--accent-cyan), var(--success-emerald));
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: #000;
          font-size: 0.8rem;
        }

        /* Modal Dialog Styles */
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal-content {
          width: 100%;
          max-width: 440px;
          background: var(--bg-secondary);
          padding: 24px;
          border-radius: var(--border-radius-lg);
          border: 1px solid var(--glass-border);
          box-shadow: var(--shadow-premium);
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--glass-border);
          padding-bottom: 16px;
          margin-bottom: 20px;
        }

        .modal-header h3 {
          font-size: 1.15rem;
          color: var(--text-primary);
        }

        .modal-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 20px;
          border-top: 1px solid var(--glass-border);
          padding-top: 16px;
        }
      `}} />
    </div>
  );
};
