import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { GeneratedDocument, UserProfile } from '../types';
import ReactMarkdown from 'react-markdown';
import { Loader2, FileText, Download, Share2, ExternalLink, User, Mail, Calendar, MessageSquare, Sparkles, X } from 'lucide-react';

export const PublicProfile: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [latestResume, setLatestResume] = useState<GeneratedDocument | null>(null);
  const [latestCoverLetter, setLatestCoverLetter] = useState<GeneratedDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCoverLetter, setShowCoverLetter] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!username) return;
      setLoading(true);
      setError(null);

      try {
        // 1. Find user by username
        const usersQuery = query(collection(db, 'users'), where('username', '==', username), limit(1));
        const userSnap = await getDocs(usersQuery);

        if (userSnap.empty) {
          setError('המשתמש לא נמצא.');
          setLoading(false);
          return;
        }

        const userData = userSnap.docs[0].data() as UserProfile;
        setUser(userData);

        // 2. Find resume (prioritize isProfilePrimary)
        const resumeQuery = query(
          collection(db, 'documents'),
          where('userId', '==', userData.uid),
          where('type', '==', 'resume'),
          where('isPublic', '==', true)
        );
        const resumeSnap = await getDocs(resumeQuery);
        if (!resumeSnap.empty) {
          const resumes = resumeSnap.docs.map(d => d.data() as GeneratedDocument);
          const primaryResume = resumes.find(r => r.isProfilePrimary);
          setLatestResume(primaryResume || resumes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]);
        }

        // 3. Find cover letter (prioritize isProfilePrimary)
        const clQuery = query(
          collection(db, 'documents'),
          where('userId', '==', userData.uid),
          where('type', '==', 'cover_letter'),
          where('isPublic', '==', true)
        );
        const clSnap = await getDocs(clQuery);
        if (!clSnap.empty) {
          const cls = clSnap.docs.map(d => d.data() as GeneratedDocument);
          const primaryCl = cls.find(c => c.isProfilePrimary);
          setLatestCoverLetter(primaryCl || cls.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]);
        }

      } catch (err) {
        console.error('Error fetching profile:', err);
        setError('אירעה שגיאה בטעינת הפרופיל.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [username]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium">טוען פרופיל אישי...</p>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">אופס!</h1>
          <p className="text-slate-600 mb-6">{error || 'הפרופיל המבוקש אינו זמין.'}</p>
          <Link to="/" className="inline-flex items-center justify-center px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors">
            חזרה לדף הבית
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20" dir="rtl">
      {/* Header / Cover */}
      <div className="h-48 sm:h-64 bg-gradient-to-r from-indigo-600 to-violet-700 relative">
        <div className="absolute -bottom-16 left-0 right-0 max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center sm:items-end gap-6">
          <div className="w-32 h-32 sm:w-40 sm:h-40 bg-white rounded-full p-1 shadow-2xl relative z-10 ring-8 ring-white/20">
            {user.photos?.[0] || latestResume?.photoUrl ? (
              <img 
                src={user.photos?.[0] || latestResume?.photoUrl} 
                alt={user.name} 
                className="w-full h-full object-cover rounded-full"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                <User className="w-16 h-16" />
              </div>
            )}
          </div>
          <div className="flex-1 text-center sm:text-right pb-2">
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 drop-shadow-sm mb-1">{user.name}</h1>
            <p className="text-slate-600 font-medium flex items-center justify-center sm:justify-start gap-2">
              <Mail className="w-4 h-4" />
              {user.email}
            </p>
          </div>
          <div className="flex gap-2 pb-2">
            {latestCoverLetter && (
              <button 
                onClick={() => setShowCoverLetter(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md transition-all flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                מכתב מקדים
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 pt-24 sm:pt-20 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sidebar (Hire Me) */}
        <div className="lg:col-span-1 order-2 lg:order-1">
          <div className="sticky top-8">
            <div className="bg-indigo-600 rounded-3xl shadow-lg shadow-indigo-200 p-8 text-white text-center">
              <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-8 h-8 text-indigo-100" />
              </div>
              <h3 className="text-2xl font-bold mb-3">מעוניין להעסיק אותי?</h3>
              <p className="text-indigo-100 mb-8 leading-relaxed">
                אשמח לשמוע על הזדמנויות חדשות. ניתן ליצור איתי קשר ישירות במייל או להוריד את קורות החיים שלי.
              </p>
              <a 
                href={`mailto:${user.email}`}
                className="w-full bg-white text-indigo-600 py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-50 transition-all hover:scale-105 active:scale-95 shadow-md"
              >
                <Mail className="w-5 h-5" />
                שלח לי מייל
              </a>
            </div>
          </div>
        </div>

        {/* Resume Display */}
        <div className="lg:col-span-2 order-1 lg:order-2">
          {latestResume ? (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden p-8 sm:p-12">
              {/* Meta info */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 mb-8 pb-6 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>הצטרף ב-{new Date(user.createdAt).toLocaleDateString('he-IL')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span>עודכן לאחרונה: {new Date(latestResume.createdAt).toLocaleDateString('he-IL')}</span>
                </div>
                <button 
                  onClick={() => window.print()}
                  className="mr-auto flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
                  title="הדפסה"
                >
                  <Download className="w-4 h-4" />
                  הדפס קורות חיים
                </button>
              </div>

              {/* Resume Content rendered as Markdown */}
              <div className="prose prose-slate prose-indigo max-w-none prose-headings:font-bold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-a:text-indigo-600 hover:prose-a:text-indigo-700 prose-img:rounded-xl prose-hr:border-slate-100">
                <ReactMarkdown>{latestResume.content}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-12 text-center">
              <FileText className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">המשתמש טרם פרסם קורות חיים.</p>
            </div>
          )}
        </div>
      </div>

      {/* Cover Letter Modal */}
      {showCoverLetter && latestCoverLetter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-3xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-indigo-600" />
                מכתב מקדים
              </h2>
              <button 
                onClick={() => setShowCoverLetter(false)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-slate-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 sm:p-12 prose prose-slate max-w-none text-right" dir="rtl">
              <ReactMarkdown>{latestCoverLetter.content}</ReactMarkdown>
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setShowCoverLetter(false)}
                className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 py-4 px-4 text-center">
        <p className="text-xs text-slate-500">
          נוצר באמצעות <span className="font-bold text-indigo-600">ResumeAI</span> - מחולל קורות חיים מבוסס בינה מלאכותית
        </p>
      </div>
    </div>
  );
};


