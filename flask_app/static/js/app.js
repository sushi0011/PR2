/* ═══════════════════════════════════════════════════════════════════════════
   SUIVI PR — Frontend JavaScript
   ═══════════════════════════════════════════════════════════════════════════ */

"use strict";

/* ── STATE ──────────────────────────────────────────────────────────────────── */
let allPRs       = [];
let selectedPRId = null;
let donutChart   = null;
let processingLimits = {};
let allDocuments  = [];
let hybridSteps  = [];
let editingDocId = null;

/* ── INIT ───────────────────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  clock();
  setInterval(clock, 1000);
  headerDate();
  loadProcessingLimits();
  loadDocuments();
  loadPRList();
  loadKPIData();
  bindForm();
  bindSearch();
  bindImportExport();
  bindStatusDropdown();
  bindModalClose();
  bindHelpButton();
  bindDocumentsButton();
  bindKPIControls();
});

/* ── CLOCK ──────────────────────────────────────────────────────────────────── */
function clock() {
  const el = document.getElementById("clockDisplay");
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function headerDate() {
  const el = document.getElementById("headerDate");
  if (!el) return;
  el.textContent = new Date().toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

/* ── API HELPERS ────────────────────────────────────────────────────────────── */
async function api(path, method = "GET", body = null) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  return res.json();
}

async function loadProcessingLimits() {
  processingLimits = await api("/api/processing-limits");
}

function showProcessingLimitsHelp() {
  const html = Object.entries(processingLimits).map(([cat, data]) => `
    <div class="help-category" style="margin-bottom:20px;padding:12px;border:1px solid #E0E0E0;border-radius:6px">
      <h4 style="margin:0 0 10px 0;color:#2C3E50"><span class="glyphicon glyphicon-file"></span> ${cat}</h4>
      <div style="font-weight:bold;margin-bottom:8px;color:#C0392B">Délai max de traitement : ${data.max_weeks} semaines</div>
      <div style="font-size:13px;margin-bottom:10px">
        <span style="color:#666">Répartition par étape :</span>
      </div>
      <ul style="margin:0;padding-left:20px;font-size:13px">
        ${Object.entries(data.steps).map(([step, weeks]) => `
          <li style="margin:4px 0"><strong>${step}</strong>: ${weeks} semaine${weeks > 1 ? 's' : ''}</li>
        `).join('')}
      </ul>
    </div>
  `).join('');
  
  Swal.fire({
    title: 'Guide des Délais de Traitement',
    html: html,
    icon: 'info',
    width: 500,
    confirmButtonText: 'Fermer',
    didOpen: () => {
      const popup = Swal.getPopup();
      popup.style.maxHeight = '70vh';
      popup.style.overflowY = 'auto';
    }
  });
}

function bindHelpButton() {
  const helpBtn = document.getElementById("btnProcessingHelp");
  if (helpBtn) {
    helpBtn.addEventListener("click", showProcessingLimitsHelp);
  }
}

/* ── DOCUMENTS MANAGEMENT ───────────────────────────────────────────────────── */
function bindDocumentsButton() {
  const docsBtn = document.getElementById("btnDocuments");
  if (docsBtn) {
    docsBtn.addEventListener("click", openDocumentsModal);
  }
}

async function loadDocuments() {
  try {
    allDocuments = await api("/api/documents");
  } catch (err) {
    console.error("[v0] Failed to load documents:", err);
    allDocuments = [];
  }
}

function openDocumentsModal() {
  const modal = document.getElementById("documentsModal");
  if (modal) {
    modal.style.display = "flex";
    renderDocumentsList();
  }
}

function renderDocumentsList() {
  const container = document.getElementById("documentsList");
  if (!container) return;
  
  const pendingDocs = allDocuments.filter(doc => !doc.done);
  
  if (pendingDocs.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:#999;padding:20px"><span class="glyphicon glyphicon-inbox"></span><p>Aucun document en attente</p></div>';
    return;
  }
  
  container.innerHTML = pendingDocs.map(doc => `
    <div class="document-item">
      <input type="checkbox" class="document-checkbox" 
             ${doc.done ? 'checked' : ''} 
             onchange="toggleDocument('${doc.id}', this.checked)" 
             id="checkbox-${doc.id}">
      <div class="document-color-tag" style="background-color:${doc.color}"></div>
      <div class="document-info">
        <div class="document-name">${escapeHtml(doc.name)}</div>
        <span class="document-status" style="border-color:${doc.color};color:${doc.color}">${escapeHtml(doc.status)}</span>
      </div>
      <div class="document-actions">
        <button class="btn-doc-edit" onclick="openDocumentEdit('${doc.id}')" title="Modifier">
          <span class="glyphicon glyphicon-pencil"></span>
        </button>
        <button class="btn-doc-delete" onclick="deleteDocument('${doc.id}')" title="Supprimer">
          <span class="glyphicon glyphicon-trash"></span>
        </button>
      </div>
    </div>
  `).join('');
}

async function addDocument() {
  const name = document.getElementById("docName").value.trim();
  const status = document.getElementById("docStatus").value.trim();
  const color = document.getElementById("docColor").value;
  
  if (!name) {
    showToast("Veuillez entrer un nom de document", "error");
    return;
  }
  
  const result = await api("/api/documents", "POST", {
    name: name,
    status: status || "En attente",
    color: color
  });
  
  if (result.error) {
    showToast(result.error, "error");
    return;
  }
  
  allDocuments.push(result);
  document.getElementById("docName").value = "";
  document.getElementById("docStatus").value = "";
  document.getElementById("docColor").value = "#3498db";
  
  renderDocumentsList();
  showToast("Document ajouté avec succès", "success");
}

async function toggleDocument(docId, isDone) {
  const doc = allDocuments.find(d => d.id === docId);
  if (!doc) return;
  
  const result = await api(`/api/documents/${docId}`, "PUT", {
    ...doc,
    done: isDone ? 1 : 0
  });
  
  if (result.error) {
    showToast("Erreur lors de la mise à jour", "error");
    return;
  }
  
  doc.done = result.done;
  renderDocumentsList();
}

async function deleteDocument(docId) {
  Swal.fire({
    title: 'Supprimer le document ?',
    text: 'Cette action est irréversible.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Supprimer',
    cancelButtonText: 'Annuler',
    confirmButtonColor: '#C0392B'
  }).then(async (result) => {
    if (!result.isConfirmed) return;
    
    const apiResult = await api(`/api/documents/${docId}`, "DELETE");
    if (apiResult.error) {
      showToast("Erreur lors de la suppression", "error");
      return;
    }
    
    allDocuments = allDocuments.filter(d => d.id !== docId);
    renderDocumentsList();
    showToast("Document supprimé", "success");
  });
}

function openDocumentEdit(docId) {
  const doc = allDocuments.find(d => d.id === docId);
  if (!doc) return;
  
  editingDocId = docId;
  document.getElementById("editDocName").value = doc.name;
  document.getElementById("editDocStatus").value = doc.status;
  document.getElementById("editDocColor").value = doc.color;
  
  const modal = document.getElementById("documentEditModal");
  if (modal) {
    modal.style.display = "flex";
  }
}

async function saveDocumentEdit() {
  if (!editingDocId) return;
  
  const name = document.getElementById("editDocName").value.trim();
  const status = document.getElementById("editDocStatus").value.trim();
  const color = document.getElementById("editDocColor").value;
  
  if (!name) {
    showToast("Veuillez entrer un nom de document", "error");
    return;
  }
  
  const doc = allDocuments.find(d => d.id === editingDocId);
  if (!doc) return;
  
  const result = await api(`/api/documents/${editingDocId}`, "PUT", {
    name: name,
    status: status || "En attente",
    color: color,
    done: doc.done
  });
  
  if (result.error) {
    showToast("Erreur lors de la modification", "error");
    return;
  }
  
  doc.name = result.name;
  doc.status = result.status;
  doc.color = result.color;
  
  closeModal("documentEditModal");
  renderDocumentsList();
  showToast("Document modifié avec succès", "success");
}

function escapeHtml(text) {
  const map = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'};
  return text.replace(/[&<>"']/g, m => map[m]);
}

/* ── HYBRID PR MANAGEMENT ──────────────────────────────────────────────────── */
let editingHybridPRId = null;
let editingStepId = null;

function openStepEdit(prId, stepId) {
  editingHybridPRId = prId;
  editingStepId = stepId;
  
  const pr = allPRs.find(p => p.id === prId);
  if (!pr) return;
  
  const tasks = Object.values(pr.tasks || {});
  const task = tasks.find(t => Object.values(pr.tasks || {}).indexOf(t) === parseInt(stepId) - 1);
  
  // Find task by getting from API or allPRs
  let stepData = null;
  for (const tid in (pr.tasks || {})) {
    if (tid === stepId) {
      stepData = pr.tasks[tid];
      break;
    }
  }
  
  if (!stepData) return;
  
  document.getElementById("editStepTitle").value = stepData.title || "";
  document.getElementById("editStepDesc").value = stepData.desc || "";
  
  const modal = document.getElementById("stepEditModal");
  if (modal) modal.style.display = "flex";
}

async function saveStepEdit() {
  if (!editingHybridPRId || !editingStepId) return;
  
  const title = document.getElementById("editStepTitle").value.trim();
  const desc = document.getElementById("editStepDesc").value.trim();
  
  if (!title) {
    showToast("Veuillez entrer un titre pour l'étape", "error");
    return;
  }
  
  const result = await api(`/api/pr/${editingHybridPRId}/step/${editingStepId}`, "PUT", {
    title: title,
    desc: desc
  });
  
  if (result.error) {
    showToast("Erreur lors de la modification", "error");
    return;
  }
  
  closeModal("stepEditModal");
  selectPR(editingHybridPRId);
  showToast("Étape modifiée avec succès", "success");
}

function openHybridCategoryEdit(prId) {
  editingHybridPRId = prId;
  const pr = allPRs.find(p => p.id === prId);
  if (!pr) return;
  
  document.getElementById("hybridCategoryNameInput").value = pr.category;
  const modal = document.getElementById("hybridCategoryEditModal");
  if (modal) modal.style.display = "flex";
}

async function saveHybridCategoryName() {
  if (!editingHybridPRId) return;
  
  const newName = document.getElementById("hybridCategoryNameInput").value.trim();
  if (!newName) {
    showToast("Veuillez entrer un nom de catégorie", "error");
    return;
  }
  
  const result = await api(`/api/pr/${editingHybridPRId}`, "PUT", {
    category: newName
  });
  
  if (result.error) {
    showToast("Erreur lors de la modification", "error");
    return;
  }
  
  const pr = allPRs.find(p => p.id === editingHybridPRId);
  if (pr) pr.category = newName;
  
  closeModal("hybridCategoryEditModal");
  selectPR(editingHybridPRId);
  showToast("Catégorie modifiée avec succès", "success");
}

async function openAddHybridStepModal(prId) {
  editingHybridPRId = prId;
  document.getElementById("hybridStepTitle").value = "";
  document.getElementById("hybridStepDesc").value = "";
  const modal = document.getElementById("hybridAddStepModal");
  if (modal) modal.style.display = "flex";
}

async function saveNewHybridStep() {
  if (!editingHybridPRId) return;
  
  const title = document.getElementById("hybridStepTitle").value.trim();
  const desc = document.getElementById("hybridStepDesc").value.trim();
  
  if (!title) {
    showToast("Veuillez entrer un titre pour l'étape", "error");
    return;
  }
  
  const result = await api(`/api/pr/${editingHybridPRId}/add-step`, "POST", {
    title: title,
    desc: desc
  });
  
  if (result.error) {
    showToast("Erreur lors de l'ajout de l'étape", "error");
    return;
  }
  
  closeModal("hybridAddStepModal");
  selectPR(editingHybridPRId);
  showToast("Étape ajoutée avec succès", "success");
}

/* ── KPI PROCESSING DELAYS ──────────────────────────────────────────────────── */
async function loadKPIData() {
  await renderKPITable("");
}

function bindKPIControls() {
  const filterSelect = document.getElementById("kpiCategoryFilter");
  const updateBtn = document.getElementById("btnUpdateKPI");
  
  if (filterSelect) {
    filterSelect.addEventListener("change", (e) => {
      renderKPITable(e.target.value);
    });
  }
  
  if (updateBtn) {
    updateBtn.addEventListener("click", async () => {
      updateBtn.disabled = true;
      updateBtn.innerHTML = '<span class="glyphicon glyphicon-refresh" style="animation:spin 1s linear infinite"></span> Mise à jour...';
      await renderKPITable(document.getElementById("kpiCategoryFilter").value);
      updateBtn.disabled = false;
      updateBtn.innerHTML = '<span class="glyphicon glyphicon-refresh"></span> Mise à jour';
      showToast("Délais recalculés avec succès", "success");
    });
  }
}

async function renderKPITable(category = "") {
  const tableBody = document.getElementById("kpiTableBody");
  if (!tableBody) return;
  
  let url = "/api/kpi/processing-delays";
  if (category) {
    url += `?category=${encodeURIComponent(category)}`;
  }
  
  try {
    const data = await api(url);
    
    if (data.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#999">Aucune PR trouvée</td></tr>';
      return;
    }
    
    tableBody.innerHTML = data.map(pr => {
      const indicator = getKPIIndicator(pr.category, pr.delay_weeks, pr.status);
      return `
        <tr>
          <td><strong>PR #${escapeHtml(pr.number)}</strong></td>
          <td>${escapeHtml(pr.title)}</td>
          <td><span class="status-badge status-${pr.category.toLowerCase()}" style="font-size:11px">${pr.category}</span></td>
          <td><strong>${pr.delay_weeks}</strong> semaines</td>
          <td>${statusLabel(pr.status)}</td>
          <td>
            ${indicator}
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error("[v0] Failed to load KPI data:", err);
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#c00">Erreur de chargement des données</td></tr>';
  }
}

function getKPIIndicator(category, delayWeeks, status) {
  if (status !== "cloturee") {
    return '<span class="kpi-indicator warning"><span class="glyphicon glyphicon-time"></span> En cours</span>';
  }
  
  let maxWeeks = 0;
  if (category === "ED") maxWeeks = 10;
  else if (category === "CR") maxWeeks = 11;
  else if (category === "COU") maxWeeks = 14;
  else if (category === "Hybride") maxWeeks = 14; // Default to 14 for hybrid
  
  if (maxWeeks === 0) {
    return '<span class="kpi-indicator warning"><span class="glyphicon glyphicon-question-sign"></span> N/A</span>';
  }
  
  if (delayWeeks <= maxWeeks) {
    return `<span class="kpi-indicator ontime"><span class="glyphicon glyphicon-ok"></span> À temps</span>`;
  } else {
    const excess = (delayWeeks - maxWeeks).toFixed(1);
    return `<span class="kpi-indicator late"><span class="glyphicon glyphicon-alert"></span> +${excess}s</span>`;
  }
}

/* ── LOAD ALL PR ────────────────────────────────────────────────────────────── */
async function loadPRList(query = "") {
  const url = query ? `/api/pr?q=${encodeURIComponent(query)}` : "/api/pr";
  allPRs = await fetch(url).then(r => r.json());
  renderPRList();
  updateDashboard();
}

/* ── RENDER PR LIST ─────────────────────────────────────────────────────────── */
function renderPRList() {
  const container = document.getElementById("prList");
  const badge     = document.getElementById("prCountBadge");
  badge.textContent = allPRs.length;

  if (!allPRs.length) {
    container.innerHTML = `
      <div class="no-pr">
        <span class="glyphicon glyphicon-inbox"></span>
        <p>Aucune demande trouvée</p>
      </div>`;
    return;
  }

  container.innerHTML = allPRs.map(pr => {
    let lateIndicator = "";
    if (pr.late_steps > 0) {
      lateIndicator = `<span class="pr-delay-badge badge-late" title="${pr.late_steps} étape(s) en retard">
        <span class="glyphicon glyphicon-warning-sign"></span> ${pr.late_steps} retard
      </span>`;
    } else if (pr.warning_steps > 0) {
      lateIndicator = `<span class="pr-delay-badge badge-warning" title="${pr.warning_steps} étape(s) à risque">
        <span class="glyphicon glyphicon-time"></span> ${pr.warning_steps} risque
      </span>`;
    }
    
    let exceedIndicator = "";
    if (pr.exceeded) {
      exceedIndicator = `<span class="pr-delay-badge badge-exceed" title="Délai max dépassé (${pr.processing_weeks} / ${pr.max_weeks} semaines)">
        <span class="glyphicon glyphicon-alert"></span> Dépassé
      </span>`;
    }
    
    return `
    <div class="pr-item ${pr.id === selectedPRId ? "selected" : ""}" data-id="${pr.id}" onclick="selectPR('${pr.id}')">
      <div class="pr-item-top">
        <div>
          <div class="pr-item-number">PR #${pr.number}</div>
          <div class="pr-item-title" title="${escHtml(pr.title)}">${escHtml(pr.title)}</div>
        </div>
        <div class="pr-item-actions">
          <button class="pr-action-btn edit-btn" title="Modifier" onclick="editPR(event,'${pr.id}')">
            <span class="glyphicon glyphicon-pencil"></span>
          </button>
          <button class="pr-action-btn del-btn" title="Supprimer" onclick="deletePR(event,'${pr.id}')">
            <span class="glyphicon glyphicon-trash"></span>
          </button>
        </div>
      </div>
      <div class="pr-item-meta">
        <span class="pr-cat-badge">${pr.category}</span>
        <span class="pr-date"><span class="glyphicon glyphicon-calendar"></span> ${pr.createdDate}</span>
      </div>
      <div class="pr-item-progress" style="margin-bottom:4px">
        <div class="mini-progress-track">
          <div class="mini-progress-fill" style="width:${pr.progress}%"></div>
        </div>
        <span class="mini-progress-pct">${pr.progress}%</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px">
        <span class="status-badge status-${pr.status.replace("-", "")}"
              onclick="openStatusMenu(event,'${pr.id}')" data-id="${pr.id}">
          ${statusDot(pr.status)} ${statusLabel(pr.status)}
        </span>
        <small style="color:var(--grey-400);font-size:10px">${pr.completed_tasks}/${pr.total_tasks} étapes</small>
      </div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">
        ${lateIndicator}
        ${exceedIndicator}
      </div>
    </div>`;
  }).join("");
}

function statusLabel(s) {
  return { "en-cours": "En Cours", "cloturee": "Clôturée", "blockee": "Bloquée", "annulee": "Annulée" }[s] || s;
}
function statusDot(s) {
  const c = { "en-cours": "#FFC107", "cloturee": "#28A745", "blockee": "#C0392B", "annulee": "#BDBDBD" }[s] || "#ccc";
  return `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${c};margin-right:2px"></span>`;
}
function escHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ── DELAY ICON ─────────────────────────────────────────────────────────────── */
function delayIcon(delay) {
  if (delay === "ontime") {
    return `<span class="delay-icon delay-ontime" title="Dans les délais">
              <span class="glyphicon glyphicon-ok-circle"></span>
            </span>`;
  }
  if (delay === "warning") {
    return `<span class="delay-icon delay-warning" title="Risque de retard (1–5 jours)">
              <span class="glyphicon glyphicon-time"></span>
            </span>`;
  }
  if (delay === "late") {
    return `<span class="delay-icon delay-late" title="En retard (plus de 5 jours)">
              <span class="glyphicon glyphicon-warning-sign"></span>
            </span>`;
  }
  return "";
}

/* ── DASHBOARD ──────────────────────────────────────────────────────────────── */
function updateDashboard() {
  const total    = allPRs.length;
  const cloturee = allPRs.filter(p => p.status === "cloturee").length;
  const enCours  = allPRs.filter(p => p.status === "en-cours").length;
  const blockee  = allPRs.filter(p => p.status === "blockee").length;
  const annulee  = allPRs.filter(p => p.status === "annulee").length;
  const avgProg  = total ? Math.round(allPRs.reduce((a, p) => a + p.progress, 0) / total) : 0;
  const totalLate    = allPRs.reduce((a, p) => a + (p.late_steps || 0), 0);
  const totalWarning = allPRs.reduce((a, p) => a + (p.warning_steps || 0), 0);

  animateCount("kpiTotal",    total);
  animateCount("kpiAvg",      avgProg);
  animateCount("kpiCloturee", cloturee);
  animateCount("kpiEnCours",  enCours);
  animateCount("kpiBlockee",  blockee);
  animateCount("kpiAnnulee",  annulee);

  const donutTotalEl = document.getElementById("donutTotal");
  if (donutTotalEl) donutTotalEl.textContent = total;

  renderDonut(cloturee, enCours, blockee, annulee);
  renderStatusBars(total, cloturee, enCours, blockee, annulee);
  renderRecentActivity();
  renderAlertBanner(totalLate, totalWarning);
  loadAndRenderAlerts();
}

function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const start    = parseInt(el.textContent) || 0;
  const duration = 600;
  let start_time = null;
  const step = (timestamp) => {
    if (!start_time) start_time = timestamp;
    const progress = Math.min((timestamp - start_time) / duration, 1);
    el.textContent = Math.round(start + (target - start) * easeOut(progress));
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

function renderDonut(cloturee, enCours, blockee, annulee) {
  const ctx = document.getElementById("donutChart");
  if (!ctx) return;
  const data   = [enCours, cloturee, blockee, annulee];
  const colors = ["#FFC107", "#28A745", "#C0392B", "#BDBDBD"];
  const labels = ["En Cours", "Clôturée", "Bloquée", "Annulée"];

  if (donutChart) donutChart.destroy();
  donutChart = new Chart(ctx, {
    type: "doughnut",
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 6 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: "72%",
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.label}: ${c.raw}` } } }
    }
  });

  const legend = document.getElementById("donutLegend");
  if (legend) {
    legend.innerHTML = labels.map((l, i) => `
      <div class="legend-item">
        <span class="legend-dot" style="background:${colors[i]}"></span>
        <span class="legend-name">${l}</span>
        <span class="legend-count">${data[i]}</span>
      </div>`).join("");
  }
}

function renderStatusBars(total, cloturee, enCours, blockee, annulee) {
  const container = document.getElementById("statusBars");
  if (!container) return;
  const max   = Math.max(cloturee, enCours, blockee, annulee, 1);
  const items = [
    { label: "En Cours", count: enCours,  color: "#FFC107" },
    { label: "Clôturée", count: cloturee, color: "#28A745" },
    { label: "Bloquée",  count: blockee,  color: "#C0392B" },
    { label: "Annulée",  count: annulee,  color: "#BDBDBD" },
  ];
  container.innerHTML = items.map(item => `
    <div class="status-bar-item">
      <div class="status-bar-label">
        <span class="status-bar-name">${item.label}</span>
        <span class="status-bar-count">${item.count}</span>
      </div>
      <div class="status-bar-track">
        <div class="status-bar-fill" style="width:${(item.count / max) * 100}%;background:${item.color}"></div>
      </div>
    </div>`).join("");
}

function renderRecentActivity() {
  const container = document.getElementById("recentActivity");
  if (!container) return;
  const recent = [...allPRs].sort((a, b) => b.createdDate.localeCompare(a.createdDate)).slice(0, 5);
  if (!recent.length) {
    container.innerHTML = `<div class="no-activity"><span class="glyphicon glyphicon-inbox"></span><p>Aucune PR pour le moment</p></div>`;
    return;
  }
  const icons = { "ED": "#E74C3C", "CR": "#3498DB", "COU": "#2ECC71", "Hybride": "#9B59B6" };
  container.innerHTML = recent.map(pr => `
    <div class="activity-item" onclick="selectPR('${pr.id}')">
      <div class="activity-icon" style="background:${icons[pr.category] || "#ccc"}22;color:${icons[pr.category] || "#999"}">
        <span class="glyphicon glyphicon-file"></span>
      </div>
      <div class="activity-body">
        <div class="activity-num">PR #${pr.number} — ${pr.category}</div>
        <div class="activity-title" title="${escHtml(pr.title)}">${escHtml(pr.title)}</div>
        <div class="activity-date">${pr.createdDate}</div>
      </div>
      <div>
        <span class="status-badge status-${pr.status.replace("-", "")}">${statusLabel(pr.status)}</span>
      </div>
    </div>`).join("");
}

/* ── ALERT BANNER ───────────────────────────────────────────────────────────── */
function renderAlertBanner(totalLate, totalWarning) {
  const banner = document.getElementById("alertBanner");
  if (!banner) return;
  if (totalLate === 0 && totalWarning === 0) {
    banner.style.display = "none";
    return;
  }
  banner.style.display = "flex";
  let msg = "";
  if (totalLate > 0) {
    msg += `<span class="alert-item alert-late">
              <span class="glyphicon glyphicon-warning-sign"></span>
              <strong>${totalLate}</strong> étape${totalLate > 1 ? "s" : ""} en retard critique
            </span>`;
  }
  if (totalWarning > 0) {
    msg += `<span class="alert-item alert-warning">
              <span class="glyphicon glyphicon-time"></span>
              <strong>${totalWarning}</strong> étape${totalWarning > 1 ? "s" : ""} à risque de retard
            </span>`;
  }
  const msgEl = document.getElementById("alertBannerMsg");
  if (msgEl) msgEl.innerHTML = msg;
}

async function loadAndRenderAlerts() {
  const container = document.getElementById("alertsList");
  if (!container) return;
  const alerts = await fetch("/api/alerts").then(r => r.json());
  const panel   = document.getElementById("alertsPanel");

  if (!alerts.length) {
    if (panel) panel.style.display = "none";
    return;
  }
  if (panel) panel.style.display = "block";

  container.innerHTML = alerts.map(a => `
    <div class="alert-row alert-row-${a.delay}" onclick="selectPR('${a.pr_id}')">
      <div class="alert-row-icon">
        ${a.delay === "late"
          ? `<span class="glyphicon glyphicon-warning-sign"></span>`
          : `<span class="glyphicon glyphicon-time"></span>`}
      </div>
      <div class="alert-row-body">
        <div class="alert-row-pr">PR #${a.pr_number} — <span class="alert-row-title">${escHtml(a.pr_title)}</span></div>
        <div class="alert-row-step">Étape ${a.task_id} : ${escHtml(a.task_title)}</div>
        <div class="alert-row-dates">
          <span><span class="glyphicon glyphicon-calendar"></span> Prév : ${a.date_prev || "—"}</span>
          <span><span class="glyphicon glyphicon-ok"></span> Réelle : ${a.date_reelle || "—"}</span>
        </div>
      </div>
      <div class="alert-row-badge">
        ${a.delay === "late"
          ? `<span class="delay-chip chip-late">En retard</span>`
          : `<span class="delay-chip chip-warning">Risque</span>`}
      </div>
    </div>`).join("");
}

/* ── SELECT PR — SHOW CHECKLIST ─────────────────────────────────────────────── */
async function selectPR(prId) {
  selectedPRId = prId;
  renderPRList();
  const pr = await api(`/api/pr/${prId}`);
  if (pr.error) return showToast(pr.error, "error");

  showView("checklistView");

  document.getElementById("checklistTitle").textContent    = `PR #${pr.number} — ${pr.title}`;
  document.getElementById("checklistSubtitle").textContent = `${pr.category} · ${pr.createdDate}`;

  const meta = document.getElementById("checklistMeta");
  let metaHTML = `<div><strong>Catégorie :</strong> ${pr.category}</div>
                  <div><strong>Statut :</strong> ${statusLabel(pr.status)}</div>
                  <div><strong>Date :</strong> ${pr.createdDate}</div>`;
  
  // Add Hybrid buttons if applicable
  if (pr.category === "Hybride") {
    metaHTML += `<div style="margin-top:12px;display:flex;gap:8px">
      <button class="btn-primary" onclick="openHybridCategoryEdit('${pr.id}')" style="padding:6px 12px;font-size:12px">
        <span class="glyphicon glyphicon-pencil"></span> Renommer
      </button>
      <button class="btn-primary" onclick="openAddHybridStepModal('${pr.id}')" style="padding:6px 12px;font-size:12px;background:#27AE60">
        <span class="glyphicon glyphicon-plus"></span> Ajouter étape
      </button>
    </div>`;
  }
  
  meta.innerHTML = metaHTML;

  renderChecklist(prId, pr.tasks, pr.progress);
  
  // Show processing time info
  showProcessingTimeInfo(pr);
}

function showProcessingTimeInfo(pr) {
  const prData = allPRs.find(p => p.id === pr.id);
  if (!prData) return;
  
  const infoDiv = document.getElementById("processingTimeInfo");
  const textSpan = document.getElementById("processingTimeText");
  
  if (prData.processing_weeks === 0) {
    infoDiv.style.display = "none";
    return;
  }
  
  const limits = processingLimits[prData.category] || {};
  const maxWeeks = limits.max_weeks || 0;
  const isExceeded = prData.exceeded;
  
  let message = `<strong>Durée totale :</strong> ${prData.processing_weeks} semaine${prData.processing_weeks > 1 ? 's' : ''} `;
  if (maxWeeks > 0) {
    message += `/ ${maxWeeks} semaines max`;
    if (isExceeded) {
      message += ` <span style="color:#C0392B;font-weight:bold;">— Délai dépassé !</span>`;
      infoDiv.style.background = "#F8D7DA";
      infoDiv.style.borderColor = "#F5C6CB";
      infoDiv.style.color = "#721C24";
    } else {
      infoDiv.style.background = "#D4EDDA";
      infoDiv.style.borderColor = "#C3E6CB";
      infoDiv.style.color = "#155724";
    }
  }
  
  textSpan.innerHTML = message;
  infoDiv.style.display = "block";
}

function renderChecklist(prId, tasks, progress) {
  updateProgressUI(progress);
  const container = document.getElementById("checklistContainer");
  if (!tasks || !Object.keys(tasks).length) {
    container.innerHTML = `<p style="color:var(--grey-400)">Aucune étape définie.</p>`;
    return;
  }
  
  const pr = allPRs.find(p => p.id === prId);
  const isHybride = pr && pr.category === "Hybride";
  
  container.innerHTML = Object.entries(tasks).map(([tid, task]) => {
    const done  = task.done;
    const delay = task.delay || "";
    const editBtn = isHybride ? `<button class="btn-step-edit" onclick="openStepEdit('${prId}','${tid}')" title="Modifier"><span class="glyphicon glyphicon-pencil"></span></button>` : '';
    return `
    <div class="task-item ${done ? "task-done" : ""} ${delay ? "task-delay-" + delay : ""}" id="taskItem-${tid}">
      <div class="task-header" onclick="toggleTaskBody('${tid}')">
        <div class="task-num">${tid}</div>
        <div class="task-checkbox ${done ? "checked" : ""}" onclick="toggleTask(event,'${prId}','${tid}')"></div>
        <div class="task-info">
          <div class="task-title">${escHtml(task.title)} ${delayIcon(delay)}</div>
          <div class="task-desc">${escHtml(task.desc)}</div>
        </div>
        ${editBtn}
        <button class="task-toggle-btn" id="toggleBtn-${tid}">
          <span class="glyphicon glyphicon-chevron-down"></span>
        </button>
      </div>
      <div class="task-body" id="taskBody-${tid}">
        <div class="task-fields">
          <div class="task-field">
            <label><span class="glyphicon glyphicon-calendar"></span> Date prévisionnelle</label>
            <input type="date" class="input-custom" value="${task.date_prev || ""}"
                   onchange="handleDatePrev('${prId}','${tid}',this.value)" />
          </div>
          <div class="task-field">
            <label><span class="glyphicon glyphicon-ok"></span> Date réelle</label>
            <input type="date" class="input-custom" value="${task.date_reelle || ""}"
                   onchange="handleDateReelle('${prId}','${tid}',this.value)" />
          </div>
          <div class="task-field task-field-full">
            <label><span class="glyphicon glyphicon-comment"></span> Notes / Commentaires</label>
            <textarea class="task-note-area" placeholder="Ajouter une note..."
                      onchange="updateTaskField('${prId}','${tid}','note',this.value)">${escHtml(task.note || "")}</textarea>
          </div>
        </div>
        <div class="task-delay-status" id="delayStatus-${tid}">
          ${renderDelayStatus(delay, task.date_prev, task.date_reelle)}
        </div>
      </div>
    </div>`;
  }).join("");
}

function renderDelayStatus(delay, datePrev, dateReelle) {
  if (!datePrev || !dateReelle) return "";
  const labels = {
    "ontime":  `<span class="delay-status-chip chip-ontime"><span class="glyphicon glyphicon-ok-circle"></span> Dans les délais</span>`,
    "warning": `<span class="delay-status-chip chip-warning"><span class="glyphicon glyphicon-time"></span> Risque de retard (1–5 jours)</span>`,
    "late":    `<span class="delay-status-chip chip-late"><span class="glyphicon glyphicon-warning-sign"></span> En retard (plus de 5 jours)</span>`,
  };
  return labels[delay] || "";
}

function toggleTaskBody(tid) {
  const body = document.getElementById(`taskBody-${tid}`);
  const btn  = document.getElementById(`toggleBtn-${tid}`);
  if (!body || !btn) return;
  body.classList.toggle("open");
  btn.classList.toggle("open");
}

async function toggleTask(event, prId, tid) {
  event.stopPropagation();
  const checkbox = event.currentTarget;
  const done     = !checkbox.classList.contains("checked");
  const res      = await api(`/api/pr/${prId}/task/${tid}`, "PATCH", { done });
  checkbox.classList.toggle("checked", done);
  const item = document.getElementById(`taskItem-${tid}`);
  if (item) item.classList.toggle("task-done", done);
  updateProgressUI(res.progress);
  // refresh mini progress in sidebar list
  const listFill = document.querySelector(`.pr-item[data-id="${prId}"] .mini-progress-fill`);
  if (listFill) listFill.style.width = res.progress + "%";
  const listPct = document.querySelector(`.pr-item[data-id="${prId}"] .mini-progress-pct`);
  if (listPct) listPct.textContent = res.progress + "%";
  const pr = allPRs.find(p => p.id === prId);
  if (pr) {
    pr.progress       = res.progress;
    pr.late_steps    = res.late_steps;
    pr.warning_steps = res.warning_steps;
    updateDashboard();
  }
}

async function handleDateReelle(prId, tid, value) {
  const res = await api(`/api/pr/${prId}/task/${tid}`, "PATCH", { date_reelle: value });
  refreshTaskDelayUI(prId, tid, res);
}

async function handleDatePrev(prId, tid, value) {
  const res = await api(`/api/pr/${prId}/task/${tid}`, "PATCH", { date_prev: value });
  refreshTaskDelayUI(prId, tid, res);
}

function refreshTaskDelayUI(prId, tid, res) {
  const delay = res.delay || "";
  // Update delay icon in title
  const titleEl = document.querySelector(`#taskItem-${tid} .task-title`);
  if (titleEl) {
    // Strip previous icon (last child span.delay-icon) and re-append
    const existingIcon = titleEl.querySelector(".delay-icon");
    if (existingIcon) existingIcon.remove();
    if (delay) titleEl.insertAdjacentHTML("beforeend", " " + delayIcon(delay));
  }
  // Update delay status chip
  const statusEl = document.getElementById(`delayStatus-${tid}`);
  if (statusEl) {
    const prevInput   = document.querySelector(`#taskItem-${tid} input[type=date]:first-of-type`);
    const reelleInput = document.querySelector(`#taskItem-${tid} input[type=date]:last-of-type`);
    statusEl.innerHTML = renderDelayStatus(
      delay,
      prevInput   ? prevInput.value   : "",
      reelleInput ? reelleInput.value : ""
    );
  }
  // Update border color class
  const item = document.getElementById(`taskItem-${tid}`);
  if (item) {
    item.classList.remove("task-delay-ontime", "task-delay-warning", "task-delay-late");
    if (delay) item.classList.add("task-delay-" + delay);
  }
  // Refresh sidebar PR card and dashboard
  const pr = allPRs.find(p => p.id === prId);
  if (pr) {
    pr.late_steps    = res.late_steps    || 0;
    pr.warning_steps = res.warning_steps || 0;
    renderPRList();
    renderAlertBanner(
      allPRs.reduce((a, p) => a + (p.late_steps || 0), 0),
      allPRs.reduce((a, p) => a + (p.warning_steps || 0), 0)
    );
    loadAndRenderAlerts();
    // Refresh processing time display if this PR is currently selected
    if (selectedPRId === prId) {
      loadPRList("").then(() => {
        const updatedPR = allPRs.find(p => p.id === prId);
        if (updatedPR) {
          showProcessingTimeInfo(updatedPR);
        }
      });
    }
  }
}

async function updateTaskField(prId, tid, field, value) {
  await api(`/api/pr/${prId}/task/${tid}`, "PATCH", { [field]: value });
}

function updateProgressUI(progress) {
  const bar  = document.getElementById("progressBarFill");
  const pct  = document.getElementById("progressPct");
  const ring = document.getElementById("ringFill");
  const rl   = document.getElementById("ringLabel");
  const circ = 175.93;
  if (bar)  bar.style.width = progress + "%";
  if (pct)  pct.textContent = progress + "%";
  if (ring) ring.style.strokeDashoffset = circ - (circ * progress / 100);
  if (rl)   rl.textContent = progress + "%";
}

/* ── FORM — CREATE / EDIT ───────────────────────────────────────────────────── */
function bindForm() {
  document.querySelectorAll(".cat-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".cat-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("prCategory").value = btn.dataset.cat;
    });
  });

  document.getElementById("prForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const editingId = document.getElementById("editingId").value;
    const body = {
      number:   document.getElementById("prNumber").value,
      title:    document.getElementById("prTitle").value.trim(),
      category: document.getElementById("prCategory").value,
      prDate:   document.getElementById("prDate").value,
    };
    
    if (!body.number || !body.title || !body.category || !body.prDate) {
      return showToast("Veuillez remplir tous les champs", "error");
    }
    let res;
    if (editingId) {
      res = await api(`/api/pr/${editingId}`, "PUT", body);
    } else {
      res = await api("/api/pr", "POST", body);
    }
    if (res.error) return showToast(res.error, "error");
    showToast(editingId ? "PR mise à jour" : "PR créée avec succès", "success");
    resetForm();
    await loadPRList();
  });

  document.getElementById("btnCancel").addEventListener("click", resetForm);
}

function resetForm() {
  document.getElementById("editingId").value   = "";
  document.getElementById("prNumber").value    = "";
  document.getElementById("prTitle").value     = "";
  document.getElementById("prDate").value      = "";
  document.getElementById("prCategory").value  = "";
  document.querySelectorAll(".cat-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("formTitle").textContent   = "Nouvelle Demande";
  document.getElementById("submitLabel").textContent = "Créer la PR";
  document.getElementById("btnCancel").style.display = "none";
}

async function editPR(event, prId) {
  event.stopPropagation();
  const pr = await api(`/api/pr/${prId}`);
  if (pr.error) return showToast(pr.error, "error");
  document.getElementById("editingId").value  = prId;
  document.getElementById("prNumber").value   = pr.number;
  document.getElementById("prTitle").value    = pr.title;
  document.getElementById("prDate").value     = pr.createdDate;
  document.getElementById("prCategory").value = pr.category;
  document.querySelectorAll(".cat-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.cat === pr.category);
  });
  document.getElementById("formTitle").textContent   = "Modifier la PR";
  document.getElementById("submitLabel").textContent = "Enregistrer";
  document.getElementById("btnCancel").style.display = "";
  document.getElementById("prNumber").scrollIntoView({ behavior: "smooth" });
}

async function deletePR(event, prId) {
  event.stopPropagation();
  const result = await Swal.fire({
    title: "Supprimer cette PR ?",
    text:  "Cette action est irréversible.",
    icon:  "warning",
    showCancelButton:    true,
    confirmButtonColor:  "#C0392B",
    cancelButtonColor:   "#95A5A6",
    confirmButtonText:   "Supprimer",
    cancelButtonText:    "Annuler",
  });
  if (!result.isConfirmed) return;
  const res = await api(`/api/pr/${prId}`, "DELETE");
  if (res.error) return showToast(res.error, "error");
  showToast("PR supprimée", "success");
  if (selectedPRId === prId) {
    selectedPRId = null;
    showView("dashboardView");
  }
  await loadPRList();
}

/* ── SEARCH ─────────────────────────────────────────────────────────────────── */
function bindSearch() {
  let debounceTimer;
  document.getElementById("searchInput").addEventListener("input", (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => loadPRList(e.target.value), 250);
  });
}

/* ── STATUS DROPDOWN ─────────────────────────────────────────────────────────── */
let activeStatusPRId = null;

function openStatusMenu(event, prId) {
  event.stopPropagation();
  activeStatusPRId = prId;
  const dropdown = document.getElementById("statusDropdown");
  dropdown.style.display = "block";
  const rect = event.currentTarget.getBoundingClientRect();
  dropdown.style.top  = (rect.bottom + 4 + window.scrollY) + "px";
  dropdown.style.left = rect.left + "px";
}

function bindStatusDropdown() {
  document.querySelectorAll(".status-option").forEach(opt => {
    opt.addEventListener("click", async () => {
      const status = opt.dataset.status;
      const res    = await api(`/api/pr/${activeStatusPRId}/status`, "PATCH", { status });
      if (res.error) return showToast(res.error, "error");
      document.getElementById("statusDropdown").style.display = "none";
      showToast("Statut mis à jour", "success");
      await loadPRList();
    });
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".status-dropdown") && !e.target.closest(".status-badge")) {
      document.getElementById("statusDropdown").style.display = "none";
    }
  });
}

/* ── IMPORT / EXPORT ─────────────────────────────────────────────────────────── */
function bindImportExport() {
  document.getElementById("btnImport").addEventListener("click", () => {
    document.getElementById("importFileInput").click();
  });

  document.getElementById("importFileInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res  = await fetch("/api/import", { method: "POST", body: formData });
      const json = await res.json();
      if (json.error) return showToast(json.error, "error");
      showToast(json.message, "success");
      await loadPRList();
    } catch (err) {
      showToast("Erreur lors de l'import", "error");
    }
    e.target.value = "";
  });

  document.getElementById("btnExportModal").addEventListener("click", () => {
    document.getElementById("exportModal").classList.add("open");
  });

  document.getElementById("btnDoExport").addEventListener("click", () => {
    const from = document.getElementById("exportFrom").value;
    const to   = document.getElementById("exportTo").value;
    let url    = "/api/export";
    const params = [];
    if (from) params.push(`from=${from}`);
    if (to)   params.push(`to=${to}`);
    if (params.length) url += "?" + params.join("&");
    window.location.href = url;
    document.getElementById("exportModal").classList.remove("open");
    showToast("Export en cours...", "success");
  });
}

