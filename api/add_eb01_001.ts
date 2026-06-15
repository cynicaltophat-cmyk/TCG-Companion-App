import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp({
  projectId: firebaseConfig.projectId
});

// Use named database ID
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function addEB01_001() {
  const cardData = {
    id: "eb01-001",
    name: "Gundam Astray Red Frame Custom (EX)",
    set: "EB01",
    cardNumber: "EB01-001",
    type: ["Unit"],
    color: "Blue",
    rarity: "LR",
    cost: 5,
    level: 6,
    ap: 5,
    hp: 4,
    ability: "【Activate・Main】 【Once per Turn】 Exile 2 Command cards from your trash from the game: Choose 1 damaged enemy Unit that is Lv.7 or lower. Rest it. It won't be set as active during the start phase of your opponent's next turn.",
    imageUrl: "https://images.gundam-tcg.com/cards/EB01-001.png",
    traits: ["(G Generation)"],
    link: "Lowe Guele",
    zones: ["Space", "Earth"],
    faq: []
  };

  try {
    console.log(`Saving card: ${cardData.name} (${cardData.cardNumber}) to Firestore database: ${firebaseConfig.firestoreDatabaseId}`);
    
    await db.collection('cards').doc(cardData.id).set(cardData);
    
    console.log("Card saved successfully!");
  } catch (error) {
    console.error("Error adding card:", error);
  }
}

addEB01_001();
