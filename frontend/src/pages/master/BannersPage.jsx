import { useEffect, useState } from 'react';
import api from '../../services/api';
import { Trash2, ToggleLeft, ToggleRight, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

export default function BannersPage() {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchBanners = async () => {
    setLoading(true);
    try { const { data } = await api.get('/banners'); setBanners(data); }
    catch { toast.error('Failed'); } finally { setLoading(false); }
  };

  useEffect(() => { fetchBanners(); }, []);

  const toggleBanner = async (id) => {
    try { await api.put(`/banners/${id}/toggle`); toast.success('Updated'); fetchBanners(); }
    catch { toast.error('Failed'); }
  };

  const deleteBanner = async (id) => {
    if (!confirm('Delete this banner?')) return;
    try { await api.delete(`/banners/${id}`); toast.success('Deleted'); fetchBanners(); }
    catch { toast.error('Failed'); }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('image', file);
    formData.append('title', file.name.replace(/\.[^.]+$/, ''));
    try {
      await api.post('/banners', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Banner uploaded');
      fetchBanners();
    } catch { toast.error('Upload failed'); } finally { setUploading(false); e.target.value = ''; }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Banners</h1><p className="text-gray-500 text-sm">App banners management</p></div>
        <label className="btn-primary flex items-center gap-2 cursor-pointer">
          <Plus size={16} /> {uploading ? 'Uploading...' : 'Upload Banner'}
          <input type="file" accept="image/*" onChange={handleUpload} className="hidden" disabled={uploading} />
        </label>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {banners.map((b) => (
            <div key={b.id} className="card p-0 overflow-hidden">
              <div className="relative">
                <img src={b.image_url} alt={b.title} className="w-full h-40 object-cover" />
                {!b.is_active && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><span className="text-white text-xs font-medium">Inactive</span></div>}
              </div>
              <div className="p-3 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 truncate">{b.title || 'Untitled'}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleBanner(b.id)} className={b.is_active ? 'text-green-600' : 'text-gray-400'}>
                    {b.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                  </button>
                  <button onClick={() => deleteBanner(b.id)} className="text-red-500 hover:text-red-700">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {banners.length === 0 && <p className="text-gray-400 col-span-4 text-center py-12">No banners found</p>}
        </div>
      )}
    </div>
  );
}
