const API_URL = "https://storegx-api.onrender.com/api";
const BACKEND_BASE = "https://storegx-api.onrender.com";
const WHATSAPP_PHONE = "593992641656";

let productos = [];
let currentImages = [];
let currentImageIndex = 0;
let currentSelectedProduct = null;

// DOM
const searchInput = document.getElementById("searchInput");
const brandFilter = document.getElementById("brandFilter");
const productsGrid = document.getElementById("productsGrid");
const loading = document.getElementById("loading");

// Modal DOM
const productModal = document.getElementById("productModal");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const modalImgWrap = document.getElementById("modalImgWrap");
const modalMainImg = document.getElementById("modalMainImg");
const modalThumbsGrid = document.getElementById("modalThumbsGrid");
const modalBrand = document.getElementById("modalBrand");
const modalTitle = document.getElementById("modalTitle");
const modalPrice = document.getElementById("modalPrice");
const modalCondition = document.getElementById("modalCondition");
const modalStorage = document.getElementById("modalStorage");
const modalBattery = document.getElementById("modalBattery");
const modalDesc = document.getElementById("modalDesc");
const modalWaBtn = document.getElementById("modalWaBtn");
const modalShareBtn = document.getElementById("modalShareBtn");

// Flechas
const galleryPrevBtn = document.getElementById("galleryPrevBtn");
const galleryNextBtn = document.getElementById("galleryNextBtn");

async function fetchProducts() {
  try {
    const res = await fetch(`${API_URL}/productos?disponibles_solo=false`);
    if (!res.ok) throw new Error("Error al obtener catálogo");
    productos = await res.json();
    populateBrands();
    renderProducts();
    checkDeepLink(); // Revisar si viene un enlace directo (?id=...)
  } catch (error) {
    if (loading) {
      loading.innerHTML = `<p style="color: var(--danger);">No se pudo conectar con el catálogo de GX Store.</p>`;
    }
  } finally {
    if (loading) loading.style.display = "none";
    if (productsGrid) productsGrid.style.display = "grid";
  }
}

function populateBrands() {
  if (!brandFilter) return;
  const brands = [...new Set(productos.map(p => (p.marca ? p.marca.trim() : "")))].filter(Boolean).sort();
  brandFilter.innerHTML = '<option value="">Todas las marcas</option>';
  brands.forEach(brand => {
    const opt = document.createElement("option");
    opt.value = brand;
    opt.textContent = brand;
    brandFilter.appendChild(opt);
  });
}

