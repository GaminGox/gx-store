from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

class ProductoBase(BaseModel):
    nombre: str
    marca: str
    precio: float
    estado: str
    almacenamiento: Optional[str] = None
    bateria_salud: Optional[str] = None
    descripcion: Optional[str] = None
    disponible: bool = True

class ProductoOut(ProductoBase):
    id: int
    imagenes: List[str]
    fecha_creacion: datetime

    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class UsuarioOut(BaseModel):
    id: int
    username: str

    model_config = ConfigDict(from_attributes=True)