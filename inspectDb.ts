import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query } from 'firebase/firestore';
import { readFileSync } from 'fs';

async function run() {
  try {
    const config = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf-8'));
    console.log('Firebase Config loaded for project:', config.projectId);
    console.log('Database ID:', config.firestoreDatabaseId);

    const app = initializeApp(config);
    const db = getFirestore(app, config.firestoreDatabaseId);

    // List some potential collections
    const collectionsToTest = ['erudite', 'QuizForge', 'levels', 'questions', 'categories', 'quiz'];
    
    for (const colName of collectionsToTest) {
      const q = query(collection(db, colName), limit(5));
      try {
        const snap = await getDocs(q);
        if (!snap.empty) {
          console.log(`\n📚 Found collection: "${colName}" (${snap.size} docs visible)`);
          snap.forEach(doc => {
            console.log(`  - Doc ID: ${doc.id}`);
            console.log(`    Fields:`, JSON.stringify(doc.data(), null, 2));
            
            // Check for subcollections inside this doc, particularly 'questions'
            getQuestionsOfDoc(db, colName, doc.id);
          });
        } else {
          console.log(`Collection "${colName}" is empty or does not exist.`);
        }
      } catch (err: any) {
        console.error(`Error reading collection "${colName}":`, err.message);
      }
    }
  } catch (err: any) {
    console.error('Fatal execution error:', err);
  }
}

async function getQuestionsOfDoc(db: any, colName: string, docId: string) {
  try {
    const subColRef = collection(db, colName, docId, 'questions');
    const snap = await getDocs(query(subColRef, limit(3)));
    if (!snap.empty) {
      console.log(`    ❓ Subcollection "questions" inside ${colName}/${docId} found with ${snap.size} questions:`);
      snap.forEach(qDoc => {
        console.log(`      * Question ID: ${qDoc.id}`);
        console.log(`        Data:`, JSON.stringify(qDoc.data()).substring(0, 120) + '...');
      });
    } else {
      console.log(`    ❌ No "questions" subcollection found inside ${colName}/${docId} or it is empty.`);
    }
  } catch (e: any) {
    console.error(`    Error fetching questions subcol for ${colName}/${docId}:`, e.message);
  }
}

run();
