/* =============================================
   JurisParaguay — Lógica Principal
   ============================================= */

// JSON habilitados para búsqueda global — todos los códigos del repositorio
const JSON_CODIGOS = [
  { id: 'codigo-civil',               nombre: 'Código Civil',                            path: 'codigos/codigocivil/codigo_civil_completo.json' },
  { id: 'codigo-penal',               nombre: 'Código Penal',                            path: 'codigos/codigopenal/codigo_penal_completo.json' },
  { id: 'codigo-ninez',               nombre: 'Código de la Niñez y Adolescencia',       path: 'codigos/codigoninez/codigo_ninez_completo.json' },
  { id: 'codigo-ejecucion-penal',     nombre: 'Código de Ejecución Penal',               path: 'codigos/codigoejecucionpenal/codigo_ejecucionpenal_completo.json' },
  { id: 'codigo-laboral',             nombre: 'Código Laboral',                          path: 'codigos/codigolaboral/codigo_laboral_completo.json' },
  { id: 'codigo-procesal-civil',      nombre: 'Código Procesal Civil',                   path: 'codigos/codigoprocesalcivil/codigo_procesal_civil_completo.json' },
  { id: 'codigo-procesal-penal',      nombre: 'Código Procesal Penal',                   path: 'codigos/codigoprocesalpenal/codigo_procesalpenal_completo.json' },
  { id: 'codigo-procesal-laboral',    nombre: 'Código Procesal Laboral',                 path: 'codigos/codigoprocesallaboral/codigo_procesallaboral_completo.json' },
  { id: 'codigo-organizacion-judicial', nombre: 'Código de Organización Judicial',       path: 'codigos/codigoorganizacionjudicial/codigo_organizacion_judicial_completo.json' },
  { id: 'codigo-electoral',           nombre: 'Código Electoral',                        path: 'codigos/codigoelectoral/codigo_electoral_completo.json' },
  { id: 'codigo-navegacion',          nombre: 'Código de Navegación Fluvial y Marítima', path: 'codigos/codigonavegacion/codigo_navegacion_completo.json' },
  { id: 'codigo-aeronautico',         nombre: 'Código Aeronáutico',                      path: 'codigos/codigoaeronautico/codigo_aeronautico_completo.json' },
  { id: 'codigo-rural',               nombre: 'Código Rural',                            path: 'codigos/codigorural/codigo_rural_completo.json' },
  { id: 'codigo-aduanero',            nombre: 'Código Aduanero',                         path: 'codigos/codigoaduanero/codigo_aduanero_completo.json' },
  { id: 'codigo-mineria',             nombre: 'Código de Minería',                       path: 'codigos/codigomineria/codigo_minero_completo.json' },
  { id: 'codigo-sanitario',           nombre: 'Código Sanitario',                        path: 'codigos/codigosanitario/codigo_sanitario_completo.json' },
];

// Índice global: array de artículos de todos los códigos cargados
let INDICE_GLOBAL = [];
let indiceListoPromise = null;
let cargaProgreso = { total: JSON_CODIGOS.length, listos: 0, fallidos: [] };

