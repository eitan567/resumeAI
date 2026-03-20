import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { GeneratedDocument, UserProfile } from '../types';
import { getUserDisplayName } from '../utils/user';
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

  const cleanMarkdownContent = (text: string, userObj?: any) => {
    if (!text) return '';
    
    let cleaned = text;

    // 1. Fill known data
    if (userObj) {
      const fullName = getUserDisplayName(userObj);
      cleaned = cleaned.replace(/\[שם מלא\]/gi, fullName);
      cleaned = cleaned.replace(/\[Full Name\]/gi, fullName);
      cleaned = cleaned.replace(/\[אימייל\]/gi, userObj.email || '');
      cleaned = cleaned.replace(/\[Email\]/gi, userObj.email || '');
      cleaned = cleaned.replace(/\[טלפון\]/gi, userObj.phone || '');
      cleaned = cleaned.replace(/\[Phone\]/gi, userObj.phone || '');
      cleaned = cleaned.replace(/\[מקום מגורים\]/gi, userObj.location || '');
      cleaned = cleaned.replace(/\[Location\]/gi, userObj.location || '');
      cleaned = cleaned.replace(/\[Link to LinkedIn\]/gi, userObj.linkedin || '');
      cleaned = cleaned.replace(/\[Link to GitHub\/Portfolio\]/gi, userObj.portfolio || '');
    }

    // 2. Remove remaining placeholders like [טלפון], [מקום מגורים], etc.
    cleaned = cleaned.replace(/(?:📞|📱|📍|🏠|🔗|💻|🌐|✉️|📧)?\s*\[([^\]]+)\](?!\()/g, (match, innerText) => {
      const lower = innerText.toLowerCase();
      const isPlaceholder = lower.includes('טלפון') || 
                            lower.includes('phone') || 
                            lower.includes('מקום') || 
                            lower.includes('location') || 
                            lower.includes('address') || 
                            lower.includes('link') || 
                            lower.includes('linkedin') || 
                            lower.includes('github') || 
                            lower.includes('portfolio') ||
                            lower.includes('email') ||
                            lower.includes('אימייל') ||
                            lower.includes('שם מלא') ||
                            lower.includes('city') ||
                            lower.includes('country');
      
      if (isPlaceholder) {
        return '';
      }
      return match;
    });

    // 3. Clean up dangling separators
    cleaned = cleaned.replace(/(\s*\|\s*)+/g, ' | ');
    cleaned = cleaned.replace(/^[ \t|]+\|[ \t]*/gm, ''); // leading |
    cleaned = cleaned.replace(/[ \t]*\|[ \t|]+$/gm, ''); // trailing |
    cleaned = cleaned.replace(/^[ \t|]+$/gm, ''); // empty lines with just |
    
    // 4. Find the first heading which almost always marks the start of the resume
    const firstHeadingIndex = cleaned.search(/^#+\s/m);
    
    if (firstHeadingIndex > 0) {
      const introText = cleaned.substring(0, firstHeadingIndex);
      // If the text before the heading is relatively short, it's likely AI chatter
      if (introText.length < 800) {
        cleaned = cleaned.substring(firstHeadingIndex);
      }
    }
    
    // 5. Fallback: remove specific known AI phrases if no heading was found
    const lines = cleaned.split('\n');
    const filteredLines = lines.filter(line => {
      const l = line.trim();
      if (l.startsWith('להלן גרסה') || 
          l.startsWith('המבנה עוצב') || 
          l.startsWith('הנה קורות') ||
          l.includes('Executive Markdown') ||
          l.includes('להלן קורות החיים')) {
        return false;
      }
      return true;
    });
    
    return filteredLines.join('\n').trim();
  };

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
      <div className="sticky top-0 z-40 bg-gradient-to-r from-indigo-600 to-violet-700 pt-8 sm:pt-12 pb-8 sm:pb-8 shadow-md">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center sm:items-end gap-6 relative z-10">
          {/* Spacer for avatar on desktop */}
          <div className="hidden sm:block w-40 shrink-0"></div>
          
          <div className="flex-1 text-center sm:text-right">
            <h1 className="text-3xl sm:text-4xl font-black text-white drop-shadow-md mb-2">{getUserDisplayName(user)}</h1>
            <p className="text-indigo-100 font-medium flex items-center justify-center sm:justify-start gap-2">
              <Mail className="w-4 h-4" />
              {user.email}
            </p>
          </div>
          
          <div className="flex gap-2 mt-4 sm:mt-0">
            {latestCoverLetter && (
              <button 
                onClick={() => setShowCoverLetter(true)}
                className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white px-5 py-2.5 rounded-xl text-sm font-bold border border-white/20 transition-all flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                מכתב מקדים
              </button>
            )}
          </div>
        </div>

        {/* Avatar */}
        <div className="absolute -bottom-16 left-0 right-0 max-w-7xl mx-auto px-4 flex justify-center sm:justify-start pointer-events-none">
          <div className="w-32 h-32 sm:w-40 sm:h-40 bg-white rounded-full p-1 shadow-2xl relative z-20 ring-8 ring-white/20 pointer-events-auto">
            {user.photos?.[0] || latestResume?.photoUrl ? (
              <img 
                src={user.photos?.[0] || latestResume?.photoUrl} 
                alt={getUserDisplayName(user)} 
                className="w-full h-full object-cover rounded-full"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                <User className="w-16 h-16" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 pt-24 flex flex-col lg:flex-row gap-8 items-start">
        {/* Resume Display */}
        <div className="flex-1 w-full max-w-4xl mx-auto">
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
                <ReactMarkdown>{cleanMarkdownContent(latestResume.content, user)}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-12 text-center">
              <FileText className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">המשתמש טרם פרסם קורות חיים.</p>
            </div>
          )}
        </div>

        {/* Sidebar (Hire Me) */}
        <div className="w-full lg:w-80 shrink-0">
          <div className="sticky top-32">
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
              <ReactMarkdown>{cleanMarkdownContent(latestCoverLetter.content, user)}</ReactMarkdown>
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


