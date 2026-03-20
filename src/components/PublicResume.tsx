import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, limit, doc as firestoreDoc, getDoc } from 'firebase/firestore';
import { GeneratedDocument, UserProfile } from '../types';
import { getUserDisplayName } from '../utils/user';
import { ResumeTemplate } from './ResumeTemplate';
import { Loader2, AlertCircle, Download, Share2, Sparkles } from 'lucide-react';

export const PublicResume: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [doc, setDoc] = useState<GeneratedDocument | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDoc = async () => {
      if (!slug) return;
      
      try {
        const q = query(
          collection(db, 'documents'),
          where('slug', '==', slug),
          where('isPublic', '==', true),
          limit(1)
        );
        
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const documentData = querySnapshot.docs[0].data() as GeneratedDocument;
          setDoc(documentData);
          
          // Fetch user profile to get the latest name
          if (documentData.userId) {
            const userRef = firestoreDoc(db, 'users', documentData.userId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              setUserProfile(userSnap.data() as UserProfile);
            }
          }
        } else {
          setError('המסמך לא נמצא או שאינו ציבורי.');
        }
      } catch (err) {
        console.error('Error fetching public resume:', err);
        setError('אירעה שגיאה בטעינת המסמך.');
      } finally {
        setLoading(false);
      }
    };

    fetchDoc();
  }, [slug]);

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

  const cleanMarkdownContent = (text: string, docObj?: any) => {
    if (!text) return '';
    
    let cleaned = text;

    // 1. Fill known data
    if (docObj) {
      const nameToUse = userProfile ? getUserDisplayName(userProfile) : (docObj.userName || '');
      cleaned = cleaned.replace(/\[שם מלא\]/gi, nameToUse);
      cleaned = cleaned.replace(/\[Full Name\]/gi, nameToUse);
      cleaned = cleaned.replace(/\[אימייל\]/gi, docObj.userEmail || '');
      cleaned = cleaned.replace(/\[Email\]/gi, docObj.userEmail || '');
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4" dir="rtl">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
        <p className="text-slate-600 font-medium">טוען קורות חיים מרשימים...</p>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center" dir="rtl">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 max-w-md w-full">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">אופס!</h2>
          <p className="text-slate-600 mb-6">{error || 'המסמך שחיפשת לא נמצא.'}</p>
          <a 
            href="/"
            className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors"
          >
            חזרה לדף הבית
          </a>
        </div>
      </div>
    );
  }

  const body = cleanMarkdownContent(doc.content, doc);

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8" dir="rtl">
      <div className="max-w-4xl mx-auto">
        {/* Floating Header Actions */}
        <div className="mb-8 flex justify-between items-center bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-slate-200 sticky top-4 z-10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <span className="font-bold text-slate-900">קורות חיים מקצועיים</span>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => window.print()}
              className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-800 transition-all"
            >
              <Download className="w-4 h-4" />
              הורד PDF
            </button>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                alert('הלינק הועתק ללוח!');
              }}
              className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-100 transition-all"
            >
              <Share2 className="w-4 h-4" />
              שתף
            </button>
          </div>
        </div>

        {/* Resume Content */}
        <div className="bg-white shadow-2xl rounded-sm overflow-hidden border border-slate-100 relative">
          <ResumeTemplate
            content={body}
            template={doc.template || 'modern'}
            name={userProfile ? getUserDisplayName(userProfile) : (doc.userName || 'משתמש')}
            jobTitle={doc.jobTitle}
            email={doc.userEmail || ''}
            photoUrl={doc.photoUrl}
            personalLink={window.location.href}
            includePersonalLink={true}
          />
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-slate-400 text-sm">
          <p>נוצר באמצעות קורות חיים AI - הדרך החכמה למצוא עבודה</p>
        </div>
      </div>

      <style>{`
        @media print {
          .mb-8, .mt-12 { display: none !important; }
          body { background: white !important; padding: 0 !important; }
          .max-w-4xl { max-width: 100% !important; }
          .shadow-2xl { shadow: none !important; border: none !important; }
        }
      `}</style>
    </div>
  );
};
