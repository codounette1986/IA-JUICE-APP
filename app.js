const STORAGE_KEY = "iajuice-pwa-state-v2";
const SUPABASE_CONFIG = window.IAJUICE_SUPABASE || {};
const SUPABASE_TABLES = ["products", "clients", "production", "sales"];
let remoteSyncTimer = null;
let remoteSyncInFlight = false;
const clone = (value) =>
  typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
const makeId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const TEXT_REPAIRS = [
  ["DonnÃ©es", "Données"],
  ["donnÃ©es", "données"],
  ["lâ€™", "l’"],
  ["â€™", "’"],
  ["tÃ©lÃ©phone", "téléphone"],
  ["opÃ©rationnel", "opérationnel"],
  ["dÃ©mo", "démo"],
  ["RÃ©", "Ré"],
  ["CrÃ©", "Cré"],
  ["bÃ©nÃ©fice", "bénéfice"],
  ["BÃ©nÃ©fice", "Bénéfice"],
  ["pÃ©riode", "période"],
  ["PÃ©riode", "Période"],
  ["dâ€™", "d’"],
  ["rentabilitÃ©", "rentabilité"],
  ["catÃ©gorie", "catégorie"],
  ["CatÃ©gorie", "Catégorie"],
  ["coÃ»t", "coût"],
  ["CoÃ»t", "Coût"],
  ["souhaitÃ©e", "souhaitée"],
  ["DÃ©tail", "Détail"],
  ["Ã€", "À"],
  ["Ã‰", "É"],
  ["Ã©", "é"],
  ["Ã¨", "è"],
  ["Ãª", "ê"],
  ["Ã ", "à"],
  ["Ã ", "à"],
  ["Ã¹", "ù"],
  ["Ã»", "û"],
  ["Ã´", "ô"],
  ["Ã¢", "â"],
  ["Ã§", "ç"],
  ["PayÃ©", "Payé"],
  ["ImpayÃ©", "Impayé"],
  ["QuantitÃ©", "Quantité"],
  ["QtÃ©", "Qté"],
  ["Ãªtre", "être"],
  ["Ã©gale", "égale"],
  ["sÃ©lectionnÃ©e", "sélectionnée"],
  ["enregistrÃ©", "enregistré"],
  ["mis Ã  jour", "mis à jour"],
  ["appliquÃ©", "appliqué"],
  ["effacÃ©", "effacé"],
  ["activÃ©", "activé"],
  ["inactivÃ©", "inactivé"],
  ["Ã‰lÃ©ment", "Élément"],
  ["annÃ©e", "année"],
  ["unitÃ©s", "unités"],
  ["gÃ©nÃ©rÃ©", "généré"],
  ["terminÃ©", "terminé"],
  ["DemandÃ©", "Demandé"],
  ["supprimÃ©", "supprimé"],
  ["rÃ©current", "récurrent"],
  ["Ã‰vÃ¨nement", "Évènement"],
  ["payÃ©es", "payées"],
  ["TÃ©lÃ©phone", "Téléphone"],
  ["dÃ©but", "début"],
  ["â€”", "—"],
];

function repairText(value) {
  if (typeof value !== "string") return value;
  return TEXT_REPAIRS.reduce((text, [from, to]) => text.split(from).join(to), value);
}

function repairData(value) {
  if (Array.isArray(value)) return value.map(repairData);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, repairData(entry)]));
  }
  return repairText(value);
}

function repairDomText(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    node.textContent = repairText(node.textContent || "");
    node = walker.nextNode();
  }
  root.querySelectorAll("input[placeholder], textarea[placeholder]").forEach((element) => {
    element.placeholder = repairText(element.placeholder || "");
  });
}

const emptyState = {
  products: [],
  clients: [],
  production: [],
  sales: [],
  ui: {
    dashboardFilter: { from: "", to: "" },
    pricingCategory: "SOLO",
    tableSorts: {},
    tableSearches: {},
    sharedPackaging: { bottleGMPrice: 0, labelGMPrice: 0, bottlePMPrice: 0, labelPMPrice: 0 },
  },
};

const demoState = {
  products: [
    {
      id: makeId(),
      name: "Solo 1 - PM",
      code: "SL1PM",
      category: "SOLO",
      size: "PM",
      status: "Actif",
      productType: "simple",
      description: "Boisson au ditakh",
      defaultPrice: 675,
      defaultCost: 216,
      packSize: 0,
      components: [],
      costItems: [
        { label: "Fruit", amount: 140 },
        { label: "Bouteille", amount: 56 },
        { label: "Etiquette", amount: 20 },
      ],
    },
    {
      id: makeId(),
      name: "Duo 1 - PM",
      code: "D1PM",
      category: "DUO",
      size: "PM",
      status: "Actif",
      productType: "simple",
      description: "Boisson tamarin et ananas",
      defaultPrice: 500,
      defaultCost: 199,
      packSize: 0,
      components: [],
      costItems: [
        { label: "Fruit", amount: 120 },
        { label: "Bouteille", amount: 59 },
        { label: "Etiquette", amount: 20 },
      ],
    },
    {
      id: makeId(),
      name: "Pack Mix 4",
      code: "PK4",
      category: "PACK",
      size: "GM",
      status: "Actif",
      productType: "pack",
      description: "Pack mix 4 bouteilles",
      defaultPrice: 2600,
      defaultCost: 0,
      packSize: 4,
      components: [],
      costItems: [{ label: "Emballage", amount: 120 }],
    },
  ],
  clients: [
    { id: makeId(), name: "ANNA CGI", phone: "", type: "Particulier", city: "", channel: "WhatsApp", notes: "" },
    { id: makeId(), name: "AWA DIA", phone: "", type: "Particulier", city: "", channel: "Direct", notes: "" },
    { id: makeId(), name: "Serigne Modou", phone: "", type: "Particulier", city: "Dakar", channel: "WhatsApp", notes: "Client rÃ©current" },
  ],
  production: [],
  sales: [],
  ui: {
    dashboardFilter: { from: "", to: "" },
    pricingCategory: "SOLO",
    tableSorts: {},
    tableSearches: {},
    sharedPackaging: { bottleGMPrice: 0, labelGMPrice: 0, bottlePMPrice: 0, labelPMPrice: 0 },
  },
};

demoState.products[2].components = [
  { productId: demoState.products[0].id, quantity: 2 },
  { productId: demoState.products[1].id, quantity: 2 },
];
demoState.products[2].defaultCost = computePackCostFromComponents(demoState.products[2], demoState.products);

demoState.production = [
  { id: makeId(), date: "2026-01-15", lot: "PROD 01. 15 Jan", event: "Magal", productId: demoState.products[0].id, quantity: 40, unitCost: 216 },
  { id: makeId(), date: "2026-01-15", lot: "PROD 01. 15 Jan", event: "Magal", productId: demoState.products[1].id, quantity: 40, unitCost: 199 },
];

demoState.sales = [
  { id: makeId(), date: "2026-01-16", clientId: demoState.clients[2].id, productId: demoState.products[0].id, quantity: 10, unitPrice: 675, status: "PayÃ©", amountPaid: 6750, saleComponents: [] },
  { id: makeId(), date: "2026-01-16", clientId: demoState.clients[2].id, productId: demoState.products[2].id, quantity: 3, unitPrice: 2600, status: "Partiel", amountPaid: 4000, saleComponents: clone(demoState.products[2].components) },
];

let state = loadState();
let deferredPrompt = null;
let toastTimer = null;

const viewTitle = document.querySelector("#viewTitle");
const toast = document.querySelector("#toast");

const forms = {
  catalogueForm: document.querySelector("#catalogueForm"),
  clientForm: document.querySelector("#clientForm"),
  productionForm: document.querySelector("#productionForm"),
  saleForm: document.querySelector("#saleForm"),
  pricingForm: document.querySelector("#pricingForm"),
  dashboardFilterForm: document.querySelector("#dashboardFilterForm"),
};

const toggleProductFormButton = document.querySelector("#toggleProductForm");
const toggleClientFormButton = document.querySelector("#toggleClientForm");
const toggleProductionFormButton = document.querySelector("#toggleProductionForm");
const toggleSaleFormButton = document.querySelector("#toggleSaleForm");
const productModal = document.querySelector("#productModal");
const clientModal = document.querySelector("#clientModal");
const productionModal = document.querySelector("#productionModal");
const saleModal = document.querySelector("#saleModal");
const productModalTitle = document.querySelector("#productModalTitle");
const clientModalTitle = document.querySelector("#clientModalTitle");
const productionModalTitle = document.querySelector("#productionModalTitle");
const saleModalTitle = document.querySelector("#saleModalTitle");
const closeProductModalButton = document.querySelector("#closeProductModal");
const closeClientModalButton = document.querySelector("#closeClientModal");
const closeProductionModalButton = document.querySelector("#closeProductionModal");
const closeSaleModalButton = document.querySelector("#closeSaleModal");
const packSizeField = document.querySelector("#packSizeField");
const knownProductListField = document.querySelector("#knownProductListField");
const knownProductsCheckboxes = document.querySelector("#knownProductsCheckboxes");
const knownProductsPicker = document.querySelector("#knownProductsPicker");
const knownProductsTotal = document.querySelector("#knownProductsTotal");
const salePackComponentsSection = document.querySelector("#salePackComponentsSection");
const saleProductsCheckboxes = document.querySelector("#saleProductsCheckboxes");
const saleProductsTotal = document.querySelector("#saleProductsTotal");
const saleComponentsTextField = document.querySelector("#saleComponentsTextField");
const amountPaidField = document.querySelector("#amountPaidField");
const pricingItemsTable = document.querySelector("#pricingItemsTable");
const pricingMetrics = document.querySelector("#pricingMetrics");
const addPricingItemButton = document.querySelector("#addPricingItem");
const packPricingBlock = document.querySelector("#packPricingBlock");
const packPricingTable = document.querySelector("#packPricingTable");
const pricingPmProductField = document.querySelector("#pricingPmProductField");
const pricingProductionBlock = document.querySelector("#pricingProductionBlock");
const pricingJuiceBlock = document.querySelector("#pricingJuiceBlock");
const pricingPackagingBlock = document.querySelector("#pricingPackagingBlock");
const pricingResultBlock = document.querySelector("#pricingResultBlock");

document.querySelectorAll(".nav-link").forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.view));
});

document.querySelectorAll("[data-clear-form]").forEach((button) => {
  button.addEventListener("click", () => clearForm(forms[button.dataset.clearForm]));
});

forms.catalogueForm.addEventListener("submit", onSubmitProduct);
forms.clientForm.addEventListener("submit", onSubmitClient);
forms.productionForm.addEventListener("submit", onSubmitProduction);
forms.saleForm.addEventListener("submit", onSubmitSale);
forms.pricingForm.addEventListener("submit", onSubmitPricing);
forms.dashboardFilterForm.addEventListener("submit", onSubmitDashboardFilter);

forms.catalogueForm.elements.category.addEventListener("change", syncProductTypeFromCategory);
forms.catalogueForm.elements.size.addEventListener("change", () => {
  renderKnownProductsCheckboxes();
  refreshKnownProductsCheckboxesState();
});
forms.catalogueForm.elements.productType.addEventListener("change", syncCategoryFromProductType);
forms.catalogueForm.elements.knownProductList.addEventListener("change", updateProductFormVisibility);
forms.catalogueForm.elements.packSize.addEventListener("input", refreshKnownProductsCheckboxesState);
forms.saleForm.elements.productId.addEventListener("change", hydrateSaleComponentsFromProduct);
forms.saleForm.elements.quantity.addEventListener("input", refreshSaleProductsCheckboxesState);
forms.saleForm.elements.status.addEventListener("change", updateSalePaymentVisibility);
forms.pricingForm.elements.productId.addEventListener("change", () => {
  syncPricingPmSelect();
  if (forms.pricingForm.elements.productId.value) loadPricingForm(forms.pricingForm.elements.productId.value);
});
forms.pricingForm.addEventListener("input", refreshPricingPreview);
forms.pricingForm.addEventListener("change", refreshPricingPreview);
["bottleGMPrice", "labelGMPrice", "bottlePMPrice", "labelPMPrice"].forEach((fieldName) => {
  forms.pricingForm.elements[fieldName].addEventListener("change", () => updateSharedPackagingFromForm(true));
});

