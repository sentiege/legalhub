/* =============================================
   JurisParaguay — Lógica Principal
   ============================================= */

// JSON habilitados para búsqueda global — todos los códigos del repositorio
const JSON_CODIGOS = [
  { id: 'codigo-civil',               nombre: 'Código Civil',                          path: 'codigos/codigocivil/codigo_civil_completo.json' },
  { id: 'codigo-penal',               nombre: 'Código Penal',                          path: 'codigos/codigopenal/codigo_penal_completo.json' },
  { id: 'codigo-ninez',               nombre: 'Código de la Niñez y Adolescencia',     path: 'codigos/codigoninez/codigo_ninez_completo.json' },
  { id: 'codigo-ejecucion-penal',     nombre: 'Código de Ejecución Penal',             path: 'codigos/codigoejecucionpenal/codigo_ejecucionpenal_completo.json' },
  { id: 'codigo-laboral',             nombre: 'Código Laboral',                        path: 'codigos/codigolaboral/codigo_laboral_completo.json' },
  { id: 'codigo-procesal-civil',      nombre: 'Código Procesal Civil',                 path: 'codigos/codigoprocesalcivil/codigo_procesal_civil_completo.json' },
  { id: 'codigo-procesal-penal',      nombre: 'Código Procesal Penal',                 path: 'codigos/codigoprocesalpenal/codigo_procesalpenal_completo.json' },
  { id: 'codigo-procesal-laboral',    nombre: 'Código Procesal Laboral',               path: 'codigos/codigoprocesallaboral/codigo_procesallaboral_completo.json' },
  { id: 'codigo-organizacion-judicial', nombre: 'Código de Organización Judicial',     path: 'codigos/codigoorganizacionjudicial/codigo_organizacion_judicial_completo.json' },
  { id: 'codigo-electoral',           nombre: 'Código Electoral',                      path: 'codigos/codigoelectoral/codigo_electoral_completo.json' },
  { id: 'codigo-navegacion',          nombre: 'Código de Navegación Fluvial y Marítima', path: 'codigos/codigonavegacion/codigo_navegacion_completo.json' },
  { id: 'codigo-aeronautico',         nombre: 'Código Aeronáutico',                    path: 'codigos/codigoaeronautico/codigo_aeronautico_completo.json' },
  { id: 'codigo-rural',               nombre: 'Código Rural',                          path: 'codigos/codigorural/codigo_rural_completo.json' },
  { id: 'codigo-aduanero',            nombre: 'Código Aduanero',                       path: 'codigos/codigoaduanero/codigo_aduanero_completo.json' },
  { id: 'codigo-mineria',             nombre: 'Código de Minería',                     path: 'codigos/codigomineria/codigo_minero_completo.json' },
  { id: 'codigo-sanitario',           nombre: 'Código Sanitario',                      path: 'codigos/codigosanitario/codigo_sanitario_completo.json' },
];

// Índice global: array de artículos de todos los códigos cargados
let INDICE_GLOBAL = [];
let indiceListoPromise = null;

