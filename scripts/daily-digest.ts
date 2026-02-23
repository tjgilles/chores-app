import { Resend } from 'resend';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const resend = new Resend(process.env.RESEND_API_KEY);

// Use your actual Firebase Config here
const firebaseConfig = {
  apiKey: "AIzaSyCT9yJT_KOivQGbfIKpmNSxXqJMVB9PY-g",
  authDomain: "chores-88a3f.firebaseapp.com",
  projectId: "chores-88a3f",
  storageBucket: "chores-88a3f.firebasestorage.app",
  messagingSenderId: "307911093238",
  appId: "1:307911093238:web:00d961a6b206e62c1e35d7",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Logic to check if a chore is due (Matching your App.tsx logic)
const isDue = (chore: any) => {
  if (!chore.last_completed_at) return true;
  const lastDone = new Date(chore.last_completed_at);
  const today = new Date();
  const diffDays = Math.floor((today.getTime() - lastDone.getTime()) / (1000 * 60 * 60 * 24));
  const intervals: any = { daily: 1, weekly: 7, monthly: 30 };
  return diffDays >= (intervals[chore.frequency] || 7);
};

async function sendDailyDigest() {
  const choresSnap = await getDocs(collection(db, "chores"));
  const usersSnap = await getDocs(collection(db, "users"));
  
  const dueToday = choresSnap.docs
    .map(doc => doc.data())
    .filter(chore => isDue(chore));

  if (dueToday.length === 0) return; // Don't bug people if nothing is due!

  const users = usersSnap.docs.map(doc => doc.data());

  for (const user of users) {
    if (user.email) {
      await resend.emails.send({
        from: 'ChoreSync <onboarding@resend.dev>',
        to: user.email,
        subject: `☀️ Daily Digest: ${dueToday.length} Tasks for Today`,
        html: `
          <h2>Good Morning, ${user.name}!</h2>
          <p>Here are your action items for today:</p>
          <ul>
            ${dueToday.map(c => `<li><strong>${c.name}</strong> (${c.duration})</li>`).join('')}
          </ul>
          <p>Check them off here: <a href="your-app-url.com">ChoreSync Dashboard</a></p>
        `
      });
    }
  }
}

sendDailyDigest();