toggleProductFormButton.addEventListener("click", () => {
  openProductModal();
});
toggleClientFormButton.addEventListener("click", () => openClientModal());
toggleProductionFormButton.addEventListener("click", () => openProductionModal());
toggleSaleFormButton.addEventListener("click", () => openSaleModal());

closeProductModalButton.addEventListener("click", closeProductModal);
closeClientModalButton.addEventListener("click", closeClientModal);
closeProductionModalButton.addEventListener("click", closeProductionModal);
closeSaleModalButton.addEventListener("click", closeSaleModal);
document.querySelectorAll("[data-close-product-modal]").forEach((element) => {
  element.addEventListener("click", closeProductModal);
});
document.querySelectorAll("[data-close-client-modal]").forEach((element) => {
  element.addEventListener("click", closeClientModal);
});
document.querySelectorAll("[data-close-production-modal]").forEach((element) => {
  element.addEventListener("click", closeProductionModal);
});
document.querySelectorAll("[data-close-sale-modal]").forEach((element) => {
  element.addEventListener("click", closeSaleModal);
});

document.querySelector("#loadPricingFromProduct").addEventListener("click", loadPricingFormFromSelectedProduct);
if (addPricingItemButton) addPricingItemButton.addEventListener("click", () => addPricingItemRow());
document.querySelector("#clearDashboardFilter").addEventListener("click", clearDashboardFilter);

const exportButton = document.querySelector("#exportButton");
const exportExcelButton = document.querySelector("#exportExcelButton");
const importExcelInput = document.querySelector("#importExcelInput");
const installButton = document.querySelector("#installButton");
const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isAndroidDevice = /Android/i.test(navigator.userAgent);
const isStandaloneMode = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

if (exportButton) exportButton.addEventListener("click", exportState);
if (exportExcelButton) exportExcelButton.addEventListener("click", exportExcelWorkbook);
if (importExcelInput) importExcelInput.addEventListener("change", importExcelWorkbook);

if (isIosDevice) document.body.classList.add("is-ios");
if (isAndroidDevice) document.body.classList.add("is-android");
if (isStandaloneMode) document.body.classList.add("is-standalone");

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event;
  if (installButton) installButton.hidden = false;
});

if (installButton) {
  installButton.addEventListener("click", async () => {
    if (isIosDevice && !deferredPrompt) {
      showToast("Sur iPhone: ouvrez Partager puis Ajouter à l'écran d'accueil.");
      return;
    }
    if (isAndroidDevice && !deferredPrompt) {
      showToast("Sur Android: ouvrez le menu du navigateur puis Installer l'application.");
      return;
    }
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installButton.hidden = true;
  });
}

if (installButton && isIosDevice && !isStandaloneMode) {
  installButton.hidden = false;
}

if (location.protocol.startsWith("http") && "serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}

applyDefaultDates();
hydrateDashboardFilterForm();
render();
void initializeSupabaseSync();

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return clone(emptyState);
  try {
    return repairData({ ...clone(emptyState), ...JSON.parse(raw) });
  } catch {
    return clone(emptyState);
  }
}

function persist(options = {}) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (options.remote !== false) scheduleSupabaseSync();
}

function getTimestamp() {
  return new Date().toISOString();
}

function getSharedPackagingSettings() {
  return {
    bottleGMPrice: Number(state.ui?.sharedPackaging?.bottleGMPrice || 0),
    labelGMPrice: Number(state.ui?.sharedPackaging?.labelGMPrice || 0),
    bottlePMPrice: Number(state.ui?.sharedPackaging?.bottlePMPrice || 0),
    labelPMPrice: Number(state.ui?.sharedPackaging?.labelPMPrice || 0),
  };
}

function updateSharedPackagingFromForm(shouldPersist = false) {
  if (!forms.pricingForm) return;
  state.ui.sharedPackaging = {
    bottleGMPrice: Number(forms.pricingForm.elements.bottleGMPrice.value || 0),
    labelGMPrice: Number(forms.pricingForm.elements.labelGMPrice.value || 0),
    bottlePMPrice: Number(forms.pricingForm.elements.bottlePMPrice.value || 0),
    labelPMPrice: Number(forms.pricingForm.elements.labelPMPrice.value || 0),
  };
  if (shouldPersist) persist();
}

function syncPricingPackagingFields() {
  if (!forms.pricingForm) return;
  const sharedPackaging = getSharedPackagingSettings();
  forms.pricingForm.elements.bottleGMPrice.value = sharedPackaging.bottleGMPrice;
  forms.pricingForm.elements.labelGMPrice.value = sharedPackaging.labelGMPrice;
  forms.pricingForm.elements.bottlePMPrice.value = sharedPackaging.bottlePMPrice;
  forms.pricingForm.elements.labelPMPrice.value = sharedPackaging.labelPMPrice;
}

function touchRecord(payload, existing = null) {
  return {
    ...payload,
    updatedAt: getTimestamp(),
    createdAt: payload.createdAt || existing?.createdAt || getTimestamp(),
  };
}

function isSupabaseConfigured() {
  return Boolean(
    SUPABASE_CONFIG?.url &&
    SUPABASE_CONFIG?.anonKey &&
    !String(SUPABASE_CONFIG.url).includes("YOUR") &&
    !String(SUPABASE_CONFIG.anonKey).includes("YOUR"),
  );
}

function getSupabaseBaseUrl() {
  return String(SUPABASE_CONFIG.url || "").replace(/\/+$/, "");
}

function getSupabaseHeaders() {
  return {
    apikey: SUPABASE_CONFIG.anonKey,
    Authorization: `Bearer ${SUPABASE_CONFIG.anonKey}`,
    "Content-Type": "application/json",
  };
}

function getBusinessStatePayload() {
  return SUPABASE_TABLES.reduce((payload, key) => {
    payload[key] = clone(state[key] || []);
    return payload;
  }, {});
}

function hasBusinessData(payload) {
  return SUPABASE_TABLES.some((key) => Array.isArray(payload?.[key]) && payload[key].length > 0);
}

async function callSupabaseRpc(name, payload = {}) {
  const response = await fetch(`${getSupabaseBaseUrl()}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      ...getSupabaseHeaders(),
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Supabase RPC ${name} a échoué.`);
  }

  const rawText = await response.text();
  return rawText ? JSON.parse(rawText) : null;
}

async function deleteSupabaseRecord(collection, id) {
  const response = await fetch(
    `${getSupabaseBaseUrl()}/rest/v1/${collection}?id=eq.${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: {
        ...getSupabaseHeaders(),
        Prefer: "return=minimal",
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Suppression Supabase ${collection} impossible.`);
  }
}

function getDeletionBlocker(collection, id) {
  if (collection === "products") {
    const productionUsage = state.production.some((entry) => entry.productId === id);
    if (productionUsage) {
      return "Impossible de supprimer ce produit car il est utilisé dans la production.";
    }

    const salesUsage = state.sales.some(
      (sale) => sale.productId === id || (sale.saleComponents || []).some((component) => component.productId === id),
    );
    if (salesUsage) {
      return "Impossible de supprimer ce produit car il est utilisé dans les ventes.";
    }

    const packUsage = state.products.some((product) => (product.components || []).some((component) => component.productId === id));
    if (packUsage) {
      return "Impossible de supprimer ce produit car il est utilisé dans la composition d'un pack.";
    }
  }

  if (collection === "clients") {
    const salesUsage = state.sales.some((sale) => sale.clientId === id);
    if (salesUsage) {
      return "Impossible de supprimer ce client car il est utilisé dans les ventes.";
    }
  }

  return "";
}

function scheduleSupabaseSync() {
  if (!isSupabaseConfigured()) return;
  clearTimeout(remoteSyncTimer);
  remoteSyncTimer = setTimeout(() => {
    void syncStateToSupabase();
  }, 700);
}

async function syncStateToSupabase() {
  if (!isSupabaseConfigured() || remoteSyncInFlight) return;
  remoteSyncInFlight = true;
  try {
    await callSupabaseRpc("sync_app_state", { payload: getBusinessStatePayload() });
  } catch (error) {
    console.error("Erreur de synchronisation Supabase:", error);
    showToast("Synchronisation Supabase échouée.");
  } finally {
    remoteSyncInFlight = false;
  }
}

async function initializeSupabaseSync() {
  if (!isSupabaseConfigured()) return;
  try {
    const remoteState = repairData((await callSupabaseRpc("get_app_state")) || {});
    if (hasBusinessData(remoteState)) {
      state = {
        ...clone(emptyState),
        ...remoteState,
        ui: state.ui,
      };
      persist({ remote: false });
      render();
      return;
    }

    if (hasBusinessData(state)) {
      await syncStateToSupabase();
    }
  } catch (error) {
    console.error("Initialisation Supabase impossible:", error);
    showToast("Connexion Supabase impossible.");
  }
}

function clearForm(form) {
  form.reset();
  if (form.elements.id) form.elements.id.value = "";
  if (form === forms.saleForm) {
    form.elements.saleComponentsText.value = "";
    form.elements.amountPaid.value = "";
    clearSaleProductSelections();
    updateSalePackComponentsVisibility();
    updateSalePaymentVisibility();
  }
  if (form === forms.catalogueForm) {
    form.elements.productType.value = "simple";
    form.elements.packSize.value = "";
    form.elements.knownProductList.value = "yes";
  }
  if (form === forms.pricingForm) {
    syncPricingPackagingFields();
    renderPricingItemsTable([createEmptyPricingItem()]);
    refreshPricingPreview();
  }
  applyDefaultDates();
  hydrateSelects();
  updateProductFormVisibility();
}

function openProductModal(editMode = false) {
  if (!editMode) {
    clearForm(forms.catalogueForm);
    productModalTitle.textContent = "Créer un produit";
  }
  productModal.hidden = false;
}

function closeProductModal() {
  productModal.hidden = true;
  clearForm(forms.catalogueForm);
  productModalTitle.textContent = "Créer un produit";
}

function openClientModal(editMode = false) {
  if (!editMode) {
    clearForm(forms.clientForm);
    clientModalTitle.textContent = "Créer un client";
  }
  clientModal.hidden = false;
}

function closeClientModal() {
  clientModal.hidden = true;
  clearForm(forms.clientForm);
  clientModalTitle.textContent = "Créer un client";
}

function openProductionModal(editMode = false) {
  if (!editMode) {
    clearForm(forms.productionForm);
    productionModalTitle.textContent = "Créer un lot";
  }
  productionModal.hidden = false;
}

function closeProductionModal() {
  productionModal.hidden = true;
  clearForm(forms.productionForm);
  productionModalTitle.textContent = "Créer un lot";
}

function openSaleModal(editMode = false) {
  if (!editMode) {
    clearForm(forms.saleForm);
    saleModalTitle.textContent = "Créer une vente";
  }
  saleModal.hidden = false;
  updateSalePaymentVisibility();
}

function closeSaleModal() {
  saleModal.hidden = true;
  clearForm(forms.saleForm);
  saleModalTitle.textContent = "Créer une vente";
}

function applyDefaultDates() {
  const today = new Date().toISOString().slice(0, 10);
  ["productionForm", "saleForm"].forEach((formKey) => {
    const input = forms[formKey].elements.date;
    if (!input.value) input.value = today;
  });
}

function hydrateDashboardFilterForm() {
  forms.dashboardFilterForm.elements.from.value = state.ui.dashboardFilter.from || "";
  forms.dashboardFilterForm.elements.to.value = state.ui.dashboardFilter.to || "";
}

