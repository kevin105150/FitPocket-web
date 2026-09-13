import requests
import json
import time
import os

class CvsDataCrawler:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
    def fetch_seven_eleven_data(self):
        print("開始爬取 7-11 營養標示資料...")
        # 這裡會是實際的 7-11 API/網頁爬蟲邏輯
        # 因 7-11 官方並無公開 API，這通常需要分析其網頁或 APP 的 request
        
        # 模擬爬取結果
        mock_data = [
            {
                "id": "711_001",
                "name": "新國民便當",
                "barcode": "4710123456789",
                "calories": 650.0,
                "protein": 25.0,
                "fat": 20.0,
                "carbs": 80.0,
                "sodium": 1200.0,
                "category": "便當"
            }
        ]
        return mock_data

    def fetch_family_mart_data(self):
        print("開始爬取 全家 營養標示資料...")
        # 這裡會是實際的全家 API/網頁爬蟲邏輯
        
        # 模擬爬取結果
        mock_data = [
            {
                "id": "fm_001",
                "name": "沙茶豬肉燴飯",
                "barcode": "4719876543210",
                "calories": 720.0,
                "protein": 22.0,
                "fat": 28.0,
                "carbs": 95.0,
                "sodium": 1500.0,
                "category": "便當"
            }
        ]
        return mock_data
        
    def save_to_json(self, data, filename):
        # 確保存檔目錄存在
        os.makedirs(os.path.dirname(filename), exist_ok=True)
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"資料已儲存至: {filename}")

if __name__ == "__main__":
    crawler = CvsDataCrawler()
    
    # 爬取資料
    seven_data = crawler.fetch_seven_eleven_data()
    family_data = crawler.fetch_family_mart_data()
    
    # 儲存到 Android 專案的 assets 目錄，讓 App 可以讀取
    assets_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'app', 'src', 'main', 'assets')
    
    crawler.save_to_json(seven_data, os.path.join(assets_dir, 'seven_eleven_nutrition.json'))
    crawler.save_to_json(family_data, os.path.join(assets_dir, 'family_mart_nutrition.json'))
    
    print("爬蟲與更新完成！")
