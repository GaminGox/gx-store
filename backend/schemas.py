from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class ProductoOut(BaseModel):
    id: int
    nombre: str
    marca: str
    precio: float
    estado: str
    almacenamiento: Optional[str] = None
    bateria_salud: Optional[str] = None
    badge: Optional[str] = None
    descripcion: Optional[str] = None
    imagenes: List[str]
    disponible: bool
    clics_whatsapp: Optional[int] = 0 
    fecha_creacion: datetime

    class Config:
        from_attributes = True

class ConfiguracionOut(BaseModel):
    whatsapp: str
    tiktok: str
    mensaje_anuncio: str

    class Config:
        from_attributes = True

class ConfiguracionUpdate(BaseModel):
    whatsapp: str
    tiktok: str
    mensaje_anuncio: str