function switchView(view) {
  document.querySelectorAll(".nav-link").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  document.querySelectorAll(".view").forEach((section) => {
    section.classList.toggle("active", section.id === `${view}View`);
  });
  viewTitle.textContent = {
    dashboard: "Dashboard",
    catalogue: "Catalogue",
    clients: "Clients",
    production: "Production",
    ventes: "Ventes",
    stock: "Stock",
    pricing: "Pricing",
  }[view];
}

function render() {
  normalizeProducts();
  hydrateSelects();
  hydrateDashboardFilterForm();
  renderDashboard();
  renderProducts();
  renderClients();
  renderProduction();
  renderSales();
  renderStock();
  renderPricing();
  bindActions();
  bindPricingTabs();
  bindTableSorts();
  bindTableSearches();
  repairDomText(document.body);
}

function normalizeProducts() {
  state.products = state.products.map((product) => {
    const normalized = {
      productType: product.category === "PACK" ? "pack" : "simple",
      size: product.size || "",
      status: product.status || "Actif",
      packSize: 0,
      knownProductList: "yes",
      components: [],
      costItems: [],
      pricingDetails: null,
      linkedPmProductId: "",
      updatedAt: product.updatedAt || getTimestamp(),
      description: product.description || product.ingredients || "",
      ...product,
    };
    if (normalized.category === "PACK" || normalized.productType === "pack") {
      normalized.productType = "pack";
      if (normalized.knownProductList !== "yes") {
        normalized.components = [];
        normalized.defaultCost = resolveUnknownPackCost(normalized);
      }
      if (normalized.knownProductList === "yes") {
        normalized.defaultCost = computePackCost(normalized);
      }
    } else if (normalized.costItems.length) {
      normalized.defaultCost = computeCostItemsTotal(normalized.costItems);
    }
    return normalized;
  });
}

function hydrateSelects() {
  const activeProducts = state.products.filter((product) => product.status !== "Inactif");
  const productOptions = activeProducts
    .map((product) => `<option value="${product.id}">${escapeHtml(product.name)} (${escapeHtml(product.code)})</option>`)
    .join("");

  const simpleProductOptions = activeProducts
    .filter((product) => product.productType !== "pack")
    .map((product) => `<option value="${product.id}">${escapeHtml(product.name)} (${escapeHtml(product.code)})</option>`)
    .join("");

  const productionSelect = forms.productionForm.elements.productId;
  const currentProductionValue = productionSelect.value;
  productionSelect.innerHTML = `<option value="">Choisir un produit</option>${simpleProductOptions}`;
  productionSelect.value = currentProductionValue;

  [forms.saleForm.elements.productId, forms.pricingForm.elements.productId].forEach((select) => {
    const currentValue = select.value;
    select.innerHTML = `<option value="">Choisir un produit</option>${productOptions}`;
    select.value = currentValue;
  });

  const clientSelect = forms.saleForm.elements.clientId;
  const currentClientValue = clientSelect.value;
  clientSelect.innerHTML = `<option value="">Choisir un client</option>${state.clients
    .map((client) => `<option value="${client.id}">${escapeHtml(client.name)}</option>`)
    .join("")}`;
  clientSelect.value = currentClientValue;

  renderKnownProductsCheckboxes();
  renderSaleProductsCheckboxes();
}

function syncProductTypeFromCategory() {
  forms.catalogueForm.elements.productType.value =
    forms.catalogueForm.elements.category.value === "PACK" ? "pack" : "simple";
  updateProductFormVisibility();
}

function syncCategoryFromProductType() {
  if (forms.catalogueForm.elements.productType.value === "pack") {
    forms.catalogueForm.elements.category.value = "PACK";
  }
  updateProductFormVisibility();
}

function hydrateSaleComponentsFromProduct() {
  const product = findById("products", forms.saleForm.elements.productId.value);
  if (!product) {
    updateSalePackComponentsVisibility();
    return;
  }
  const text = product.knownProductList === "yes" ? stringifyComponents(product.components) : "";
  forms.saleForm.elements.saleComponentsText.value = product.productType === "pack" ? text : "";
  forms.saleForm.elements.saleComponentsText.required = false;
  if (product.productType === "pack" && product.knownProductList !== "yes") {
    clearSaleProductSelections();
  }
  updateSalePackComponentsVisibility();
  if (!forms.saleForm.elements.unitPrice.value) {
    forms.saleForm.elements.unitPrice.value = product.defaultPrice;
  }
  updateSalePaymentVisibility();
}

function updateSalePaymentVisibility() {
  const status = forms.saleForm.elements.status.value;
  const showAmountPaid = status === "Partiel";
  amountPaidField.hidden = !showAmountPaid;
  amountPaidField.style.display = showAmountPaid ? "" : "none";
  forms.saleForm.elements.amountPaid.required = showAmountPaid;
  forms.saleForm.elements.amountPaid.disabled = !showAmountPaid;
  if (status === "Payé") {
    const qty = Number(forms.saleForm.elements.quantity.value || 0);
    const unitPrice = Number(forms.saleForm.elements.unitPrice.value || 0);
    forms.saleForm.elements.amountPaid.value = qty * unitPrice || "";
  } else if (status === "Impayé") {
    forms.saleForm.elements.amountPaid.value = "";
  }
}

function updateSalePackComponentsVisibility() {
  const product = findById("products", forms.saleForm.elements.productId.value);
  const showUnknownPackPicker =
    product?.productType === "pack" && product?.knownProductList !== "yes";

  salePackComponentsSection.hidden = !showUnknownPackPicker;
  salePackComponentsSection.style.display = showUnknownPackPicker ? "" : "none";
  saleComponentsTextField.hidden = true;
  saleComponentsTextField.style.display = "none";
  forms.saleForm.elements.saleComponentsText.required = false;
  forms.saleForm.elements.saleComponentsText.disabled = true;

  if (!showUnknownPackPicker) {
    clearSaleProductSelections();
    saleProductsTotal.textContent = "";
    saleProductsTotal.className = "muted small";
    return;
  }

  renderSaleProductsCheckboxes();
  refreshSaleProductsCheckboxesState();
}

function updateProductFormVisibility() {
  const isPack = forms.catalogueForm.elements.productType.value === "pack";
  forms.catalogueForm.querySelectorAll(".pack-only").forEach((element) => {
    element.hidden = !isPack;
  });
  packSizeField.style.display = isPack ? "" : "none";
  forms.catalogueForm.elements.packSize.disabled = !isPack;
  forms.catalogueForm.elements.packSize.required = isPack;
  knownProductListField.style.display = isPack ? "" : "none";
  forms.catalogueForm.elements.knownProductList.disabled = !isPack;
  forms.catalogueForm.elements.knownProductList.required = isPack;

  if (!isPack) {
    knownProductsPicker.hidden = true;
    forms.catalogueForm.elements.packSize.value = "";
    clearKnownProductSelections();
    return;
  }

  knownProductsPicker.hidden = forms.catalogueForm.elements.knownProductList.value !== "yes";
  if (forms.catalogueForm.elements.knownProductList.value !== "yes") {
    clearKnownProductSelections();
  }
  refreshKnownProductsCheckboxesState();
}

function renderKnownProductsCheckboxes() {
  const currentQuantities = new Map(getSelectedKnownProductComponents().map((item) => [item.productId, item.quantity]));
  const targetSize = forms.catalogueForm.elements.size.value;
  knownProductsCheckboxes.innerHTML = state.products
    .filter((product) => product.productType !== "pack")
    .filter((product) => product.status !== "Inactif")
    .filter((product) => !targetSize || product.size === targetSize)
    .map(
      (product) => `
        <label class="checkbox-item">
          <input
            type="checkbox"
            name="knownProductSelection"
            value="${product.id}"
            ${currentQuantities.has(product.id) ? "checked" : ""}
          />
          <span class="checkbox-title">${escapeHtml(product.name)}</span>
          <span class="checkbox-meta">${escapeHtml(product.description || product.ingredients || product.code)}</span>
          <input
            class="checkbox-qty"
            type="number"
            name="knownProductQuantity"
            data-product-id="${product.id}"
            min="1"
            step="1"
            value="${currentQuantities.get(product.id) || 1}"
            ${currentQuantities.has(product.id) ? "" : "disabled"}
          />
        </label>`,
    )
    .join("");

  knownProductsCheckboxes.querySelectorAll('input[name="knownProductSelection"]').forEach((checkbox) => {
    checkbox.addEventListener("change", refreshKnownProductsCheckboxesState);
  });
  knownProductsCheckboxes.querySelectorAll('input[name="knownProductQuantity"]').forEach((input) => {
    input.addEventListener("input", refreshKnownProductsCheckboxesState);
  });
}

function refreshKnownProductsCheckboxesState() {
  const packSize = Number(forms.catalogueForm.elements.packSize.value) || 0;
  const checkboxes = Array.from(
    knownProductsCheckboxes.querySelectorAll('input[name="knownProductSelection"]'),
  );
  const selectedQty = getSelectedKnownProductComponents().reduce((sum, item) => sum + item.quantity, 0);

  checkboxes.forEach((checkbox) => {
    const qtyInput = knownProductsCheckboxes.querySelector(
      `input[name="knownProductQuantity"][data-product-id="${checkbox.value}"]`,
    );
    if (qtyInput) qtyInput.disabled = !checkbox.checked;
    checkbox.disabled = false;
    if (!checkbox.checked && packSize > 0 && selectedQty >= packSize) {
      checkbox.disabled = true;
    }
  });

  if (forms.catalogueForm.elements.productType.value !== "pack") {
    knownProductsTotal.textContent = "";
    knownProductsTotal.className = "muted small";
    return;
  }

  if (forms.catalogueForm.elements.knownProductList.value !== "yes") {
    knownProductsTotal.textContent = "";
    knownProductsTotal.className = "muted small";
    return;
  }

  knownProductsTotal.textContent = `Quantité sélectionnée: ${selectedQty} / ${packSize || 0}`;
  knownProductsTotal.className =
    selectedQty === packSize && packSize > 0
      ? "small status-ok"
      : "small status-error";
}

function getSelectedKnownProductIds() {
  return Array.from(
    knownProductsCheckboxes.querySelectorAll('input[name="knownProductSelection"]:checked'),
  ).map((checkbox) => checkbox.value);
}

function getSelectedKnownProductComponents() {
  return getSelectedKnownProductIds().map((productId) => {
    const qtyInput = knownProductsCheckboxes.querySelector(
      `input[name="knownProductQuantity"][data-product-id="${productId}"]`,
    );
    return {
      productId,
      quantity: Math.max(1, Number(qtyInput?.value || 1)),
    };
  });
}

function clearKnownProductSelections() {
  knownProductsCheckboxes
    .querySelectorAll('input[name="knownProductSelection"]')
    .forEach((checkbox) => {
      checkbox.checked = false;
    });

  knownProductsCheckboxes
    .querySelectorAll('input[name="knownProductQuantity"]')
    .forEach((input) => {
      input.value = 1;
      input.disabled = true;
    });
}

function renderSaleProductsCheckboxes() {
  const currentQuantities = new Map(getSelectedSaleProductComponents().map((item) => [item.productId, item.quantity]));
  const selectedPack = findById("products", forms.saleForm.elements.productId.value);
  const targetSize = selectedPack?.size || "";
  saleProductsCheckboxes.innerHTML = state.products
    .filter((product) => product.productType !== "pack")
    .filter((product) => product.status !== "Inactif")
    .filter((product) => !targetSize || product.size === targetSize)
    .map(
      (product) => `
        <label class="checkbox-item">
          <input
            type="checkbox"
            name="saleProductSelection"
            value="${product.id}"
            ${currentQuantities.has(product.id) ? "checked" : ""}
          />
          <span class="checkbox-title">${escapeHtml(product.name)}</span>
          <span class="checkbox-meta">${escapeHtml(product.description || product.ingredients || product.code)}</span>
          <input
            class="checkbox-qty"
            type="number"
            name="saleProductQuantity"
            data-product-id="${product.id}"
            min="1"
            step="1"
            value="${currentQuantities.get(product.id) || 1}"
            ${currentQuantities.has(product.id) ? "" : "disabled"}
          />
        </label>`,
    )
    .join("");

  saleProductsCheckboxes.querySelectorAll('input[name="saleProductSelection"]').forEach((checkbox) => {
    checkbox.addEventListener("change", refreshSaleProductsCheckboxesState);
  });
  saleProductsCheckboxes.querySelectorAll('input[name="saleProductQuantity"]').forEach((input) => {
    input.addEventListener("input", refreshSaleProductsCheckboxesState);
  });
}

