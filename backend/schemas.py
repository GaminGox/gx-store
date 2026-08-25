from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class Token(BaseModel):
    access_token: str
    token_type: str

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
    fecha_creacion: datetime

    class Config:
        from_attributes = True