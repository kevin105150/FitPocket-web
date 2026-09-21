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
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
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
  if (!b || b === '自訂飲食') return '自訂';

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
  if (food.id && (food.id.startsWith('tfda_') || food.id.includes('tfda_'))) return true;
  const brand = (food.brand || '').trim();
  if (brand.includes('衛福部') || brand.includes('食藥署') || brand.includes('台灣衛福部基礎食材庫')) {
    return true;
  }
  return false;
}

/**
 * Checks whether nutrition or food information has been modified compared to an existing record.
 * Returns true if ANY field differs (modified), false if identical.
 */
export function isFoodInfoModified(foodA: CustomFood | CloudFood, foodB: CustomFood | CloudFood): boolean {
  const normStr = (s?: string) => (s || '').trim().toLowerCase();
  const numEq = (n1?: number, n2?: number) => {
    const v1 = Number(n1 || 0);
    const v2 = Number(n2 || 0);
    return Math.abs(v1 - v2) < 0.01;
  };

  if (normStr(foodA.name) !== normStr(foodB.name)) return true;
  if (normalizeBrandName(foodA.brand || '') !== normalizeBrandName(foodB.brand || '')) return true;
  if (normStr(foodA.servingUnit) !== normStr(foodB.servingUnit)) return true;
  if (normStr(foodA.barcode) !== normStr(foodB.barcode)) return true;
  if (normStr(foodA.imageUrl) !== normStr(foodB.imageUrl)) return true;

  if (!numEq(foodA.servingAmount, foodB.servingAmount)) return true;
  if (!numEq(foodA.calories, foodB.calories)) return true;
  if (!numEq(foodA.carbs, foodB.carbs)) return true;
  if (!numEq(foodA.protein, foodB.protein)) return true;
  if (!numEq(foodA.fat, foodB.fat)) return true;
  if (!numEq(foodA.sugars, foodB.sugars)) return true;
  if (!numEq(foodA.fiber, foodB.fiber)) return true;
  if (!numEq(foodA.sodium, foodB.sodium)) return true;
  if (!numEq(foodA.potassium, foodB.potassium)) return true;

  return false; // All nutrition and food info are identical (not modified)
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
 * (e.g. "cf_7-11_茶葉蛋_顆_a1b2c3")
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
   * Upload custom food to the global online food database (cloud_foods).
   * Update rules:
   * 1. 衛福部資料不進去: Block official TFDA records.
   * 2. 打開 cloud_foods 開關: Food must have isSharedToCloud === true.
   * 3. 營養素等資訊被修改過才更新: If item exists in cloud_foods, update ONLY if nutrition/info was modified.
   */
  async uploadToCloudDatabase(food: CustomFood): Promise<{ success: boolean; food?: CloudFood; reason?: string }> {
    // 1. 衛福部資料不進去
    if (isTfdaFood(food)) {
      console.warn('[CloudFoodService] 衛福部官方資料不發佈至雲端資料庫');
      return { success: false, reason: '衛福部官方資料不提供上傳服務' };
    }

    // 2. 打開 cloud_foods 開關
    if (food.isSharedToCloud === false) {
      console.log('[CloudFoodService] 未開啟 cloud_foods 同步開關，跳過雲端更新:', food.name);
      return { success: false, reason: '未開啟同步至雲端資料庫開關' };
    }

    const normalizedBrand = normalizeBrandName(food.brand || '');
    const deterministicId = generateDeterministicCloudId(normalizedBrand, food.name, food.servingUnit || 'g');

    // 3. 營養素等資訊被修改過才更新
    try {
      const preCheck = await this.preCheckCloudFood({
        name: food.name,
        brand: normalizedBrand,
        servingUnit: food.servingUnit || 'g',
      });

      if (preCheck.exists && preCheck.existingFood) {
        const modified = isFoodInfoModified(food, preCheck.existingFood);
        if (!modified) {
          console.log('[CloudFoodService] 營養素等資訊未經修改，跳過 cloud_foods 更新:', food.name);
          return {
            success: true,
            food: preCheck.existingFood,
            reason: '營養素等資訊未經過修改，無需更新雲端資料庫',
          };
        }
      }
    } catch (err) {
      console.warn('[CloudFoodService] preCheck warning:', err);
    }

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

    try {
      const docRef = doc(db, COLLECTION_NAME, deterministicId);
      await setDoc(docRef, cloudFood, { merge: true });
      console.log('[CloudFoodService] 已更新 cloud_foods:', food.name);
      return { success: true, food: cloudFood };
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${COLLECTION_NAME}/${deterministicId}`);
      return { success: false, reason: '寫入雲端失敗' };
    }
  },

  /**
   * Uploads custom food to Firestore cloud database in the background (fire-and-forget).
   * Does NOT block the UI, avoiding long saving delays for the user.
   */
  uploadInBackground(food: CustomFood): void {
    if (isTfdaFood(food)) return;
    if (food.isSharedToCloud === false) return;

    // Execute asynchronously in background
    Promise.resolve().then(async () => {
      try {
        const res = await CloudFoodService.uploadToCloudDatabase(food);
        if (res.success) {
          console.log('[CloudFoodService] Background sync result:', food.name, res.reason || '已同步');
        } else {
          console.log('[CloudFoodService] Background sync skipped:', food.name, res.reason || '');
        }
      } catch (err) {
        console.warn('[CloudFoodService] Background upload warning:', err);
      }
    });
  },

  /**
   * Fetch online foods from global database.
   */
  /**
   * Fetch online foods from global database, including stores (FamilyMart, McDonald's, Subway).
   */
  async fetchCloudFoods(searchQuery: string = '', maxResults: number = 60): Promise<FoodSearchResult[]> {
    try {
      const qStr = searchQuery.trim().toLowerCase();
      const results: FoodSearchResult[] = [];

      // Helper to fetch and map from a collection
      const fetchFromCol = async (colName: string, brandDefault: string, idPrefix: string) => {
        try {
          const colRef = collection(db, colName);
          const q = query(colRef, limit(100)); // Limit per collection for performance
          const snap = await getDocs(q);
          snap.forEach(docSnap => {
            const data = docSnap.data();
            const name = String(data.name || '');
            const brand = String(data.brand || brandDefault);
            const barcode = String(data.barcode || '');
            
            const matchesQuery = !qStr || 
              name.toLowerCase().includes(qStr) || 
              brand.toLowerCase().includes(qStr) ||
              barcode.includes(qStr);
            
            if (matchesQuery) {
              results.push({
                id: `${idPrefix}_${data.id || docSnap.id}`,
                name: name,
                brand: brand,
                calories: Number(data.calories) || 0,
                carbs: Number(data.carbs) || 0,
                sugars: Number(data.sugars) || 0,
                fiber: Number(data.fiber) || 0,
                protein: Number(data.protein) || 0,
                fat: Number(data.fat) || 0,
                sodium: Number(data.sodium) || 0,
                potassium: Number(data.potassium) || 0,
                servingAmount: Number(data.servingAmount) || 100,
                servingUnit: String(data.servingUnit || 'g'),
                servingSizeText: String(data.servingSizeText || `1 ${data.servingUnit || 'g'} (${data.servingAmount || 100}${data.servingUnit || 'g'})`),
                imageUrl: String(data.imageUrl || ''),
                isLocalPreset: false,
                isUserCustom: false,
                isCloudPreset: true,
                barcode: barcode,
              });
            }
          });
        } catch (err) {
          console.warn(`[CloudFoodService] Error fetching from ${colName}:`, err);
        }
      };

      // Execute queries in parallel
      await Promise.all([
        fetchFromCol(COLLECTION_NAME, '網路資料庫', 'cloud'),
        fetchFromCol('family_foods', '全家', 'family'),
        fetchFromCol('mcdonald_foods', '麥當勞', 'mcd'),
        fetchFromCol('subway_foods', 'SUBWAY', 'subway')
      ]);

      // Remove duplicates by name + brand
      const seen = new Set<string>();
      const finalResults = results.filter(item => {
        const key = `${item.name.trim().toLowerCase()}_${(item.brand || '').trim().toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      return finalResults.slice(0, maxResults);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, COLLECTION_NAME);
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
  },

  /**
   * Fetch cloud food by barcode from global database, including stores.
   */
  async fetchCloudFoodByBarcode(barcode: string): Promise<FoodSearchResult | null> {
    try {
      const cleanBarcode = barcode.trim();
      if (!cleanBarcode) return null;

      const collectionsToSearch = [
        { name: COLLECTION_NAME, brand: '網路資料庫', prefix: 'cloud' },
        { name: 'family_foods', brand: '全家', prefix: 'family' },
        { name: 'mcdonald_foods', brand: '麥當勞', prefix: 'mcd' },
        { name: 'subway_foods', brand: 'SUBWAY', prefix: 'subway' }
      ];

      for (const colInfo of collectionsToSearch) {
        try {
          const colRef = collection(db, colInfo.name);
          const q = query(colRef, where('barcode', '==', cleanBarcode), limit(1));
          const querySnap = await getDocs(q);
          
          if (!querySnap.empty) {
            const data = querySnap.docs[0].data();
            return {
              id: `${colInfo.prefix}_${data.id || querySnap.docs[0].id}`,
              name: data.name,
              brand: data.brand || colInfo.brand,
              calories: Number(data.calories) || 0,
              carbs: Number(data.carbs) || 0,
              sugars: Number(data.sugars) || 0,
              fiber: Number(data.fiber) || 0,
              protein: Number(data.protein) || 0,
              fat: Number(data.fat) || 0,
              sodium: Number(data.sodium) || 0,
              potassium: Number(data.potassium) || 0,
              servingAmount: Number(data.servingAmount) || 100,
              servingUnit: data.servingUnit || 'g',
              servingSizeText: data.servingSizeText || `1 ${data.servingUnit} (${data.servingAmount}${data.servingUnit})`,
              imageUrl: data.imageUrl || '',
              isLocalPreset: false,
              isUserCustom: false,
              isCloudPreset: true,
              barcode: data.barcode,
            };
          }
        } catch (err) {
          console.warn(`[CloudFoodService] Error searching barcode in ${colInfo.name}:`, err);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch cloud food by barcode:', err);
    }
    return null;
  }
};

