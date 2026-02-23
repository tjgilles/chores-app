import { Resend } from 'resend';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const resend = new Resend(process.env.RESEND_API_KEY);

// Your Firebase Config (Copy this from your App.tsx)
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

async function sendSundayPreview() {
  const choresSnap = await getDocs(collection(db, "chores"));
  const usersSnap = await getDocs(collection(db, "users"));
  const activitySnap = await getDocs(collection(db, "activity"));

  const chores = choresSnap.docs.map(doc => doc.data());
  const users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Filter for anything due in the next 7 days
  const upcomingThisWeek = chores.filter(chore => {
    // If it's never been done, it's upcoming
    if (!chore.last_completed_at) return true;
    
    // Check if the next due date falls within the next 7 days
    const lastDone = new Date(chore.last_completed_at);
    const nextDue = new Date(lastDone);
    const intervals: any = { daily: 1, weekly: 7, monthly: 30, quarterly: 90 };
    nextDue.setDate(nextDue.getDate() + (intervals[chore.frequency] || 7));
    
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    
    return nextDue <= sevenDaysFromNow;
  });

  // Calculate Leaderboard (Weekly Reset)
  const stats = users.map(user => {
    const userActivity = activitySnap.docs.filter(doc => doc.data().user_name === user.name);
    return { name: user.name, points: userActivity.length * 10 };
  }).sort((a, b) => b.points - a.points);

  for (const user of users) {
    if (user.email) {
      await resend.emails.send({
        from: 'ChoreSync <onboarding@resend.dev>',
        to: user.email,
        subject: `📋 Sunday Outlook: ${upcomingThisWeek.length} Tasks This Week`,
        html: `
          <div style="font-family: sans-serif; background-color: #f5f5f5; padding: 40px 20px;">
            <div style="max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1a1a1a; font-size: 24px; margin-bottom: 8px;">Happy Sunday, ${user.name}!</h2>
              <p style="color: #666; margin-bottom: 32px;">Here is the roadmap for the week of ${new Date().toLocaleDateString()}:</p>
              
              <div style="font-size: 12px; font-weight: bold; color: #3b82f6; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Weekly Roadmap</div>
              
              ${upcomingThisWeek.map(c => `
                <div style="background: white; border-radius: 20px; padding: 20px; margin-bottom: 12px; border: 1px solid rgba(0,0,0,0.05);">
                  <table width="100%">
                    <tr>
                      <td>
                        <div style="font-size: 16px; font-weight: bold; color: #1a1a1a;">${c.name}</div>
                        <div style="font-size: 13px; color: #666; margin-top: 2px;">Frequency: ${c.frequency} • Time: ${c.duration}</div>
                      </td>
                    </tr>
                  </table>
                </div>
              `).join('')}

              <div style="margin-top: 40px; background: #1a1a1a; border-radius: 24px; padding: 24px; color: white;">
                <h3 style="margin-top: 0; font-size: 16px; color: #ffffff;">Current Standings</h3>
                ${stats.map(s => `
                  <div style="margin-bottom: 16px;">
                    <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
                      <span>${s.name}</span>
                      <span style="color: #10b981; font-weight: bold;">${s.points} pts</span>
                    </div>
                    <div style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
                      <div style="height: 100%; background: #10b981; width: ${Math.min((s.points / 100) * 100, 100)}%;"></div>
                    </div>
                  </div>
                `).join('')}
              </div>

              <p style="text-align: center; margin-top: 32px;">
                <a href="YOUR_APP_URL_HERE" style="background: #1a1a1a; color: white; padding: 14px 24px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">Open Weekly Dashboard</a>
              </p>
            </div>
          </div>
        `
      });
    }
  }
}

sendSundayPreview();
