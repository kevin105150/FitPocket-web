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
        console.log(`[FamilyCache] Checking Firestore keyword index for: ${cleanQuery}`);
        const docId = `kw_${safeStringHash(cleanQuery)}`;
        const docRef = doc(db, 'family_food_cache', docId);
        
        let snap;
        try {
          snap = await getDoc(docRef);
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `family_food_cache/${docId}`);
          return null;
        }

        if (snap.exists()) {
          const data = snap.data();
          if (data && Array.isArray(data.productIds)) {
            console.log(`[FamilyCache] Keyword index HIT for: ${cleanQuery}, resolving products...`);
            const productIds: string[] = data.productIds;
            if (productIds.length === 0) {
              localStorage.setItem(`fitpocket_fam_cache_${cleanQuery}`, JSON.stringify([]));
              return [];
            }

            // Fetch products in parallel from family_foods collection
            const productRefs = productIds.map(id => doc(db, 'family_foods', id));
            const productSnaps = await Promise.all(productRefs.map(ref => getDoc(ref)));
            const products: FoodSearchResult[] = [];
            
            productSnaps.forEach(pSnap => {
              if (pSnap.exists()) {
                products.push(pSnap.data() as FoodSearchResult);
              }
            });

            console.log(`[FamilyCache] Resolved ${products.length}/${productIds.length} products from family_foods`);
            localStorage.setItem(`fitpocket_fam_cache_${cleanQuery}`, JSON.stringify(products));
            return products;
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
        // Write each product to family_foods first
        console.log(`[FamilyCache] Writing ${products.length} products to family_foods...`);
        const productPromises = products.map(async (product) => {
          const cleanId = product.id.startsWith('family_') ? product.id : `family_${product.id}`;
          const prodRef = doc(db, 'family_foods', cleanId);
          const cleanProduct: FoodSearchResult = {
            id: cleanId,
            name: product.name.trim(),
            brand: product.brand || '全家',
            calories: product.calories || 0,
            carbs: product.carbs || 0,
            sugars: product.sugars || 0,
            fiber: product.fiber || 0,
            protein: product.protein || 0,
            fat: product.fat || 0,
            sodium: product.sodium || 0,
            potassium: product.potassium || 0,
            servingAmount: product.servingAmount || 100,
            servingUnit: product.servingUnit || 'g',
            servingSizeText: product.servingSizeText || '',
            imageUrl: product.imageUrl || '',
            isLocalPreset: product.isLocalPreset || false
          };
          try {
            await setDoc(prodRef, cleanProduct, { merge: true });
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, `family_foods/${cleanId}`);
          }
        });
        await Promise.all(productPromises);

        // Write the keyword to productIds mapping
        const docId = `kw_${safeStringHash(cleanQuery)}`;
        const docRef = doc(db, 'family_food_cache', docId);
        const productIds = products.map(p => p.id.startsWith('family_') ? p.id : `family_${p.id}`);
        
        console.log(`[FamilyCache] Writing keyword mapping to Firestore: ${cleanQuery}`);
        try {
          await setDoc(docRef, {
            keyword: cleanQuery,
            productIds,
            updatedAt: Date.now()
          }, { merge: true });
          console.log(`[FamilyCache] Firestore keyword mapping SUCCESS: ${cleanQuery}`);
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