function refreshSaleProductsCheckboxesState() {
  const product = findById("products", forms.saleForm.elements.productId.value);
  const packSize = Number(product?.packSize || 0);
  const soldPackQty = Number(forms.saleForm.elements.quantity.value || 0);
  const expectedTotal = packSize * soldPackQty;
  const checkboxes = Array.from(
    saleProductsCheckboxes.querySelectorAll('input[name="saleProductSelection"]'),
  );
  const selectedQty = getSelectedSaleProductComponents().reduce((sum, item) => sum + item.quantity, 0);

  checkboxes.forEach((checkbox) => {
    const qtyInput = saleProductsCheckboxes.querySelector(
      `input[name="saleProductQuantity"][data-product-id="${checkbox.value}"]`,
    );
    if (qtyInput) qtyInput.disabled = !checkbox.checked;
    checkbox.disabled = false;
    if (!checkbox.checked && expectedTotal > 0 && selectedQty >= expectedTotal) {
      checkbox.disabled = true;
    }
  });

  saleProductsTotal.textContent = `Quantité sélectionnée: ${selectedQty} / ${expectedTotal || 0}`;
  saleProductsTotal.className =
    selectedQty === expectedTotal && expectedTotal > 0 ? "small status-ok" : "small status-error";
}

function getSelectedSaleProductIds() {
  return Array.from(
    saleProductsCheckboxes.querySelectorAll('input[name="saleProductSelection"]:checked'),
  ).map((checkbox) => checkbox.value);
}

function getSelectedSaleProductComponents() {
  return getSelectedSaleProductIds().map((productId) => {
    const qtyInput = saleProductsCheckboxes.querySelector(
      `input[name="saleProductQuantity"][data-product-id="${productId}"]`,
    );
    return {
      productId,
      quantity: Math.max(1, Number(qtyInput?.value || 1)),
    };
  });
}

function clearSaleProductSelections() {
  saleProductsCheckboxes
    .querySelectorAll('input[name="saleProductSelection"]')
    .forEach((checkbox) => {
      checkbox.checked = false;
      checkbox.disabled = false;
    });

  saleProductsCheckboxes
    .querySelectorAll('input[name="saleProductQuantity"]')
    .forEach((input) => {
      input.value = 1;
      input.disabled = true;
    });
}

function onSubmitProduct(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const category = formData.get("category");
  const productType = formData.get("productType") === "pack" || category === "PACK" ? "pack" : "simple";
  const packSize = Number(formData.get("packSize")) || 0;
  const knownProductList = formData.get("knownProductList") || "yes";
  const selectedComponents =
    productType === "pack" && knownProductList === "yes"
      ? getSelectedKnownProductComponents()
      : [];

  if (productType === "pack" && packSize <= 0) {
    return showToast("Indiquez la quantité de bouteilles du pack.");
  }

  const selectedTotalQuantity = selectedComponents.reduce((sum, item) => sum + item.quantity, 0);
  if (productType === "pack" && knownProductList === "yes" && selectedTotalQuantity !== packSize) {
    return showToast("La somme des quantités sélectionnées doit être égale à la quantité de bouteilles.");
  }

  const payload = {
    id: formData.get("id") || makeId(),
    name: formData.get("name").trim(),
    code: formData.get("code").trim().toUpperCase(),
    category: productType === "pack" ? "PACK" : category,
    size: formData.get("size"),
    status: formData.get("status") || "Actif",
    productType,
    description: formData.get("description").trim(),
    defaultPrice: Number(formData.get("defaultPrice")),
    defaultCost: Number(formData.get("defaultCost")),
    packSize,
    knownProductList,
    components: selectedComponents,
    costItems: [],
  };
  if (payload.productType === "pack" && payload.knownProductList === "yes") {
    payload.defaultCost = computePackCost(payload);
  }
  closeProductModal();
  upsert("products", payload);
  showToast("Produit enregistré.");
}

function onSubmitClient(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  upsert("clients", {
    id: formData.get("id") || makeId(),
    name: formData.get("name").trim(),
    phone: formData.get("phone").trim(),
    type: formData.get("type").trim(),
    city: formData.get("city").trim(),
    channel: formData.get("channel").trim(),
    notes: formData.get("notes").trim(),
  });
  closeClientModal();
  showToast("Client enregistré.");
}

function onSubmitProduction(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const product = findById("products", formData.get("productId"));
  if (!product) return showToast("Choisissez un produit valide.");
  if (product.productType === "pack") return showToast("La production ne s'applique qu'aux produits unitaires.");
  upsert("production", {
    id: formData.get("id") || makeId(),
    date: formData.get("date"),
    lot: formData.get("lot").trim(),
    event: formData.get("event").trim(),
    productId: product.id,
    quantity: Number(formData.get("quantity")),
    unitCost: Number(formData.get("unitCost")) || product.defaultCost,
  });
  closeProductionModal();
  showToast("Lot enregistré.");
}

function onSubmitSale(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const product = findById("products", formData.get("productId"));
  const client = findById("clients", formData.get("clientId"));
  if (!product || !client) return showToast("Choisissez un client et un produit valides.");
  const quantity = Number(formData.get("quantity"));
  const editingId = formData.get("id");
  const saleComponents =
    product.productType === "pack"
      ? product.knownProductList === "yes"
        ? clone(product.components || [])
        : getSelectedSaleProductComponents()
      : [];
  if (product.productType === "pack" && !saleComponents.length) {
    return showToast("Indiquez la composition du pack pour cette vente.");
  }
  if (product.productType === "pack" && product.knownProductList !== "yes") {
    const selectedTotalQuantity = saleComponents.reduce((sum, item) => sum + item.quantity, 0);
    const expectedTotalQuantity = Number(product.packSize || 0) * quantity;
    if (selectedTotalQuantity !== expectedTotalQuantity) {
      return showToast("La somme des quantités sélectionnées doit être égale au nombre de packs vendus multiplié par le nombre de bouteilles du pack.");
    }
  }
  const stockCheck = validateSaleStock(product, quantity, saleComponents, editingId);
  if (!stockCheck.ok) return showToast(stockCheck.message);
  upsert("sales", {
    id: editingId || makeId(),
    date: formData.get("date"),
    clientId: client.id,
    productId: product.id,
    quantity,
    unitPrice: Number(formData.get("unitPrice")) || product.defaultPrice,
    status: formData.get("status"),
    amountPaid: resolveAmountPaid(formData, quantity),
    saleComponents,
  });
  closeSaleModal();
  showToast("Vente enregistrée.");
}

function onSubmitPricing(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const product = findById("products", formData.get("productId"));
  if (!product) return showToast("Choisissez un produit.");
  const isPackProduct = product.category === "PACK" || product.productType === "pack";
  const pmProduct = isPackProduct ? null : findById("products", formData.get("pmProductId"));
  if (!isPackProduct && (!pmProduct || pmProduct.category !== product.category || pmProduct.size !== "PM")) {
    return showToast("Choisissez un produit PM valide de la même catégorie.");
  }

  const pricingDetails = getPricingDetailsFromForm();
  const pricingMetricsValues = computePricingDetails(pricingDetails);
  updateSharedPackagingFromForm(false);
  const defaultCost = isPackProduct
    ? computePackCost(product)
    : product.size === "GM"
      ? pricingMetricsValues.unitCostGM
      : pricingMetricsValues.unitCostPM;
  const defaultPrice = Number(formData.get("defaultPrice"));

  const updatedProduct = {
    ...product,
    defaultPrice,
    defaultCost,
    pricingDetails,
    linkedPmProductId: isPackProduct ? "" : pmProduct.id,
  };

  state.products = state.products.map((item) => {
    if (item.id === updatedProduct.id) {
      return touchRecord({
        ...updatedProduct,
        defaultCost:
          updatedProduct.productType === "pack" && updatedProduct.knownProductList === "yes"
            ? computePackCost(updatedProduct)
            : defaultCost,
      }, item);
    }
    if (!isPackProduct && item.id === pmProduct.id) {
      return touchRecord({
        ...item,
        defaultCost: pricingMetricsValues.unitCostPM,
        linkedPmProductId: pmProduct.id,
      }, item);
    }
    return item;
  });
  persist();
  render();
  loadPricingForm(product.id);
  showToast("Pricing mis à jour.");
}

function resolveAmountPaid(formData, quantity) {
  const status = formData.get("status");
  const unitPrice = Number(formData.get("unitPrice")) || 0;
  const total = unitPrice * quantity;
  if (status === "Payé") return total;
  if (status === "Partiel") return Number(formData.get("amountPaid")) || 0;
  return 0;
}

function onSubmitDashboardFilter(event) {
  event.preventDefault();
  state.ui.dashboardFilter = {
    from: forms.dashboardFilterForm.elements.from.value,
    to: forms.dashboardFilterForm.elements.to.value,
  };
  persist();
  renderDashboard();
  showToast("Filtre appliqué.");
}

function clearDashboardFilter() {
  state.ui.dashboardFilter = { from: "", to: "" };
  persist();
  hydrateDashboardFilterForm();
  renderDashboard();
  showToast("Filtre effacé.");
}

function upsert(collection, payload) {
  const index = state[collection].findIndex((item) => item.id === payload.id);
  const existing = index >= 0 ? state[collection][index] : null;
  const stampedPayload = touchRecord(payload, existing);
  if (index === -1) state[collection].unshift(stampedPayload);
  else state[collection][index] = stampedPayload;
  persist();
  render();
}

function toggleProductStatus(id) {
  const product = findById("products", id);
  if (!product) return;
  upsert("products", {
    ...product,
    status: product.status === "Inactif" ? "Actif" : "Inactif",
  });
  showToast(product.status === "Inactif" ? "Produit activé." : "Produit désactivé.");
}

