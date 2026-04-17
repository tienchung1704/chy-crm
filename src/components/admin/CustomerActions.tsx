'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CustomerActions() {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    gender: '',
    dob: '',
    address: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowModal(false);
      setForm({ name: '', email: '', phone: '', gender: '', dob: '', address: '' });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button className="btn btn-primary" onClick={() => setShowModal(true)} id="add-customer-btn">
        + Thêm khách hàng
      </button>

      {showModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Thêm khách hàng mới</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)} id="close-modal-btn">✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <div className="alert alert-error"><span>⚠</span><span>{error}</span></div>}

                <div className="form-group">
                  <label className="form-label" htmlFor="new-name">Họ và tên *</label>
                  <input id="new-name" name="name" className="form-input" required
                    value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                    placeholder="Nguyễn Văn A" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="new-email">Email</label>
                    <input id="new-email" name="email" type="email" className="form-input"
                      value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                      placeholder="email@example.com" />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="new-phone">Số điện thoại</label>
                    <input id="new-phone" name="phone" type="tel" className="form-input"
                      value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                      placeholder="0912345678" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="new-gender">Giới tính</label>
                    <select id="new-gender" className="form-select"
                      value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}>
                      <option value="">Chọn</option>
                      <option value="MALE">Nam</option>
                      <option value="FEMALE">Nữ</option>
                      <option value="OTHER">Khác</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="new-dob">Ngày sinh</label>
                    <input id="new-dob" name="dob" type="date" className="form-input"
                      value={form.dob} onChange={e => setForm({...form, dob: e.target.value})} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="new-address">Địa chỉ</label>
                  <textarea id="new-address" className="form-input" rows={2}
                    value={form.address} onChange={e => setForm({...form, address: e.target.value})}
                    placeholder="Số nhà, đường, quận/huyện, tỉnh/thành" />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={loading} id="save-customer-btn">
                  {loading ? 'Đang lưu...' : 'Lưu khách hàng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