/* ─── Utilidades ──────────────────────────────────────────────── */
function normalize(str) {
  return (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function highlight(str, query) {
  if (!query || !str) return str || '';
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return str.replace(re, '<mark style="background:rgba(201,162,39,.45);border-radius:2px;padding:0 2px">$1</mark>');
}

function extractArticulos(node, out) {
  if (!node || typeof node !== 'object') return;
  if ('numero' in node && (node.texto || node.epigrafe !== undefined)) {
    out.push(node);
    return;
  }
  const knownKeys = [
    'articulos','articulo','arts','artículos',
    'capitulos','capitulo','subcapitulos','subcapitulo',
    'titulos','titulo','libros','libro',
    'partes','parte','secciones','seccion','items'
  ];
  let handled = false;
  for (const k of knownKeys) {
    if (Array.isArray(node[k]) && node[k].length) {
      node[k].forEach(c => extractArticulos(c, out));
      handled = true;
    }
  }
  if (!handled) {
    for (const k of Object.keys(node)) {
      if (Array.isArray(node[k])) node[k].forEach(c => extractArticulos(c, out));
    }
  }
}

/* ─── Carga e indexado ────────────────────────────────────────── */
async function cargarIndiceGlobal() {
  const resultados = await Promise.allSettled(
    JSON_CODIGOS.map(async (cod) => {
      const res = await fetch(cod.path);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const arts = [];
      extractArticulos(data, arts);
      return { cod, arts };
    })
  );

  INDICE_GLOBAL = [];
  resultados.forEach(r => {
    if (r.status !== 'fulfilled') return;
    const { cod, arts } = r.value;
    const cat = CATEGORIAS.flatMap(c => c.codigos).find(c => c.id === cod.id);
    arts.forEach(art => {
      INDICE_GLOBAL.push({
        codigoId:      cod.id,
        codigoNombre:  cod.nombre,
        codigoUrl:     cat ? cat.internalUrl : '#',
        numero:        art.numero,
        epigrafe:      art.epigrafe || '',
        texto:         art.texto || [],
        palabrasClave: art.palabrasClave || [],
      });
    });
  });
}

/* ─── Renderizado de categorías ───────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  renderCategorias(CATEGORIAS);
  // Precargar índice en background
  indiceListoPromise = cargarIndiceGlobal().catch(() => {});
});

function renderCategorias(cats) {
  const grid = document.getElementById('categorias-grid');
  grid.innerHTML = '';

  if (!cats.length) {
    grid.innerHTML = '<div class="empty-state"><div class="big">🔎</div><p>No se encontraron resultados para esa búsqueda.</p></div>';
    return;
  }

  cats.forEach(cat => {
    if (!cat.codigos.length) return;
    const card = document.createElement('div');
    card.className = 'categoria-card';
    card.innerHTML = `
      <div class="categoria-card__header" style="background:${cat.color}">
        <span class="icon">${cat.icono}</span>
        <h2>${cat.nombre}</h2>
      </div>
      <div class="categoria-card__body">
        ${cat.codigos.map(c => `
          <a href="${c.internalUrl}" class="codigo-item" data-id="${c.id}">
            <span class="codigo-item__num">${c.ley}</span>
            <span class="codigo-item__info">
              <span class="codigo-item__nombre">${c.nombre}</span>
              <span class="codigo-item__desc">${c.descripcion.substring(0, 80)}…</span>
            </span>
          </a>
        `).join('')}
      </div>
    `;
    grid.appendChild(card);
  });
}

/* ─── Búsqueda ────────────────────────────────────────────────── */
async function buscar() {
  const q = document.getElementById('searchInput').value.trim();
  if (!q) {
    renderCategorias(CATEGORIAS);
    ocultarResultadosGlobales();
    return;
  }

  const qn = normalize(q);

  // 1) Búsqueda rápida en metadatos (instantánea)
  const filtradas = CATEGORIAS.map(cat => ({
    ...cat,
    codigos: cat.codigos.filter(c =>
      normalize(c.nombre).includes(qn) ||
      normalize(c.ley).includes(qn) ||
      normalize(c.descripcion).includes(qn)
    )
  })).filter(cat => cat.codigos.length > 0);
  renderCategorias(filtradas);

  // 2) Indicador de carga para búsqueda en artículos
  ocultarResultadosGlobales();
  const main = document.getElementById('codigos');
  const loadingEl = document.createElement('div');
  loadingEl.id = 'resultados-globales';
  loadingEl.style.cssText = 'text-align:center;padding:1.5rem;color:#888;font-size:.92rem';
  loadingEl.innerHTML = '⏳ Buscando en todos los artículos de los 16 códigos…';
  main.appendChild(loadingEl);

  // 3) Esperar índice y buscar
  await indiceListoPromise;

  ocultarResultadosGlobales();

  if (!INDICE_GLOBAL.length) return;

  const matches = INDICE_GLOBAL.filter(art =>
    normalize(art.epigrafe).includes(qn) ||
    art.texto.some(t => normalize(t).includes(qn)) ||
    art.palabrasClave.some(p => normalize(p).includes(qn))
  );

  mostrarResultadosGlobales(matches, q);
}

function mostrarResultadosGlobales(matches, rawQuery) {
  if (!matches.length) return;

  const qn = normalize(rawQuery);

  // Agrupar por código
  const grupos = {};
  matches.forEach(m => {
    if (!grupos[m.codigoId]) {
      grupos[m.codigoId] = { nombre: m.codigoNombre, url: m.codigoUrl, arts: [] };
    }
    grupos[m.codigoId].arts.push(m);
  });

  const container = document.createElement('div');
  container.id = 'resultados-globales';

  const totalCodigos = Object.keys(grupos).length;
  container.innerHTML = `
    <h2 style="margin:2rem 0 1rem;font-size:1.05rem;color:#1a3a5c;font-weight:700">
      🔎 ${matches.length} artículo${matches.length !== 1 ? 's' : ''} encontrado${matches.length !== 1 ? 's' : ''}
      en ${totalCodigos} código${totalCodigos !== 1 ? 's' : ''}
      para "<em>${rawQuery}</em>"
    </h2>
  `;

  Object.values(grupos).forEach(grupo => {
    const section = document.createElement('div');
    section.style.cssText = [
      'background:#fff',
      'border-radius:12px',
      'border:1px solid #dde0e5',
      'margin-bottom:1.2rem',
      'overflow:hidden',
      'box-shadow:0 2px 8px rgba(0,0,0,.06)',
    ].join(';');

    // Cabecera del grupo (código)
    const header = document.createElement('div');
    header.style.cssText = 'background:#1a3a5c;color:#fff;padding:.7rem 1rem;display:flex;align-items:center;justify-content:space-between;gap:.5rem';
    header.innerHTML = `
      <span style="font-weight:600;font-size:.95rem">${grupo.nombre}</span>
      <span style="display:flex;align-items:center;gap:.75rem;flex-shrink:0">
        <span style="font-size:.78rem;opacity:.75">${grupo.arts.length} resultado${grupo.arts.length !== 1 ? 's' : ''}</span>
        <a href="${grupo.url}" style="color:#c9a227;font-size:.8rem;text-decoration:none;white-space:nowrap">Abrir código →</a>
      </span>
    `;
    section.appendChild(header);

    // Artículos (máx. 10 por código)
    grupo.arts.slice(0, 10).forEach(art => {
      const matchedParr = art.texto.find(t => normalize(t).includes(qn));
      let snippet = '';
      if (matchedParr) {
        const idx = normalize(matchedParr).indexOf(qn);
        const start = Math.max(0, idx - 60);
        snippet = (start > 0 ? '…' : '') +
          matchedParr.slice(start, start + 180) +
          (matchedParr.length > start + 180 ? '…' : '');
      }

      const item = document.createElement('a');
      item.href = `${grupo.url}#art-${art.numero}`;
      item.style.cssText = 'display:block;padding:.6rem 1rem;border-top:1px solid #f0f0f0;text-decoration:none;color:inherit;transition:background .15s';
      item.addEventListener('mouseenter', () => item.style.background = '#f5f8ff');
      item.addEventListener('mouseleave', () => item.style.background = '');
      item.innerHTML = `
        <div style="display:flex;align-items:baseline;gap:.5rem;flex-wrap:wrap">
          <span style="font-size:.72rem;font-weight:700;color:#1a3a5c;white-space:nowrap;flex-shrink:0">Art. ${art.numero}</span>
          <span style="font-size:.85rem;font-weight:600">${highlight(art.epigrafe || '(sin epígrafe)', rawQuery)}</span>
        </div>
        ${snippet ? `<div style="font-size:.78rem;color:#555;margin-top:3px;line-height:1.55">${highlight(snippet, rawQuery)}</div>` : ''}
      `;
      section.appendChild(item);
    });

    // Aviso si hay más de 10
    if (grupo.arts.length > 10) {
      const more = document.createElement('div');
      more.style.cssText = 'padding:.45rem 1rem;font-size:.78rem;color:#888;border-top:1px solid #f0f0f0;font-style:italic';
      more.textContent = `… y ${grupo.arts.length - 10} artículos más. Abrí el código para buscar dentro de él.`;
      section.appendChild(more);
    }

    container.appendChild(section);
  });

  document.getElementById('codigos').appendChild(container);
}

function ocultarResultadosGlobales() {
  const el = document.getElementById('resultados-globales');
  if (el) el.remove();
}

/* ─── Enter en el buscador ────────────────────────────────────── */
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.activeElement.id === 'searchInput') buscar();
});
