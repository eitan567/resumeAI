import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { PublicResume } from './components/PublicResume';
import { PublicProfile } from './components/PublicProfile';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { UserProfile } from './types';
import { Loader2 } from 'lucide-react';
import { SupportChat } from './components/SupportChat';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        
        // Setup realtime listener for user profile
        const unsubscribeProfile = onSnapshot(userRef, async (docSnap) => {
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
            setLoading(false);
          } else {
            // Create new user profile
            const newUser: UserProfile = {
              uid: currentUser.uid,
              email: currentUser.email || 'no-email@example.com',
              name: currentUser.displayName || 'משתמש',
              plan: 'free',
              credits: 3,
              createdAt: new Date().toISOString()
            };
            try {
              await setDoc(userRef, newUser);
              setUserProfile(newUser);
              setLoading(false);
            } catch (error) {
              handleFirestoreError(error, OperationType.CREATE, `users/${currentUser.uid}`, currentUser.uid);
            }
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`, currentUser.uid);
          setLoading(false);
        });

        return () => unsubscribeProfile();
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" dir="rtl">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <Router>
      <div className="h-full bg-slate-50 font-sans text-slate-900" dir="rtl">
        <Routes>
          <Route 
            path="/" 
            element={
              user && userProfile ? (
                <Dashboard userProfile={userProfile} />
              ) : (
                <Auth />
              )
            } 
          />
          <Route path="/r/:slug" element={<PublicResume />} />
          <Route path="/u/:username" element={<PublicProfile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <SupportChat />
      </div>
    </Router>
  );
}
