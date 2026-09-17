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

// INYECCIÓN DE SKELETON LOADERS
function renderSkeletons() {
  if (!productsGrid) return;
  productsGrid.style.display = "grid";
  if (loading) loading.style.display = "none";

  const skeletonHTML = Array(6).fill(0).map(() => `
    <div class="card skeleton-card">
      <div class="skeleton-img shimmer"></div>
      <div class="card-content">
        <div class="skeleton-line shimmer" style="width: 30%; height: 12px; margin-bottom: 8px;"></div>
        <div class="skeleton-line shimmer" style="width: 85%; height: 20px; margin-bottom: 12px;"></div>
        <div class="skeleton-pill-row">
          <div class="skeleton-line shimmer" style="width: 28%; height: 22px; border-radius: 4px;"></div>
          <div class="skeleton-line shimmer" style="width: 28%; height: 22px; border-radius: 4px;"></div>
          <div class="skeleton-line shimmer" style="width: 28%; height: 22px; border-radius: 4px;"></div>
        </div>
        <div class="card-footer" style="margin-top: 14px;">
          <div class="skeleton-line shimmer" style="width: 40%; height: 24px;"></div>
          <div class="skeleton-line shimmer" style="width: 35%; height: 32px; border-radius: 6px;"></div>
        </div>
      </div>
    </div>
  `).join("");

  productsGrid.innerHTML = skeletonHTML;
}

// 1. OBTENER CONFIGURACIÓN
async function fetchStoreConfig() {
  try {
    const res = await fetch(`${API_URL}/configuracion`);
    if (res.ok) {
      globalStoreConfig = await res.json();
      applyConfigToDOM();
    }
  } catch (error) {
    console.warn("Usando configuración local por defecto.");
  }
}

// 2. APLICAR CONFIGURACIÓN AL DOM
function applyConfigToDOM() {
  const heroDesc = document.querySelector(".hero p");
  if (heroDesc) heroDesc.textContent = globalStoreConfig.mensaje_anuncio;

  document.querySelectorAll('a.whatsapp, a.btn-whatsapp-large, .social-circle-btn.whatsapp').forEach(el => {
    if (el.id !== "modalWaBtn") { 
      el.href = `https://wa.me/${globalStoreConfig.whatsapp}`;
    }
  });

  document.querySelectorAll('a.tiktok, a[href*="tiktok.com"], .social-circle-btn.tiktok').forEach(el => {
    el.href = globalStoreConfig.tiktok;
  });
}

