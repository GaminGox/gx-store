const API_URL = "https://storegx-api.onrender.com/api";
const BACKEND_BASE = "https://storegx-api.onrender.com";

let inventario = [];

const loginSection = document.getElementById("loginSection");
const dashboardSection = document.getElementById("dashboardSection");
const navUserActions = document.getElementById("navUserActions");
const loginForm = document.getElementById("loginForm");
const productForm = document.getElementById("productForm");
const btnLogout = document.getElementById("btnLogout");
const btnSubmitProduct = document.getElementById("btnSubmitProduct");
const inventoryTableBody = document.getElementById("inventoryTableBody");
const toast = document.getElementById("toast");

// Elementos de edición
const formCard = document.getElementById("formCard");
const formTitle = document.getElementById("formTitle");
const editModeIndicator = document.getElementById("editModeIndicator");
const btnCancelEdit = document.getElementById("btnCancelEdit");
const pId = document.getElementById("p_id");
const uploadLabel = document.getElementById("uploadLabel");

// Multi-preview
const pImagenes = document.getElementById("p_imagenes");
const previewsContainer = document.getElementById("previewsContainer");
const uploadPrompt = document.getElementById("uploadPrompt");

pImagenes.addEventListener("change", function () {
  const files = Array.from(this.files);
  previewsContainer.innerHTML = "";
  
  if (files.length > 0) {
    uploadPrompt.textContent = `${files.length} nueva(s) foto(s) seleccionada(s) (Clic para cambiar)`;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = function (e) {
        const img = document.createElement("img");
        img.src = e.target.result;
        img.className = "preview-item";
        previewsContainer.appendChild(img);
      };
      reader.readAsDataURL(file);
    });
  } else {
    uploadPrompt.textContent = "Haz clic para seleccionar una o varias fotos del celular";
  }
});

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.style.borderColor = isError ? "var(--danger)" : "var(--accent-red)";
  toast.style.display = "block";
  setTimeout(() => {
    toast.style.display = "none";
  }, 3500);
}

function getToken() {
  return localStorage.getItem("gx_token");
}

function checkAuthState() {
  const token = getToken();
  if (token) {
    loginSection.style.display = "none";
    dashboardSection.style.display = "block";
    navUserActions.style.display = "flex";
    loadAdminInventory();
  } else {
    loginSection.style.display = "flex";
    dashboardSection.style.display = "none";
    navUserActions.style.display = "none";
  }
}

// LOGIN
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const usernameInput = document.getElementById("username").value.trim();
  const passwordInput = document.getElementById("password").value;

  const formData = new URLSearchParams();
  formData.append("username", usernameInput);
  formData.append("password", passwordInput);

  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData
    });

    if (!res.ok) throw new Error("Usuario o contraseña incorrectos");

    const data = await res.json();
    localStorage.setItem("gx_token", data.access_token);
    loginForm.reset();
    showToast("Bienvenido a GX Store Admin");
    checkAuthState();
  } catch (error) {
    showToast(error.message, true);
  }
});

// LOGOUT
btnLogout.addEventListener("click", () => {
  localStorage.removeItem("gx_token");
  checkAuthState();
  showToast("Sesión cerrada");
});

// INVENTARIO
async function loadAdminInventory() {
  try {
    const res = await fetch(`${API_URL}/productos`);
    if (!res.ok) throw new Error("Error al cargar inventario");
    inventario = await res.json();
    renderTable(inventario);
  } catch (error) {
    showToast(error.message, true);
  }
}

