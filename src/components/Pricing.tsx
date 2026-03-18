import React, { useState } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';
import { CheckCircle2, X } from 'lucide-react';

interface PricingProps {
  userProfile: UserProfile;
  onClose: () => void;
}

export const Pricing: React.FC<PricingProps> = ({ userProfile, onClose }) => {
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async (data: any, actions: any) => {
    try {
      // In a real app, you'd verify this on the backend via webhooks.
      // For this prototype, we update the user's plan directly.
      const userRef = doc(db, 'users', userProfile.uid);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days from now
      
      await updateDoc(userRef, {
        plan: 'pro',
        credits: 9999, // Unlimited
        proExpiresAt: expiresAt.toISOString(),
        reminderSent: false
      });
      onClose();
    } catch (err) {
      console.error('Failed to update plan', err);
      setError('אירעה שגיאה בעדכון המנוי. אנא פנה לתמיכה.');
    }
  };

  const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID || 'test';
  
  // לבקשתך: אנחנו מאלצים מצב דמו כדי לעקוף את PayPal כרגע. הקוד המקורי נשמר ב-else.
  const FORCE_DEMO_MODE = true;
  const isTestMode = FORCE_DEMO_MODE || !clientId || clientId === 'test' || clientId === '123456789' || clientId.length < 20;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto relative border border-slate-200 dark:border-slate-800">
        <button 
          onClick={onClose}
          className="absolute top-4 left-4 sm:top-6 sm:left-6 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-800 p-2 rounded-full z-10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-8 md:p-12">
          <div className="text-center mb-8 sm:mb-10 mt-4 sm:mt-0">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2 sm:mb-4">שדרג ל-Pro 🚀</h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">קבל גישה בלתי מוגבלת לכל הכלים שלנו והגדל את סיכויי הקבלה שלך.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
            {/* Free Plan */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 bg-slate-50 dark:bg-slate-950/50">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-2">חינם</h3>
              <div className="text-2xl sm:text-3xl font-bold mb-6 text-slate-900 dark:text-white">₪0 <span className="text-xs sm:text-sm font-normal text-slate-500 dark:text-slate-500">/ חודש</span></div>
              
              <ul className="space-y-3 sm:space-y-4 mb-8 text-sm sm:text-base">
                <li className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>3 יצירות קורות חיים בחודש</span>
                </li>
                <li className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>תבנית בסיסית</span>
                </li>
                <li className="flex items-center gap-3 text-slate-400 dark:text-slate-600 opacity-50">
                  <X className="w-5 h-5 shrink-0" />
                  <span>ללא מכתבי מקדים</span>
                </li>
              </ul>

              <button 
                disabled
                className="w-full py-3 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-500 font-medium text-sm sm:text-base"
              >
                {userProfile.plan === 'free' ? 'התוכנית הנוכחית שלך' : 'חינם'}
              </button>
            </div>

            {/* Pro Plan */}
            <div className="border-2 border-indigo-600 rounded-2xl p-6 sm:p-8 bg-white dark:bg-slate-900 relative shadow-lg">
              <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 bg-indigo-600 text-white px-3 py-1 sm:px-4 sm:py-1 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap">
                מומלץ
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-2">Pro</h3>
              <div className="text-2xl sm:text-3xl font-bold mb-6 text-slate-900 dark:text-white">₪49 <span className="text-xs sm:text-sm font-normal text-slate-500 dark:text-slate-500">/ חודש</span></div>
              
              <ul className="space-y-3 sm:space-y-4 mb-8 text-sm sm:text-base">
                <li className="flex items-start gap-3 text-slate-600 dark:text-slate-400">
                  <CheckCircle2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block text-slate-900 dark:text-white">יצירה ללא הגבלה</span>
                    <span className="text-xs text-slate-500 dark:text-slate-500">צור כמה קורות חיים שתרצה, ללא הגבלת קרדיטים.</span>
                  </div>
                </li>
                <li className="flex items-start gap-3 text-slate-600 dark:text-slate-400">
                  <CheckCircle2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block text-slate-900 dark:text-white">מכתבי מקדים חכמים</span>
                    <span className="text-xs text-slate-500 dark:text-slate-500">גישה מלאה למחולל מכתבי המקדים המותאמים אישית.</span>
                  </div>
                </li>
                <li className="flex items-start gap-3 text-slate-600 dark:text-slate-400">
                  <CheckCircle2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block text-slate-900 dark:text-white">כל תבניות העיצוב</span>
                    <span className="text-xs text-slate-500 dark:text-slate-500">גישה לתבניות פרימיום: מודרני, יצירתי וניהולי.</span>
                  </div>
                </li>
                <li className="flex items-start gap-3 text-slate-600 dark:text-slate-400">
                  <CheckCircle2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block text-slate-900 dark:text-white">שליטה בטון הכתיבה</span>
                    <span className="text-xs text-slate-500 dark:text-slate-500">התאם את סגנון המכתב (רשמי, סטארטאפ, יצירתי).</span>
                  </div>
                </li>
                <li className="flex items-start gap-3 text-slate-600 dark:text-slate-400">
                  <CheckCircle2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block text-slate-900 dark:text-white">היסטוריה מלאה</span>
                    <span className="text-xs text-slate-500 dark:text-slate-500">שמירה וגישה לכל המסמכים שיצרת אי פעם.</span>
                  </div>
                </li>
              </ul>

              {userProfile.plan === 'pro' ? (
                <button 
                  disabled
                  className="w-full py-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold text-sm sm:text-base"
                >
                  מנוי פעיל
                </button>
              ) : (
                <div className="w-full">
                  {error && <div className="text-red-500 dark:text-red-400 text-xs sm:text-sm mb-4 text-center">{error}</div>}
                  
                  {isTestMode ? (
                    <div className="text-center">
                      <button 
                        onClick={() => handleApprove({}, {})}
                        className="w-full py-3 rounded-xl bg-[#0070ba] hover:bg-[#003087] text-white font-bold text-sm sm:text-base transition-colors shadow-md"
                      >
                        שדרג עכשיו (גרסת הדגמה)
                      </button>
                      <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 mt-4">
                        * מצב הדגמה פעיל: לחיצה על הכפתור תשדרג את החשבון מידית ללא חיוב אמיתי.
                      </p>
                    </div>
                  ) : (
                    <>
                      <PayPalScriptProvider options={{ "clientId": clientId, currency: "ILS", intent: "subscription" }}>
                        <PayPalButtons 
                          style={{ layout: "vertical", shape: "rect", color: "blue" }}
                          createSubscription={(data, actions) => {
                            return actions.subscription.create({
                              plan_id: "P-YOUR_PLAN_ID_HERE" 
                            });
                          }}
                          onApprove={handleApprove}
                          onError={(err) => {
                            console.error("PayPal Error:", err);
                            setError("שגיאה בהתחברות ל-PayPal. נסה שוב מאוחר יותר.");
                          }}
                        />
                      </PayPalScriptProvider>
                      <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 text-center mt-4">
                        * בסביבת פיתוח זו, כפתור ה-PayPal דורש הגדרת Client ID ו-Plan ID אמיתיים.
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
