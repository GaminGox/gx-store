import os
import uuid
from io import BytesIO
from typing import List
from PIL import Image, ImageOps
from fastapi import UploadFile, HTTPException

UPLOAD_DIR = "uploads"

def save_and_optimize_image(file: UploadFile, max_dimension: int = 1200) -> str:
    if not os.path.exists(UPLOAD_DIR):
        os.makedirs(UPLOAD_DIR, exist_ok=True)
    
    allowed_extensions = {"jpg", "jpeg", "png", "webp", "heic", "avif"}
    extension = file.filename.split(".")[-1].lower() if "." in file.filename else ""
    
    if extension not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"Formato de imagen '{file.filename}' inválido. Solo se admiten JPG, PNG, WEBP, HEIC o AVIF."
        )

    try:
        contents = file.file.read()
        image = Image.open(BytesIO(contents))
        
        image = ImageOps.exif_transpose(image)

        if image.mode in ("RGBA", "P"):
            image = image.convert("RGB")

        image.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)

        unique_filename = f"{uuid.uuid4().hex}.webp"
        save_path = os.path.join(UPLOAD_DIR, unique_filename)

        image.save(save_path, "WEBP", quality=85, optimize=True)
        
        return f"/uploads/{unique_filename}"
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Fallo al procesar imagen: {str(e)}"
        )
    finally:
        file.file.close()

def remove_multiple_images(image_urls: List[str]):
    if not image_urls:
        return
    for img_url in image_urls:
        filename = os.path.basename(img_url)
        filepath = os.path.join(UPLOAD_DIR, filename)
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
            except OSError:
                pass