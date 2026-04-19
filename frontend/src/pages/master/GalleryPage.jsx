import { useEffect, useState } from 'react';
import api from '../../services/api';
import { Trash2, Play, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';

export default function GalleryPage() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', video_url: '' });
  const [saving, setSaving] = useState(false);

  const fetchVideos = async () => {
    setLoading(true);
    try { const { data } = await api.get('/gallery'); setVideos(data); }
    catch { toast.error('Failed'); } finally { setLoading(false); }
  };

  useEffect(() => { fetchVideos(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/gallery', form);
      toast.success('Added'); setShowAdd(false); setForm({ title: '', video_url: '' }); fetchVideos();
    } catch { toast.error('Failed'); } finally { setSaving(false); }
  };

  const deleteVideo = async (id) => {
    if (!confirm('Delete?')) return;
    try { await api.delete(`/gallery/${id}`); toast.success('Deleted'); fetchVideos(); }
    catch { toast.error('Failed'); }
  };

  const getYtThumb = (url) => {
    const match = url.match(/(?:v=|youtu.be\/)([^&\s]+)/);
    return match ? `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg` : null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Gallery</h1><p className="text-gray-500 text-sm">Product videos</p></div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2"><Plus size={16} /> Add Video</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {videos.map((v) => {
            const thumb = v.thumbnail || getYtThumb(v.video_url);
            return (
              <div key={v.id} className="card p-0 overflow-hidden">
                <div className="relative">
                  {thumb ? <img src={thumb} alt={v.title} className="w-full h-36 object-cover" /> : <div className="w-full h-36 bg-gray-100 flex items-center justify-center"><Play size={32} className="text-gray-400" /></div>}
                  <a href={v.video_url} target="_blank" rel="noreferrer" className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 transition-colors">
                    <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center"><Play size={18} className="text-blue-600" /></div>
                  </a>
                </div>
                <div className="p-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 truncate">{v.title}</span>
                  <button onClick={() => deleteVideo(v.id)} className="text-red-500 hover:text-red-700 ml-2 flex-shrink-0"><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
          {videos.length === 0 && <p className="text-gray-400 col-span-4 text-center py-12">No videos found</p>}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Video">
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input-field" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Video URL (YouTube or other)</label>
            <input value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} className="input-field" placeholder="https://youtube.com/watch?v=..." required />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Add Video'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
