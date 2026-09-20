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
import { normalizeBrandName } from './cloudFoodService';
import { FoodSearchResult } from '../types';

const OPEN_FOODS_COLLECTION = 'open_foods';

/**
 * OpenFoodDocument structure strictly matches CloudFood structure.
 */
export interface OpenFoodDocument {
  id: string;
  name: string;
  brand: string;
  servingAmount: number;
  servingUnit: string;
  calories: number;
  carbs: number;
  sugars: number;
  fiber: number;
  protein: number;
  fat: number;
  sodium: number;
  potassium: number;
  imageUrl?: string;
  barcode?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Deterministic hash algorithm for producing safe alphanumeric document IDs.
 */
function safeStringHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Generates a clean, deterministic Open Food Document ID based on:
 * Brand + Food Name + Serving Unit + Barcode
 * (e.g. "of_openfoodfacts_oatmilk_a1b2c3")
 */
export function generateDeterministicOpenFoodId(
  brand: string,
  name: string,
  servingUnit: string,
  barcode?: string
): string {
  const normBrand = brand.trim() ? normalizeBrandName(brand) : 'Open Food Facts';
  const cleanBrand = normBrand.toLowerCase().replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '');
  const cleanName = name.trim().toLowerCase().replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '');
  const cleanUnit = (servingUnit || 'g').trim().toLowerCase().replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '');
  const cleanBarcode = (barcode || '').trim();

  const rawKey = `${normBrand}___${name.trim()}___${cleanUnit}___${cleanBarcode}`;
  const hash = safeStringHash(rawKey);

  const prefix = cleanBrand ? `${cleanBrand}_` : 'off_';
  const namePart = cleanName.slice(0, 16);
  return `of_${prefix}${namePart}_${hash}`;
}

export interface OpenFoodPreCheckResult {
  exists: boolean;
  existingFood?: OpenFoodDocument;
  targetDocId: string;
  normalizedBrand: string;
}

export const OpenFoodService = {
  /**
   * Pre-checks if the food item already exists in the open_foods collection.
   */
  async preCheckOpenFood(food: {
    name: string;
    brand?: string;
    servingUnit?: string;
    barcode?: string;
  }): Promise<OpenFoodPreCheckResult> {
    const normalizedBrand = food.brand ? normalizeBrandName(food.brand) : 'Open Food Facts';
    const targetDocId = generateDeterministicOpenFoodId(
      normalizedBrand,
      food.name,
      food.servingUnit || 'g',
      food.barcode
    );

    try {
      // 1. Direct document check via deterministic ID
      const directDocRef = doc(db, OPEN_FOODS_COLLECTION, targetDocId);
      const directSnap = await getDoc(directDocRef);
      if (directSnap.exists()) {
        return {
          exists: true,
          existingFood: directSnap.data() as OpenFoodDocument,
          targetDocId,
          normalizedBrand,
        };
      }

      // 2. Query by barcode if available
      if (food.barcode?.trim()) {
        const colRef = collection(db, OPEN_FOODS_COLLECTION);
        const q = query(colRef, where('barcode', '==', food.barcode.trim()), limit(1));
        const querySnap = await getDocs(q);
        if (!querySnap.empty) {
          const foundDoc = querySnap.docs[0];
          return {
            exists: true,
            existingFood: foundDoc.data() as OpenFoodDocument,
            targetDocId: foundDoc.id,
            normalizedBrand,
          };
        }
      }

      // 3. Query by brand and food name
      const colRef = collection(db, OPEN_FOODS_COLLECTION);
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
          existingFood: foundDoc.data() as OpenFoodDocument,
          targetDocId: foundDoc.id,
          normalizedBrand,
        };
      }
    } catch (err) {
      console.warn('Pre-check open food warning (ignorable if offline):', err);
    }

    return {
      exists: false,
      targetDocId,
      normalizedBrand,
    };
  },

  /**
   * Uploads or updates an Open Food item in the 'open_foods' Firestore collection.
   * Structure strictly matches CloudFood / cloud_foods.
   */
  async saveToOpenFoodsCollection(food: {
    id?: string;
    name: string;
    brand?: string;
    servingAmount?: number;
    servingUnit?: string;
    calories: number;
    carbs: number;
    sugars?: number;
    fiber?: number;
    protein: number;
    fat: number;
    sodium?: number;
    potassium?: number;
    barcode?: string;
    imageUrl?: string;
  }): Promise<{ success: boolean; food?: OpenFoodDocument; reason?: string }> {
    const normalizedBrand = food.brand ? normalizeBrandName(food.brand) : 'Open Food Facts';
    const deterministicId = generateDeterministicOpenFoodId(
      normalizedBrand,
      food.name,
      food.servingUnit || 'g',
      food.barcode
    );

    const docData: OpenFoodDocument = {
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
      const docRef = doc(db, OPEN_FOODS_COLLECTION, deterministicId);
      await setDoc(docRef, docData, { merge: true });
      return { success: true, food: docData };
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${OPEN_FOODS_COLLECTION}/${deterministicId}`);
      return { success: false, reason: '寫入 open_foods 集合失敗' };
    }
  },

  /**
   * Fire-and-forget background upload to 'open_foods' collection.
   */
  uploadInBackground(food: {
    id?: string;
    name: string;
    brand?: string;
    servingAmount?: number;
    servingUnit?: string;
    calories: number;
    carbs: number;
    sugars?: number;
    fiber?: number;
    protein: number;
    fat: number;
    sodium?: number;
    potassium?: number;
    barcode?: string;
    imageUrl?: string;
  }): void {
    Promise.resolve().then(async () => {
      try {
        await OpenFoodService.saveToOpenFoodsCollection(food);
        console.log('[OpenFoodService] Saved to open_foods collection:', food.name);
      } catch (err) {
        console.warn('[OpenFoodService] Background save warning:', err);
      }
    });
  },

  /**
   * Fetch saved open foods from open_foods collection in Firestore.
   */
  async fetchSavedOpenFoods(searchQuery: string = '', maxResults: number = 40): Promise<FoodSearchResult[]> {
    try {
      const qStr = searchQuery.trim().toLowerCase();
      const colRef = collection(db, OPEN_FOODS_COLLECTION);
      const q = query(colRef, limit(150));
      const querySnapshot = await getDocs(q);

      const results: FoodSearchResult[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data() as OpenFoodDocument;
        const matchesQuery =
          !qStr ||
          data.name.toLowerCase().includes(qStr) ||
          (data.brand && data.brand.toLowerCase().includes(qStr)) ||
          (data.barcode && data.barcode.includes(qStr));

        if (matchesQuery) {
          results.push({
            id: `open_${data.id}`,
            name: data.name,
            brand: data.brand || 'Open Food Facts',
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
            isCloudPreset: false,
            isOpenFood: true,
            barcode: data.barcode,
          });
        }
      });

      return results.slice(0, maxResults);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, OPEN_FOODS_COLLECTION);
      return [];
    }
  },

  /**
   * Get total count of saved items in open_foods collection.
   */
  async getOpenFoodsCount(): Promise<number> {
    try {
      const colRef = collection(db, OPEN_FOODS_COLLECTION);
      const querySnapshot = await getDocs(colRef);
      return querySnapshot.size;
    } catch (err) {
      console.warn('Failed to get open foods count:', err);
      return 0;
    }
  },
};
