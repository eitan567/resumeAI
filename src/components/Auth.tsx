import React, { useState, useRef, useEffect } from 'react';
import { loginWithGoogle, db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { LogIn, Sparkles, FileText, Target, Zap, ChevronLeft, CheckCircle2, Mail, Phone, MapPin, Send, Loader2, ArrowUp } from 'lucide-react';
import { motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';

const RESUME_EXAMPLE = `
# ישראל ישראלי
**מפתח Full Stack מנוסה**
📍 תל אביב | 📱 050-1234567 | ✉️ israel@example.com | 🔗 linkedin.com/in/israel

## תמצית מנהלים
מפתח Full Stack בעל 5 שנות ניסיון בפיתוח מערכות ווב מורכבות וסקיילביליות. מתמחה באקו-סיסטם של React ו-Node.js. בעל יכולת מוכחת בהובלת פרויקטים מקצה לקצה, שיפור ביצועים של מערכות קיימות ועבודה בצוותים אג'יליים. מחפש את האתגר הבא בחברה טכנולוגית מובילה.

## ניסיון תעסוקתי
**מפתח Full Stack בכיר | TechSolutions בע"מ**
*2021 - היום*
* הובלת פיתוח של מערכת ניהול לקוחות (CRM) מבוססת ענן שמשמשת מעל 10,000 משתמשים פעילים ביום.
* שיפור זמני הטעינה של האפליקציה ב-40% על ידי אופטימיזציה של שאילתות מסד נתונים (MongoDB) ויישום Server-Side Rendering עם Next.js.
* חניכה וליווי של 3 מפתחים ג'וניורים בצוות.

**מפתח Front End | WebInnovate**
*2018 - 2021*
* פיתוח ממשקי משתמש מורכבים ורספונסיביים באמצעות React ו-Redux.
* עבודה צמודה עם צוותי עיצוב (UI/UX) להבטחת חווית משתמש חלקה ונגישה.
* הקמת תשתית בדיקות אוטומטיות (Jest & Cypress) שהעלתה את כיסוי הקוד ל-85%.

## השכלה
**תואר ראשון (B.Sc) במדעי המחשב | אוניברסיטת תל אביב**
*2014 - 2018*
* סיום בהצטיינות (ממוצע 92).
* פרויקט גמר: פיתוח אלגוריתם לזיהוי תבניות בנתוני עתק (Big Data).

## כישורים טכנולוגיים
* **שפות תכנות:** JavaScript (ES6+), TypeScript, Python, HTML5, CSS3/SASS.
* **צד לקוח (Front End):** React, Next.js, Redux, Tailwind CSS, Material UI.
* **צד שרת (Back End):** Node.js, Express, NestJS.
* **מסדי נתונים:** MongoDB, PostgreSQL, Redis.
* **כלים ותשתיות:** Git, Docker, AWS, CI/CD, Jest.
`;

const COVER_LETTER_EXAMPLE = `
לכבוד מנהל/ת הגיוס,
חברת InnovateTech,

הנדון: **הגשת מועמדות למשרת מנהל מוצר (Product Manager)**

שמחתי מאוד לראות את המשרה הפנויה לתפקיד מנהל מוצר בחברת InnovateTech, כפי שפורסמה לאחרונה. כמי שעוקב מקרוב אחר ההתפתחויות והמוצרים החדשניים של חברתכם בתחום ה-Fintech, אני רואה בתפקיד זה הזדמנות יוצאת דופן להשתלב בחברה מובילה ולהשפיע באופן משמעותי על חווית המשתמש של אלפי לקוחות.

במהלך 4 השנים האחרונות, שימשתי כמנהל מוצר בחברת StartUpX, שם הובלתי את פיתוחו של מוצר הדגל משלב הרעיון ועד להשקה מוצלחת בשוק הבינלאומי. במסגרת תפקידי:
* ניהלתי צוותים חוצי-ארגון (פיתוח, עיצוב, שיווק ומכירות) תוך שימוש במתודולוגיות Agile/Scrum.
* ביצעתי מחקרי שוק מעמיקים וראיונות משתמשים שהובילו להגדרת מפת דרכים (Roadmap) ברורה וממוקדת ערך.
* הגדלתי את מעורבות המשתמשים (User Engagement) ב-35% תוך חצי שנה בעזרת אפיון מחדש של תהליך ה-Onboarding.

אני מביא עמי שילוב ייחודי של הבנה טכנולוגית עמוקה (הודות לרקע קודם בפיתוח תוכנה) יחד עם ראייה עסקית חדה ויכולת אנליטית גבוהה. אני מאמין ששילוב זה מאפשר לי לגשר ביעילות בין צרכי הלקוח ליכולות הטכנולוגיות, ולהוביל לפיתוח מוצרים מנצחים.

אשמח להזדמנות להיפגש לראיון ולהרחיב על האופן שבו הניסיון והכישורים שלי יכולים לתרום להצלחת הצוות והחברה.

מצ"ב קורות החיים שלי לעיונכם.

בברכה,
ישראל ישראלי
050-1234567
israel@example.com
`;

export const Auth: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'resume' | 'cover_letter'>('resume');
  const [contactForm, setContactForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'contact_messages'), {
        id: Date.now().toString(),
        ...contactForm,
        createdAt: new Date().toISOString()
      });
      setIsSubmitted(true);
      setContactForm({ name: '', email: '', subject: '', message: '' });
      setTimeout(() => setIsSubmitted(false), 5000);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (container.scrollTop > 400) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogin = async () => {
    try {
      setLoginError(null);
      await loginWithGoogle();
    } catch (error: any) {
      console.error('Login failed', error);
      if (error?.code === 'auth/network-request-failed' || error?.message?.includes('network-request-failed')) {
        setLoginError('שגיאת רשת: נראה שהדפדפן חוסם את חלון ההתחברות (אופייני לגלישה בסתר או חסימת עוגיות צד-שלישי). אנא פתח את האפליקציה בלשונית חדשה או אפשר חלונות קופצים.');
      } else {
        setLoginError('אירעה שגיאה בהתחברות. אנא נסה שוב מאוחר יותר.');
      }
    }
  };

  return (
    <div ref={containerRef} className="h-full bg-slate-50 font-sans overflow-y-auto custom-scrollbar" dir="rtl">
      {/* Navigation */}
      <nav className="fixed top-0 w-full p-4 sm:p-6 flex justify-between items-center z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-indigo-600" />
          <span className="text-xl font-bold text-slate-900 tracking-tight">קורות חיים AI</span>
        </div>
        
        <div className="hidden md:flex items-center gap-8">
          <button onClick={() => containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })} className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">בית</button>
          <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">יתרונות</button>
          <button onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })} className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">איך זה עובד</button>
          <button onClick={() => document.getElementById('examples')?.scrollIntoView({ behavior: 'smooth' })} className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">דוגמאות</button>
          <button onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })} className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">צור קשר</button>
        </div>

        <button
          onClick={handleLogin}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 text-indigo-600 text-sm font-bold border border-indigo-100 hover:bg-indigo-100 transition-all"
        >
          <span>התחברות</span>
          <LogIn className="w-4 h-4 rotate-180" />
        </button>
      </nav>

      {/* Hero Section */}
      <main className="relative pt-32 pb-16 sm:pt-40 sm:pb-24 lg:pb-32 px-4 mx-auto max-w-7xl text-center">
        {/* Background Blobs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[500px] opacity-30 pointer-events-none">
          <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
          <div className="absolute top-0 left-0 w-72 h-72 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-sm font-medium mb-8 border border-indigo-100">
            <Sparkles className="w-4 h-4" />
            <span>הדור הבא של חיפוש עבודה</span>
          </div>
          
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-slate-900 tracking-tight mb-8 leading-tight">
            השג את משרת החלומות <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
              בלי מאמץ.
            </span>
          </h1>
          
          <p className="mt-4 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed px-4">
            צור קורות חיים מקצועיים ומכתבים מקדימים מנצחים בשניות בעזרת בינה מלאכותית. 
            התבלט מעל שאר המועמדים והתקבל לעבודה מהר יותר.
          </p>

          {loginError && (
            <div className="max-w-md mx-auto mb-8 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm text-right">
              <p className="font-bold mb-1">שגיאת התחברות</p>
              <p>{loginError}</p>
              {loginError.includes('בלשונית חדשה') && (
                <button 
                  onClick={() => window.open(window.location.href, '_blank')}
                  className="mt-3 bg-red-100 hover:bg-red-200 text-red-800 px-4 py-2 rounded-lg font-medium transition-colors text-sm"
                >
                  פתח בלשונית חדשה
                </button>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 px-4">
            <button
              onClick={handleLogin}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl text-lg font-bold transition-all shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-1"
            >
              <span>התחל בחינם עכשיו</span>
              <LogIn className="w-5 h-5 rotate-180" />
            </button>
            <p className="text-sm text-slate-500 sm:hidden mt-2">אין צורך בכרטיס אשראי</p>
          </div>
          <p className="hidden sm:block text-sm text-slate-500 mt-4">אין צורך בכרטיס אשראי • 3 קרדיטים מתנה בהרשמה</p>
        </motion.div>

        {/* Features Grid */}
        <motion.div 
          id="features"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-24 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto relative z-10 px-4 scroll-mt-24"
        >
          <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-sm border border-slate-200/60 text-right hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">מהיר וקל</h3>
            <p className="text-slate-600 leading-relaxed">
              הזן את הניסיון והכישורים שלך בקצרה, והבינה המלאכותית שלנו תנסח עבורך קורות חיים מושלמים תוך שניות.
            </p>
          </div>

          <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-sm border border-slate-200/60 text-right hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-6">
              <Target className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">מותאם אישית</h3>
            <p className="text-slate-600 leading-relaxed">
              התוכן מותאם במדויק למשרה שאתה מחפש. המערכת מדגישה את הכישורים הרלוונטיים ביותר עבור המגייס.
            </p>
          </div>

          <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-sm border border-slate-200/60 text-right hover:shadow-md transition-shadow sm:col-span-2 lg:col-span-1">
            <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-6">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">תוצאות מקצועיות</h3>
            <p className="text-slate-600 leading-relaxed">
              ניסוחים ברמה הגבוהה ביותר שמושכים את תשומת לב המגייסים ועוברים מערכות סינון אוטומטיות (ATS).
            </p>
          </div>
        </motion.div>

        {/* How it works */}
        <motion.div
          id="how-it-works"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="mt-32 max-w-5xl mx-auto relative z-10 px-4 scroll-mt-24"
        >
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">איך זה עובד?</h2>
            <p className="text-lg text-slate-600">3 צעדים פשוטים למשרת החלומות שלך</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-indigo-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mb-6 shadow-lg shadow-indigo-200">1</div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">הזן פרטים</h3>
              <p className="text-slate-600">ספר לנו בקצרה על הניסיון והכישורים שלך</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-indigo-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mb-6 shadow-lg shadow-indigo-200">2</div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">ה-AI מייצר</h3>
              <p className="text-slate-600">האלגוריתם שלנו מנסח מסמך מקצועי ומדויק</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-indigo-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mb-6 shadow-lg shadow-indigo-200">3</div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">הורד והגש</h3>
              <p className="text-slate-600">קבל קובץ PDF מוכן להגשה והתחל להתראיין</p>
            </div>
          </div>
        </motion.div>

        {/* Examples Section */}
        <motion.div
          id="examples"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="mt-32 max-w-4xl mx-auto relative z-10 px-4 scroll-mt-24 pb-20"
        >
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">תראה בעצמך את התוצאות</h2>
            <p className="text-lg text-slate-600">דוגמאות אמיתיות למסמכים שנוצרו על ידי הבינה המלאכותית שלנו</p>
          </div>

          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-slate-200">
              <button
                onClick={() => setActiveTab('resume')}
                className={`flex-1 py-4 text-center font-medium transition-colors ${
                  activeTab === 'resume' 
                    ? 'bg-indigo-50 text-indigo-600 border-b-2 border-indigo-600' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                קורות חיים
              </button>
              <button
                onClick={() => setActiveTab('cover_letter')}
                className={`flex-1 py-4 text-center font-medium transition-colors ${
                  activeTab === 'cover_letter' 
                    ? 'bg-indigo-50 text-indigo-600 border-b-2 border-indigo-600' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                מכתב מקדים
              </button>
            </div>

            {/* Content */}
            <div className="p-6 sm:p-10 text-right bg-slate-50/50">
              <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-100 prose prose-sm sm:prose-base prose-slate max-w-none mx-auto">
                <ReactMarkdown>
                  {activeTab === 'resume' ? RESUME_EXAMPLE : COVER_LETTER_EXAMPLE}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Contact Section */}
        <motion.div
          id="contact"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="mt-32 max-w-6xl mx-auto relative z-10 px-4 scroll-mt-24 pb-20"
        >
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">צור קשר</h2>
            <p className="text-lg text-slate-600">יש לך שאלה? אנחנו כאן בשבילך</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Contact Info */}
            <div className="space-y-8 text-right">
              <h3 className="text-2xl font-bold text-slate-900 mb-6">נשמח לשמוע ממך</h3>
              <p className="text-slate-600 leading-relaxed max-w-md">
                צוות התמיכה שלנו זמין לכל שאלה, הצעה או משוב. אנחנו משתדלים לחזור לכל פנייה תוך 24 שעות.
              </p>

              <div className="space-y-6">
                <div className="flex items-center gap-4 justify-start">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
                    <Mail className="w-6 h-6" />
                  </div>
                  <div className="text-right">
                    <h4 className="font-bold text-slate-900">אימייל</h4>
                    <p className="text-slate-500">support@cv-ai.co.il</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 justify-start">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
                    <Phone className="w-6 h-6" />
                  </div>
                  <div className="text-right">
                    <h4 className="font-bold text-slate-900">טלפון</h4>
                    <p className="text-slate-500">050-1234567</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 justify-start">
                  <div className="w-12 h-12 bg-amber-50 text-amber-700 rounded-2xl flex items-center justify-center shrink-0">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div className="text-right">
                    <h4 className="font-bold text-slate-900">מיקום</h4>
                    <p className="text-slate-500">תל אביב, ישראל</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-8 sm:p-10">
              {isSubmitted ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Send className="w-10 h-10" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">ההודעה נשלחה בהצלחה!</h3>
                  <p className="text-slate-500">תודה על פנייתך. נחזור אליך בהקדם האפשרי.</p>
                  <button 
                    onClick={() => setIsSubmitted(false)}
                    className="mt-8 text-indigo-600 font-bold hover:underline"
                  >
                    שלח הודעה נוספת
                  </button>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} className="space-y-6 text-right">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">שם מלא</label>
                      <input
                        required
                        type="text"
                        value={contactForm.name}
                        onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        placeholder="ישראל ישראלי"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">אימייל</label>
                      <input
                        required
                        type="email"
                        value={contactForm.email}
                        onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        placeholder="israel@example.com"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">נושא</label>
                    <input
                      required
                      type="text"
                      value={contactForm.subject}
                      onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="איך נוכל לעזור?"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">הודעה</label>
                    <textarea
                      required
                      rows={4}
                      value={contactForm.message}
                      onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                      placeholder="כתוב כאן את הודעתך..."
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    שלח הודעה
                  </button>
                </form>
              )}
            </div>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-12 px-4 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-6 h-6 text-indigo-600" />
                <span className="text-xl font-bold text-slate-900 tracking-tight">קורות חיים AI</span>
              </div>
              <p className="text-slate-500 max-w-sm leading-relaxed">
                הפלטפורמה המתקדמת ביותר ליצירת קורות חיים ומכתבים מקדימים בעזרת בינה מלאכותית. 
                אנחנו עוזרים לאלפי מחפשי עבודה להשיג את המשרה הבאה שלהם.
              </p>
            </div>
            
            <div>
              <h4 className="font-bold text-slate-900 mb-4">ניווט מהיר</h4>
              <ul className="space-y-2 text-slate-500 text-sm">
                <li><button onClick={() => containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })} className="hover:text-indigo-600 transition-colors">בית</button></li>
                <li><button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-indigo-600 transition-colors">יתרונות</button></li>
                <li><button onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-indigo-600 transition-colors">איך זה עובד</button></li>
                <li><button onClick={() => document.getElementById('examples')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-indigo-600 transition-colors">דוגמאות</button></li>
                <li><button onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-indigo-600 transition-colors">צור קשר</button></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 mb-4">צור קשר</h4>
              <ul className="space-y-2 text-slate-500 text-sm">
                <li>תמיכה טכנית</li>
                <li>שאלות נפוצות</li>
                <li>שיתופי פעולה</li>
                <li>israel@example.com</li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-400">
            <p>© {new Date().getFullYear()} קורות חיים AI. כל הזכויות שמורות.</p>
            <div className="flex gap-6">
              <button className="hover:text-slate-600 transition-colors">תנאי שימוש</button>
              <button className="hover:text-slate-600 transition-colors">מדיניות פרטיות</button>
              <button className="hover:text-slate-600 transition-colors">עוגיות</button>
            </div>
          </div>
        </div>
      </footer>

      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-24 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-indigo-700 transition-all hover:scale-110 active:scale-95 z-40 animate-in fade-in slide-in-from-bottom-4 duration-300"
          title="חזרה למעלה"
        >
          <ArrowUp className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};
