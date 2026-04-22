import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  Timestamp,
  doc,
  getDocFromServer
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Safety wrapper for config
let firebaseConfig: any = null;

const app = null;
export let db: any = null;
export let auth: any = null;

// Initialization function
export async function initFirebase() {
  if (db) return; // Already init
  try {
    firebaseConfig = await import('../../firebase-applet-config.json').then(m => m.default);
    if (firebaseConfig) {
      const firebaseApp = initializeApp(firebaseConfig);
      db = getFirestore(firebaseApp);
      auth = getAuth(firebaseApp);
    }
  } catch (e) {
    console.warn("Firebase configuration not found. Running in local simulation mode.");
  }
}

// Trigger initial load attempt (non-blocking)
initFirebase();

// Connection Test as per instructions
export async function testConnection() {
  if (!db) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error: any) {
    if (error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

export interface Campaign {
  id?: string;
  name: string;
  subject: string;
  content: string;
  status: 'draft' | 'sent' | 'scheduled';
  ownerId: string;
  sentCount: number;
  createdAt: any;
}

export async function saveCampaign(campaign: Omit<Campaign, 'id'>) {
  if (!db || !auth?.currentUser) {
    console.log("Saving to local simulation:", campaign);
    return { id: 'sim-' + Date.now() };
  }
  
  return await addDoc(collection(db, 'campaigns'), {
    ...campaign,
    ownerId: auth.currentUser.uid,
    createdAt: Timestamp.now(),
    sentCount: 0,
    openCount: 0,
    clickCount: 0
  });
}

export async function getCampaigns() {
  if (!db || !auth?.currentUser) return [];
  
  const q = query(
    collection(db, 'campaigns'), 
    where('ownerId', '==', auth.currentUser.uid)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Campaign[];
}

export interface SMTPConfig {
  id?: string;
  name: string;
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: boolean;
  ownerId: string;
  isActive: boolean;
  status?: 'working' | 'failing' | 'unknown';
  failCount?: number;
  successCount?: number;
  lastResult?: string;
  lastChecked?: any;
}

export async function saveSMTPConfig(config: Omit<SMTPConfig, 'id'>) {
  if (!db || !auth?.currentUser) return { id: 'sim-' + Date.now() };
  return await addDoc(collection(db, 'smtpConfigs'), {
    ...config,
    ownerId: auth.currentUser.uid,
    status: 'unknown',
    failCount: 0,
    successCount: 0,
    lastResult: 'Initialized',
    lastChecked: Timestamp.now()
  });
}

export async function getSMTPConfigs() {
  if (!db || !auth?.currentUser) return [];
  const q = query(collection(db, 'smtpConfigs'), where('ownerId', '==', auth.currentUser.uid));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as SMTPConfig[];
}

export async function saveBulkSMTPConfigs(configs: Omit<SMTPConfig, 'id' | 'ownerId'>[]) {
  if (!db || !auth?.currentUser) return configs.length;
  const { writeBatch } = await import('firebase/firestore');
  const batch = writeBatch(db);
  configs.forEach(c => {
    const ref = doc(collection(db, 'smtpConfigs'));
    batch.set(ref, { 
      ...c, 
      ownerId: auth?.currentUser?.uid, 
      isActive: true,
      secure: c.port === 465 
    });
  });
  await batch.commit();
  return configs.length;
}

export async function saveBulkContacts(contacts: { email: string; firstName?: string; lastName?: string }[]) {
  if (!db || !auth?.currentUser) return contacts.length;
  // Use batch for better performance
  const { writeBatch } = await import('firebase/firestore');
  const batch = writeBatch(db);
  contacts.forEach(c => {
    const ref = doc(collection(db, 'contacts'));
    batch.set(ref, { ...c, ownerId: auth?.currentUser?.uid, unsubscribed: false });
  });
  await batch.commit();
  return contacts.length;
}
