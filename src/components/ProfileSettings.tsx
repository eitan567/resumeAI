import React, { useState } from 'react';
import { UserProfile } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, updateDoc, arrayUnion, arrayRemove, query, collection, where, getDocs, limit } from 'firebase/firestore';
import { User, Mail, Link as LinkIcon, Image as ImageIcon, Plus, Trash2, Loader2, Check, ExternalLink, Share2 } from 'lucide-react';

interface ProfileSettingsProps {
  userProfile: UserProfile;
}

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({ userProfile }) => {
  const defaultSlug = (userProfile.name || 'user')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  const [username, setUsername] = useState(userProfile.username || defaultSlug);
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [isAddingPhoto, setIsAddingPhoto] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (userProfile.username) {
      setUsername(userProfile.username);
    }
  }, [userProfile.username]);

  const handleSaveUsername = async () => {
    const cleanUsername = username.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    if (cleanUsername.length < 3) {
      setMessage({ type: 'error', text: 'שם המשתמש חייב להכיל לפחות 3 תווים.' });
      return;
    }

    setIsSavingUsername(true);
    setMessage(null);
    try {
      // Check if username is already taken by another user
      const usersQuery = query(
        collection(db, 'users'), 
        where('username', '==', cleanUsername),
        limit(1)
      );
      const querySnapshot = await getDocs(usersQuery);
      
      const isTaken = !querySnapshot.empty && querySnapshot.docs[0].id !== userProfile.uid;
      
      if (isTaken) {
        setMessage({ type: 'error', text: 'שם המשתמש כבר תפוס. בחר שם אחר.' });
        setIsSavingUsername(false);
        return;
      }

      await updateDoc(doc(db, 'users', userProfile.uid), {
        username: cleanUsername
      });
      setMessage({ type: 'success', text: 'שם המשתמש עודכן בהצלחה!' });
    } catch (err) {
      console.error(err);
      try {
        handleFirestoreError(err, OperationType.UPDATE, `users/${userProfile.uid}`);
      } catch (e) {
        // Error already logged
      }
      setMessage({ type: 'error', text: 'אירעה שגיאה בעדכון שם המשתמש. נסה שוב מאוחר יותר.' });
    } finally {
      setIsSavingUsername(false);
    }
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          
          // Compress as JPEG with 0.7 quality
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(dataUrl);
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limit to 5MB before compression
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'הקובץ גדול מדי. הגודל המקסימלי הוא 5MB.' });
      return;
    }

    setIsAddingPhoto(true);
    setMessage(null);

    try {
      const compressedBase64 = await compressImage(file);
      
      // Update Firestore
      await updateDoc(doc(db, 'users', userProfile.uid), {
        photos: arrayUnion(compressedBase64)
      });
      setMessage({ type: 'success', text: 'התמונה נוספה בהצלחה!' });
    } catch (err) {
      console.error('Error adding photo:', err);
      setMessage({ type: 'error', text: 'אירעה שגיאה בהוספת התמונה.' });
    } finally {
      setIsAddingPhoto(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemovePhoto = async (photoUrl: string) => {
    try {
      await updateDoc(doc(db, 'users', userProfile.uid), {
        photos: arrayRemove(photoUrl)
      });
    } catch (err) {
      console.error(err);
    }
  };

  const publicProfileUrl = userProfile.username ? `${window.location.origin}/u/${userProfile.username}` : null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500" dir="rtl">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
        <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
          <User className="w-6 h-6 text-indigo-600" />
          הגדרות פרופיל אישי
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Username / Personal Link */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">שם משתמש (ללינק האישי)</label>
              <div className="flex items-center">
                <span className="bg-slate-100 px-3 py-3 rounded-r-xl border border-l-0 border-slate-200 text-slate-500 text-sm">/u/</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your-name"
                  className="flex-1 px-4 py-3 rounded-l-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">זה יהיה הלינק הקבוע שלך לקורות החיים המעודכנים ביותר.</p>
            </div>
            <button
              onClick={handleSaveUsername}
              disabled={isSavingUsername || username === userProfile.username}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2"
            >
              {isSavingUsername ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              שמור שם משתמש
            </button>

            {publicProfileUrl && (
              <div className="mt-4 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                <p className="text-xs font-bold text-indigo-900 mb-2">הלינק האישי שלך:</p>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-xs text-indigo-700 break-all">{publicProfileUrl}</code>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(publicProfileUrl);
                        setMessage({ type: 'success', text: 'הלינק הועתק ללוח!' });
                      }}
                      className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                      title="העתק לינק"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    <a 
                      href={publicProfileUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                      title="פתח לינק"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">שם מלא</label>
              <div className="px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 flex items-center gap-3">
                <User className="w-4 h-4" />
                {userProfile.name}
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">אימייל</label>
              <div className="px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 flex items-center gap-3">
                <Mail className="w-4 h-4" />
                {userProfile.email}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Photo Management */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
        <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
          <ImageIcon className="w-6 h-6 text-indigo-600" />
          ניהול תמונות פרופיל
        </h2>

        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isAddingPhoto}
              className="w-full px-4 py-6 rounded-xl border-2 border-dashed border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 transition-all text-slate-500 flex items-center justify-center gap-2"
            >
              {isAddingPhoto ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
              לחץ כאן להעלאת תמונה מהמחשב
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {userProfile.photos?.map((photo, index) => (
              <div key={index} className="group relative aspect-square rounded-2xl overflow-hidden border border-slate-200 bg-slate-50">
                <img 
                  src={photo} 
                  alt={`Profile ${index}`} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    onClick={() => handleRemovePhoto(photo)}
                    className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {(!userProfile.photos || userProfile.photos.length === 0) && (
              <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl">
                <ImageIcon className="w-12 h-12 text-slate-200 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">טרם הוספת תמונות פרופיל.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
          {message.text}
        </div>
      )}
    </div>
  );
};
