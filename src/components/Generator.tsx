import React, { useState, useRef } from 'react';
import { generateResume, generateCoverLetter } from '../services/ai';
import { UserProfile } from '../types';
import { auth, db } from '../firebase';
import { doc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { Loader2, FileText, Send, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import html2pdf from 'html2pdf.js';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface GeneratorProps {
  userProfile: UserProfile;
  onShowPricing: () => void;
  onDocumentCreated: () => void;
}

export const Generator: React.FC<GeneratorProps> = ({ userProfile, onShowPricing, onDocumentCreated }) => {
  const [type, setType] = useState<'resume' | 'cover_letter'>('resume');
  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [skills, setSkills] = useState('');
  const [experience, setExperience] = useState('');
  const [education, setEducation] = useState('');
  const [template, setTemplate] = useState('modern');
  const [coverLetterTemplate, setCoverLetterTemplate] = useState('formal');
  const [photoUrl, setPhotoUrl] = useState('');
  const [includePersonalLink, setIncludePersonalLink] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const resultRef = useRef<HTMLDivElement>(null);

  const defaultSlug = (userProfile.name || 'user')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  const handleEditClick = () => {
    setEditedContent(result || '');
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!currentDocId || !editedContent) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'documents', currentDocId), {
        content: editedContent
      });
      setResult(editedContent);
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      setError('אירעה שגיאה בשמירת השינויים.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!resultRef.current) return;
    
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        setError('הדפדפן חסם את פתיחת חלון ההדפסה. אנא אפשר חלונות קופצים (Pop-ups) עבור אתר זה ונסה שוב.');
        return;
      }
      
      const html = `
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
          <title>${type === 'resume' ? 'קורות חיים' : 'מכתב מקדים'}</title>
          <style>
            body {
              font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
              color: #1e293b;
              line-height: 1.6;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
            }
            h1 { font-size: 28px; font-weight: 800; margin-bottom: 16px; margin-top: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; color: #0f172a; }
            h2 { font-size: 20px; font-weight: 700; margin-bottom: 12px; margin-top: 24px; color: #1e293b; }
            h3 { font-size: 16px; font-weight: 600; margin-bottom: 12px; margin-top: 16px; color: #334155; }
            p { font-size: 14px; margin-bottom: 12px; }
            ul, ol { margin-bottom: 16px; padding-right: 24px; }
            li { font-size: 14px; margin-bottom: 6px; }
            strong, b { font-weight: 700; color: #0f172a; }
            em, i { font-style: italic; }
            a { color: #4f46e5; text-decoration: none; }
            @media print {
              @page { margin: 20mm; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          ${photoUrl ? `
            <div style="text-align: center; margin-bottom: 24px;">
              <img src="${photoUrl}" style="width: 120px; height: 120px; border-radius: 12px; object-fit: cover; border: 4px solid white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);" referrerPolicy="no-referrer" />
            </div>
          ` : ''}
          ${includePersonalLink && userProfile.username ? `
            <div style="text-align: center; margin-bottom: 24px; padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 12px; color: #64748b;">צפה בגרסה המקוונת והמעודכנת שלי:</p>
              <a href="${window.location.origin}/u/${userProfile.username}" style="font-size: 14px; color: #4f46e5; font-weight: bold; text-decoration: none;">${window.location.origin}/u/${userProfile.username}</a>
            </div>
          ` : ''}
          ${resultRef.current.innerHTML}
          <script>
            window.onload = () => {
              try {
                window.print();
                setTimeout(() => window.close(), 500);
              } catch (e) {
                console.error('Print failed', e);
              }
            };
          </script>
        </body>
        </html>
      `;
      
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      
      // Clear any previous errors if successful
      if (error && error.includes('PDF')) {
        setError(null);
      }
    } catch (err) {
      console.error('PDF generation failed:', err);
      setError('אירעה שגיאה בהכנת המסמך ל-PDF. אנא נסה שוב או נסה להשתמש בדפדפן אחר.');
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (userProfile.plan === 'free' && userProfile.credits <= 0) {
      onShowPricing();
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let content = '';
      if (type === 'resume') {
        const personalLink = includePersonalLink && userProfile.username ? `${window.location.origin}/u/${userProfile.username}` : undefined;
        content = await generateResume(jobTitle, skills, experience, education, template, personalLink);
      } else {
        if (userProfile.plan === 'free') {
          setLoading(false);
          onShowPricing();
          return;
        }
        content = await generateCoverLetter(jobTitle, companyName, skills, experience, coverLetterTemplate);
      }

      // Save to Firestore
      const docId = Date.now().toString();
      setCurrentDocId(docId);
      try {
          await setDoc(doc(db, 'documents', docId), {
            id: docId,
            userId: userProfile.uid,
            type,
            content,
            createdAt: new Date().toISOString(),
            photoUrl: photoUrl || undefined,
            isPublic: true,
            includePersonalLink: includePersonalLink || false,
            ...(type === 'resume' ? { template } : { template: coverLetterTemplate })
          });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `documents/${docId}`);
      }

      // Deduct credit if free
      if (userProfile.plan === 'free') {
        try {
          await updateDoc(doc(db, 'users', userProfile.uid), {
            credits: increment(-1)
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `users/${userProfile.uid}`);
        }
      }

      setResult(content);
      onDocumentCreated();
    } catch (err) {
      console.error('Generation failed', err);
      setError('אירעה שגיאה ביצירת המסמך. אנא נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 md:p-8" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">מחולל מסמכים AI</h2>
        <div className="flex gap-2 bg-slate-100 p-1 rounded-lg w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setType('resume')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${type === 'resume' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            קורות חיים
          </button>
          <button
            onClick={() => {
              if (userProfile.plan === 'free') {
                onShowPricing();
              } else {
                setType('cover_letter');
              }
            }}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 whitespace-nowrap ${type === 'cover_letter' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            מכתב מקדים
            {userProfile.plan === 'free' && <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-full">PRO</span>}
          </button>
        </div>
      </div>

      <form onSubmit={handleGenerate} className="space-y-5 sm:space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">תפקיד מבוקש</label>
            <input
              required
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="למשל: מפתח Full Stack"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
            />
          </div>
          
          {type === 'cover_letter' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">שם החברה</label>
              <input
                required
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="למשל: Google"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">כישורים מרכזיים</label>
          <input
            required
            type="text"
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder="למשל: React, Node.js, ניהול צוותים, אנגלית שוטפת"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">ניסיון תעסוקתי (בקצרה)</label>
          <textarea
            required
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            rows={4}
            placeholder="תאר את הניסיון שלך, מקומות עבודה קודמים והישגים בולטים..."
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none resize-none"
          />
        </div>

        {type === 'resume' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">השכלה</label>
            <input
              required
              type="text"
              value={education}
              onChange={(e) => setEducation(e.target.value)}
              placeholder="למשל: תואר ראשון במדעי המחשב, אוניברסיטת תל אביב"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
            />
          </div>
        )}

        {type === 'resume' && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">בחר תמונת פרופיל</label>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                <button
                  type="button"
                  onClick={() => setPhotoUrl('')}
                  className={`aspect-square rounded-xl border-2 flex items-center justify-center transition-all ${photoUrl === '' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <span className="text-[10px] font-bold text-slate-500">ללא</span>
                </button>
                {userProfile.photos?.map((photo, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setPhotoUrl(photo)}
                    className={`aspect-square rounded-xl border-2 overflow-hidden transition-all ${photoUrl === photo ? 'border-indigo-600 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-slate-300'}`}
                  >
                    <img src={photo} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </button>
                ))}
              </div>
              {(!userProfile.photos || userProfile.photos.length === 0) && (
                <p className="text-xs text-slate-500 mt-2">טיפ: ניתן להוסיף תמונות פרופיל בלשונית "פרופיל והגדרות".</p>
              )}
            </div>

            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex items-center justify-between gap-4">
              <div className="flex-1">
                <h4 className="text-sm font-bold text-indigo-900 mb-1">כתובת אישית לקורות החיים (אופציונלי)</h4>
                <p className="text-xs text-indigo-700">הוסף את הכתובת הקבועה שלך לקורות החיים: <span className="font-mono">{window.location.origin}/u/{userProfile.username || defaultSlug}</span></p>
                {!userProfile.username && (
                  <p className="text-[10px] text-indigo-500 mt-1">* שים לב: עליך לשמור את שם המשתמש בהגדרות הפרופיל כדי שהלינק יעבוד.</p>
                )}
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={includePersonalLink}
                  onChange={(e) => setIncludePersonalLink(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>
        )}

        {type === 'resume' && (
          <div className="pt-2">
            <label className="block text-sm font-medium text-slate-700 mb-3">סגנון תבנית</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setTemplate('modern')}
                className={`p-4 rounded-xl border text-right transition-all ${template === 'modern' ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600' : 'border-slate-200 hover:border-indigo-300 bg-white'}`}
              >
                <div className="font-bold text-slate-900 mb-1">מודרני</div>
                <div className="text-xs text-slate-500">נקי, מקצועי וברור. מתאים לרוב המשרות.</div>
              </button>
              <button
                type="button"
                onClick={() => setTemplate('creative')}
                className={`p-4 rounded-xl border text-right transition-all ${template === 'creative' ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600' : 'border-slate-200 hover:border-indigo-300 bg-white'}`}
              >
                <div className="font-bold text-slate-900 mb-1">יצירתי</div>
                <div className="text-xs text-slate-500">דינמי ובולט. מעולה למקצועות העיצוב והשיווק.</div>
              </button>
              <button
                type="button"
                onClick={() => setTemplate('executive')}
                className={`p-4 rounded-xl border text-right transition-all ${template === 'executive' ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600' : 'border-slate-200 hover:border-indigo-300 bg-white'}`}
              >
                <div className="font-bold text-slate-900 mb-1">ניהולי</div>
                <div className="text-xs text-slate-500">רשמי וממוקד הישגים. למשרות בכירות וניהול.</div>
              </button>
            </div>
          </div>
        )}

        {type === 'cover_letter' && (
          <div className="pt-2">
            <label className="block text-sm font-medium text-slate-700 mb-3">סגנון מכתב (Tone)</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setCoverLetterTemplate('formal')}
                className={`p-4 rounded-xl border text-right transition-all ${coverLetterTemplate === 'formal' ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600' : 'border-slate-200 hover:border-indigo-300 bg-white'}`}
              >
                <div className="font-bold text-slate-900 mb-1">רשמי ומקצועי</div>
                <div className="text-xs text-slate-500">טון מכובד ומסורתי. מתאים לתאגידים, בנקים ומשרדי ממשלה.</div>
              </button>
              <button
                type="button"
                onClick={() => setCoverLetterTemplate('startup')}
                className={`p-4 rounded-xl border text-right transition-all ${coverLetterTemplate === 'startup' ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600' : 'border-slate-200 hover:border-indigo-300 bg-white'}`}
              >
                <div className="font-bold text-slate-900 mb-1">הייטק וסטארטאפ</div>
                <div className="text-xs text-slate-500">דינמי, נלהב וישיר. מדגיש תשוקה, גמישות וחדשנות.</div>
              </button>
              <button
                type="button"
                onClick={() => setCoverLetterTemplate('creative')}
                className={`p-4 rounded-xl border text-right transition-all ${coverLetterTemplate === 'creative' ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600' : 'border-slate-200 hover:border-indigo-300 bg-white'}`}
              >
                <div className="font-bold text-slate-900 mb-1">יצירתי ואישי</div>
                <div className="text-xs text-slate-500">מחוץ לקופסה. מתאים לתפקידי עיצוב, שיווק וקריאייטיב.</div>
              </button>
            </div>
          </div>
        )}

        {error && <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}

        <div className="space-y-3">
          {userProfile.plan === 'free' && (
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-medium text-slate-500">קרדיטים נותרים:</span>
              <div className="flex items-center gap-1">
                <div className="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${userProfile.credits > 2 ? 'bg-indigo-500' : 'bg-amber-500'}`}
                    style={{ width: `${(userProfile.credits / 10) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-slate-700">{userProfile.credits}/10</span>
              </div>
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                מייצר קסמים...
              </>
            ) : (
              <>
                <Send className="w-5 h-5 scale-x-[-1]" />
                {type === 'resume' ? 'צור קורות חיים' : 'צור מכתב מקדים'}
              </>
            )}
          </button>
        </div>
      </form>

      {result && (
        <div className="mt-10 sm:mt-12 border-t border-slate-200 pt-6 sm:pt-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 sm:mb-6">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
              התוצאה שלך
            </h3>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={handleSaveEdit}
                    disabled={isSaving}
                    className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    שמור שינויים
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="flex items-center justify-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    ביטול
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleEditClick}
                    className="flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    ערוך
                  </button>
                  <button
                    onClick={handleDownloadPDF}
                    disabled={isDownloading}
                    className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    {isDownloading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    הורד כ-PDF
                  </button>
                </>
              )}
            </div>
          </div>
          
          {isEditing ? (
            <div className="flex flex-col lg:flex-row gap-4 min-h-[500px]">
              <div className="flex-1 flex flex-col">
                <label className="text-sm font-bold text-slate-700 mb-2 text-right">עריכת Markdown</label>
                <textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="flex-1 p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none font-mono text-sm text-left"
                  dir="ltr"
                />
              </div>
              <div className="flex-1 flex flex-col">
                <label className="text-sm font-bold text-slate-700 mb-2 text-right">תצוגה מקדימה</label>
                <div className="flex-1 p-4 border border-slate-200 rounded-xl overflow-y-auto bg-slate-50">
                  <div 
                    ref={resultRef}
                    className="prose prose-sm prose-slate max-w-none text-right" 
                    dir="rtl"
                  >
                    <ReactMarkdown>{editedContent}</ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div 
              ref={resultRef}
              className="bg-slate-50 p-4 sm:p-6 rounded-xl prose prose-sm prose-slate max-w-none text-right" 
              dir="rtl"
            >
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
