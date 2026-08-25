import os
from contextlib import asynccontextmanager
from typing import List, Optional
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
    
    # Auto-migración segura: agregar columna badge si no existe en la base de datos
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE productos ADD COLUMN badge VARCHAR;"))
            conn.commit()
    except Exception:
        pass

    # Auto-migración segura: agregar columna clics_whatsapp si no existe
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE productos ADD COLUMN clics_whatsapp INTEGER DEFAULT 0;"))
            conn.commit()
    except Exception:
        pass
    
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
    finally:
        db.close()
    yield

app = FastAPI(
    title="GX Store API",
    version="2.1.0",
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
    
    producto.clics_whatsapp += 1
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

    # Si se suben nuevas fotos, reemplazar las existentes
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