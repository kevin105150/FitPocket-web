import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CloudFood, CustomFood, FoodSearchResult } from '../types';

const COLLECTION_NAME = 'cloud_foods';

/**
 * Normalizes brand names, especially for Taiwanese convenience stores:
 * 7-11 / 7-Eleven / 統一超商 -> '7-11'
 * 全家 / 全家便利商店 / FamilyMart -> '全家'
 * 萊爾富 / Hi-Life -> '萊爾富'
 * OK / OK超商 / OK·MART / OKmart -> 'OK'
 */
export function normalizeBrandName(brandName: string): string {
  const b = (brandName || '').trim();
  if (!b) return '自訂飲食';

  // Check 7-11
  if (/^(7-?11|7-?eleven|seven(-?eleven)?|統一超商|小七|711)$/i.test(b) || /7-?eleven/i.test(b) || /統一超商/.test(b)) {
    return '7-11';
  }
  // Check 全家
  if (/^(全家(便利商店)?|familymart)$/i.test(b) || /全家便利商店/.test(b) || /familymart/i.test(b)) {
    return '全家';
  }
  // Check 萊爾富
  if (/^(萊爾富(便利商店)?|hi-?life)$/i.test(b) || /萊爾富/.test(b) || /hi-?life/i.test(b)) {
    return '萊爾富';
  }
  // Check OK
  if (/^(ok(超商|便利商店|mart|·mart)?)$/i.test(b) || /ok(超商|mart|·mart)/i.test(b)) {
    return 'OK';
  }

  return b;
}

/**
 * Checks whether a food belongs to the official Taiwan TFDA (衛福部) database.
 * TFDA data should NEVER be re-uploaded to the user-shared cloud database.
 */
export function isTfdaFood(food: { id?: string; brand?: string; name?: string }): boolean {
  if (food.id && food.id.startsWith('tfda_')) return true;
  const brand = (food.brand || '').trim();
  if (brand.includes('衛福部') || brand.includes('食藥署') || brand.includes('台灣衛福部基礎食材庫')) {
    return true;
  }
  return false;
}

/**
 * Simple deterministic string hash to produce safe, clean alphanumeric Firestore document IDs.
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
 * Generates a clean, deterministic Cloud Document ID based primarily on:
 * Brand + Food Name + Serving Unit
 * (e.g. "c_7-11_茶葉蛋_顆_a1b2c3")
 */
export function generateDeterministicCloudId(brand: string, name: string, servingUnit: string): string {
  const normBrand = normalizeBrandName(brand);
  const cleanBrand = normBrand.toLowerCase().replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '');
  const cleanName = name.trim().toLowerCase().replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '');
  const cleanUnit = (servingUnit || 'g').trim().toLowerCase().replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '');

  const rawKey = `${normBrand}___${name.trim()}___${cleanUnit}`;
  const hash = safeStringHash(rawKey);

  const prefix = cleanBrand ? `${cleanBrand}_` : '';
  const namePart = cleanName.slice(0, 16);
  return `cf_${prefix}${namePart}_${hash}`;
}

export interface CloudPreCheckResult {
  exists: boolean;
  existingFood?: CloudFood;
  targetDocId: string;
  normalizedBrand: string;
}

