import sys
import os

try:
    import pymupdf as fitz
except ImportError:
    try:
        import fitz
    except ImportError:
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pymupdf"])
        import pymupdf as fitz

pdf_path = r"C:\Users\adity\.gemini\antigravity-ide\brain\4ae22dc3-49b6-4e68-aa17-27bea60f3c00\.user_uploaded\media_1791138271816.pdf"
out_dir = r"C:\Users\adity\.gemini\antigravity-ide\scratch\nimmt6\public\img\cards"

if not os.path.exists(out_dir):
    os.makedirs(out_dir)

doc = fitz.open(pdf_path)

zoom_x = 2.0
zoom_y = 2.0
mat = fitz.Matrix(zoom_x, zoom_y)

for card_num in range(1, 105):
    page_idx = card_num  # page index 1 is page 2
    if page_idx >= len(doc):
        print(f"Warning: page {page_idx} not found")
        continue
    page = doc.load_page(page_idx)
    pix = page.get_pixmap(matrix=mat)
    out_path = os.path.join(out_dir, f"card-{card_num}.jpg")
    pix.save(out_path)
    print(f"Saved {out_path}")

print("Done extracting cards.")