function editItem(collection, id) {
  const item = state[collection].find((entry) => entry.id === id);
  if (!item) return;

  if (collection === "products") {
    const form = forms.catalogueForm;
    productModalTitle.textContent = "Modifier un produit";
    openProductModal(true);
    form.elements.id.value = item.id;
    form.elements.name.value = item.name;
    form.elements.code.value = item.code;
    form.elements.category.value = item.category;
    form.elements.size.value = item.size || "";
    form.elements.status.value = item.status || "Actif";
    form.elements.productType.value = item.productType || (item.category === "PACK" ? "pack" : "simple");
    form.elements.description.value = item.description || item.ingredients || "";
    form.elements.defaultPrice.value = item.defaultPrice || 0;
    form.elements.defaultCost.value = item.defaultCost || 0;
    form.elements.packSize.value = item.packSize || "";
    form.elements.knownProductList.value = item.knownProductList || "yes";
    renderKnownProductsCheckboxes();
    (item.components || []).forEach((component) => {
      const checkbox = knownProductsCheckboxes.querySelector(`input[value="${component.productId}"]`);
      if (checkbox) checkbox.checked = true;
      const qtyInput = knownProductsCheckboxes.querySelector(
        `input[name="knownProductQuantity"][data-product-id="${component.productId}"]`,
      );
      if (qtyInput) qtyInput.value = component.quantity;
    });
    refreshKnownProductsCheckboxesState();
    updateProductFormVisibility();
    switchView("catalogue");
    return;
  }

  if (collection === "clients") {
    const form = forms.clientForm;
    clientModalTitle.textContent = "Modifier un client";
    openClientModal(true);
    Object.entries(item).forEach(([key, value]) => {
      if (form.elements[key]) form.elements[key].value = value;
    });
    switchView("clients");
    return;
  }

  if (collection === "production") {
    const form = forms.productionForm;
    productionModalTitle.textContent = "Modifier un lot";
    openProductionModal(true);
    Object.entries(item).forEach(([key, value]) => {
      if (form.elements[key]) form.elements[key].value = value;
    });
    switchView("production");
    return;
  }

  if (collection === "sales") {
    const form = forms.saleForm;
    saleModalTitle.textContent = "Modifier une vente";
    openSaleModal(true);
    form.elements.id.value = item.id;
    form.elements.date.value = item.date;
    form.elements.clientId.value = item.clientId;
    form.elements.productId.value = item.productId;
    form.elements.quantity.value = item.quantity;
    form.elements.unitPrice.value = item.unitPrice;
    form.elements.status.value = item.status || "";
    form.elements.amountPaid.value = item.amountPaid || "";
    clearSaleProductSelections();
    renderSaleProductsCheckboxes();
    (item.saleComponents || []).forEach((component) => {
      const checkbox = saleProductsCheckboxes.querySelector(`input[value="${component.productId}"]`);
      if (checkbox) checkbox.checked = true;
      const qtyInput = saleProductsCheckboxes.querySelector(
        `input[name="saleProductQuantity"][data-product-id="${component.productId}"]`,
      );
      if (qtyInput) qtyInput.value = component.quantity;
    });
    refreshSaleProductsCheckboxesState();
    updateSalePackComponentsVisibility();
    updateSalePaymentVisibility();
    form.elements.saleComponentsText.value = stringifyComponents(item.saleComponents || []);
    switchView("ventes");
  }
}

async function removeItem(collection, id) {
  const blockerMessage = getDeletionBlocker(collection, id);
  if (blockerMessage) {
    showToast(blockerMessage);
    return;
  }

  if (isSupabaseConfigured()) {
    try {
      await deleteSupabaseRecord(collection, id);
    } catch (error) {
      console.error("Erreur de suppression Supabase:", error);
      showToast("Suppression base de données échouée.");
      return;
    }
  }

  state[collection] = state[collection].filter((item) => item.id !== id);
  persist({ remote: false });
  render();
  showToast("Élément supprimé.");
}

function renderDashboard() {
  const metrics = computeDashboardMetrics();
  document.querySelector("#todaySummary").innerHTML = metrics.filterLabel
    ? `<span class="chip">${metrics.filterLabel}</span>`
    : "";

  document.querySelector("#statsGrid").innerHTML = [
    ["CA de l'année", formatCurrency(metrics.yearRevenue), "Année en cours"],
    ["Bénéfice de l'année", formatCurrency(metrics.yearProfit), "Année en cours"],
    ["CA du mois", formatCurrency(metrics.monthRevenue), "Mois en cours"],
    ["Bénéfice du mois", formatCurrency(metrics.monthProfit), "Mois en cours"],
    ["À recouvrer", formatCurrency(metrics.outstandingAmount), "Ventes non payées"],
  ]
    .map(
      ([label, value, meta]) =>
        `<article class="stat-card"><span class="eyebrow">${label}</span><strong>${value}</strong><span class="muted">${meta}</span></article>`,
    )
    .join("");

  document.querySelector("#filterStats").innerHTML = [
    ["CA", formatCurrency(metrics.filteredRevenue), "Période sélectionnée"],
    ["Bénéfice", formatCurrency(metrics.filteredProfit), "Période sélectionnée"],
    ["Bouteilles vendues", formatNumber(metrics.filteredUnits), "Période sélectionnée"],
    ["Clients actifs", formatNumber(metrics.activeClients), "Période sélectionnée"],
  ]
    .map(
      ([label, value, meta]) =>
        `<article class="stat-card"><span class="eyebrow">${label}</span><strong>${value}</strong><span class="muted">${meta}</span></article>`,
    )
    .join("");

  document.querySelector("#topProducts").innerHTML = renderList(
    metrics.topProducts.map((item) => ({
      title: item.name,
      subtitle: `${formatNumber(item.quantity)} unités vendues`,
      value: formatCurrency(item.revenue),
    })),
  );

  document.querySelector("#stockAlerts").innerHTML = renderList(
    metrics.stockAlerts.map((item) => ({
      title: item.name,
      subtitle: `Stock restant: ${formatNumber(item.stock)}`,
      value: item.stock <= 0 ? "Rupture" : "Bas niveau",
      variant: item.stock <= 0 ? "danger" : "warning",
    })),
    "Aucune alerte stock.",
  );
}

function renderProducts() {
  const headers = ["Produit", "Code", "Catégorie", "Description", "Prix", "Coût", "Marge unitaire", "Actions"];
  const activeProducts = state.products.filter((product) => product.status !== "Inactif");
  const inactiveProducts = state.products.filter((product) => product.status === "Inactif");
  const renderProductRow = (product) => [
      escapeHtml(repairText(product.name || "—")),
      escapeHtml(repairText(product.code || "—")),
      escapeHtml(repairText(product.category || "—")),
      escapeHtml(repairText(product.description || product.ingredients || "—")),
      formatCurrency(product.defaultPrice),
      formatCurrency(resolveUnitCost(product.id)),
      formatCurrency((Number(product.defaultPrice) || 0) - resolveUnitCost(product.id)),
      actionCell("products", product.id),
    ];
  document.querySelector("#catalogueTable").innerHTML = renderTable(headers, activeProducts.map(renderProductRow));
  document.querySelector("#inactiveCatalogueTable").innerHTML = renderTable(headers, inactiveProducts.map(renderProductRow));
}
function renderClients() {
  document.querySelector("#clientsTable").innerHTML = renderTable(
    ["Client", "Téléphone", "Type", "Ville", "Canal", "Total unités", "CA estimé", "Nb lignes", "Notes", "Actions"],
    getClientStats().map((client) => [
      client.name,
      client.phone || "—",
      client.type || "—",
      client.city || "—",
      client.channel || "—",
      formatNumber(client.totalUnits),
      formatCurrency(client.revenue),
      formatNumber(client.salesLines),
      client.notes || "—",
      actionCell("clients", client.id),
    ]),
  );
}

function renderProduction() {
  document.querySelector("#productionTable").innerHTML = renderTable(
    ["Date lot", "Lot", "Évènement", "Produit", "Code", "Catégorie", "Qté produite", "Restant", "Coût unitaire", "Actions"],
    state.production.map((entry) => {
      const product = findById("products", entry.productId);
      return [
        formatDate(entry.date),
        entry.lot,
        entry.event || "—",
        product?.name || "Produit supprimé",
        product?.code || "—",
        product?.category || "—",
        formatNumber(entry.quantity),
        formatNumber(getAvailableStockForProduct(entry.productId)),
        formatCurrency(entry.unitCost),
        actionCell("production", entry.id),
      ];
    }),
  );
}

function renderSales() {
  document.querySelector("#salesTable").innerHTML = renderTable(
    ["Date vente", "Client", "Produit", "Statut", "Qté", "Prix unitaire", "CA", "Montant payé", "Montant dû", "Coût", "Bénéfice", "Composition pack", "Actions"],
    state.sales.map((sale) => {
      const product = findById("products", sale.productId);
      const client = findById("clients", sale.clientId);
      const unitCost = getSaleUnitCost(sale);
      const totalCost = unitCost * sale.quantity;
      const totalSale = sale.quantity * sale.unitPrice;
      const amountPaid = getSaleAmountPaid(sale);
      const amountDue = Math.max(0, totalSale - amountPaid);
      return [
        formatDate(sale.date),
        client?.name || "Client supprimé",
        product?.name || "Produit supprimé",
        sale.status || "—",
        formatNumber(sale.quantity),
        formatCurrency(sale.unitPrice),
        formatCurrency(totalSale),
        sale.status === "Payé" || sale.status === "Partiel" ? formatCurrency(amountPaid) : "—",
        sale.status === "Impayé" || sale.status === "Partiel" ? formatCurrency(amountDue) : "—",
        formatCurrency(totalCost),
        formatCurrency((sale.unitPrice - unitCost) * sale.quantity),
        sale.saleComponents?.length ? escapeHtml(stringifyComponents(sale.saleComponents, ", ")) : "—",
        actionCell("sales", sale.id),
      ];
    }),
  );
}

function renderStock() {
  document.querySelector("#stockTable").innerHTML = renderTable(
    ["Produit", "Code", "Type", "Total produit", "Total sorti", "Taux d'écoulement", "Stock restant", "Prix", "Coût", "Valeur stock", "CA réalisé", "Marge brute"],
    state.products.filter((product) => product.status !== "Inactif").map((product) => {
      const produced = getProducedQty(product.id);
      const sold = getDeductedQty(product.id);
      const soldPacks = getSoldQty(product.id);
      const stock = getAvailableStockForProduct(product.id);
      const totalProducedForView =
        product.productType === "pack" ? stock + soldPacks : produced;
      const totalSoldForView =
        product.productType === "pack" ? soldPacks : sold;
      const flowRate =
        totalProducedForView > 0 ? (totalSoldForView / totalProducedForView) * 100 : 0;
      const revenue = state.sales
        .filter((sale) => sale.productId === product.id)
        .reduce((sum, sale) => sum + sale.quantity * sale.unitPrice, 0);
      const grossMargin = state.sales
        .filter((sale) => sale.productId === product.id)
        .reduce((sum, sale) => sum + (sale.unitPrice - getSaleUnitCost(sale)) * sale.quantity, 0);
      const stockLabel = product.productType === "pack" ? `${formatNumber(stock)} packs` : formatNumber(stock);
      const chipClass = stock <= 0 ? "chip danger" : stock <= 10 ? "chip warning" : "chip";
      return [
        product.name,
        product.code,
        product.productType === "pack" ? "Pack" : "Simple",
        formatNumber(totalProducedForView),
        formatNumber(totalSoldForView),
        `${flowRate.toFixed(1)}%`,
        `<span class="${chipClass}">${stockLabel}</span>`,
        formatCurrency(product.defaultPrice),
        formatCurrency(resolveUnitCost(product.id)),
        product.productType === "pack"
          ? formatCurrency(stock * computePackCost(product))
          : formatCurrency(stock * resolveUnitCost(product.id)),
        formatCurrency(revenue),
        formatCurrency(grossMargin),
      ];
    }),
  );
}

function renderPricing() {
  const category = state.ui.pricingCategory || "SOLO";
  const isPackCategory = category === "PACK";
  const products = isPackCategory
    ? state.products.filter(
        (product) =>
          product.productType === "pack" &&
          product.status !== "Inactif" &&
          product.knownProductList !== "yes",
      )
    : state.products.filter(
        (product) =>
          product.category === category &&
          product.size !== "PM" &&
          product.status !== "Inactif",
      );
  syncPricingPackagingFields();
  const pricingSelect = forms.pricingForm.elements.productId;
  const currentProductId = pricingSelect.value;
  pricingSelect.innerHTML = `<option value="">Choisir un produit</option>${products
    .map((product) => `<option value="${product.id}">${escapeHtml(product.name)} (${escapeHtml(product.code)})</option>`)
    .join("")}`;
  if (products.some((product) => product.id === currentProductId)) {
    pricingSelect.value = currentProductId;
  }
  syncPricingPmSelect();

  document.querySelector("#pricingTabs").innerHTML = ["SOLO", "DUO", "SAISON", "COCKTAIL", "PACK"]
    .map(
      (item) =>
        `<button class="pill-tab ${item === category ? "active" : ""}" data-pricing-category="${item}">${item}</button>`,
    )
    .join("");

  document.querySelector("#pricingSummary").innerHTML = renderList(
    products.map((product) => ({
      title: product.name,
      subtitle: isPackCategory ? "" : renderPricingSummarySubtitle(product),
      value: formatCurrency(product.defaultPrice),
    })),
    "Aucun produit dans cette catégorie.",
  );

  togglePricingSections(isPackCategory);

  if (!forms.pricingForm.elements.productId.value && products[0]) {
    forms.pricingForm.elements.productId.value = products[0].id;
    loadPricingForm(products[0].id);
  } else if (forms.pricingForm.elements.productId.value) {
    refreshPricingPreview();
  } else {
    renderPricingItemsTable([createEmptyPricingItem()]);
    refreshPricingPreview();
  }
}