function renderProducts() {
  if (!productsGrid) return;
  const searchTerm = (searchInput?.value || "").toLowerCase().trim();
  const selectedBrand = brandFilter?.value || "";

  const filtered = productos.filter(p => {
    const matchText = (
      (p.nombre && p.nombre.toLowerCase().includes(searchTerm)) || 
      (p.marca && p.marca.toLowerCase().includes(searchTerm)) ||
      (p.almacenamiento && p.almacenamiento.toLowerCase().includes(searchTerm))
    );
    const matchBrand = selectedBrand === "" || p.marca === selectedBrand;
    return matchText && matchBrand;
  });

  if (filtered.length === 0) {
    productsGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 4rem 0; color: var(--text-secondary);">
        No se encontraron celulares con ese criterio de búsqueda.
      </div>
    `;
    return;
  }

  productsGrid.innerHTML = filtered.map(item => {
    const firstImg = item.imagenes && item.imagenes.length > 0 ? item.imagenes[0] : '';
    const imgPath = firstImg ? (firstImg.startsWith("http") ? firstImg : `${BACKEND_BASE}${firstImg}`) : 'https://placehold.co/400x400/14141a/ffffff?text=Sin+Foto';
    const totalFotos = item.imagenes ? item.imagenes.length : 0;
    const formattedPrice = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.precio);

    return `
      <article class="card" onclick="openProductModal(${item.id})">
        <div class="card-img-wrapper">
          <div class="badge-container">
            <span class="badge badge-condition">${item.estado}</span>
            ${item.almacenamiento ? `<span class="badge badge-storage">💾 ${item.almacenamiento}</span>` : ''}
            ${item.bateria_salud ? `<span class="badge badge-battery">⚡ ${item.bateria_salud}</span>` : ''}
          </div>
          ${totalFotos > 1 ? `<div class="badge-count">📷 ${totalFotos} fotos</div>` : ''}
          <img class="card-img" src="${imgPath}" alt="${item.nombre}" loading="lazy">
        </div>
        <div class="card-content">
          <span class="card-brand">${item.marca}</span>
          <h3 class="card-title">${item.nombre}</h3>
          <div class="card-footer">
            <span class="card-price">${formattedPrice}</span>
            <span class="btn btn-secondary btn-sm">Ver detalles</span>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

// ABRIR MODAL
window.openProductModal = function(id) {
  const item = productos.find(p => p.id === id);
  if (!item) return;

  currentSelectedProduct = item;
  currentImages = item.imagenes && item.imagenes.length > 0 ? item.imagenes : [];
  currentImageIndex = 0;

  updateModalImage();

  if (currentImages.length > 1) {
    if (galleryPrevBtn) galleryPrevBtn.style.display = "flex";
    if (galleryNextBtn) galleryNextBtn.style.display = "flex";
    if (modalThumbsGrid) modalThumbsGrid.style.display = "flex";
  } else {
    if (galleryPrevBtn) galleryPrevBtn.style.display = "none";
    if (galleryNextBtn) galleryNextBtn.style.display = "none";
    if (modalThumbsGrid) modalThumbsGrid.style.display = "none";
  }

  renderThumbnails();

  const formattedPrice = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.precio);

  if (modalBrand) modalBrand.textContent = item.marca;
  if (modalTitle) modalTitle.textContent = item.nombre;
  if (modalPrice) modalPrice.textContent = formattedPrice;
  if (modalCondition) modalCondition.textContent = item.estado;
  if (modalStorage) modalStorage.textContent = item.almacenamiento || "—";
  if (modalBattery) modalBattery.textContent = item.bateria_salud || "—";
  if (modalDesc) modalDesc.textContent = item.descripcion || "Equipo testeado y garantizado con entrega inmediata.";

  // Configurar enlace dinámico de WhatsApp
  if (modalWaBtn) {
    const waText = encodeURIComponent(`Hola GX Store, quiero comprar el ${item.marca} ${item.nombre} (${item.almacenamiento || ''}) por ${formattedPrice}.`);
    modalWaBtn.href = `https://wa.me/${WHATSAPP_PHONE}?text=${waText}`;
  }

  // BOTÓN COMPARTIR LINK DIRECTO
  if (modalShareBtn) {
    modalShareBtn.onclick = (e) => {
      e.stopPropagation();
      const shareUrl = `${window.location.origin}${window.location.pathname}?id=${item.id}`;
      navigator.clipboard.writeText(shareUrl).then(() => {
        alert(`¡Enlace directo al ${item.marca} ${item.nombre} copiado al portapapeles!`);
      }).catch(() => {
        prompt("Copia este enlace para compartir:", shareUrl);
      });
    };
  }

  if (productModal) productModal.style.display = "flex";
};

function updateModalImage() {
  if (currentImages.length === 0) {
    if (modalMainImg) modalMainImg.src = 'https://placehold.co/600x600/14141a/ffffff?text=Sin+Foto';
    return;
  }
  const rawUrl = currentImages[currentImageIndex];
  const fullUrl = rawUrl.startsWith("http") ? rawUrl : `${BACKEND_BASE}${rawUrl}`;
  if (modalMainImg) modalMainImg.src = fullUrl;

  document.querySelectorAll(".thumb-img").forEach((thumb, idx) => {
    thumb.classList.toggle("active", idx === currentImageIndex);
  });
}

function renderThumbnails() {
  if (!modalThumbsGrid) return;
  if (currentImages.length <= 1) {
    modalThumbsGrid.innerHTML = "";
    return;
  }

  modalThumbsGrid.innerHTML = currentImages.map((imgUrl, index) => {
    const fullUrl = imgUrl.startsWith("http") ? imgUrl : `${BACKEND_BASE}${imgUrl}`;
    return `
      <img src="${fullUrl}" 
           class="thumb-img ${index === currentImageIndex ? 'active' : ''}" 
           onclick="selectImage(${index})" 
           alt="Miniatura ${index + 1}">
    `;
  }).join("");
}

window.selectImage = function(index) {
  currentImageIndex = index;
  updateModalImage();
};

// FLECHAS GALERÍA
if (galleryPrevBtn) {
  galleryPrevBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (currentImages.length <= 1) return;
    currentImageIndex = (currentImageIndex - 1 + currentImages.length) % currentImages.length;
    updateModalImage();
  });
}

if (galleryNextBtn) {
  galleryNextBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (currentImages.length <= 1) return;
    currentImageIndex = (currentImageIndex + 1) % currentImages.length;
    updateModalImage();
  });
}

// GESTOS TOUCH (SWIPE) PARA CELULARES
let touchStartX = 0;
let touchEndX = 0;

if (modalImgWrap) {
  modalImgWrap.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  modalImgWrap.addEventListener("touchend", (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipeGesture();
  }, { passive: true });
}

function handleSwipeGesture() {
  const swipeThreshold = 45;
  if (currentImages.length <= 1) return;

  if (touchEndX < touchStartX - swipeThreshold && galleryNextBtn) {
    galleryNextBtn.click();
  }
  if (touchEndX > touchStartX + swipeThreshold && galleryPrevBtn) {
    galleryPrevBtn.click();
  }
}

// TECLADO Y ATAJOS
window.addEventListener("keydown", (e) => {
  if (productModal && productModal.style.display === "flex") {
    if (e.key === "ArrowLeft" && galleryPrevBtn) {
      galleryPrevBtn.click();
    } else if (e.key === "ArrowRight" && galleryNextBtn) {
      galleryNextBtn.click();
    } else if (e.key === "Escape") {
      productModal.style.display = "none";
    }
  }

  // Atajo secreto al panel admin: Ctrl + Shift + A
  if (e.ctrlKey && e.shiftKey && (e.key === "A" || e.key === "a")) {
    window.location.href = "admin.html";
  }
});

if (modalCloseBtn) {
  modalCloseBtn.addEventListener("click", () => {
    if (productModal) productModal.style.display = "none";
  });
}

window.addEventListener("click", (e) => {
  if (e.target === productModal) {
    productModal.style.display = "none";
  }
});

if (searchInput) searchInput.addEventListener("input", renderProducts);
if (brandFilter) brandFilter.addEventListener("change", renderProducts);

// Abrir celular automáticamente si la URL tiene ?id=X
function checkDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const phoneId = params.get("id");
  if (phoneId) {
    const idNum = parseInt(phoneId, 10);
    setTimeout(() => {
      openProductModal(idNum);
    }, 350);
  }
}

document.addEventListener("DOMContentLoaded", fetchProducts);