/* ── MODAL ──────────────────────────────────────────────────────────────────── */
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = "none";
  }
}

// Close modal when clicking outside of modal-content
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal")) {
    e.target.style.display = "none";
  }
});

function bindModalClose() {
  document.getElementById("closeExportModal").addEventListener("click", () => {
    document.getElementById("exportModal").classList.remove("open");
  });
  document.getElementById("cancelExport").addEventListener("click", () => {
    document.getElementById("exportModal").classList.remove("open");
  });
  document.getElementById("exportModal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("exportModal"))
      document.getElementById("exportModal").classList.remove("open");
  });
  document.getElementById("btnBackToDash").addEventListener("click", () => {
    selectedPRId = null;
    renderPRList();
    showView("dashboardView");
  });
}

/* ── VIEW TOGGLE ─────────────────────────────────────────────────────────────── */
function showView(viewId) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active-view"));
  const view = document.getElementById(viewId);
  if (view) view.classList.add("active-view");
}

/* ── TOAST ──────────────────────────────────────────────────────────────────── */
function showToast(message, type = "success") {
  const existing = document.querySelector(".toast-notification");
  if (existing) existing.remove();
  const icon  = type === "success"
    ? '<span class="glyphicon glyphicon-ok-circle"></span>'
    : '<span class="glyphicon glyphicon-exclamation-sign"></span>';
  const toast = document.createElement("div");
  toast.className = `toast-notification toast-${type}`;
  toast.innerHTML = `${icon} ${message}`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}