function bindPricingTabs() {
  document.querySelectorAll("[data-pricing-category]").forEach((button) => {
    button.onclick = () => {
      state.ui.pricingCategory = button.dataset.pricingCategory;
      persist();
      forms.pricingForm.reset();
      renderPricing();
      bindPricingTabs();
    };
  });
}

function loadPricingFormFromSelectedProduct() {
  const productId = forms.pricingForm.elements.productId.value;
  if (!productId) return showToast("Choisissez un produit.");
  loadPricingForm(productId);
}

function togglePricingSections(isPackCategory) {
  [
    pricingProductionBlock,
    pricingJuiceBlock,
    pricingPackagingBlock,
    pricingResultBlock,
  ].forEach((element) => {
    if (!element) return;
    element.hidden = isPackCategory;
    element.style.display = isPackCategory ? "none" : "";
  });

  if (pricingPmProductField) {
    pricingPmProductField.hidden = isPackCategory;
    pricingPmProductField.style.display = isPackCategory ? "none" : "";
  }

  if (forms.pricingForm?.elements.pmProductId) {
    forms.pricingForm.elements.pmProductId.disabled = isPackCategory;
    forms.pricingForm.elements.pmProductId.required = !isPackCategory;
    if (isPackCategory) forms.pricingForm.elements.pmProductId.value = "";
  }
}

function syncPricingPmSelect(selectedPmProductId = "") {
  const selectedProduct = findById("products", forms.pricingForm.elements.productId.value);
  const category = selectedProduct?.category || state.ui.pricingCategory || "SOLO";
  const pmSelect = forms.pricingForm.elements.pmProductId;
  const pmProducts = state.products.filter(
    (product) => product.category === category && product.size === "PM" && product.status !== "Inactif",
  );
  const currentValue = selectedPmProductId || pmSelect.value;
  pmSelect.innerHTML = `<option value="">Choisir un produit PM</option>${pmProducts
    .map((product) => `<option value="${product.id}">${escapeHtml(product.name)} (${escapeHtml(product.code)})</option>`)
    .join("")}`;

  if (pmProducts.some((product) => product.id === currentValue)) {
    pmSelect.value = currentValue;
  } else if (selectedProduct?.size === "PM" && pmProducts.some((product) => product.id === selectedProduct.id)) {
    pmSelect.value = selectedProduct.id;
  } else if (selectedProduct?.linkedPmProductId && pmProducts.some((product) => product.id === selectedProduct.linkedPmProductId)) {
    pmSelect.value = selectedProduct.linkedPmProductId;
  } else if (pmProducts[0]) {
    pmSelect.value = pmProducts[0].id;
  } else {
    pmSelect.value = "";
  }
}

function loadPricingForm(productId) {
  const product = findById("products", productId);
  if (!product) return;
  togglePricingSections(product.category === "PACK");
  const details = getNormalizedPricingDetails(product);
  forms.pricingForm.elements.productId.value = product.id;
  forms.pricingForm.elements.defaultPrice.value = product.defaultPrice || 0;
  if (product.category !== "PACK") {
    syncPricingPmSelect(product.linkedPmProductId || (product.size === "PM" ? product.id : ""));
  }
  forms.pricingForm.elements.pricingQtyGM.value = details.qtyGM;
  forms.pricingForm.elements.pricingQtyPM.value = details.qtyPM;
  syncPricingPackagingFields();
  renderPricingItemsTable(details.juiceItems);
  refreshPricingPreview();
  renderPackPricingBreakdown(product);
}

function getClientStats() {
  return state.clients.map((client) => {
    const sales = state.sales.filter((sale) => sale.clientId === client.id);
    return {
      ...client,
      totalUnits: sales.reduce((sum, sale) => sum + sale.quantity, 0),
      revenue: sales.reduce((sum, sale) => sum + sale.quantity * sale.unitPrice, 0),
      salesLines: sales.length,
    };
  });
}

function computeDashboardMetrics() {
  const filteredSales = getFilteredSales();
  const today = new Date().toISOString().slice(0, 10);
  const monthPrefix = today.slice(0, 7);
  const yearPrefix = today.slice(0, 4);
  const todaySales = state.sales.filter((sale) => sale.date === today);
  const monthSales = state.sales.filter((sale) => sale.date.startsWith(monthPrefix));
  const yearSales = state.sales.filter((sale) => sale.date.startsWith(yearPrefix));
  const toRevenue = (sales) => sales.reduce((sum, sale) => sum + sale.quantity * sale.unitPrice, 0);
  const toProfit = (sales) => sales.reduce((sum, sale) => sum + (sale.unitPrice - getSaleUnitCost(sale)) * sale.quantity, 0);
  const toUnits = (sales) => sales.reduce((sum, sale) => sum + sale.quantity, 0);
  const toActiveClients = (sales) => new Set(sales.map((sale) => sale.clientId)).size;
  const toOutstandingAmount = (sales) =>
    sales
    .filter((sale) => sale.status === "Impayé" || sale.status === "Partiel")
      .reduce((sum, sale) => sum + Math.max(0, sale.quantity * sale.unitPrice - getSaleAmountPaid(sale)), 0);
  const filter = state.ui.dashboardFilter;
  const filterLabel = filter.from || filter.to ? `${filter.from || "début"} -> ${filter.to || "fin"}` : "";

  const topProducts = state.products
    .map((product) => {
      const sales = filteredSales.filter((sale) => sale.productId === product.id);
      return {
        name: product.name,
        quantity: sales.reduce((sum, sale) => sum + sale.quantity, 0),
        revenue: toRevenue(sales),
      };
    })
    .filter((item) => item.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  const stockAlerts = state.products
    .filter((product) => product.status !== "Inactif")
    .filter((product) => product.productType !== "pack")
    .map((product) => ({ name: product.name, stock: getAvailableStockForProduct(product.id) }))
    .filter((entry) => entry.stock <= 10)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 5);

  return {
    filterLabel,
    filteredRevenue: toRevenue(filteredSales),
    filteredProfit: toProfit(filteredSales),
    filteredUnits: toUnits(filteredSales),
    activeClients: toActiveClients(filteredSales),
    todayRevenue: toRevenue(todaySales),
    todayProfit: toProfit(todaySales),
    monthRevenue: toRevenue(monthSales),
    monthProfit: toProfit(monthSales),
    yearRevenue: toRevenue(yearSales),
    yearProfit: toProfit(yearSales),
    outstandingAmount: toOutstandingAmount(filteredSales),
    topProducts,
    stockAlerts,
  };
}

function getFilteredSales() {
  const { from, to } = state.ui.dashboardFilter;
  return state.sales.filter((sale) => {
    if (from && sale.date < from) return false;
    if (to && sale.date > to) return false;
    return true;
  });
}

function getProducedQty(productId) {
  return state.production.filter((entry) => entry.productId === productId).reduce((sum, entry) => sum + entry.quantity, 0);
}

function getSoldQty(productId) {
  return state.sales.filter((sale) => sale.productId === productId).reduce((sum, sale) => sum + sale.quantity, 0);
}

function getDeductedQty(productId) {
  const direct = state.sales
    .filter((sale) => sale.productId === productId && findById("products", sale.productId)?.productType !== "pack")
    .reduce((sum, sale) => sum + sale.quantity, 0);

  const packUsage = state.sales.reduce((sum, sale) => {
    const saleProduct = findById("products", sale.productId);
    const qty = (sale.saleComponents || [])
      .filter((component) => component.productId === productId)
      .reduce(
        (sub, component) =>
          sub +
          component.quantity *
            (saleProduct?.productType === "pack" && saleProduct?.knownProductList === "yes"
              ? sale.quantity
              : 1),
        0,
      );
    return sum + qty;
  }, 0);

  return direct + packUsage;
}

function getAvailableStockForProduct(productId) {
  const product = findById("products", productId);
  if (!product) return 0;
  if (product.productType === "pack") {
    if (!product.components?.length) return 0;
    const packStocks = product.components.map((component) => {
      const base = getAvailableStockForProduct(component.productId);
      return Math.floor(base / component.quantity);
    });
    return Math.max(0, Math.min(...packStocks));
  }
  return getProducedQty(productId) - getDeductedQty(productId);
}

function getSaleUnitCost(sale) {
  const product = findById("products", sale.productId);
  if (!product) return 0;
  if (product.productType === "pack") {
    const totalCost = (sale.saleComponents || []).reduce(
      (sum, component) => sum + resolveUnitCost(component.productId) * component.quantity,
      0,
    );
    return product.knownProductList === "yes"
      ? totalCost
      : sale.quantity > 0
        ? totalCost / sale.quantity
        : 0;
  }
  return resolveUnitCost(product.id);
}

function getSaleAmountPaid(sale) {
  const total = sale.quantity * sale.unitPrice;
  if (sale.status === "Payé") return total;
  if (sale.status === "Partiel") return Number(sale.amountPaid || 0);
  return 0;
}

function resolveUnitCost(productId) {
  const product = findById("products", productId);
  if (!product) return 0;
  if (product.productType === "pack") return computePackCost(product);
  if (product.pricingDetails) {
    const metrics = computePricingDetails(getNormalizedPricingDetails(product));
    return Math.round(product.size === "GM" ? metrics.unitCostGM : metrics.unitCostPM);
  }
  if (product.costItems?.length) return computeCostItemsTotal(product.costItems);

  const productionCosts = state.production
    .filter((entry) => entry.productId === productId)
    .map((entry) => entry.unitCost)
    .filter((value) => Number.isFinite(value) && value > 0);

  if (productionCosts.length) {
    return Math.round(productionCosts.reduce((sum, value) => sum + value, 0) / productionCosts.length);
  }
  return product.defaultCost || 0;
}

function validateSaleStock(product, quantity, saleComponents, editingId) {
  if (product.productType !== "pack") {
    const available = getAvailableStockForProduct(product.id) + getEditingAdjustment(editingId, product.id);
    if (quantity > available) {
      return {
        ok: false,
      message: `Stock insuffisant pour ${product.name}. Disponible: ${available}. Demandé: ${quantity}.`,
      };
    }
    return { ok: true };
  }

  const shortages = [];
  for (const component of saleComponents) {
    const available = getAvailableStockForProduct(component.productId) + getEditingPackAdjustment(editingId, component.productId);
    const required =
      product.knownProductList === "yes" ? component.quantity * quantity : component.quantity;
    if (required > available) {
      const componentProduct = findById("products", component.productId);
      shortages.push(
        `${componentProduct?.name || "Produit"} (${available} dispo / ${required} requis)`,
      );
    }
  }

  if (shortages.length) {
    return {
      ok: false,
      message: `Impossible d'enregistrer la vente. Produits en rupture ou insuffisants: ${shortages.join(", ")}.`,
    };
  }
  return { ok: true };
}

function getEditingAdjustment(editingId, productId) {
  if (!editingId) return 0;
  const existing = state.sales.find((sale) => sale.id === editingId);
  if (!existing || existing.productId !== productId) return 0;
  const existingProduct = findById("products", existing.productId);
  if (existingProduct?.productType === "pack") return 0;
  return existing.quantity;
}

function getEditingPackAdjustment(editingId, productId) {
  if (!editingId) return 0;
  const existing = state.sales.find((sale) => sale.id === editingId);
  if (!existing) return 0;
  const existingProduct = findById("products", existing.productId);
  return (existing.saleComponents || [])
    .filter((component) => component.productId === productId)
    .reduce(
      (sum, component) =>
        sum +
        component.quantity *
          (existingProduct?.productType === "pack" && existingProduct?.knownProductList === "yes"
            ? existing.quantity
            : 1),
      0,
    );
}

