import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({
  credential: cert({
    projectId: 'synergo-75ffb',
    clientEmail: 'firebase-adminsdk-fbsvc@synergo-75ffb.iam.gserviceaccount.com',
    privateKey: `-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDcPE8zgyHgFiRP\nAhdvpqVrb78+CCHY1y9ZM1AH8KjLacd6IL9XOSbXOYHtb/ICKnG8dgCiaZyy0MLN\nUrdnlSOKCldIWjNFp8uKipuJvpHStjuOYZuxKv3jeAMgwvUwCRGVvLfz9C+aJNRJ\ns/tgohfiAcDhNrMkiVT7xiaDy0JIYocT7Vt0wGmL++V7Yber5vvERyQCFsmEALIN\nTq1yQER2gkDodhFk5Shodbyw5cU6ynCJsHfi2MBY9eQKC6/Fe6IZYiznf9r9J4u2\nH9NmKPxE8LKICo3/ddxV/VbFLgCFVw/CP734GWjMS0nSB7XPdmogrNbzotwkVxos\nRjM9Zek1AgMBAAECggEAD3FtLlQGJpP25NFlOk+JrvBtjRh94xonuE4IUR43f9gB\nhFdSg3e++P2P1knwwuUeB5SQs9LLCaDo4APqV2mWTeIuv6SPjtVWyPayNGT4Dbn4\nkCHZDIHSvsYWFhCFp+Ii6QiML5+STPFDL43e1SZYnWD5GPHAexHkMylwXvJ8Sd35\nfEpBJlVMCVSVXsqLvv9vsaALtCYtFjc9Y4JZFpp9O+bXsNOMieZXySFGkGaJ3f1T\nzREQTR+pbeRjZMgq3NWrYDGsTe2M9ipG6rQXQrlzsyiQAwqgV/RXntMo7yIlGx6L\nOVFDJFKDlvqBnwSfkqUvBI1hBymZXl1OFj5y3CK2UQKBgQD4ai3ZX1+GsFgOOXpr\nYTOxv7BpVKqZm22xzCo+EG59GEDTWbtgY6WrkK8c3htncRMwoErGtMJGATwbxSuD\nJU0C6bUEgQHMk0Sht8UIjvM9KFPCBRz50q69u+niEZdKj5auJfwqOFtTjWVjFSoM\n3cEHeLxqnwZyoH4QPw5jedD1zQKBgQDi9dudkeLGBc2jNN9w+OKLqjD9kf5nbRws\nP7VoAPD0qe3HfI43mFTB3W07bh9xga0faatcVA3QBDtIzX4toNlLmyHAgHW02maL\nWVngDB6Tp4fmlwCqLK8T89wKiT9LLvQyfYPA5QBoHBqYImCtTVwM90yOuiEajYf1\n3pfQ9P1ZCQKBgFoLwwrkc3ATRBgD5cg+t8pavcuwkRaVLLIiW72bnzFhNT5nbHCI\nLml+TLueFzjr2BTsRa65nyJZGDzIv/kN8Fh59s/nI4vQZjRotNdhWfJ1R8cwq0wz\nfnvwPdtgnQK+AdSmmD2FqDUlL/c2mMOJLotSzJmpg2DRpGCnOsP8SC6RAoGANy1o\nmBVImbX9eYk4LWIEycm1oWAmBoULTWKrur5H1mOdsFsCxFdfe8ZWcRVjxZeuPC3X\ngFnbBdCRjTCQVY1+Zpgvi3pvo2lZdtVhOUwY/vLC4nehrL2yTtqBi3o0jhW7Pq8v\nIe1KvQTgHk51TIy7LVfOIAD2XVs9S7QzGpUFJukCgYEAwJrMjdxzA/hHABsBedwp\nukgj8rjRk9D+kBzXoKk8CU1GKa7AWsWqvGP8kIYzSL6zuQylD8hazSUvU/Dci+Lq\ngPjwxA8G4dNX1Vo4eqRjmzv37UxzdhnsT7CuUE/T0cO9pZbdWalywjimVLUxvxAB\nxawZxxIuAyh0KjeaJeiIxq8=\n-----END PRIVATE KEY-----\n`,
  }),
});

const db = getFirestore(app);

// Ivan's UID
const uid = 'POC9tIPm5Qe63UsmMX32WBvHZ683';

async function run() {
  console.log('Testing single-field query (userA only)...');
  const s1 = await db.collection('friendships').where('userA', '==', uid).get();
  console.log(`  userA == uid: ${s1.size} docs`);
  s1.docs.forEach(d => console.log('   ', d.id, d.data().status));

  console.log('\nTesting single-field query (userB only)...');
  const s2 = await db.collection('friendships').where('userB', '==', uid).get();
  console.log(`  userB == uid: ${s2.size} docs`);
  s2.docs.forEach(d => console.log('   ', d.id, d.data().status));

  console.log('\nTesting compound query (userA + status)...');
  try {
    const s3 = await db.collection('friendships').where('userA', '==', uid).where('status', '==', 'accepted').get();
    console.log(`  userA + status: ${s3.size} docs`);
  } catch(e) { console.log('  ERROR:', e.message); }

  console.log('\nTesting compound query (userB + status)...');
  try {
    const s4 = await db.collection('friendships').where('userB', '==', uid).where('status', '==', 'accepted').get();
    console.log(`  userB + status: ${s4.size} docs`);
  } catch(e) { console.log('  ERROR:', e.message); }
}

run().catch(e => { console.error(e); process.exit(1); });
