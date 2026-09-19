import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { FoodSearchResult } from '../types';

/**
 * Simple deterministic string hash to produce safe, clean alphanumeric Firestore document IDs.
 * Same logic as CloudFoodService for consistency.
 */
function safeStringHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

export const FamilyCacheService = {
  async getCachedFamilySearch(query: string): Promise<FoodSearchResult[] | null> {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return null;

    // 1. Check LocalStorage (方案一)
    try {
      const local = localStorage.getItem(`fitpocket_fam_cache_${cleanQuery}`);
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}

    // 2. Check Firestore (方案二：雲端共用快取)
    try {
      if (db) {
        console.log(`[FamilyCache] Checking Firestore for: ${cleanQuery}`);
        // Generate a safe deterministic ID to avoid issues with special/Unicode characters
        const docId = `kw_${safeStringHash(cleanQuery)}`;
        const docRef = doc(db, 'family_food_cache', docId);
        
        let snap;
        try {
          snap = await getDoc(docRef);
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `family_food_cache/${docId}`);
          return null; // unreachable due to throw
        }

        if (snap.exists()) {
          const data = snap.data();
          if (data && Array.isArray(data.products)) {
            console.log(`[FamilyCache] Cloud cache HIT for: ${cleanQuery}`);
            localStorage.setItem(`fitpocket_fam_cache_${cleanQuery}`, JSON.stringify(data.products));
            return data.products;
          }
        }
        console.log(`[FamilyCache] Cloud cache MISS for: ${cleanQuery}`);
      }
    } catch (err) {
      console.error('[FamilyCache] Firestore read error:', err);
    }

    return null;
  },

  async setCachedFamilySearch(query: string, products: FoodSearchResult[]): Promise<void> {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return;

    // 1. Set LocalStorage
    try {
      localStorage.setItem(`fitpocket_fam_cache_${cleanQuery}`, JSON.stringify(products));
    } catch {}

    // 2. Set Firestore (方案二：雲端共用快取)
    try {
      if (db) {
        const docId = `kw_${safeStringHash(cleanQuery)}`;
        const docRef = doc(db, 'family_food_cache', docId);
        
        console.log(`[FamilyCache] Writing to Firestore: ${cleanQuery}`);
        try {
          await setDoc(docRef, {
            keyword: cleanQuery,
            products,
            updatedAt: Date.now()
          }, { merge: true });
          console.log(`[FamilyCache] Firestore write SUCCESS: ${cleanQuery}`);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `family_food_cache/${docId}`);
        }
      }
    } catch (err) {
      console.error('[FamilyCache] Firestore write error:', err);
    }
  },
  
  clearAllLocalCache(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('fitpocket_fam_cache_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (err) {
      console.warn('Error clearing local cache:', err);
    }
  }
};
