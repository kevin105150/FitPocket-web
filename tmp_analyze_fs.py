import urllib.request
import re

req = urllib.request.Request("https://foodsafety.family.com.tw/Web_FFD_2022/js/bundle.js", headers={"User-Agent": "Mozilla/5.0"})
with urllib.request.urlopen(req) as resp:
    content = resp.read().decode("utf-8", errors="ignore")

for m in re.finditer(r'PRODUCT_ID', content):
    pos = m.start()
    print("PRODUCT_ID at", pos)
    print(content[max(0, pos-200):min(len(content), pos+300)])
    print("---------------------------------")

