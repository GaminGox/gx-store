import os
import json
from contextlib import asynccontextmanager
from typing import List, Optional, Any
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import text

import models
import schemas
import auth
from database import engine, get_db, SessionLocal
from utils import save_and_optimize_image, remove_multiple_images

@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs("uploads", exist_ok=True)
    models.Base.metadata.create_all(bind=engine)
    
    # Auto-migraciones
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE productos ADD COLUMN badge VARCHAR;"))
            conn.commit()
    except Exception: pass

    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE productos ADD COLUMN clics_whatsapp INTEGER DEFAULT 0;"))
            conn.commit()
    except Exception: pass
        
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE configuracion ADD COLUMN promo_flash_activo BOOLEAN DEFAULT 0;"))
            conn.commit()
    except Exception: pass

    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE configuracion ADD COLUMN promo_flash_texto VARCHAR DEFAULT '⚡ ¡OFERTA FLASH! Envíos GRATIS a todo el Ecuador comprando hoy. ⚡';"))
            conn.commit()
    except Exception: pass

    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE configuracion ADD COLUMN express_apple JSON;"))
            conn.commit()
    except Exception: pass

    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE configuracion ADD COLUMN express_samsung JSON;"))
            conn.commit()
    except Exception: pass
    
    db = SessionLocal()
    try:
        admin_user = db.query(models.Usuario).filter(models.Usuario.username == "admin").first()
        if not admin_user:
            default_admin = models.Usuario(
                username="admin",
                hashed_password=auth.get_password_hash("admin123")
            )
            db.add(default_admin)
            db.commit()
            
        config = db.query(models.Configuracion).first()
        if not config:
            default_config = models.Configuracion()
            db.add(default_config)
            db.commit()
            config = default_config

        # Rellenar con los datos base si está vacío
        if not config.express_apple:
            config.express_apple = [
                {"serie": "Serie iPhone 12", "modelo": "iPhone 12 (64GB)", "precio": 255},
                {"serie": "Serie iPhone 12", "modelo": "iPhone 12 (128GB)", "precio": 285},
                {"serie": "Serie iPhone 12", "modelo": "iPhone 12 Pro (128GB)", "precio": 320},
                {"serie": "Serie iPhone 12", "modelo": "iPhone 12 Pro Max (128GB)", "precio": 405},
                {"serie": "Serie iPhone 12", "modelo": "iPhone 12 Pro Max (256GB)", "precio": 420},
                {"serie": "Serie iPhone 13", "modelo": "iPhone 13 (128GB)", "precio": 340},
                {"serie": "Serie iPhone 13", "modelo": "iPhone 13 (256GB)", "precio": 370},
                {"serie": "Serie iPhone 13", "modelo": "iPhone 13 Pro (128GB)", "precio": 430},
                {"serie": "Serie iPhone 13", "modelo": "iPhone 13 Pro (256GB)", "precio": 450},
                {"serie": "Serie iPhone 13", "modelo": "iPhone 13 Pro Max (128GB)", "precio": 485},
                {"serie": "Serie iPhone 13", "modelo": "iPhone 13 Pro Max (256GB)", "precio": 535},
                {"serie": "Serie iPhone 14", "modelo": "iPhone 14 (128GB)", "precio": 385},
                {"serie": "Serie iPhone 14", "modelo": "iPhone 14 Pro (128GB)", "precio": 490},
                {"serie": "Serie iPhone 14", "modelo": "iPhone 14 Pro (256GB)", "precio": 535},
                {"serie": "Serie iPhone 14", "modelo": "iPhone 14 Pro Max (128GB)", "precio": 565},
                {"serie": "Serie iPhone 14", "modelo": "iPhone 14 Pro Max (256GB)", "precio": 600},
                {"serie": "Serie iPhone 15", "modelo": "iPhone 15 (128GB)", "precio": 480},
                {"serie": "Serie iPhone 15", "modelo": "iPhone 15 (256GB)", "precio": 520},
                {"serie": "Serie iPhone 15", "modelo": "iPhone 15 Pro (128GB)", "precio": 630},
                {"serie": "Serie iPhone 15", "modelo": "iPhone 15 Pro (256GB)", "precio": 670},
                {"serie": "Serie iPhone 15", "modelo": "iPhone 15 Pro Max (256GB)", "precio": 700},
                {"serie": "Serie iPhone 16", "modelo": "iPhone 16 (128GB)", "precio": 630},
                {"serie": "Serie iPhone 16", "modelo": "iPhone 16 (256GB)", "precio": 670},
                {"serie": "Serie iPhone 16", "modelo": "iPhone 16 Pro (128GB)", "precio": 760},
                {"serie": "Serie iPhone 16", "modelo": "iPhone 16 Pro (256GB)", "precio": 799},
                {"serie": "Serie iPhone 16", "modelo": "iPhone 16 Pro Max (256GB)", "precio": 870},
                {"serie": "Serie iPhone 17", "modelo": "iPhone 17 Pro (256GB)", "precio": 1100},
                {"serie": "Serie iPhone 17", "modelo": "iPhone 17 Pro (512GB)", "precio": 1250},
                {"serie": "Serie iPhone 17", "modelo": "iPhone 17 Pro Max (256GB)", "precio": 1210},
                {"serie": "Serie iPhone 17", "modelo": "iPhone 17 Pro Max (1TB)", "precio": 1400}
            ]
            db.commit()

        if not config.express_samsung:
            config.express_samsung = [
                {"serie": "Serie Galaxy S22", "modelo": "Galaxy S22 (128GB)", "precio": 245},
                {"serie": "Serie Galaxy S22", "modelo": "Galaxy S22 (256GB)", "precio": 280},
                {"serie": "Serie Galaxy S22", "modelo": "Galaxy S22 Plus (128GB)", "precio": 280},
                {"serie": "Serie Galaxy S22", "modelo": "Galaxy S22 Plus (256GB)", "precio": 310},
                {"serie": "Serie Galaxy S22", "modelo": "Galaxy S22 Ultra (128GB)", "precio": 410},
                {"serie": "Serie Galaxy S22", "modelo": "Galaxy S22 Ultra (256GB)", "precio": 440},
                {"serie": "Serie Galaxy S22", "modelo": "Galaxy S22 Ultra (512GB)", "precio": 470},
                {"serie": "Serie Galaxy S23", "modelo": "Galaxy S23 FE (128GB)", "precio": 320},
                {"serie": "Serie Galaxy S23", "modelo": "Galaxy S23 (128GB)", "precio": 350},
                {"serie": "Serie Galaxy S23", "modelo": "Galaxy S23 (256GB)", "precio": 375},
                {"serie": "Serie Galaxy S23", "modelo": "Galaxy S23 Plus (256GB)", "precio": 410},
                {"serie": "Serie Galaxy S23", "modelo": "Galaxy S23 Ultra (256GB)", "precio": 550},
                {"serie": "Serie Galaxy S23", "modelo": "Galaxy S23 Ultra (512GB)", "precio": 580},
                {"serie": "Serie Galaxy S24", "modelo": "Galaxy S24 FE (128GB)", "precio": 420},
                {"serie": "Serie Galaxy S24", "modelo": "Galaxy S24 (128GB)", "precio": 470},
                {"serie": "Serie Galaxy S24", "modelo": "Galaxy S24 (256GB)", "precio": 490},
                {"serie": "Serie Galaxy S24", "modelo": "Galaxy S24 Plus (256GB)", "precio": 550},
                {"serie": "Serie Galaxy S24", "modelo": "Galaxy S24 Ultra (256GB)", "precio": 700},
                {"serie": "Serie Galaxy S24", "modelo": "Galaxy S24 Ultra (512GB)", "precio": 760},
                {"serie": "Serie Galaxy S25", "modelo": "Galaxy S25 (128GB)", "precio": 580},
                {"serie": "Serie Galaxy S25", "modelo": "Galaxy S25 (256GB)", "precio": 660},
                {"serie": "Serie Galaxy S25", "modelo": "Galaxy S25 Plus (256GB)", "precio": 699},
                {"serie": "Serie Galaxy S25", "modelo": "Galaxy S25 Ultra (256GB)", "precio": 830},
                {"serie": "Serie Galaxy S25", "modelo": "Galaxy S25 Ultra (512GB)", "precio": 865},
                {"serie": "Serie Galaxy S26", "modelo": "Galaxy S26 (256GB)", "precio": 680},
                {"serie": "Serie Galaxy S26", "modelo": "Galaxy S26 (512GB)", "precio": 720},
                {"serie": "Serie Galaxy S26", "modelo": "Galaxy S26 Plus (256GB)", "precio": 740},
                {"serie": "Serie Galaxy S26", "modelo": "Galaxy S26 Plus (512GB)", "precio": 790},
                {"serie": "Serie Galaxy S26", "modelo": "Galaxy S26 Ultra (256GB)", "precio": 1100},
                {"serie": "Serie Galaxy S26", "modelo": "Galaxy S26 Ultra (512GB)", "precio": 1200}
            ]
            db.commit()
    finally:
        db.close()
    yield

