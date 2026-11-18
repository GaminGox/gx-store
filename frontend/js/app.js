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
  mensaje_anuncio: "Smartphones seminuevos y sellados garantizados con fotos 100% reales y envíos seguros a todo el Ecuador.",
  promo_flash_activo: false,
  promo_flash_texto: "⚡ ¡OFERTA FLASH! Envíos GRATIS a todo el Ecuador comprando hoy.",
  express_apple: [],
  express_samsung: []
};

// DOM
const searchInput = document.getElementById("searchInput");
const brandFilter = document.getElementById("brandFilter");
const productsGrid = document.getElementById("productsGrid");
const loading = document.getElementById("loading");

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
  const promoBar = document.querySelector(".flash-promo-bar");
  if (promoBar) promoBar.style.display = "none";

  try {
    const res = await fetch(`${API_URL}/configuracion`);
    if (res.ok) {
      globalStoreConfig = await res.json();
      applyConfigToDOM();
      renderExpressCatalog(); // Construye el catálogo con los datos de la BD
    }
  } catch (error) {
    console.warn("Usando configuración local por defecto.");
  }
}

// 2. APLICAR CONFIGURACIÓN AL DOM
function applyConfigToDOM() {
  const heroDesc = document.querySelector(".hero p");
  if (heroDesc) heroDesc.textContent = globalStoreConfig.mensaje_anuncio;

  const promoBar = document.querySelector(".flash-promo-bar");
  if (promoBar) {
    if (globalStoreConfig.promo_flash_activo) {
      promoBar.style.display = "block";
      const promoText = promoBar.querySelector("p");
      if (promoText && globalStoreConfig.promo_flash_texto) {
        promoText.textContent = globalStoreConfig.promo_flash_texto;
      }
    } else {
      promoBar.style.display = "none";
    }
  }

  document.querySelectorAll('a.whatsapp, a.btn-whatsapp-large, .social-circle-btn.whatsapp').forEach(el => {
    if (el.id !== "modalWaBtn" && !el.classList.contains('floating-whatsapp') && !el.closest('#expressCatalogModal')) { 
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
    if (priorityA !== priorityB) return priorityA - priorityB;
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
    modalPrice.style.color = isAgotado ? "var(--text-muted)" : "var(--accent-green)";
  }
  if (modalCondition) modalCondition.textContent = item.estado || "Garantizado";
  if (modalStorage) modalStorage.textContent = item.almacenamiento || "—";
  if (modalBattery) modalBattery.textContent = item.bateria_salud || "—";
  if (modalDesc) modalDesc.textContent = item.descripcion || "Equipo testeado y garantizado con entrega inmediata.";

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

  const expressModal = document.getElementById("expressCatalogModal");
  if (expressModal && expressModal.style.display === "flex" && e.key === "Escape") {
    expressModal.style.display = "none";
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

// ==========================================
// RENDERIZADO DINÁMICO DE PRECIOS REFERENCIALES
// ==========================================
function renderExpressCatalog() {
  const expressContainer = document.querySelector('.express-lists-grid');
  if (!expressContainer) return;

  const appleData = globalStoreConfig.express_apple || [];
  const samsungData = globalStoreConfig.express_samsung || [];

  if (appleData.length === 0 && samsungData.length === 0) {
    expressContainer.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">La lista de precios referenciales se está actualizando. Por favor revisa más tarde.</p>`;
    return;
  }

  const appleSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: -2px; margin-right: 4px;"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.96 6.32c.68-.83 1.14-1.98 1.01-3.13-.98.04-2.16.65-2.86 1.48-.63.73-1.18 1.9-1.03 3.02 1.09.08 2.2-.55 2.88-1.37z"/></svg>`;
  const samsungSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px; margin-right: 4px;"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>`;

  const buildColumnHTML = (title, iconHtml, color, data) => {
    if (!data || data.length === 0) return '';
    
    const seriesGrouped = data.reduce((acc, item) => {
      if (!acc[item.serie]) acc[item.serie] = [];
      acc[item.serie].push(item);
      return acc;
    }, {});

    let html = `
      <div class="brand-list-col">
        <h3 class="brand-list-title" style="color: ${color};">${iconHtml}${title}</h3>
    `;

    for (const serie in seriesGrouped) {
      html += `<div class="series-group"><div class="series-name">${serie}</div>`;
      seriesGrouped[serie].forEach(item => {
        const waMsg = encodeURIComponent(`Hola GX Store 🇪🇨, vi su lista de precios referenciales. Me interesa cotizar el ${item.modelo} ($${item.precio}). ¿Tienen disponible?`);
        const waUrl = `https://wa.me/${globalStoreConfig.whatsapp}?text=${waMsg}`;
        html += `
          <a href="${waUrl}" target="_blank" rel="noopener" class="price-row price-row-link" title="Cotizar ${item.modelo} por WhatsApp">
            <span>${item.modelo}</span>
            <span class="price-tag">$${item.precio}</span>
          </a>
        `;
      });
      html += `</div>`;
    }
    html += `</div>`;
    return html;
  };

  expressContainer.innerHTML = 
    buildColumnHTML('APPLE iPHONE', appleSvg, 'var(--text-main)', appleData) + 
    buildColumnHTML('SAMSUNG GALAXY', samsungSvg, '#60a5fa', samsungData);
}

// ==========================================
// LÓGICA DEL MODAL EXPRESS (AL CARGAR LA PÁGINA)
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
  await fetchStoreConfig();
  fetchProducts();

  const expressCatalogModal = document.getElementById('expressCatalogModal');
  const closeExpressModalBtn = document.getElementById('closeExpressModalBtn');
  const closeExpressBottomBtn = document.getElementById('closeExpressBottomBtn');

  const closeExpress = () => {
    if (expressCatalogModal) expressCatalogModal.style.display = 'none';
  };

  // No abrir el modal si el usuario entró con un link directo a un producto
  const params = new URLSearchParams(window.location.search);
  const hasDeepLink = params.has("p") || params.has("id");

  if (expressCatalogModal && !hasDeepLink) {
    setTimeout(() => {
      expressCatalogModal.style.display = 'flex';
    }, 2000);
  }

  if (closeExpressModalBtn) {
    closeExpressModalBtn.addEventListener('click', closeExpress);
  }

  if (closeExpressBottomBtn) {
    closeExpressBottomBtn.addEventListener('click', closeExpress);
  }

  window.addEventListener('click', (e) => {
    if (e.target === expressCatalogModal) {
      closeExpress();
    }
  });
});