/* ─── Utilidades ──────────────────────────────────────────────── */
function normalize(str) {
  return (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function highlight(str, query) {
  if (!query || !str) return str || '';
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return str.replace(re, '<mark>$1</mark>');
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

/* ─── Ranking de relevancia ───────────────────────────────────── */
// Devuelve un score numérico: mayor = más relevante
// Criterios (de mayor a menor peso):
//   10 — coincidencia exacta en epígrafe
//    5 — coincidencia en palabras clave
//    3 — coincidencia en texto (primer párrafo)
//    1 — coincidencia en texto (párrafos siguientes)
//  +2 — la query aparece como palabra entera (no solo subcadena)
function calcScore(art, qn) {
  let score = 0;
  const epNorm   = normalize(art.epigrafe);
  const kwNorms  = (art.palabrasClave || []).map(normalize);
  const texNorms = (art.texto || []).map(normalize);

  // Epígrafe
  if (epNorm.includes(qn)) {
    score += 10;
    if (new RegExp(`\\b${qn}\\b`).test(epNorm)) score += 2;
  }
  // Palabras clave
  if (kwNorms.some(k => k.includes(qn))) {
    score += 5;
    if (kwNorms.some(k => new RegExp(`\\b${qn}\\b`).test(k))) score += 2;
  }
  // Texto — primer párrafo vale más
  texNorms.forEach((t, i) => {
    if (t.includes(qn)) {
      score += i === 0 ? 3 : 1;
      if (new RegExp(`\\b${qn}\\b`).test(t)) score += 1;
    }
  });
  return score;
}

/* ─── Barra de progreso ───────────────────────────────────────── */
function actualizarBarraProgreso() {
  const barra = document.getElementById('jp-progress-bar');
  const texto = document.getElementById('jp-progress-text');
  if (!barra) return;
  const pct = Math.round((cargaProgreso.listos / cargaProgreso.total) * 100);
  barra.style.width = pct + '%';
  if (texto) {
    texto.textContent = cargaProgreso.listos < cargaProgreso.total
      ? `Cargando índice… ${cargaProgreso.listos}/${cargaProgreso.total} códigos`
      : cargaProgreso.fallidos.length
        ? `⚠️ ${cargaProgreso.listos} cargados, ${cargaProgreso.fallidos.length} con error`
        : `✅ ${cargaProgreso.total} códigos listos para búsqueda`;
  }
  if (pct === 100) {
    setTimeout(() => {
      const wrap = document.getElementById('jp-progress-wrap');
      if (wrap) wrap.classList.add('jp-progress--done');
    }, 1200);
  }
}

function mostrarBarraProgreso() {
  let wrap = document.getElementById('jp-progress-wrap');
  if (wrap) return; // ya existe
  wrap = document.createElement('div');
  wrap.id = 'jp-progress-wrap';
  wrap.innerHTML = `
    <span id="jp-progress-text">Cargando índice… 0/${cargaProgreso.total} códigos</span>
    <div class="jp-progress-track"><div id="jp-progress-bar" style="width:0%"></div></div>
  `;
  // Insertarlo debajo del hero
  const hero = document.querySelector('.hero');
  if (hero && hero.nextSibling) {
    hero.parentNode.insertBefore(wrap, hero.nextSibling);
  } else {
    document.body.appendChild(wrap);
  }
}

/* ─── Carga e indexado ────────────────────────────────────────── */
async function cargarIndiceGlobal() {
  mostrarBarraProgreso();
  cargaProgreso = { total: JSON_CODIGOS.length, listos: 0, fallidos: [] };

  const resultados = await Promise.allSettled(
    JSON_CODIGOS.map(async (cod) => {
      const res = await fetch(cod.path);
      if (!res.ok) throw new Error(`HTTP ${res.status} — ${cod.path}`);
      const data = await res.json();
      const arts = [];
      extractArticulos(data, arts);
      // Actualizar progreso en tiempo real (cada JSON al terminar)
      cargaProgreso.listos++;
      actualizarBarraProgreso();
      return { cod, arts };
    })
  );

  INDICE_GLOBAL = [];
  resultados.forEach(r => {
    if (r.status !== 'fulfilled') {
      cargaProgreso.fallidos.push(r.reason?.message || 'Error desconocido');
      console.warn('⚠️ JSON no cargado:', r.reason?.message);
      return;
    }
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
  actualizarBarraProgreso();
}

/* ─── Renderizado de categorías ───────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  renderCategorias(CATEGORIAS);
  // Precargar índice en background inmediatamente
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
let debounceTimer = null;

// Búsqueda en tiempo real — se dispara automáticamente al escribir
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('searchInput');
  if (!input) return;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const q = input.value.trim();
    if (!q) {
      // Limpiar resultados y restaurar grid de categorías
      renderCategorias(CATEGORIAS);
      ocultarResultadosGlobales();
      return;
    }
    // Búsqueda instantánea en metadatos (sin esperar)
    buscarMetadatos(q);
    // Búsqueda profunda con debounce de 400 ms
    debounceTimer = setTimeout(() => buscarArticulos(q), 400);
  });
});

async function buscar() {
  const q = document.getElementById('searchInput').value.trim();
  if (!q) {
    renderCategorias(CATEGORIAS);
    ocultarResultadosGlobales();
    return;
  }
  buscarMetadatos(q);
  await buscarArticulos(q);
}

function buscarMetadatos(q) {
  const qn = normalize(q);
  const filtradas = CATEGORIAS.map(cat => ({
    ...cat,
    codigos: cat.codigos.filter(c =>
      normalize(c.nombre).includes(qn) ||
      normalize(c.ley).includes(qn) ||
      normalize(c.descripcion).includes(qn)
    )
  })).filter(cat => cat.codigos.length > 0);
  renderCategorias(filtradas);
}

async function buscarArticulos(q) {
  const qn = normalize(q);

  // Mostrar indicador de búsqueda en artículos si el índice aún carga
  if (INDICE_GLOBAL.length === 0) {
    ocultarResultadosGlobales();
    const main = document.getElementById('codigos');
    const loadingEl = document.createElement('div');
    loadingEl.id = 'resultados-globales';
    loadingEl.className = 'jp-search-loading';
    loadingEl.innerHTML = '⏳ Esperando que termine de cargar el índice…';
    main.appendChild(loadingEl);
  }

  await indiceListoPromise;
  ocultarResultadosGlobales();
  if (!INDICE_GLOBAL.length) return;

  // Filtrar con score
  const matches = INDICE_GLOBAL
    .map(art => ({ art, score: calcScore(art, qn) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ art }) => art);

  mostrarResultadosGlobales(matches, q);
}

function mostrarResultadosGlobales(matches, rawQuery) {
  if (!matches.length) return;

  const qn = normalize(rawQuery);

  // Agrupar por código (preservando orden de primera aparición = mayor score)
  const grupos = {};
  const orden = [];
  matches.forEach(m => {
    if (!grupos[m.codigoId]) {
      grupos[m.codigoId] = { nombre: m.codigoNombre, url: m.codigoUrl, arts: [] };
      orden.push(m.codigoId);
    }
    grupos[m.codigoId].arts.push(m);
  });

  const container = document.createElement('div');
  container.id = 'resultados-globales';

  const totalCodigos = orden.length;
  container.innerHTML = `
    <h2 class="jp-resultados-titulo">
      🔎 ${matches.length} artículo${matches.length !== 1 ? 's' : ''} encontrado${matches.length !== 1 ? 's' : ''}
      en ${totalCodigos} código${totalCodigos !== 1 ? 's' : ''}
      para "<em>${rawQuery}</em>"
    </h2>
  `;

  orden.forEach(id => {
    const grupo = grupos[id];
    const section = document.createElement('div');
    section.className = 'jp-grupo';

    const header = document.createElement('div');
    header.className = 'jp-grupo__header';
    header.innerHTML = `
      <span class="jp-grupo__nombre">${grupo.nombre}</span>
      <span class="jp-grupo__meta">
        <span class="jp-grupo__count">${grupo.arts.length} resultado${grupo.arts.length !== 1 ? 's' : ''}</span>
        <a href="${grupo.url}" class="jp-grupo__link">Abrir código →</a>
      </span>
    `;
    section.appendChild(header);

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
      item.className = 'jp-art-item';
      item.innerHTML = `
        <div class="jp-art-item__header">
          <span class="jp-art-item__num">Art. ${art.numero}</span>
          <span class="jp-art-item__epigrafe">${highlight(art.epigrafe || '(sin epígrafe)', rawQuery)}</span>
        </div>
        ${snippet ? `<div class="jp-art-item__snippet">${highlight(snippet, rawQuery)}</div>` : ''}
      `;
      section.appendChild(item);
    });

    if (grupo.arts.length > 10) {
      const more = document.createElement('div');
      more.className = 'jp-grupo__more';
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
