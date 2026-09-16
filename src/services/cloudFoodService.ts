import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  limit,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CloudFood, CustomFood, FoodSearchResult } from '../types';

const COLLECTION_NAME = 'cloud_foods';

export const CloudFoodService = {
  /**
   * Upload custom food to the global online food database.
   */
  async uploadToCloudDatabase(food: CustomFood): Promise<CloudFood> {
    const cloudFood: CloudFood = {
      id: food.id || `cloud_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: food.name.trim(),
      brand: food.brand?.trim() || '網路資料庫',
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
      barcode: food.barcode || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const docRef = doc(db, COLLECTION_NAME, cloudFood.id);
    await setDoc(docRef, cloudFood, { merge: true });
    return cloudFood;
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
  }
};