function renderTable(items) {
  if (items.length === 0) {
    inventoryTableBody.innerHTML = `<tr><td colspan="11" style="text-align:center; color: var(--text-muted);">No hay celulares registrados.</td></tr>`;
    return;
  }

  inventoryTableBody.innerHTML = items.map(p => {
    const firstImg = p.imagenes && p.imagenes.length > 0 ? p.imagenes[0] : '';
    const imgPath = firstImg.startsWith("http") ? firstImg : `${BACKEND_BASE}${firstImg}`;
    const formattedPrice = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(p.precio);
    const cantFotos = p.imagenes ? p.imagenes.length : 0;

    return `
      <tr>
        <td><img src="${imgPath}" class="table-thumb" alt="${p.nombre}"></td>
        <td><strong>${p.nombre}</strong></td>
        <td>${p.marca}</td>
        <td><span class="badge badge-storage">${p.almacenamiento || '—'}</span></td>
        <td style="color: var(--accent-red); font-weight:800;">${formattedPrice}</td>
        <td>${p.badge ? `<span class="badge" style="background:rgba(229,9,20,0.2); color:#ff4d58; border:1px solid rgba(229,9,20,0.4);">${p.badge}</span>` : '—'}</td>
        <td><span class="badge" style="background:#202028;">${cantFotos} fotos</span></td>
        <td>${p.estado}</td>
        <td>${p.bateria_salud || '—'}</td>
        <td>
          <span class="status-dot ${p.disponible ? 'status-online' : 'status-offline'}"></span>
          ${p.disponible ? 'Activo' : 'Pausado'}
        </td>
        <td>
          <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
            <button onclick="editProduct(${p.id})" class="btn btn-secondary btn-sm">
              Editar
            </button>
            <button onclick="toggleAvailability(${p.id})" class="btn btn-secondary btn-sm">
              ${p.disponible ? 'Pausar' : 'Activar'}
            </button>
            <button onclick="deleteProduct(${p.id})" class="btn btn-danger btn-sm">
              Borrar
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

// EDITAR PRODUCTO (CARGAR EN FORMULARIO)
window.editProduct = function(id) {
  const item = inventario.find(p => p.id === id);
  if (!item) return;

  pId.value = item.id;
  document.getElementById("p_nombre").value = item.nombre;
  document.getElementById("p_marca").value = item.marca;
  document.getElementById("p_almacenamiento").value = item.almacenamiento || "";
  document.getElementById("p_precio").value = item.precio;
  document.getElementById("p_estado").value = item.estado;
  document.getElementById("p_bateria").value = item.bateria_salud || "";
  document.getElementById("p_badge").value = item.badge || "";
  document.getElementById("p_descripcion").value = item.descripcion || "";

  formTitle.textContent = "Editar Celular";
  btnSubmitProduct.textContent = "Actualizar Cambios en GX Store";
  editModeIndicator.style.display = "flex";
  uploadLabel.textContent = "Reemplazar Fotografías (Opcional)";
  uploadPrompt.textContent = "Deja vacío para conservar las fotos actuales, o sube nuevas para reemplazarlas";

  // Previsualizar fotos actuales
  previewsContainer.innerHTML = "";
  if (item.imagenes) {
    item.imagenes.forEach(url => {
      const fullUrl = url.startsWith("http") ? url : `${BACKEND_BASE}${url}`;
      const img = document.createElement("img");
      img.src = fullUrl;
      img.className = "preview-item";
      previewsContainer.appendChild(img);
    });
  }

  formCard.scrollIntoView({ behavior: "smooth" });
};

// CANCELAR EDICIÓN
btnCancelEdit.addEventListener("click", () => {
  resetFormState();
});

function resetFormState() {
  productForm.reset();
  pId.value = "";
  formTitle.textContent = "Ingresar Celular al Catálogo";
  btnSubmitProduct.textContent = "Guardar y Publicar en GX Store";
  editModeIndicator.style.display = "none";
  uploadLabel.textContent = "Fotografías del Celular *";
  uploadPrompt.textContent = "Haz clic para seleccionar una o varias fotos del celular";
  previewsContainer.innerHTML = "";
}

// GUARDAR O ACTUALIZAR
productForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const token = getToken();
  if (!token) return checkAuthState();

  const isEditing = Boolean(pId.value);
  const files = pImagenes.files;

  if (!isEditing && files.length === 0) {
    showToast("Debes seleccionar al menos una foto para el nuevo celular", true);
    return;
  }

  btnSubmitProduct.disabled = true;
  btnSubmitProduct.textContent = isEditing ? "Actualizando producto..." : "Subiendo y optimizando...";

  const formData = new FormData();
  formData.append("nombre", document.getElementById("p_nombre").value);
  formData.append("marca", document.getElementById("p_marca").value);
  formData.append("almacenamiento", document.getElementById("p_almacenamiento").value);
  formData.append("precio", document.getElementById("p_precio").value);
  formData.append("estado", document.getElementById("p_estado").value);
  formData.append("bateria_salud", document.getElementById("p_bateria").value);
  formData.append("badge", document.getElementById("p_badge")?.value || "");
  formData.append("descripcion", document.getElementById("p_descripcion").value);

  for (let i = 0; i < files.length; i++) {
    formData.append("imagenes", files[i]);
  }

  const endpoint = isEditing ? `${API_URL}/productos/${pId.value}` : `${API_URL}/productos`;
  const method = isEditing ? "PUT" : "POST";

  try {
    const res = await fetch(endpoint, {
      method: method,
      headers: { "Authorization": `Bearer ${token}` },
      body: formData
    });

    if (res.status === 401) {
      localStorage.removeItem("gx_token");
      checkAuthState();
      throw new Error("Sesión expirada");
    }

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Error al procesar la solicitud");
    }

    resetFormState();
    showToast(isEditing ? "Celular actualizado correctamente" : "Celular publicado con éxito en GX Store");
    loadAdminInventory();
  } catch (error) {
    showToast(error.message, true);
  } finally {
    btnSubmitProduct.disabled = false;
  }
});

// ALTERNAR ESTADO
window.toggleAvailability = async function(id) {
  const token = getToken();
  try {
    const res = await fetch(`${API_URL}/productos/${id}/toggle`, {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Error al cambiar estado");
    loadAdminInventory();
  } catch (error) {
    showToast(error.message, true);
  }
};

// ELIMINAR
window.deleteProduct = async function(id) {
  if (!confirm("¿Deseas eliminar definitivamente este celular y todas sus fotos?")) return;
  const token = getToken();
  try {
    const res = await fetch(`${API_URL}/productos/${id}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("No se pudo eliminar");
    showToast("Celular eliminado del catálogo");
    if (pId.value === String(id)) resetFormState();
    loadAdminInventory();
  } catch (error) {
    showToast(error.message, true);
  }
};

document.addEventListener("DOMContentLoaded", checkAuthState);