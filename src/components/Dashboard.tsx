import React, { useEffect, useState, useRef } from 'react';
import { UserProfile, GeneratedDocument } from '../types';
import { auth, db, logout } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, increment } from 'firebase/firestore';
import { Generator } from './Generator';
import { Pricing } from './Pricing';
import { ProfileSettings } from './ProfileSettings';
import { LogOut, Crown, FileText, Clock, Sparkles, Menu, X, Download, Loader2, Palette, ArrowUp, Share2, User as UserIcon, Settings } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { rewriteDocument } from '../services/ai';

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
  // We don't throw here for list listeners to avoid crashing the whole dashboard
}

interface DashboardProps {
  userProfile: UserProfile;
}

export const Dashboard: React.FC<DashboardProps> = ({ userProfile }) => {
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
  const [activeTab, setActiveTab] = useState<'documents' | 'profile'>('documents');
  const [showPricing, setShowPricing] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<GeneratedDocument | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingTemplate, setIsChangingTemplate] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  const modalContentRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (mainScrollRef.current) {
      setShowScrollTop(mainScrollRef.current.scrollTop > 300);
    }
  };

  const scrollToTop = () => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  const parseContent = (content: string) => {
    const separator = '---\n';
    const parts = content.split(separator);
    if (parts.length > 1 && !parts[0].includes('#')) {
      return {
        intro: parts[0].trim(),
        body: parts.slice(1).join(separator).trim()
      };
    }
    return { intro: null, body: content.trim() };
  };

  const handleEditClick = () => {
    const { body } = parseContent(selectedDoc?.content || '');
    setEditedContent(body);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedDoc) return;
    setIsSaving(true);
    try {
      const { intro } = parseContent(selectedDoc.content);
      const fullContent = intro ? `${intro}\n---\n${editedContent}` : editedContent;
      
      await updateDoc(doc(db, 'documents', selectedDoc.id), {
        content: fullContent
      });
      setSelectedDoc({ ...selectedDoc, content: fullContent });
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      setPdfError('אירעה שגיאה בשמירת השינויים.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangeTemplate = async (newTemplate: string) => {
    if (!selectedDoc) return;
    
    // Check if user has enough credits or is pro
    if (userProfile.plan === 'free' && userProfile.credits <= 0) {
      setShowPricing(true);
      return;
    }

    setIsChangingTemplate(true);
    setPdfError(null);
    setShowTemplateSelector(false);
    
    try {
      const newContent = await rewriteDocument(selectedDoc.content, selectedDoc.type, newTemplate);
      
      await updateDoc(doc(db, 'documents', selectedDoc.id), {
        content: newContent,
        template: newTemplate
      });

      // Deduct credit if free plan
      if (userProfile.plan === 'free') {
        await updateDoc(doc(db, 'users', userProfile.uid), {
          credits: increment(-1)
        });
      }

      setSelectedDoc({ ...selectedDoc, content: newContent, template: newTemplate });
    } catch (err) {
      console.error('Failed to change template:', err);
      setPdfError('אירעה שגיאה בשינוי התבנית. אנא נסה שוב.');
    } finally {
      setIsChangingTemplate(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!modalContentRef.current || !selectedDoc) return;
    
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        setPdfError('הדפדפן חסם את פתיחת חלון ההדפסה. אנא אפשר חלונות קופצים (Pop-ups) עבור אתר זה ונסה שוב.');
        return;
      }

      let fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif";
      let primaryColor = "#0f172a";
      let secondaryColor = "#1e293b";
      let accentColor = "#4f46e5"; // indigo
      
      if (selectedDoc.template === 'executive' || selectedDoc.template === 'formal') {
        fontFamily = "Georgia, Cambria, 'Times New Roman', Times, serif";
        primaryColor = "#1c1917"; // stone
        secondaryColor = "#292524";
        accentColor = "#44403c";
      } else if (selectedDoc.template === 'creative') {
        accentColor = "#4f46e5"; // indigo
      } else if (selectedDoc.template === 'startup') {
        accentColor = "#059669"; // emerald
      }
      
      const html = `
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
          <title>${selectedDoc.type === 'resume' ? 'קורות חיים' : 'מכתב מקדים'}</title>
          <style>
            body {
              font-family: ${fontFamily};
              color: ${secondaryColor};
              line-height: 1.6;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
            }
            h1 { font-size: 28px; font-weight: 800; margin-bottom: 16px; margin-top: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; color: ${primaryColor}; }
            h2 { font-size: 20px; font-weight: 700; margin-bottom: 12px; margin-top: 24px; color: ${primaryColor}; }
            h3 { font-size: 16px; font-weight: 600; margin-bottom: 12px; margin-top: 16px; color: ${secondaryColor}; }
            p { font-size: 14px; margin-bottom: 12px; }
            ul, ol { margin-bottom: 16px; padding-right: 24px; }
            li { font-size: 14px; margin-bottom: 6px; }
            strong, b { font-weight: 700; color: ${primaryColor}; }
            em, i { font-style: italic; }
            a { color: ${accentColor}; text-decoration: none; }
            @media print {
              @page { margin: 20mm; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          ${modalContentRef.current.innerHTML}
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
      setPdfError(null);
    } catch (err) {
      console.error('PDF generation failed:', err);
      setPdfError('אירעה שגיאה בהכנת המסמך ל-PDF. אנא נסה שוב או נסה להשתמש בדפדפן אחר.');
    }
  };

  useEffect(() => {
    const q = query(
      collection(db, 'documents'),
      where('userId', '==', userProfile.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs: GeneratedDocument[] = [];
      snapshot.forEach((doc) => {
        docs.push(doc.data() as GeneratedDocument);
      });
      // Sort in memory
      setDocuments(docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'documents');
    });

    return () => unsubscribe();
  }, [userProfile.uid]);

  useEffect(() => {
    if (userProfile.plan === 'pro' && userProfile.proExpiresAt && !userProfile.reminderSent) {
      const expiresAt = new Date(userProfile.proExpiresAt);
      const now = new Date();
      const diffTime = expiresAt.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      
      // If it expires within 3 days and hasn't expired yet
      if (diffDays <= 3 && diffDays >= 0) {
        fetch('/api/send-reminder', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: userProfile.email,
            name: userProfile.name,
            expiresAt: userProfile.proExpiresAt
          })
        }).then(res => {
          if (res.ok) {
            updateDoc(doc(db, 'users', userProfile.uid), {
              reminderSent: true
            }).catch(console.error);
          }
        }).catch(console.error);
      }
    }
  }, [userProfile]);

  const getTemplateStyles = (template?: string) => {
    switch (template) {
      case 'modern': return 'prose-slate font-sans';
      case 'creative': return 'prose-indigo font-sans selection:bg-indigo-200';
      case 'executive': return 'prose-stone font-serif';
      case 'formal': return 'prose-neutral font-serif';
      case 'startup': return 'prose-emerald font-sans';
      default: return 'prose-slate font-sans';
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 z-30 shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-600" />
            <h1 className="text-xl font-bold text-slate-900 hidden sm:block">קורות חיים AI</h1>
          </div>

          <nav className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('documents')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'documents' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <FileText className="w-4 h-4" />
              מחולל ומסמכים
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'profile' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <UserIcon className="w-4 h-4" />
              פרופיל והגדרות
            </button>
          </nav>
          
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <span className="text-slate-600 truncate max-w-[120px]">שלום, {userProfile.name}</span>
              <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${userProfile.plan === 'pro' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                {userProfile.plan === 'pro' ? 'PRO' : 'FREE'}
              </span>
              {userProfile.plan === 'free' && (
                <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-100">
                  <Sparkles className="w-3 h-3" />
                  <span className="text-[10px] font-bold">{userProfile.credits} קרדיטים</span>
                </div>
              )}
              {userProfile.plan === 'pro' && userProfile.proExpiresAt && (
                <span className="text-slate-500 text-xs hidden md:inline">
                  (תוקף עד: {new Date(userProfile.proExpiresAt).toLocaleDateString('he-IL')})
                </span>
              )}
            </div>
            
            {userProfile.plan === 'free' && (
              <button
                onClick={() => setShowPricing(true)}
                className="flex items-center gap-1 bg-amber-100 hover:bg-amber-200 text-amber-700 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors"
              >
                <Crown className="w-4 h-4" />
                <span className="hidden sm:inline">שדרג</span>
              </button>
            )}
            
            <button
              onClick={logout}
              className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors hidden sm:block"
              title="התנתק"
            >
              <LogOut className="w-5 h-5 scale-x-[-1]" />
            </button>

            {/* Mobile Menu Toggle */}
            <button 
              className="sm:hidden text-slate-600 p-2"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="sm:hidden bg-white border-t border-slate-100 px-4 py-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-medium">שלום, {userProfile.name}</span>
              <span className={`px-2 py-1 rounded-full text-xs font-bold ${userProfile.plan === 'pro' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                {userProfile.plan === 'pro' ? 'PRO' : 'FREE'}
              </span>
            </div>
            {userProfile.plan === 'free' && (
              <div className="text-slate-500 text-sm">נותרו לך {userProfile.credits} קרדיטים</div>
            )}
            <button
              onClick={() => {
                logout();
                setIsMobileMenuOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 text-red-600 bg-red-50 py-3 rounded-xl font-medium"
            >
              <LogOut className="w-5 h-5 scale-x-[-1]" />
              התנתק
            </button>
          </div>
        )}
      </header>

      <main 
        ref={mainScrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto custom-scrollbar"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {activeTab === 'documents' ? (
            <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">
              {/* Main Generator Area */}
              <div className="lg:col-span-2 order-1 lg:order-none">
                <Generator 
                  userProfile={userProfile} 
                  onShowPricing={() => setShowPricing(true)} 
                  onDocumentCreated={() => {}}
                />
              </div>

              {/* Sidebar - History */}
              <div className="lg:col-span-1 order-2 lg:order-none">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 lg:sticky lg:top-8">
                  <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-slate-400" />
                    היסטוריית מסמכים
                  </h3>
                  
                  <div className="space-y-3 max-h-[40vh] lg:max-h-[60vh] overflow-y-auto pl-2 custom-scrollbar">
                    {documents.length === 0 ? (
                      <p className="text-slate-500 text-sm text-center py-8">עדיין לא יצרת מסמכים. התחל עכשיו!</p>
                    ) : (
                      documents.map((doc) => (
                        <button
                          key={doc.id}
                          onClick={() => setSelectedDoc(doc)}
                          className="w-full text-right p-4 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 transition-all group"
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <FileText className={`w-5 h-5 shrink-0 ${doc.type === 'resume' ? 'text-blue-500' : 'text-emerald-500'}`} />
                            <span className="font-medium text-slate-900 group-hover:text-indigo-700 truncate">
                              {doc.type === 'resume' ? 'קורות חיים' : 'מכתב מקדים'}
                            </span>
                            {doc.isPublic && doc.slug && (
                              <div className="bg-emerald-100 text-emerald-700 p-1 rounded-full" title="ציבורי">
                                <Share2 className="w-3 h-3" />
                              </div>
                            )}
                            {doc.template && (
                              <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full whitespace-nowrap">
                                {doc.template === 'modern' ? 'מודרני' : 
                                 doc.template === 'creative' ? 'יצירתי' : 
                                 doc.template === 'executive' ? 'ניהולי' : 
                                 doc.template === 'formal' ? 'רשמי' : 
                                 doc.template === 'startup' ? 'סטארטאפ' : doc.template}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400">
                            {new Date(doc.createdAt).toLocaleDateString('he-IL', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <ProfileSettings userProfile={userProfile} />
          )}
        </div>
      </main>

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-24 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-indigo-700 transition-all hover:scale-110 active:scale-95 z-40 animate-in fade-in slide-in-from-bottom-4 duration-300"
          title="חזרה למעלה"
        >
          <ArrowUp className="w-6 h-6" />
        </button>
      )}

      {/* Document Modal */}
      {selectedDoc && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-7xl w-full max-h-[90vh] flex flex-col transition-all duration-300">
            <div className="p-4 sm:p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">
                {selectedDoc.type === 'resume' ? 'קורות חיים' : 'מכתב מקדים'}
              </h3>
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={handleSaveEdit}
                      disabled={isSaving}
                      className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      שמור
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="flex items-center justify-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
                    >
                      ביטול
                    </button>
                  </>
                ) : (
                  <>
                    <div className="relative">
                      <button
                        onClick={() => setShowTemplateSelector(!showTemplateSelector)}
                        disabled={isChangingTemplate}
                        className="flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                      >
                        {isChangingTemplate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Palette className="w-4 h-4" />}
                        <span className="hidden sm:inline">שנה תבנית</span>
                      </button>
                      
                      {showTemplateSelector && (
                        <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 p-2 z-50">
                          <div className="text-xs font-bold text-slate-400 mb-2 px-2">בחר תבנית חדשה:</div>
                          {selectedDoc.type === 'resume' ? (
                            <>
                              <button onClick={() => handleChangeTemplate('modern')} className="w-full text-right px-3 py-2 text-sm hover:bg-slate-50 rounded-lg text-slate-700">מודרני</button>
                              <button onClick={() => handleChangeTemplate('creative')} className="w-full text-right px-3 py-2 text-sm hover:bg-slate-50 rounded-lg text-slate-700">יצירתי</button>
                              <button onClick={() => handleChangeTemplate('executive')} className="w-full text-right px-3 py-2 text-sm hover:bg-slate-50 rounded-lg text-slate-700">ניהולי</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => handleChangeTemplate('formal')} className="w-full text-right px-3 py-2 text-sm hover:bg-slate-50 rounded-lg text-slate-700">רשמי</button>
                              <button onClick={() => handleChangeTemplate('startup')} className="w-full text-right px-3 py-2 text-sm hover:bg-slate-50 rounded-lg text-slate-700">סטארטאפ</button>
                              <button onClick={() => handleChangeTemplate('creative')} className="w-full text-right px-3 py-2 text-sm hover:bg-slate-50 rounded-lg text-slate-700">יצירתי</button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={handleEditClick}
                      className="flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                    >
                      ערוך
                    </button>
                    <button
                      onClick={handleDownloadPDF}
                      disabled={isDownloading}
                      className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                      title="הורד כ-PDF"
                    >
                      {isDownloading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      <span className="hidden sm:inline">הורד</span>
                    </button>
                  </>
                )}
                <button 
                  onClick={() => { setSelectedDoc(null); setPdfError(null); setIsEditing(false); setShowTemplateSelector(false); }}
                  className="text-slate-400 hover:text-slate-600 bg-slate-100 p-2 rounded-full transition-colors"
                  title="סגור"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className={`p-4 sm:p-6 overflow-y-auto custom-scrollbar ${isEditing ? 'flex-1 flex flex-col' : ''}`}>
              {selectedDoc && parseContent(selectedDoc.content).intro && (
                <div className="mb-6 bg-indigo-50 border border-indigo-100 rounded-2xl p-4 sm:p-5 flex gap-4 items-start shadow-sm">
                  <div className="bg-white p-2 rounded-xl shadow-sm shrink-0">
                    <Sparkles className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-indigo-900 mb-1">הערות ה-AI על הגרסה הזו:</h4>
                    <p className="text-sm text-indigo-700 leading-relaxed">
                      {parseContent(selectedDoc.content).intro}
                    </p>
                  </div>
                </div>
              )}
              
              {pdfError && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm text-right" dir="rtl">
                  {pdfError}
                </div>
              )}
              {isEditing ? (
                <div className="flex flex-col lg:flex-row gap-6 h-full min-h-[60vh]">
                  <div className="flex-1 flex flex-col">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-slate-400 font-mono">Markdown Editor</span>
                      <label className="text-sm font-bold text-slate-700 text-right">עריכת תוכן</label>
                    </div>
                    <textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      className="flex-1 p-6 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none font-mono text-sm text-right bg-slate-50/50"
                      dir="rtl"
                      placeholder="הזן תוכן בפורמט Markdown..."
                    />
                  </div>
                  <div className="flex-1 flex flex-col">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-slate-400 font-mono">Live Preview</span>
                      <label className="text-sm font-bold text-slate-700 text-right">תצוגה מקדימה</label>
                    </div>
                    <div className="flex-1 p-8 border border-slate-200 rounded-2xl overflow-y-auto bg-slate-100/50 shadow-inner">
                      <div 
                        ref={modalContentRef}
                        className={`prose max-w-none text-right bg-white p-8 sm:p-12 shadow-lg rounded-sm min-h-full ${getTemplateStyles(selectedDoc.template)}`} 
                        dir="rtl"
                      >
                        {selectedDoc.photoUrl && (
                          <div className="flex justify-center mb-8">
                            <img 
                              src={selectedDoc.photoUrl} 
                              alt="Profile" 
                              className="w-24 h-24 rounded-xl object-cover border-2 border-white shadow-md ring-1 ring-slate-200"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        )}
                        <ReactMarkdown>{editedContent}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-100/50 p-4 sm:p-10 rounded-2xl shadow-inner">
                  <div 
                    ref={modalContentRef}
                    className={`prose max-w-none text-right bg-white p-8 sm:p-16 shadow-xl rounded-sm mx-auto ${getTemplateStyles(selectedDoc.template)}`} 
                    dir="rtl"
                    style={{ maxWidth: '1000px' }}
                  >
                    {selectedDoc.photoUrl && (
                      <div className="flex justify-center mb-10">
                        <img 
                          src={selectedDoc.photoUrl} 
                          alt="Profile" 
                          className="w-32 h-32 rounded-2xl object-cover border-4 border-white shadow-lg ring-1 ring-slate-200"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}
                    <ReactMarkdown>{parseContent(selectedDoc.content).body}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showPricing && (
        <Pricing userProfile={userProfile} onClose={() => setShowPricing(false)} />
      )}
    </div>
  );
};