export const CloudFoodService = {
  /**
   * Normalizes brand names (e.g., 7-11, 全家, 萊爾富, OK).
   */
  normalizeBrand(brand: string): string {
    return normalizeBrandName(brand);
  },

  /**
   * Pre-checks if the food item already exists in the cloud database.
   * Compares using deterministic ID and brand + name matching.
   */
  async preCheckCloudFood(food: { name: string; brand?: string; servingUnit?: string }): Promise<CloudPreCheckResult> {
    const normalizedBrand = normalizeBrandName(food.brand || '');
    const targetDocId = generateDeterministicCloudId(normalizedBrand, food.name, food.servingUnit || 'g');

    try {
      // 1. Direct document check via deterministic ID
      const directDocRef = doc(db, COLLECTION_NAME, targetDocId);
      const directSnap = await getDoc(directDocRef);
      if (directSnap.exists()) {
        return {
          exists: true,
          existingFood: directSnap.data() as CloudFood,
          targetDocId,
          normalizedBrand,
        };
      }

      // 2. Query by normalized brand and food name
      const colRef = collection(db, COLLECTION_NAME);
      const q = query(
        colRef,
        where('brand', '==', normalizedBrand),
        where('name', '==', food.name.trim()),
        limit(1)
      );
      const querySnap = await getDocs(q);
      if (!querySnap.empty) {
        const foundDoc = querySnap.docs[0];
        return {
          exists: true,
          existingFood: foundDoc.data() as CloudFood,
          targetDocId: foundDoc.id,
          normalizedBrand,
        };
      }
    } catch (err) {
      console.warn('Pre-check cloud food warning (ignorable if offline):', err);
    }

    return {
      exists: false,
      targetDocId,
      normalizedBrand,
    };
  },

  /**
   * Upload custom food to the global online food database.
   * - Enforces rejection of official TFDA records.
   * - Standardizes convenience store brand names (7-11, 全家, 萊爾富, OK).
   * - Uses deterministic ID to eliminate duplicates.
   */
  async uploadToCloudDatabase(food: CustomFood): Promise<{ success: boolean; food?: CloudFood; reason?: string }> {
    // 1. Block TFDA (衛福部) data from uploading
    if (isTfdaFood(food)) {
      console.warn('Official TFDA food data cannot be uploaded to user cloud database.');
      return { success: false, reason: '衛福部官方資料不提供上傳服務' };
    }

    const normalizedBrand = normalizeBrandName(food.brand || '');
    const deterministicId = generateDeterministicCloudId(normalizedBrand, food.name, food.servingUnit || 'g');

    const cloudFood: CloudFood = {
      id: deterministicId,
      name: food.name.trim(),
      brand: normalizedBrand,
      servingAmount: Number(food.servingAmount) || 100,
      servingUnit: food.servingUnit || 'g',
      calories: Number(food.calories) || 0,
      carbs: Number(food.carbs) || 0,
      sugars: Number(food.sugars) || 0,
      fiber: Number(food.fiber) || 0,
      protein: Number(food.protein) || 0,
      fat: Number(food.fat) || 0,
      sodium: Number(food.sodium) || 0,
      potassium: Number(food.potassium) || 0,
      imageUrl: food.imageUrl || '',
      barcode: food.barcode?.trim() || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const docRef = doc(db, COLLECTION_NAME, deterministicId);
    await setDoc(docRef, cloudFood, { merge: true });
    return { success: true, food: cloudFood };
  },

  /**
   * Uploads custom food to Firestore cloud database in the background (fire-and-forget).
   * Does NOT block the UI, avoiding long saving delays for the user.
   */
  uploadInBackground(food: CustomFood): void {
    if (isTfdaFood(food)) return;

    // Execute asynchronously in background
    Promise.resolve().then(async () => {
      try {
        await CloudFoodService.uploadToCloudDatabase(food);
        console.log('[CloudFoodService] Background upload complete:', food.name);
      } catch (err) {
        console.warn('[CloudFoodService] Background upload warning:', err);
      }
    });
  },

  /**
   * Fetch online foods from global database.
   */
  async fetchCloudFoods(searchQuery: string = '', maxResults: number = 40): Promise<FoodSearchResult[]> {
    try {
      const qStr = searchQuery.trim().toLowerCase();
      const colRef = collection(db, COLLECTION_NAME);
      
      const q = query(colRef, limit(150));
      const querySnapshot = await getDocs(q);
      
      const results: FoodSearchResult[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data() as CloudFood;
        const matchesQuery = !qStr || 
          data.name.toLowerCase().includes(qStr) || 
          (data.brand && data.brand.toLowerCase().includes(qStr)) ||
          (data.barcode && data.barcode.includes(qStr));

        if (matchesQuery) {
          results.push({
            id: `cloud_${data.id}`,
            name: data.name,
            brand: data.brand || '網路資料庫',
            calories: data.calories,
            carbs: data.carbs,
            sugars: data.sugars,
            fiber: data.fiber,
            protein: data.protein,
            fat: data.fat,
            sodium: data.sodium,
            potassium: data.potassium,
            servingAmount: data.servingAmount,
            servingUnit: data.servingUnit,
            servingSizeText: `1 ${data.servingUnit} (${data.servingAmount}${data.servingUnit})`,
            imageUrl: data.imageUrl,
            isLocalPreset: false,
            isUserCustom: false,
            isCloudPreset: true,
            barcode: data.barcode,
          });
        }
      });

      return results.slice(0, maxResults);
    } catch (err) {
      console.warn('Failed to fetch cloud foods from Firestore:', err);
      return [];
    }
  },

  /**
   * Get total count of cloud foods in global database.
   */
  async getCloudFoodsCount(): Promise<number> {
    try {
      const colRef = collection(db, COLLECTION_NAME);
      const querySnapshot = await getDocs(colRef);
      return querySnapshot.size;
    } catch (err) {
      console.warn('Failed to get cloud foods count:', err);
      return 0;
    }
  }
};

