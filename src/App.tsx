import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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

function AppContent({ user, userProfile }: { user: any, userProfile: UserProfile | null }) {
  const location = useLocation();
  const isPublicRoute = location.pathname.startsWith('/u/') || location.pathname.startsWith('/r/');

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900" dir="rtl">
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
      {!isPublicRoute && <SupportChat />}
    </div>
  );
}

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
            const data = docSnap.data() as UserProfile;
            if (!data.username) {
              const defaultUsername = (currentUser.displayName || 'user')
                .toLowerCase()
                .trim()
                .replace(/\s+/g, '-')
                .replace(/[^a-z0-9-]/g, '') + '-' + Math.random().toString(36).substring(2, 7);

              try {
                const { updateDoc } = await import('firebase/firestore');
                await updateDoc(userRef, { username: defaultUsername });
                // The next snapshot will have the updated data
              } catch (error) {
                console.error("Error setting default username:", error);
                setUserProfile(data);
                setLoading(false);
              }
            } else {
              setUserProfile(data);
              setLoading(false);
            }
          } else {
            // Create new user profile
            const defaultUsername = (currentUser.displayName || 'user')
              .toLowerCase()
              .trim()
              .replace(/\s+/g, '-')
              .replace(/[^a-z0-9-]/g, '') + '-' + Math.random().toString(36).substring(2, 7);

            const newUser: UserProfile = {
              uid: currentUser.uid,
              email: currentUser.email || 'no-email@example.com',
              name: currentUser.displayName || 'משתמש',
              username: defaultUsername,
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
      <AppContent user={user} userProfile={userProfile} />
    </Router>
  );
}