app = FastAPI(
    title="GX Store API",
    version="2.5.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

def parsear_config(config):
    if isinstance(config.express_apple, str):
        try: config.express_apple = json.loads(config.express_apple)
        except: pass
    if isinstance(config.express_samsung, str):
        try: config.express_samsung = json.loads(config.express_samsung)
        except: pass
    return config

# --- AUTENTICACIÓN ---
@app.post("/api/auth/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.Usuario).filter(models.Usuario.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = auth.create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

# --- CONFIGURACIÓN DE LA TIENDA ---
@app.get("/api/configuracion", response_model=schemas.ConfiguracionOut)
def obtener_configuracion(db: Session = Depends(get_db)):
    config = db.query(models.Configuracion).first()
    return parsear_config(config)

@app.put("/api/configuracion", response_model=schemas.ConfiguracionOut)
def actualizar_configuracion(
    datos: schemas.ConfiguracionUpdate,
    db: Session = Depends(get_db),
    admin: models.Usuario = Depends(auth.get_current_admin)
):
    config = db.query(models.Configuracion).first()
    config.whatsapp = datos.whatsapp.strip()
    config.tiktok = datos.tiktok.strip()
    config.mensaje_anuncio = datos.mensaje_anuncio.strip()
    
    config.promo_flash_activo = getattr(datos, 'promo_flash_activo', config.promo_flash_activo)
    
    nuevo_texto = getattr(datos, 'promo_flash_texto', None)
    if nuevo_texto is not None:
        config.promo_flash_texto = nuevo_texto.strip()
        
    db.commit()
    db.refresh(config)
    return parsear_config(config)

# --- NUEVA RUTA: CATÁLOGO EXPRESS ---
@app.put("/api/configuracion/express", response_model=schemas.ConfiguracionOut)
def actualizar_catalogo_express(
    datos: schemas.ExpressCatalogUpdate,
    db: Session = Depends(get_db),
    admin: models.Usuario = Depends(auth.get_current_admin)
):
    config = db.query(models.Configuracion).first()
    
    if datos.express_apple is not None:
        config.express_apple = datos.express_apple
    if datos.express_samsung is not None:
        config.express_samsung = datos.express_samsung
        
    db.commit()
    db.refresh(config)
    return parsear_config(config)

# --- PRODUCTOS PÚBLICOS ---
@app.get("/api/productos", response_model=List[schemas.ProductoOut])
def listar_productos(
    marca: Optional[str] = None, 
    disponibles_solo: bool = False,
    db: Session = Depends(get_db)
):
    query = db.query(models.Producto)
    if disponibles_solo:
        query = query.filter(models.Producto.disponible == True)
    if marca:
        query = query.filter(models.Producto.marca.ilike(f"%{marca}%"))
    return query.order_by(models.Producto.fecha_creacion.desc()).all()

@app.get("/api/productos/{producto_id}", response_model=schemas.ProductoOut)
def obtener_producto(producto_id: int, db: Session = Depends(get_db)):
    producto = db.query(models.Producto).filter(models.Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return producto

@app.post("/api/productos/{producto_id}/clic-whatsapp")
def registrar_clic_whatsapp(producto_id: int, db: Session = Depends(get_db)):
    producto = db.query(models.Producto).filter(models.Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    producto.clics_whatsapp = (producto.clics_whatsapp or 0) + 1
    db.commit()
    return {"message": "Clic registrado exitosamente", "clics": producto.clics_whatsapp}

# --- PRODUCTOS ADMINISTRACIÓN ---
@app.post("/api/productos", response_model=schemas.ProductoOut, status_code=status.HTTP_201_CREATED)
def crear_producto(
    nombre: str = Form(...),
    marca: str = Form(...),
    precio: float = Form(...),
    estado: str = Form(...),
    almacenamiento: Optional[str] = Form(None),
    bateria_salud: Optional[str] = Form(None),
    badge: Optional[str] = Form(None),
    descripcion: Optional[str] = Form(None),
    imagenes: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    admin: models.Usuario = Depends(auth.get_current_admin)
):
    valid_files = [f for f in imagenes if f.filename]
    if not valid_files:
        raise HTTPException(status_code=400, detail="Debes subir al menos una imagen.")

    rutas_imagenes = [save_and_optimize_image(f) for f in valid_files]
    
    nuevo_producto = models.Producto(
        nombre=nombre.strip(),
        marca=marca.strip(),
        precio=precio,
        estado=estado.strip(),
        almacenamiento=almacenamiento.strip() if almacenamiento else None,
        bateria_salud=bateria_salud.strip() if bateria_salud else None,
        badge=badge.strip() if badge else None,
        descripcion=descripcion.strip() if descripcion else None,
        imagenes=rutas_imagenes,
        disponible=True,
        clics_whatsapp=0
    )
    
    db.add(nuevo_producto)
    db.commit()
    db.refresh(nuevo_producto)
    return nuevo_producto

@app.put("/api/productos/{producto_id}", response_model=schemas.ProductoOut)
def actualizar_producto(
    producto_id: int,
    nombre: str = Form(...),
    marca: str = Form(...),
    precio: float = Form(...),
    estado: str = Form(...),
    almacenamiento: Optional[str] = Form(None),
    bateria_salud: Optional[str] = Form(None),
    badge: Optional[str] = Form(None),
    descripcion: Optional[str] = Form(None),
    imagenes: Optional[List[UploadFile]] = File(None),
    db: Session = Depends(get_db),
    admin: models.Usuario = Depends(auth.get_current_admin)
):
    producto = db.query(models.Producto).filter(models.Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    producto.nombre = nombre.strip()
    producto.marca = marca.strip()
    producto.precio = precio
    producto.estado = estado.strip()
    producto.almacenamiento = almacenamiento.strip() if almacenamiento else None
    producto.bateria_salud = bateria_salud.strip() if bateria_salud else None
    producto.badge = badge.strip() if badge else None
    producto.descripcion = descripcion.strip() if descripcion else None

    if imagenes:
        valid_files = [f for f in imagenes if f.filename]
        if valid_files:
            if isinstance(producto.imagenes, list):
                remove_multiple_images(producto.imagenes)
            producto.imagenes = [save_and_optimize_image(f) for f in valid_files]

    db.commit()
    db.refresh(producto)
    return producto

@app.patch("/api/productos/{producto_id}/toggle", response_model=schemas.ProductoOut)
def alternar_disponibilidad(
    producto_id: int, 
    db: Session = Depends(get_db),
    admin: models.Usuario = Depends(auth.get_current_admin)
):
    producto = db.query(models.Producto).filter(models.Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    producto.disponible = not producto.disponible
    db.commit()
    db.refresh(producto)
    return producto

@app.delete("/api/productos/{producto_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_producto(
    producto_id: int, 
    db: Session = Depends(get_db),
    admin: models.Usuario = Depends(auth.get_current_admin)
):
    producto = db.query(models.Producto).filter(models.Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    if isinstance(producto.imagenes, list):
        remove_multiple_images(producto.imagenes)

    db.delete(producto)
    db.commit()
    return None