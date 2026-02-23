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
  // 1. Get all chores and users
  const choresSnap = await getDocs(collection(db, "chores"));
  const usersSnap = await getDocs(collection(db, "users"));
  
  const chores = choresSnap.docs.map(doc => doc.data());
  const users = usersSnap.docs.map(doc => doc.data());

  // 2. Filter chores for the upcoming week
  const weeklyChores = chores.filter(chore => {
    // Logic to see if chore is due in the next 7 days
    return true; // Simplified for now
  });

  // 3. Send to every user in your "People" list
  for (const user of users) {
    if (user.email) {
      await resend.emails.send({
        from: 'ChoreSync <onboarding@resend.dev>',
        to: user.email,
        subject: '📋 Sunday Preview: Your Week Ahead',
        html: `
          <h1>Happy Sunday, ${user.name}!</h1>
          <p>Here’s the household outlook for the coming week:</p>
          <ul>
            ${weeklyChores.map(c => `<li><strong>${c.name}</strong> - ${c.duration}</li>`).join('')}
          </ul>
          <p><a href="your-app-url.com">View Dashboard</a></p>
        `
      });
    }
  }
}

sendSundayPreview();