// 3. OBTENER PRODUCTOS
async function fetchProducts() {
  renderSkeletons();
  try {
    const res = await fetch(`${API_URL}/productos?disponibles_solo=false`);
    if (!res.ok) throw new Error("Error al obtener catálogo");
    productos = await res.json();
    populateBrands();
    renderProducts();
    checkDeepLink();
  } catch (error) {
    if (productsGrid) {
      productsGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 3rem 1rem; color: #ef4444;">
          <p style="font-weight: 700; font-size: 1.1rem; margin-bottom: 0.5rem;">No se pudo conectar con el catálogo de GX Store.</p>
          <p style="color: var(--text-secondary); font-size: 0.9rem;">El servidor se está iniciando o actualizando. Intenta recargar en unos segundos.</p>
        </div>
      `;
    }
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

function getBadgePriority(badge) {
  if (!badge) return 4;
  const b = badge.toUpperCase();
  if (b.includes("OFERTA")) return 1;
  if (b.includes("ÚLTIMA UNIDAD") || b.includes("ULTIMA UNIDAD")) return 2;
  if (b.includes("MÁS VENDIDO") || b.includes("MAS VENDIDO")) return 3;
  if (b.includes("AGOTADO")) return 5;
  return 4;
}

// RENDERIZADO LIMPIO DE PRODUCTOS
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
      <div style="grid-column: 1/-1; text-align: center; padding: 4rem 1rem; color: var(--text-secondary);">
        <div style="font-size: 2.2rem; margin-bottom: 0.8rem;">🔍</div>
        <p style="font-weight: 600;">No se encontraron celulares con ese criterio de búsqueda.</p>
      </div>
    `;
    return;
  }

  productsGrid.innerHTML = filtered.map(item => {
    const firstImg = item.imagenes && item.imagenes.length > 0 ? item.imagenes[0] : '';
    const imgPath = firstImg ? (firstImg.startsWith("http") ? firstImg : `${BACKEND_BASE}${firstImg}`) : 'https://placehold.co/500x500/14141a/ffffff?text=Sin+Foto';
    const totalFotos = item.imagenes ? item.imagenes.length : 0;
    const formattedPrice = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.precio);

    const isAgotado = (item.badge && item.badge.toUpperCase().includes("AGOTADO")) || !item.disponible;

    return `
      <article class="card" onclick="openProductModal(${item.id})">
        <div class="card-img-wrapper">
          ${isAgotado ? `<div class="soldout-center-badge">AGOTADO ❌</div>` : ''}
          ${item.badge && !isAgotado ? `
            <div class="badge-container">
              <span class="badge badge-highlight">${item.badge}</span>
            </div>
          ` : ''}
          ${totalFotos > 1 ? `<div class="badge-count">📷 ${totalFotos}</div>` : ''}
          <img class="card-img ${isAgotado ? 'card-img-dimmed' : ''}" src="${imgPath}" alt="${item.nombre}" loading="lazy">
        </div>
        <div class="card-content">
          <span class="card-brand">${item.marca}</span>
          <h3 class="card-title">${item.nombre}</h3>
          
          <!-- ESPECIFICACIONES INTEGRADAS Y LIMPIAS -->
          <div class="card-specs-row">
            ${item.estado ? `<span class="spec-pill condition">${item.estado}</span>` : ''}
            ${item.almacenamiento ? `<span class="spec-pill storage">💾 ${item.almacenamiento}</span>` : ''}
            ${item.bateria_salud ? `<span class="spec-pill battery">⚡ ${item.bateria_salud}</span>` : ''}
          </div>

          <div class="card-footer">
            <span class="card-price" style="${isAgotado ? 'color: var(--text-muted);' : ''}">${formattedPrice}</span>
            <span class="btn btn-secondary btn-sm">${isAgotado ? 'Ver detalles' : 'Ver equipo'}</span>
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
    modalBrand.innerHTML = `${item.marca} ${item.badge ? `<span class="badge badge-highlight" style="margin-left: 6px; font-size: 0.65rem;">${item.badge}</span>` : ''}`;
  }
  if (modalTitle) modalTitle.textContent = item.nombre;
  if (modalPrice) {
    modalPrice.textContent = formattedPrice;
    modalPrice.style.color = isAgotado ? "var(--text-muted)" : "var(--accent-red)";
  }
  if (modalCondition) modalCondition.textContent = item.estado || "Garantizado";
  if (modalStorage) modalStorage.textContent = item.almacenamiento || "—";
  if (modalBattery) modalBattery.textContent = item.bateria_salud || "—";
  if (modalDesc) modalDesc.textContent = item.descripcion || "Equipo testeado y garantizado con entrega inmediata.";

  // BOTÓN COMPRAR WHATSAPP
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
          <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.23 8.23 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24m4.52 11.66c-.19.53-1.09 1.04-1.54 1.1-.42.06-.97.09-2.79-.66-2.33-.96-3.83-3.34-3.95-3.5-.12-.15-.95-1.26-.95-2.4 0-1.15.6-1.71.82-1.94.21-.23.47-.29.62-.29.16 0 .31.01.45.01.14 0 .34-.05.53.4.19.46.66 1.6.72 1.72.06.12.1.26.02.42-.08.16-.12.26-.24.4-.12.14-.25.31-.36.42-.12.12-.24.25-.1.5.14.24.62 1.02 1.33 1.65.91.81 1.68 1.06 1.92 1.18.24.12.38.1.52-.06.14-.16.6-.7.76-.94.16-.24.32-.2.53-.12.21.08 1.33.63 1.56.74.23.12.38.17.44.27.06.1.06.58-.13 1.11z"/>
        </svg>
        <span>Comprar por WhatsApp</span>
      `;
      
      const waText = encodeURIComponent(`Hola GX Store 🇪🇨, me interesa comprar el ${item.marca} ${item.nombre} (${item.almacenamiento || ''}) publicado a ${formattedPrice}. ¿Sigue disponible?`);
      modalWaBtn.removeAttribute("href");
      
      modalWaBtn.onclick = (e) => {
        e.preventDefault();
        fetch(`${API_URL}/productos/${item.id}/clic-whatsapp`, { method: "POST" })
          .catch(() => {})
          .finally(() => {
            window.open(`https://wa.me/${globalStoreConfig.whatsapp}?text=${waText}`, "_blank");
          });
      };
    }
  }

  // BOTÓN DE COMPARTIR NATIVO (WEB SHARE API)
  if (modalShareBtn) {
    modalShareBtn.onclick = async (e) => {
      e.stopPropagation();
      const shareUrl = window.location.href;
      const shareData = {
        title: `${item.marca} ${item.nombre} | GX STORE`,
        text: `Mira este ${item.marca} ${item.nombre} (${item.almacenamiento || ''}) en GX Store por solo ${formattedPrice}:`,
        url: shareUrl
      };

      if (navigator.share) {
        try {
          await navigator.share(shareData);
        } catch (err) {
          if (err.name !== 'AbortError') copyToClipboard(shareUrl);
        }
      } else {
        copyToClipboard(shareUrl);
      }
    };
  }

  if (productModal) productModal.style.display = "flex";
};

function copyToClipboard(url) {
  navigator.clipboard.writeText(url).then(() => {
    alert(`¡Enlace copiado al portapapeles!\n${url}`);
  }).catch(() => {
    prompt("Copia este enlace:", url);
  });
}

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

// SWIPE TÁCTIL PARA CELULARES EN EL MODAL
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

// ACCESOS POR TECLADO
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