function parseComponentsText(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const parsed = [];
  for (const line of lines) {
    const [code, qtyText] = line.split("=");
    if (!code || !qtyText) continue;
    const quantity = Number(qtyText.trim());
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    const product = state.products.find((item) => item.code.toUpperCase() === code.trim().toUpperCase());
    if (!product) continue;
    parsed.push({ productId: product.id, quantity });
  }
  return parsed;
}

function parseCostItemsText(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, amountText] = line.split("=");
      return { label: (label || "").trim(), amount: Number((amountText || "").trim()) };
    })
    .filter((item) => item.label && Number.isFinite(item.amount));
}

function createEmptyPricingItem() {
  return { label: "", quantity: 0, unit: "", unitPrice: 0 };
}

function getNormalizedPricingDetails(product) {
  const details = product?.pricingDetails || {};
  const sharedPackaging = getSharedPackagingSettings();
  return {
    qtyGM: Number(details.qtyGM || 0),
    qtyPM: Number(details.qtyPM || 0),
    bottleGMPrice: sharedPackaging.bottleGMPrice,
    labelGMPrice: sharedPackaging.labelGMPrice,
    bottlePMPrice: sharedPackaging.bottlePMPrice,
    labelPMPrice: sharedPackaging.labelPMPrice,
    juiceItems: Array.isArray(details.juiceItems) && details.juiceItems.length
      ? details.juiceItems.map((item) => ({
          label: item.label || "",
          quantity: Number(item.quantity || 0),
          unit: item.unit || "",
          unitPrice: Number(item.unitPrice || 0),
        }))
      : [createEmptyPricingItem()],
  };
}

function computePricingDetails(details) {
  const qtyGM = Number(details.qtyGM || 0);
  const qtyPM = Number(details.qtyPM || 0);
  const totalLiters = qtyGM + qtyPM * 0.25;
  const juiceItems = (details.juiceItems || []).filter((item) => item.label);
  const juicePreparationTotal = juiceItems.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0),
    0,
  );
  const costPerLiter = totalLiters > 0 ? juicePreparationTotal / totalLiters : 0;
  const unitCostGM = costPerLiter + Number(details.bottleGMPrice || 0) + Number(details.labelGMPrice || 0);
  const unitCostPM = costPerLiter / 4 + Number(details.bottlePMPrice || 0) + Number(details.labelPMPrice || 0);
  return {
    qtyGM,
    qtyPM,
    totalLiters,
    juicePreparationTotal,
    costPerLiter,
    unitCostGM,
    unitCostPM,
  };
}

function getPricingDetailsFromForm() {
  return {
    qtyGM: Number(forms.pricingForm.elements.pricingQtyGM.value || 0),
    qtyPM: Number(forms.pricingForm.elements.pricingQtyPM.value || 0),
    bottleGMPrice: Number(forms.pricingForm.elements.bottleGMPrice.value || 0),
    labelGMPrice: Number(forms.pricingForm.elements.labelGMPrice.value || 0),
    bottlePMPrice: Number(forms.pricingForm.elements.bottlePMPrice.value || 0),
    labelPMPrice: Number(forms.pricingForm.elements.labelPMPrice.value || 0),
    juiceItems: getPricingItemsFromTable(),
  };
}

function getPricingItemsFromTable() {
  return Array.from(pricingItemsTable.querySelectorAll("[data-pricing-row]")).map((row) => ({
    label: row.querySelector('[name="pricingItemLabel"]')?.value.trim() || "",
    quantity: Number(row.querySelector('[name="pricingItemQuantity"]')?.value || 0),
    unit: row.querySelector('[name="pricingItemUnit"]')?.value.trim() || "",
    unitPrice: Number(row.querySelector('[name="pricingItemUnitPrice"]')?.value || 0),
  }));
}

function renderPricingItemsTable(items = [createEmptyPricingItem()]) {
  const normalizedItems = items.length ? items : [createEmptyPricingItem()];
  pricingItemsTable.innerHTML = `
    <div class="pricing-items">
      <div class="pricing-items-head">
        <span>Libellé</span>
        <span>Quantité</span>
        <span>Unité</span>
        <span>Prix unitaire</span>
        <span>Total</span>
        <span>Action</span>
      </div>
      ${normalizedItems
        .map(
          (item, index) => `
            <div class="pricing-item-row" data-pricing-row="${index}">
              <input name="pricingItemLabel" value="${escapeHtml(item.label || "")}" placeholder="Ex: Ditakh" />
              <input name="pricingItemQuantity" type="number" min="0" step="0.01" value="${Number(item.quantity || 0)}" />
              <input name="pricingItemUnit" value="${escapeHtml(item.unit || "")}" placeholder="Ex: KG" />
              <input name="pricingItemUnitPrice" type="number" min="0" step="0.01" value="${Number(item.unitPrice || 0)}" />
              <span class="pricing-line-total">${formatCurrency(Number(item.quantity || 0) * Number(item.unitPrice || 0))}</span>
              <button type="button" class="ghost" data-remove-pricing-row="${index}">Supprimer</button>
            </div>`,
        )
        .join("")}
    </div>
  `;

  pricingItemsTable.querySelectorAll("[data-remove-pricing-row]").forEach((button) => {
    button.addEventListener("click", () => {
      const itemsAfterRemoval = getPricingItemsFromTable().filter((_, index) => index !== Number(button.dataset.removePricingRow));
      renderPricingItemsTable(itemsAfterRemoval.length ? itemsAfterRemoval : [createEmptyPricingItem()]);
      refreshPricingPreview();
    });
  });
}

function addPricingItemRow() {
  const items = getPricingItemsFromTable();
  items.push(createEmptyPricingItem());
  renderPricingItemsTable(items);
  refreshPricingPreview();
}

function refreshPricingPreview() {
  if (!pricingMetrics || !forms.pricingForm) return;
  if (!forms.pricingForm.elements.productId.value) {
    pricingMetrics.innerHTML = "";
    renderPackPricingBreakdown(null);
    return;
  }
  const details = getPricingDetailsFromForm();
  const metrics = computePricingDetails(details);
  pricingMetrics.innerHTML = [
    ["Coût préparation", formatCurrency(metrics.juicePreparationTotal), "Ingrédients du jus"],
    ["Coût au litre", formatCurrency(metrics.costPerLiter), "Base de calcul"],
    ["Coût unitaire GM", formatCurrency(metrics.unitCostGM), `${formatNumber(metrics.qtyGM)} bouteilles GM`],
    ["Coût unitaire PM", formatCurrency(metrics.unitCostPM), `${formatNumber(metrics.qtyPM)} bouteilles PM`],
  ]
    .map(
      ([label, value, meta]) =>
        `<article class="stat-card"><span class="eyebrow">${label}</span><strong>${value}</strong><span class="muted">${meta}</span></article>`,
    )
    .join("");

  pricingItemsTable.querySelectorAll("[data-pricing-row]").forEach((row) => {
    const quantity = Number(row.querySelector('[name="pricingItemQuantity"]')?.value || 0);
    const unitPrice = Number(row.querySelector('[name="pricingItemUnitPrice"]')?.value || 0);
    const totalElement = row.querySelector(".pricing-line-total");
    if (totalElement) totalElement.textContent = formatCurrency(quantity * unitPrice);
  });

  renderPackPricingBreakdown(findById("products", forms.pricingForm.elements.productId.value));
}

function renderPricingSummarySubtitle(product) {
  const details = getNormalizedPricingDetails(product);
  const metrics = computePricingDetails(details);
  return `Litre ${formatCurrency(metrics.costPerLiter)} | GM ${formatCurrency(metrics.unitCostGM)} | PM ${formatCurrency(metrics.unitCostPM)}`;
}

function renderPackPricingBreakdown(product) {
  if (!packPricingBlock || !packPricingTable) return;
  const isObservedPack =
    product?.productType === "pack" &&
    product?.knownProductList !== "yes";
  const isKnownPack =
    product?.productType === "pack" &&
    product?.knownProductList === "yes" &&
    Array.isArray(product.components) &&
    product.components.length > 0;

  packPricingBlock.hidden = !isKnownPack && !isObservedPack;
  if (!isKnownPack && !isObservedPack) {
    packPricingTable.innerHTML = "";
    return;
  }

  if (isObservedPack) {
    const observed = getObservedPackSalesSummary(product);
    if (!observed.salesCount) {
      packPricingTable.innerHTML = `
        <div class="pricing-pack-total">Aucune vente avec composition enregistrée pour ce pack.</div>
      `;
      return;
    }

    const rows = observed.components.map((component) => `
      <tr>
        <td>${escapeHtml(repairText(component.name))}</td>
        <td>${formatNumber(component.totalQuantity)}</td>
        <td>${formatCurrency(component.unitCost)}</td>
        <td>${formatCurrency(component.totalCost)}</td>
      </tr>
    `);

    packPricingTable.innerHTML = `
      <div class="table-wrap pricing-pack-table">
        <table>
          <thead>
            <tr>
              <th>Produit</th>
              <th>Quantité totale vendue</th>
              <th>Coût unitaire</th>
              <th>Coût total observé</th>
            </tr>
          </thead>
          <tbody>
            ${rows.join("")}
          </tbody>
        </table>
      </div>
      <div class="pricing-pack-total">Coût moyen observé du pack: <strong>${formatCurrency(observed.averageCostPerPack)}</strong></div>
    `;
    return;
  }

  const rows = product.components.map((component) => {
    const componentProduct = findById("products", component.productId);
    const unitCost = resolveUnitCost(component.productId);
    const totalCost = unitCost * Number(component.quantity || 0);
    return `
      <tr>
        <td>${escapeHtml(repairText(componentProduct?.name || "Produit supprimé"))}</td>
        <td>${formatNumber(component.quantity)}</td>
        <td>${formatCurrency(unitCost)}</td>
        <td>${formatCurrency(totalCost)}</td>
      </tr>
    `;
  });
  const packCost = product.components.reduce(
    (sum, component) => sum + resolveUnitCost(component.productId) * Number(component.quantity || 0),
    0,
  );

  packPricingTable.innerHTML = `
    <div class="table-wrap pricing-pack-table">
      <table>
        <thead>
          <tr>
            <th>Produit</th>
            <th>Quantité</th>
            <th>Coût unitaire</th>
            <th>Coût total</th>
          </tr>
        </thead>
        <tbody>
          ${rows.join("")}
        </tbody>
      </table>
    </div>
    <div class="pricing-pack-total">Coût du pack: <strong>${formatCurrency(packCost)}</strong></div>
  `;
}

function stringifyComponents(components, separator = "\n") {
  return (components || [])
    .map((component) => {
      const product = findById("products", component.productId) || demoState.products.find((item) => item.id === component.productId);
      return `${product?.code || component.productId}=${component.quantity}`;
    })
    .join(separator);
}

function stringifyCostItems(costItems) {
  return (costItems || []).map((item) => `${item.label}=${item.amount}`).join("\n");
}

function computeCostItemsTotal(costItems) {
  return Math.round((costItems || []).reduce((sum, item) => sum + Number(item.amount || 0), 0));
}

function computePackCost(product) {
  if (product?.knownProductList !== "yes") {
    return resolveUnknownPackCost(product);
  }
  const components = product.components || [];
  return components.reduce((sum, component) => sum + resolveUnitCost(component.productId) * component.quantity, 0);
}

function computePackCostFromComponents(product, products) {
  const getCost = (productId) => products.find((item) => item.id === productId)?.defaultCost || 0;
  return (product.components || []).reduce((sum, component) => sum + getCost(component.productId) * component.quantity, 0);
}

