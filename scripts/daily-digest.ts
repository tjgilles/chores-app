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
          <div style="font-family: sans-serif; background-color: #f5f5f5; padding: 40px 20px;">
            <div style="max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1a1a1a; font-size: 24px; margin-bottom: 8px;">Good Morning, ${user.name}!</h2>
              <p style="color: #666; margin-bottom: 32px;">Here are your action items for ${new Date().toLocaleDateString()}:</p>
              
              ${dueToday.map(c => `
                <div style="background: white; border-radius: 24px; padding: 24px; margin-bottom: 16px; border: 1px solid rgba(0,0,0,0.05); box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
                  <table width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td width="60" valign="top">
                        <div style="width: 48px; height: 48px; border: 2px solid #f1f1f1; border-radius: 16px;"></div>
                      </td>
                      <td style="padding-left: 16px;">
                        <div style="font-size: 12px; font-weight: bold; color: #059669; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Due Today</div>
                        <div style="font-size: 18px; font-weight: bold; color: #1a1a1a;">${c.name}</div>
                        <div style="font-size: 14px; color: #666; margin-top: 4px;">⏱️ ${c.duration} • 📅 ${c.frequency}</div>
                      </td>
                      <td align="right">
                        <a href="YOUR_APP_URL_HERE" style="background: #059669; color: white; padding: 12px 20px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 14px;">Check Off</a>
                      </td>
                    </tr>
                  </table>
                </div>
              `).join('')}

              <p style="text-align: center; margin-top: 32px;">
                <a href="YOUR_APP_URL_HERE" style="color: #666; text-decoration: underline; font-size: 12px;">View Full Leaderboard</a>
              </p>
            </div>
          </div>
        `
      });
    }
  }
}

sendDailyDigest();
