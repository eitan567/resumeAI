import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { GeneratedDocument } from '../types';
import { ResumeTemplate } from './ResumeTemplate';
import { Loader2, AlertCircle, Download, Share2, Sparkles } from 'lucide-react';

export const PublicResume: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [doc, setDoc] = useState<GeneratedDocument | null>(null);
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
          setDoc(querySnapshot.docs[0].data() as GeneratedDocument);
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

  const { body } = parseContent(doc.content);

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
            name={doc.userName || 'משתמש'}
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
