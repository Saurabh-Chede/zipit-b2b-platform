import React, { useCallback, useEffect, useState } from 'react';
import { MapPin, Plus, Trash2 } from 'lucide-react';
import { apiClient, extractErrorMessage } from '../../services/api.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { formatDateTime } from '../../utils/formatters.ts';
import { StatusBadge } from '../../components/ui/StatusBadge.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { ErrorBanner, LoadingSkeleton } from '../../components/ui/States.tsx';
import { KycVerificationSection } from '../../components/shared/KycVerificationSection.tsx';
import { ChangePasswordCard } from '../../components/shared/ChangePasswordCard.tsx';
import type { SavedAddress, SellerProfile } from '../../types/index.ts';

export function SellerProfilePage() {
  const { showToast } = useToast();
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addrModalOpen, setAddrModalOpen] = useState(false);
  const [savingAddr, setSavingAddr] = useState(false);
  const [label, setLabel] = useState('');
  const [addressType, setAddressType] = useState<'PICKUP' | 'DELIVERY' | 'BOTH'>('DELIVERY');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profRes, addrRes] = await Promise.all([
        apiClient.get<{ success: boolean; data: SellerProfile }>('/sellers/me'),
        apiClient.get<{ success: boolean; data: SavedAddress[] }>('/sellers/me/addresses'),
      ]);
      setProfile(profRes.data.data);
      setAddresses(addrRes.data.data);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load seller profile.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAddr(true);
    try {
      const res = await apiClient.post<{ success: boolean; data: SavedAddress[] }>(
        '/sellers/me/addresses',
        {
          label: label.trim(),
          addressType,
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          city: city.trim(),
          pincode: pincode.trim(),
          isDefault,
        }
      );
      setAddresses(res.data.data);
      setAddrModalOpen(false);
      setLabel('');
      setName('');
      setPhone('');
      setAddress('');
      setCity('');
      setPincode('');
      setIsDefault(false);
      showToast('Address saved to address book.', 'success');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to save address.'), 'error');
    } finally {
      setSavingAddr(false);
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    try {
      const res = await apiClient.delete<{ success: boolean; data: SavedAddress[] }>(
        `/sellers/me/addresses/${addressId}`
      );
      setAddresses(res.data.data);
      showToast('Saved address removed.', 'info');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to delete address.'), 'error');
    }
  };

  if (loading) return <LoadingSkeleton rows={5} />;
  if (error || !profile) return <ErrorBanner message={error || 'Profile not found'} onRetry={loadProfile} />;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Seller Business Profile</h1>
          <p className="text-sm text-slate-500 mt-0.5">Registered legal entity and onboarding verification status</p>
        </div>
        <StatusBadge status={profile.approvalStatus} />
      </div>

      {profile.rejectionReason && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
          <strong>Rejection Reason:</strong> {profile.rejectionReason}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-6 grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm shadow-sm">
        <div>
          <p className="text-xs text-slate-500">Business Name</p>
          <p className="font-semibold text-slate-900 mt-0.5">{profile.businessName}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Owner Name</p>
          <p className="font-medium text-slate-900 mt-0.5">{profile.ownerName}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">GSTIN</p>
          <p className="font-mono text-slate-900 mt-0.5">{profile.gstNumber}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Contact Phone</p>
          <p className="font-mono tabular-nums text-slate-900 mt-0.5">{profile.phone}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Registered Email</p>
          <p className="text-slate-900 mt-0.5">{profile.email}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Registered On</p>
          <p className="font-mono tabular-nums text-slate-900 mt-0.5">{formatDateTime(profile.createdAt)}</p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs text-slate-500">Business Address</p>
          <p className="text-slate-900 mt-0.5">
            {profile.businessAddress}, {profile.city} — {profile.pincode}
          </p>
        </div>
      </div>

      {/* Saved Address Book */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Saved Address Book</h2>
              <p className="text-xs text-slate-500">
                Quick-fill frequent pickup warehouses and regular B2B consignee buyers during booking
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setAddrModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Saved Address</span>
          </button>
        </div>

        {addresses.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">
            No saved addresses yet. Add a warehouse pickup point or frequent buyer hub for 1-click filling.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {addresses.map((addr) => (
              <div
                key={addr._id}
                className="border border-slate-200 rounded-lg p-4 flex flex-col justify-between gap-3 bg-slate-50/40"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-slate-900">{addr.label}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-200/70 text-slate-700 rounded">
                        {addr.addressType}
                      </span>
                      {addr.isDefault && (
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-700 rounded">
                          DEFAULT
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs font-medium text-slate-800">
                    {addr.name} · <span className="font-mono">{addr.phone}</span>
                  </p>
                  <p className="text-xs text-slate-600">
                    {addr.address}, {addr.city} — {addr.pincode}
                  </p>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleDeleteAddress(addr._id)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <ChangePasswordCard />

      <KycVerificationSection onKycUpdated={loadProfile} />

      <Modal
        open={addrModalOpen}
        onClose={() => !savingAddr && setAddrModalOpen(false)}
        title="Add Saved Address"
        subtitle="Store a frequent pickup warehouse or delivery consignee"
      >
        <form onSubmit={handleAddAddress} className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Address Label *</label>
            <input
              type="text"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Bhiwandi Hub / Pune Dealer"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Usage Type *</label>
            <select
              value={addressType}
              onChange={(e) => setAddressType(e.target.value as 'PICKUP' | 'DELIVERY' | 'BOTH')}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
            >
              <option value="PICKUP">Pickup (Consignor)</option>
              <option value="DELIVERY">Delivery (Consignee)</option>
              <option value="BOTH">Both Pickup &amp; Delivery</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Contact / Company Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">10-Digit Phone *</label>
            <input
              type="tel"
              required
              pattern="[6-9]\d{9}"
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">Street / Estate Address *</label>
            <input
              type="text"
              required
              minLength={5}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">City *</label>
            <input
              type="text"
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">6-Digit Pincode *</label>
            <input
              type="text"
              required
              pattern="\d{6}"
              maxLength={6}
              value={pincode}
              onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
            />
          </div>
          <div className="sm:col-span-2 flex items-center gap-2 pt-1">
            <input
              id="addr-default"
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-600"
            />
            <label htmlFor="addr-default" className="text-xs text-slate-700">
              Mark as default for this type
            </label>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              disabled={savingAddr}
              onClick={() => setAddrModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingAddr}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {savingAddr ? 'Saving...' : 'Save Address'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
