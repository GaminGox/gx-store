from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, JSON
from database import Base

class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)

class Producto(Base):
    __tablename__ = "productos"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, index=True, nullable=False)
    marca = Column(String, index=True, nullable=False)
    precio = Column(Float, nullable=False)
    estado = Column(String, nullable=False)
    almacenamiento = Column(String, nullable=True)
    bateria_salud = Column(String, nullable=True)
    badge = Column(String, nullable=True, default="")
    descripcion = Column(String, nullable=True)
    imagenes = Column(JSON, nullable=False, default=list)
    disponible = Column(Boolean, default=True, nullable=False)
    clics_whatsapp = Column(Integer, default=0, nullable=True)
    fecha_creacion = Column(DateTime, default=datetime.utcnow, nullable=False)

class Configuracion(Base):
    __tablename__ = "configuracion"
    
    id = Column(Integer, primary_key=True, index=True)
    whatsapp = Column(String, default="593992641656", nullable=False)
    tiktok = Column(String, default="https://www.tiktok.com/@store_gx", nullable=False)
    mensaje_anuncio = Column(String, default="Smartphones seminuevos y sellados garantizados con fotos 100% reales y envíos seguros a todo el Ecuador.", nullable=False)