function getObservedPackSalesSummary(product) {
  const packId = typeof product === "string" ? product : product?.id;
  const relevantSales = state.sales.filter(
    (sale) => sale.productId === packId && Array.isArray(sale.saleComponents) && sale.saleComponents.length > 0 && Number(sale.quantity || 0) > 0,
  );

  const totalComponentCost = relevantSales.reduce(
    (sum, sale) =>
      sum +
      sale.saleComponents.reduce(
        (componentSum, component) => componentSum + resolveUnitCost(component.productId) * Number(component.quantity || 0),
        0,
      ),
    0,
  );
  const totalPacksSold = relevantSales.reduce((sum, sale) => sum + Number(sale.quantity || 0), 0);

  const componentsMap = new Map();
  relevantSales.forEach((sale) => {
    sale.saleComponents.forEach((component) => {
      const existing = componentsMap.get(component.productId) || { totalQuantity: 0 };
      componentsMap.set(component.productId, {
        totalQuantity: existing.totalQuantity + Number(component.quantity || 0),
      });
    });
  });

  const components = Array.from(componentsMap.entries())
    .map(([productId, summary]) => {
      const componentProduct = findById("products", productId);
      const unitCost = resolveUnitCost(productId);
      return {
        productId,
        name: componentProduct?.name || "Produit supprimé",
        totalQuantity: summary.totalQuantity,
        unitCost,
        totalCost: unitCost * summary.totalQuantity,
      };
    })
    .sort((a, b) => b.totalQuantity - a.totalQuantity);

  return {
    salesCount: relevantSales.length,
    totalPacksSold,
    totalComponentCost,
    averageCostPerPack: totalPacksSold > 0 ? totalComponentCost / totalPacksSold : 0,
    components,
  };
}

function computePackObservedAverageCost(product) {
  return getObservedPackSalesSummary(product).averageCostPerPack;
}

function resolveUnknownPackCost(product) {
  const observedAverageCost = computePackObservedAverageCost(product);
  if (observedAverageCost > 0) return observedAverageCost;
  return Number(product?.defaultCost || 0);
}

function findById(collection, id) {
  return state[collection].find((item) => item.id === id);
}

function renderTable(headers, rows) {
  if (!rows.length) return document.querySelector("#emptyStateTemplate").innerHTML;

  const tableKey = getTableKeyFromHeaders(headers);
  const sortState = state.ui.tableSorts?.[tableKey];
  const searchTerm = state.ui.tableSearches?.[tableKey] || "";
  const filteredRows = filterRows(rows, searchTerm);
  const sortedRows = sortRows(filteredRows, sortState);

  return `
    <div class="table-search">
      <input
        type="search"
        placeholder="Rechercher dans le tableau"
        value="${escapeHtml(searchTerm)}"
        data-table-search="${tableKey}"
      />
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>${headers
            .map((header, index) => {
              const sortable = !/actions/i.test(header);
              const arrow =
                sortable && sortState?.index === index
                  ? sortState.direction === "asc"
                    ? "&uarr;"
                    : "&darr;"
                  : "&varr;";
              return `<th ${
                sortable ? `class="sortable-th" data-table-key="${tableKey}" data-sort-index="${index}"` : ""
              }>${header}${sortable ? ` <span class="sort-arrow" aria-hidden="true">${arrow}</span>` : ""}</th>`;
            })
            .join("")}</tr>
        </thead>
        <tbody>
          ${sortedRows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderList(items, emptyMessage = "Aucune donnée pour le moment.") {
  if (!items.length) return `<div class="empty-state"><p>${emptyMessage}</p></div>`;
  return items
    .map(
      (item) => `
      <div class="list-item">
        <div>
          <strong>${escapeHtml(item.title)}</strong>
          <span class="muted">${escapeHtml(item.subtitle)}</span>
        </div>
        <span class="chip ${item.variant || ""}">${escapeHtml(item.value)}</span>
      </div>`,
    )
    .join("");
}

function bindTableSorts() {
  document.querySelectorAll("[data-table-key][data-sort-index]").forEach((header) => {
    header.onclick = () => {
      const tableKey = header.dataset.tableKey;
      const index = Number(header.dataset.sortIndex);
      const current = state.ui.tableSorts?.[tableKey];
      const direction = current?.index === index && current.direction === "asc" ? "desc" : "asc";
      state.ui.tableSorts = {
        ...(state.ui.tableSorts || {}),
        [tableKey]: { index, direction },
      };
      persist();
      render();
    };
  });
}

function bindTableSearches() {
  document.querySelectorAll("[data-table-search]").forEach((input) => {
    input.oninput = () => {
      const tableKey = input.dataset.tableSearch;
      state.ui.tableSearches = {
        ...(state.ui.tableSearches || {}),
        [tableKey]: input.value,
      };
      persist();
      render();
    };
  });
}

function getTableKeyFromHeaders(headers) {
  const first = String(headers[0] || "").toLowerCase();
  if (first.includes("client")) return "clients";
  if (first.includes("date lot")) return "production";
  if (first.includes("date vente")) return "sales";
  if (first.includes("produit") && String(headers[2] || "").toLowerCase().includes("type")) return "stock";
  if (first.includes("produit")) return "catalogue";
  return "default";
}

function sortRows(rows, sortState) {
  if (!sortState || !Number.isInteger(sortState.index)) return rows;
  const factor = sortState.direction === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const left = getCellSortValue(a[sortState.index]);
    const right = getCellSortValue(b[sortState.index]);
    if (typeof left === "number" && typeof right === "number") {
      return (left - right) * factor;
    }
    return String(left).localeCompare(String(right), "fr", { numeric: true, sensitivity: "base" }) * factor;
  });
}

function filterRows(rows, searchTerm) {
  const term = String(searchTerm || "").trim().toLowerCase();
  if (!term) return rows;
  return rows.filter((row) =>
    row.some((cell) =>
      String(cell ?? "")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .toLowerCase()
        .includes(term),
    ),
  );
}

function getCellSortValue(cell) {
  const raw = String(cell ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const numeric = raw.replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", ".");
  if (numeric && !Number.isNaN(Number(numeric))) return Number(numeric);
  return raw;
}

function actionCell(collection, id) {
  const product = collection === "products" ? findById("products", id) : null;
  const toggleButton = product
    ? `<button class="secondary" data-action="toggle-status" data-collection="${collection}" data-id="${id}">${product.status === "Inactif" ? "Activer" : "Désactiver"}</button>`
    : "";
  return `
    <div class="actions">
      ${toggleButton}
      <button class="ghost" data-action="edit" data-collection="${collection}" data-id="${id}">Modifier</button>
      <button class="danger" data-action="delete" data-collection="${collection}" data-id="${id}">Supprimer</button>
    </div>
  `;
}
function bindActions() {
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.onclick = async () => {
      const { action, collection, id } = button.dataset;
      if (action === "edit") editItem(collection, id);
      if (action === "delete") await removeItem(collection, id);
      if (action === "toggle-status" && collection === "products") toggleProductStatus(id);
    };
  });
}

function exportState() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `iajuice-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("Export JSON généré.");
}

function exportExcelWorkbook() {
  const workbook = buildExcelWorkbookXml();
  const blob = new Blob([workbook], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `iajuice-export-${new Date().toISOString().slice(0, 10)}.xml`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("Export Excel généré.");
}

function importExcelWorkbook(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const xml = String(reader.result || "");
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, "application/xml");
      if (doc.querySelector("parsererror")) {
        throw new Error("invalid xml");
      }

      const metadataJson = extractWorksheetJson(doc, "METADATA");
      if (!metadataJson) {
        throw new Error("missing metadata");
      }

      const parsed = JSON.parse(metadataJson);
      state = { ...clone(emptyState), ...parsed };
      persist();
      render();
      showToast("Import Excel terminé.");
    } catch {
      showToast("Fichier Excel non pris en charge. Utilisez un export Excel généré par l'app.");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function buildExcelWorkbookXml() {
  const workbookState = JSON.stringify(state);
  const sheets = [
    {
      name: "CATALOGUE",
      headers: ["Produit", "Code", "Categorie", "Format", "Statut", "Type", "Prix", "Cout", "PackSize", "Description", "Components", "CostItems"],
      rows: state.products.map((product) => [
        product.name,
        product.code,
        product.category,
        product.size || "",
        product.status || "Actif",
        product.productType,
        product.defaultPrice,
        resolveUnitCost(product.id),
        product.packSize || 0,
        product.description || product.ingredients || "",
        stringifyComponents(product.components || [], "; "),
        stringifyCostItems(product.costItems || []).replaceAll("\n", "; "),
      ]),
    },
    {
      name: "CLIENTS",
      headers: ["Client", "Telephone", "Type", "Ville", "Canal", "Notes"],
      rows: state.clients.map((client) => [
        client.name,
        client.phone || "",
        client.type || "",
        client.city || "",
        client.channel || "",
        client.notes || "",
      ]),
    },
    {
      name: "PRODUCTION",
      headers: ["Date", "Lot", "Evenement", "Produit", "Code", "Quantite", "CoutUnitaire"],
      rows: state.production.map((entry) => {
        const product = findById("products", entry.productId);
        return [
          entry.date,
          entry.lot,
          entry.event || "",
          product?.name || "",
          product?.code || "",
          entry.quantity,
          entry.unitCost,
        ];
      }),
    },
    {
      name: "VENTES",
      headers: ["Date", "Client", "Produit", "Code", "Statut", "Quantite", "PrixUnitaire", "CoutUnitaire", "Benefice", "CompositionPack"],
      rows: state.sales.map((sale) => {
        const product = findById("products", sale.productId);
        const client = findById("clients", sale.clientId);
        const unitCost = getSaleUnitCost(sale);
        return [
          sale.date,
          client?.name || "",
          product?.name || "",
          product?.code || "",
          sale.status || "",
          sale.quantity,
          sale.unitPrice,
          unitCost,
          (sale.unitPrice - unitCost) * sale.quantity,
          stringifyComponents(sale.saleComponents || [], "; "),
        ];
      }),
    },
    {
      name: "STOCK",
      headers: ["Produit", "Code", "Type", "StockRestant", "Prix", "Cout", "ValeurStock"],
      rows: state.products.map((product) => [
        product.name,
        product.code,
        product.productType,
        getAvailableStockForProduct(product.id),
        product.defaultPrice,
        resolveUnitCost(product.id),
        getAvailableStockForProduct(product.id) * resolveUnitCost(product.id),
      ]),
    },
    {
      name: "METADATA",
      headers: ["JsonState"],
      rows: [[workbookState]],
    },
  ];

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
  <Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#F7D7B3" ss:Pattern="Solid"/></Style>
</Styles>
${sheets.map(buildWorksheetXml).join("\n")}
</Workbook>`;
}

function buildWorksheetXml(sheet) {
  return `<Worksheet ss:Name="${escapeXml(sheet.name)}">
  <Table>
    <Row>${sheet.headers.map((header) => `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(header)}</Data></Cell>`).join("")}</Row>
    ${sheet.rows
      .map(
        (row) => `<Row>${row.map((cell) => buildCellXml(cell)).join("")}</Row>`,
      )
      .join("\n")}
  </Table>
</Worksheet>`;
}

function buildCellXml(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
  }
  return `<Cell><Data ss:Type="String">${escapeXml(value ?? "")}</Data></Cell>`;
}

function extractWorksheetJson(doc, worksheetName) {
  const worksheets = Array.from(doc.getElementsByTagNameNS("*", "Worksheet"));
  const target = worksheets.find(
    (node) =>
      node.getAttribute("ss:Name") === worksheetName ||
      node.getAttributeNS("urn:schemas-microsoft-com:office:spreadsheet", "Name") === worksheetName,
  );
  if (!target) return "";

  const rows = Array.from(target.getElementsByTagNameNS("*", "Row"));
  if (rows.length < 2) return "";

  const dataCells = Array.from(rows[1].getElementsByTagNameNS("*", "Data"));
  return dataCells.map((node) => node.textContent || "").join("");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2200);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatNumber(value) {
  return new Intl.NumberFormat("fr-FR").format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}



