import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { FoodSearchResult } from '../types';

/**
 * Deterministic string hash to generate a safe, clean alphanumeric Firestore document ID.
 */
function safeStringHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Generates a clean, deterministic document ID for Subway foods.
 * Format: subway_<hashed_name>
 */
export function generateSubwayFoodId(name: string): string {
  const cleanName = name.trim().toLowerCase().replace(/\s+/g, '');
  const hash = safeStringHash(cleanName);
  return `subway_${hash}`;
}

/**
 * Checks if the nutritional metrics of Subway food are modified compared to the saved database record.
 */
function isSubwayFoodModified(foodA: any, foodB: any): boolean {
  const numEq = (n1?: number, n2?: number) => {
    const v1 = Number(n1 || 0);
    const v2 = Number(n2 || 0);
    return Math.abs(v1 - v2) < 0.01;
  };

  if (!numEq(foodA.calories, foodB.calories)) return true;
  if (!numEq(foodA.carbs, foodB.carbs)) return true;
  if (!numEq(foodA.protein, foodB.protein)) return true;
  if (!numEq(foodA.fat, foodB.fat)) return true;
  if (!numEq(foodA.sugars, foodB.sugars)) return true;
  if (!numEq(foodA.fiber, foodB.fiber)) return true;
  if (!numEq(foodA.sodium, foodB.sodium)) return true;
  if (!numEq(foodA.potassium, foodB.potassium)) return true;
  if (!numEq(foodA.servingAmount, foodB.servingAmount)) return true;

  const strEq = (s1?: string, s2?: string) => (s1 || '').trim() === (s2 || '').trim();
  if (!strEq(foodA.servingUnit, foodB.servingUnit)) return true;

  return false;
}

export const SubwayCacheService = {
  /**
   * Fetches all saved Subway foods directly from the Firebase 'subway_foods' collection.
   */
  async getSubwayFoodsFromFirestore(): Promise<FoodSearchResult[]> {
    if (!db) return [];
    try {
      const colRef = collection(db, 'subway_foods');
      const snap = await getDocs(colRef);
      const list: FoodSearchResult[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({
          id: d.id || docSnap.id,
          name: d.name,
          brand: 'SUBWAY',
          calories: Number(d.calories) || 0,
          protein: Number(d.protein) || 0,
          fat: Number(d.fat) || 0,
          carbs: Number(d.carbs) || 0,
          sodium: Number(d.sodium) || 0,
          sugars: Number(d.sugars) || 0,
          fiber: Number(d.fiber) || 0,
          potassium: Number(d.potassium) || 0,
          imageUrl: '',
          isLocalPreset: false,
          servingAmount: Number(d.servingAmount) || 100,
          servingSizeText: d.servingSizeText || `${d.servingAmount || 100}g`,
          servingUnit: d.servingUnit || 'g'
        });
      });
      return list;
    } catch (err) {
      console.error('[SubwayCacheService] Error fetching from Firestore:', err);
      return [];
    }
  },

  /**
   * Searches saved Subway foods in Firestore by matching keyword locally after fetching list.
   */
  async searchSubwayFoodsInFirestore(query: string): Promise<FoodSearchResult[]> {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return [];
    const all = await this.getSubwayFoodsFromFirestore();
    return all.filter(item => {
      const name = (item.name || '').toLowerCase();
      return name.includes(cleanQuery) || cleanQuery.includes(name);
    });
  },

  /**
   * Automatically saves searched Subway items to Firestore under the 'subway_foods' collection.
   * Compares each item to prevent duplicate uploads unless the nutrition profile has changed.
   */
  async saveSubwayFoods(foods: FoodSearchResult[]): Promise<void> {
    if (!db) {
      console.warn('[SubwayCacheService] Firestore database is not initialized. Skipping cloud sync.');
      return;
    }

    console.log(`[SubwayCacheService] Starting sync check for ${foods.length} items...`);
    const promises = foods.map(async (food) => {
      const docId = generateSubwayFoodId(food.name);
      const docRef = doc(db, 'subway_foods', docId);

      try {
        const snap = await getDoc(docRef);
        
        const preparedData = {
          id: docId,
          name: food.name.trim(),
          brand: 'SUBWAY',
          calories: Number(food.calories) || 0,
          carbs: Number(food.carbs) || 0,
          sugars: Number(food.sugars) || 0,
          fiber: Number(food.fiber) || 0,
          protein: Number(food.protein) || 0,
          fat: Number(food.fat) || 0,
          sodium: Number(food.sodium) || 0,
          potassium: Number(food.potassium) || 0,
          servingAmount: Number(food.servingAmount) || 100,
          servingUnit: food.servingUnit || 'g',
          servingSizeText: food.servingSizeText || '',
          imageUrl: '',
          isLocalPreset: false,
          updatedAt: Date.now()
        };

        if (snap.exists()) {
          const existingData = snap.data();
          const modified = isSubwayFoodModified(preparedData, existingData);

          if (!modified) {
            console.log(`[SubwayCacheService] Item [${food.name}] exists and is identical. Skipping upload.`);
            return;
          }

          console.log(`[SubwayCacheService] Item [${food.name}] exists but nutrition profile modified! Updating...`);
        } else {
          console.log(`[SubwayCacheService] Item [${food.name}] is new. Uploading...`);
        }

        await setDoc(docRef, preparedData, { merge: true });
        console.log(`[SubwayCacheService] Successfully wrote item [${food.name}] to subway_foods.`);
      } catch (err) {
        console.error(`[SubwayCacheService] Error syncing item [${food.name}]:`, err);
        handleFirestoreError(err, OperationType.WRITE, `subway_foods/${docId}`);
      }
    });

    await Promise.allSettled(promises);
    console.log(`[SubwayCacheService] Sync check completed.`);
  }
};
