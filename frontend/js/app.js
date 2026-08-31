const API_URL = "https://storegx-api.onrender.com/api";
const BACKEND_BASE = "https://storegx-api.onrender.com";

let productos = [];
let currentImages = [];
let currentImageIndex = 0;
let currentSelectedProduct = null;

// Configuración global de la tienda (valores por defecto)
let globalStoreConfig = {
  whatsapp: "593992641656",
  tiktok: "https://www.tiktok.com/@store_gx",
  mensaje_anuncio: "Smartphones seminuevos y sellados garantizados con fotos 100% reales y envíos seguros a todo el Ecuador."
};

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

function createSlug(marca, nombre, almacenamiento) {
  const text = `${marca || ''} ${nombre || ''} ${almacenamiento || ''}`;
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// 1. OBTENER CONFIGURACIÓN ANTES QUE NADA
async function fetchStoreConfig() {
  try {
    const res = await fetch(`${API_URL}/configuracion`);
    if (res.ok) {
      globalStoreConfig = await res.json();
      applyConfigToDOM();
    }
  } catch (error) {
    console.error("Usando configuración local por defecto.");
  }
}

// 2. APLICAR LA CONFIGURACIÓN A LA PÁGINA
function applyConfigToDOM() {
  const heroDesc = document.querySelector(".hero p");
  if (heroDesc) heroDesc.textContent = globalStoreConfig.mensaje_anuncio;

  // Actualizar todos los links fijos de WhatsApp
  document.querySelectorAll('a.whatsapp, a.btn-whatsapp-large').forEach(el => {
    if (el.id !== "modalWaBtn") { 
      el.href = `https://wa.me/${globalStoreConfig.whatsapp}`;
    }
  });

  // Actualizar links de TikTok
  document.querySelectorAll('a.tiktok, a[href*="tiktok.com"]').forEach(el => {
    el.href = globalStoreConfig.tiktok;
  });
}

// 3. OBTENER PRODUCTOS
async function fetchProducts() {
  try {
    const res = await fetch(`${API_URL}/productos?disponibles_solo=false`);
    if (!res.ok) throw new Error("Error al obtener catálogo");
    productos = await res.json();
    populateBrands();
    renderProducts();
    checkDeepLink();
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

// ASIGNAR JERARQUÍA DE IMPORTANCIA A LAS ETIQUETAS
function getBadgePriority(badge) {
  if (!badge) return 4;
  const b = badge.toUpperCase();
  if (b.includes("OFERTA")) return 1;
  if (b.includes("ÚLTIMA UNIDAD") || b.includes("ULTIMA UNIDAD")) return 2;
  if (b.includes("MÁS VENDIDO") || b.includes("MAS VENDIDO")) return 3;
  if (b.includes("AGOTADO")) return 5;
  return 4;
}

function renderProducts() {
  if (!productsGrid) return;
  
  const searchTerm = (searchInput?.value || "").toLowerCase().trim();
  const selectedBrand = brandFilter?.value || "";

  let filtered = productos.filter(p => {
    const matchText = (
      (p.nombre && p.nombre.toLowerCase().includes(searchTerm)) || 
      (p.marca && p.marca.toLowerCase().includes(searchTerm)) ||
      (p.almacenamiento && p.almacenamiento.toLowerCase().includes(searchTerm))
    );
    const matchBrand = selectedBrand === "" || p.marca === selectedBrand;
    return matchText && matchBrand;
  });

  // ORDENAMIENTO POR RELEVANCIA COMERCIAL
  filtered.sort((a, b) => {
    const aAgotado = (a.badge && a.badge.toUpperCase().includes("AGOTADO")) || !a.disponible;
    const bAgotado = (b.badge && b.badge.toUpperCase().includes("AGOTADO")) || !b.disponible;

    if (aAgotado && !bAgotado) return 1;
    if (!aAgotado && bAgotado) return -1;

    const priorityA = getBadgePriority(a.badge);
    const priorityB = getBadgePriority(b.badge);

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    return new Date(b.fecha_creacion || 0) - new Date(a.fecha_creacion || 0);
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

    const isAgotado = (item.badge && item.badge.toUpperCase().includes("AGOTADO")) || !item.disponible;

    return `
      <article class="card" onclick="openProductModal(${item.id})">
        <div class="card-img-wrapper">
          ${isAgotado ? `<div class="soldout-center-badge">AGOTADO ❌</div>` : ''}
          <div class="badge-container">
            ${item.badge && !isAgotado ? `<span class="badge" style="background: #e50914; color:#fff; box-shadow: 0 2px 8px rgba(229, 9, 20, 0.28);">${item.badge}</span>` : ''}
            <span class="badge badge-condition">${item.estado}</span>
            ${item.almacenamiento ? `<span class="badge badge-storage">💾 ${item.almacenamiento}</span>` : ''}
            ${item.bateria_salud ? `<span class="badge badge-battery">⚡ ${item.bateria_salud}</span>` : ''}
          </div>
          ${totalFotos > 1 ? `<div class="badge-count">📷 ${totalFotos} fotos</div>` : ''}
          <img class="card-img ${isAgotado ? 'card-img-dimmed' : ''}" src="${imgPath}" alt="${item.nombre}" loading="lazy">
        </div>
        <div class="card-content">
          <span class="card-brand">${item.marca}</span>
          <h3 class="card-title">${item.nombre}</h3>
          <div class="card-footer">
            <span class="card-price" style="${isAgotado ? 'color: var(--text-muted);' : ''}">${formattedPrice}</span>
            <span class="btn btn-secondary btn-sm">${isAgotado ? 'Ver fotos' : 'Ver detalles'}</span>
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

  const isAgotado = (item.badge && item.badge.toUpperCase().includes("AGOTADO")) || !item.disponible;

  const slug = createSlug(item.marca, item.nombre, item.almacenamiento);
  const newUrl = `${window.location.pathname}?p=${item.id}-${slug}`;
  window.history.pushState({ phoneId: item.id }, "", newUrl);

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

  if (modalBrand) {
    modalBrand.innerHTML = `${item.marca} ${item.badge ? `<span class="badge" style="background: #e50914; color:#fff; margin-left: 6px; font-size: 0.65rem;">${item.badge}</span>` : ''}`;
  }
  if (modalTitle) modalTitle.textContent = item.nombre;
  if (modalPrice) {
    modalPrice.textContent = formattedPrice;
    modalPrice.style.color = isAgotado ? "var(--text-muted)" : "var(--accent-green)";
  }
  if (modalCondition) modalCondition.textContent = item.estado;
  if (modalStorage) modalStorage.textContent = item.almacenamiento || "—";
  if (modalBattery) modalBattery.textContent = item.bateria_salud || "—";
  if (modalDesc) modalDesc.textContent = item.descripcion || "Equipo testeado y garantizado con entrega inmediata.";

  // BOTÓN DE ACCIÓN DINÁMICO (AGOTADO VS WHATSAPP)
  if (modalWaBtn) {
    if (isAgotado) {
      modalWaBtn.className = "btn btn-soldout-large btn-full";
      modalWaBtn.innerHTML = `<span>⏳ Próximamente más unidades</span>`;
      modalWaBtn.removeAttribute("href");
      modalWaBtn.onclick = null;
    } else {
      modalWaBtn.className = "btn btn-whatsapp-large btn-full";
      modalWaBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
        </svg>
        Comprar ahora el dispositivo
      `;
      
      const waText = encodeURIComponent(`Hola GX Store, quiero comprar el ${item.marca} ${item.nombre} (${item.almacenamiento || ''}) por ${formattedPrice}.`);
      modalWaBtn.removeAttribute("href");
      
      modalWaBtn.onclick = (e) => {
        e.preventDefault();
        fetch(`${API_URL}/productos/${item.id}/clic-whatsapp`, { method: "POST" })
          .catch(err => console.error("Error interno:", err))
          .finally(() => {
            window.open(`https://wa.me/${globalStoreConfig.whatsapp}?text=${waText}`, "_blank");
          });
      };
    }
  }

  if (modalShareBtn) {
    modalShareBtn.onclick = (e) => {
      e.stopPropagation();
      const shareUrl = window.location.href;
      navigator.clipboard.writeText(shareUrl).then(() => {
        alert(`¡Enlace copiado al portapapeles!\n${shareUrl}`);
      }).catch(() => {
        prompt("Copia este enlace:", shareUrl);
      });
    };
  }

  if (productModal) productModal.style.display = "flex";
};

function closeModal() {
  if (productModal) productModal.style.display = "none";
  window.history.pushState({}, "", window.location.pathname);
}

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

window.addEventListener("keydown", (e) => {
  if (productModal && productModal.style.display === "flex") {
    if (e.key === "ArrowLeft" && galleryPrevBtn) {
      galleryPrevBtn.click();
    } else if (e.key === "ArrowRight" && galleryNextBtn) {
      galleryNextBtn.click();
    } else if (e.key === "Escape") {
      closeModal();
    }
  }

  if (e.ctrlKey && e.shiftKey && (e.key === "A" || e.key === "a")) {
    window.location.href = "admin.html";
  }
});

window.addEventListener("popstate", () => {
  const params = new URLSearchParams(window.location.search);
  const param = params.get("p") || params.get("id");
  if (param) {
    const idNum = parseInt(param.split("-")[0], 10);
    openProductModal(idNum);
  } else {
    if (productModal) productModal.style.display = "none";
  }
});

if (modalCloseBtn) {
  modalCloseBtn.addEventListener("click", closeModal);
}

window.addEventListener("click", (e) => {
  if (e.target === productModal) {
    closeModal();
  }
});

if (searchInput) searchInput.addEventListener("input", renderProducts);
if (brandFilter) brandFilter.addEventListener("change", renderProducts);

function checkDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const param = params.get("p") || params.get("id");
  if (param) {
    const idNum = parseInt(param.split("-")[0], 10);
    if (!isNaN(idNum)) {
      setTimeout(() => {
        openProductModal(idNum);
      }, 350);
    }
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await fetchStoreConfig();
  fetchProducts();
});