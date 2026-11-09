'use strict';
/* Panel de administración (admin.html). */

/* Navegación */
document.querySelectorAll('.nav-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('page-'+btn.dataset.page).classList.add('active');
    if(btn.dataset.page==='catalogo') cargarCatalogo();
    if(btn.dataset.page==='proveedores') cargarProveedores();
    if(btn.dataset.page==='clientes') cargarClientes();
    if(btn.dataset.page==='facturacion') cargarFacturacion();
    if(btn.dataset.page==='compra') cargarCatalogoCompra();
  });
});

function alertElement(msg, type){
  const div = document.createElement('div');
  div.className = 'alert ' + type;
  div.textContent = msg;
  return div;
}
function showAlert(boxId, msg, type='err'){
  const box = document.getElementById(boxId);
  box.replaceChildren(alertElement(msg, type));
  setTimeout(()=> box.replaceChildren(), 5000);
}
function round(n){ return Math.round(n*100)/100; }
function capitalize(s){ return s.charAt(0).toUpperCase()+s.slice(1); }
function todayStr(){ return localDateKey(new Date()); }
function emptyRow(colspan, msg){ return html`<tr><td colspan="${colspan}"><div class="empty-state">${msg}</div></td></tr>`; }
function kpiCard(icon, valor, label){
  return html`<div class="card" style="padding:16px;text-align:center;margin-bottom:0;">
    <div style="font-size:24px;">${icon}</div>
    <div style="font-family:'Poppins';font-weight:800;font-size:20px;color:var(--verde-oscuro);margin:4px 0 2px;">${valor}</div>
    <div style="font-size:12px;color:#6b756b;">${label}</div>
  </div>`;
}
/* Supabase no lanza errores: los devuelve en { error }. Esto los convierte en excepciones. */
function check(result){
  if(result.error) throw result.error;
  return result.data;
}

/* ---------------- PEDIDOS ---------------- */
document.getElementById('fDesde').value = todayStr();
document.getElementById('fHasta').value = todayStr();

async function consultarPedidos(){
  const desde = document.getElementById('fDesde').value;
  const hasta = document.getElementById('fHasta').value;
  if(!desde || !hasta){ showAlert('alertPedidos','Selecciona ambas fechas.'); return; }
  if(desde > hasta){ showAlert('alertPedidos','La fecha "Desde" no puede ser mayor que la fecha "Hasta".'); return; }
  const desdeISO = new Date(desde+'T00:00:00').toISOString();
  const hastaISO = new Date(hasta+'T23:59:59').toISOString();

  try{
    const data = check(await sb.from('pedido_items')
      .select('producto_nombre, cantidad, unidad, observacion, pedido_id, pedidos!inner(cliente_nombre, creado_en, comentario, origen)')
      .gte('pedidos.creado_en', desdeISO).lte('pedidos.creado_en', hastaISO));

    // Agregado por producto
    const agg = {};
    data.forEach(it=>{
      const key = it.producto_nombre.toLowerCase()+'|'+it.unidad;
      if(!agg[key]) agg[key] = { nombre: it.producto_nombre, unidad: it.unidad, cantidad:0 };
      agg[key].cantidad += Number(it.cantidad);
    });
    const rows = Object.values(agg).sort((a,b)=>a.nombre.localeCompare(b.nombre));
    const tbody = document.getElementById('tbodyPedidos');
    setHtml(tbody, rows.length
      ? rows.map(r=>html`<tr><td>${capitalize(r.nombre)}</td><td class="num">${round(r.cantidad)}</td><td>${r.unidad}</td></tr>`)
      : emptyRow(3, 'No hay pedidos en ese rango de fechas.'));

    window.__ultimoAgregado = rows;

    // Pedidos individuales agrupados
    const porPedido = {};
    data.forEach(it=>{
      if(!porPedido[it.pedido_id]) porPedido[it.pedido_id] = { cliente: it.pedidos.cliente_nombre, fecha: it.pedidos.creado_en, comentario: it.pedidos.comentario, origen: it.pedidos.origen, items: [] };
      porPedido[it.pedido_id].items.push(it);
    });
    const lista = Object.entries(porPedido).map(([id,p])=>({id, ...p})).sort((a,b)=> new Date(b.fecha)-new Date(a.fecha));
    const box = document.getElementById('listaPedidosIndividuales');
    setHtml(box, lista.length ? lista.map(p=>html`
      <div style="border:1px solid var(--borde);border-radius:12px;padding:12px 16px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:start;gap:10px;">
          <div>
            <div style="font-weight:700;color:var(--verde-oscuro);">${p.cliente} ${p.origen==='admin' ? html`<span style="background:var(--amarillo);color:var(--verde-oscuro);font-size:10.5px;padding:2px 7px;border-radius:8px;margin-left:6px;">🏠 PEDIDO INTERNO</span>` : ''}</div>
            <div style="font-size:12px;color:#8a938a;margin-bottom:8px;">${new Date(p.fecha).toLocaleString('es-CO')}</div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0;">
            <button class="btn btn-small btn-editar-pedido" data-id="${p.id}">Editar</button>
            <button class="btn btn-small btn-danger btn-eliminar-pedido" data-id="${p.id}">Eliminar</button>
          </div>
        </div>
        ${p.items.map(it=>html`<div style="font-size:13.5px;">• ${capitalize(it.producto_nombre)} — ${round(it.cantidad)} ${it.unidad}${it.observacion ? ' ('+it.observacion+')' : ''}</div>`)}
        ${p.comentario ? html`<div style="font-size:12.5px;margin-top:8px;background:var(--amarillo-suave);padding:8px 10px;border-radius:8px;color:#8a6d00;">💬 ${p.comentario}</div>` : ''}
      </div>
    `) : html`<div class="empty-state">No hay pedidos en ese rango.</div>`);

    box.querySelectorAll('.btn-editar-pedido').forEach(btn=> btn.addEventListener('click', ()=> abrirModalPedido('editar', btn.dataset.id)));
    box.querySelectorAll('.btn-eliminar-pedido').forEach(btn=> btn.addEventListener('click', ()=> eliminarPedido(btn.dataset.id)));

  }catch(e){
    console.error(e);
    showAlert('alertPedidos','No se pudieron cargar los pedidos. Intenta de nuevo.');
  }
}
document.getElementById('btnFiltrarPedidos').addEventListener('click', consultarPedidos);

document.getElementById('btnExcelPedidos').addEventListener('click', ()=>{
  const rows = window.__ultimoAgregado || [];
  if(rows.length===0){ showAlert('alertPedidos','No hay datos para descargar. Consulta primero.'); return; }
  const aoa = [['Producto','Cantidad total','Unidad'], ...rows.map(r=>[capitalize(r.nombre), round(r.cantidad), r.unidad])];
  const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols']=[{wch:28},{wch:16},{wch:12}];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Pedidos');
  XLSX.writeFile(wb, `pedidos_LA_Fruver_${todayStr()}.xlsx`);
});

consultarPedidos();

/* ---------------- MODAL DE PEDIDO (crear propio / editar) ---------------- */
let pedidoModalMode = 'crear';
let pedidoModalId = null;
let pedidoModalProductos = [];

function showModalPedidoAlert(msg){
  document.getElementById('modalPedidoAlert').replaceChildren(alertElement(msg, 'err'));
}

async function asegurarProductosCache(){
  if(pedidoModalProductos.length) return;
  pedidoModalProductos = check(await sb.from('productos').select('id,nombre,unidad').eq('disponible', true).order('nombre')) || [];
}

function filaPedidoModalHtml(item){
  const opciones = pedidoModalProductos.slice();
  let seleccionado = null;
  if(item){
    seleccionado = opciones.find(p=> item.producto_id && p.id===item.producto_id)
      || opciones.find(p=> p.nombre===item.producto_nombre);
    // Si el producto del pedido ya no está disponible, se conserva en lugar de cambiarlo por otro.
    if(!seleccionado){
      seleccionado = { id: item.producto_id || '', nombre: item.producto_nombre, unidad: item.unidad, noDisponible: true };
      opciones.unshift(seleccionado);
    }
  }
  return html`
    <div class="producto-row-modal" style="border:1px solid var(--borde);border-radius:10px;padding:10px;margin-bottom:8px;">
      <div style="display:grid;grid-template-columns:1fr 80px 30px;gap:8px;margin-bottom:6px;align-items:center;">
        <select class="fila-producto">${opciones.map(p=>html`<option value="${p.id}" data-nombre="${p.nombre}" data-unidad="${p.unidad}" ${p===seleccionado?'selected':''}>${p.nombre}${p.noDisponible?' (no disponible)':''}</option>`)}</select>
        <input type="number" class="fila-cantidad" placeholder="Cant." value="${item?item.cantidad:''}">
        <button type="button" class="btn btn-small btn-danger fila-quitar" style="padding:6px;">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <select class="fila-unidad">${UNIT_OPTIONS.map(u=>html`<option value="${u}" ${item&&item.unidad===u?'selected':''}>${u}</option>`)}</select>
        <input type="text" class="fila-obs" placeholder="Observación" value="${item?(item.observacion||''):''}">
      </div>
    </div>`;
}

function agregarFilaPedidoModal(item){
  const cont = document.getElementById('filasPedidoModal');
  appendHtml(cont, filaPedidoModalHtml(item));
  const nueva = cont.lastElementChild;
  nueva.querySelector('.fila-quitar').addEventListener('click', ()=> nueva.remove());
  const provSel = nueva.querySelector('.fila-producto');
  provSel.addEventListener('change', ()=>{
    const opt = provSel.options[provSel.selectedIndex];
    nueva.querySelector('.fila-unidad').value = opt.dataset.unidad;
  });
}

async function abrirModalPedido(mode, pedidoId){
  try{
    await asegurarProductosCache();
    pedidoModalMode = mode; pedidoModalId = pedidoId || null;
    document.getElementById('filasPedidoModal').replaceChildren();
    document.getElementById('modalPedidoComentario').value = '';
    document.getElementById('modalPedidoAlert').replaceChildren();

    if(mode === 'crear'){
      document.getElementById('modalPedidoTitulo').textContent = 'Nuevo pedido propio (L&A Fruver)';
      agregarFilaPedidoModal();
    } else {
      document.getElementById('modalPedidoTitulo').textContent = 'Editar pedido';
      const pedido = check(await sb.from('pedidos').select('*').eq('id', pedidoId).single());
      const items = check(await sb.from('pedido_items').select('*').eq('pedido_id', pedidoId)) || [];
      document.getElementById('modalPedidoComentario').value = pedido.comentario || '';
      items.forEach(it=> agregarFilaPedidoModal(it));
      if(items.length===0) agregarFilaPedidoModal();
    }
    document.getElementById('modalPedidoBg').classList.add('show');
  }catch(e){
    console.error(e);
    showAlert('alertPedidos','No se pudo abrir el pedido. Intenta de nuevo.');
  }
}

document.getElementById('btnNuevoPedidoPropio').addEventListener('click', ()=> abrirModalPedido('crear'));
document.getElementById('btnAgregarFilaPedidoModal').addEventListener('click', ()=> agregarFilaPedidoModal());
document.getElementById('btnCancelarPedidoModal').addEventListener('click', ()=> document.getElementById('modalPedidoBg').classList.remove('show'));

document.getElementById('btnGuardarPedidoModal').addEventListener('click', async ()=>{
  const filas = [...document.querySelectorAll('.producto-row-modal')];
  const items = [];
  filas.forEach(fila=>{
    const sel = fila.querySelector('.fila-producto');
    const opt = sel.options[sel.selectedIndex];
    const cantidad = parseFloat(fila.querySelector('.fila-cantidad').value);
    if(!opt || !cantidad || cantidad<=0) return;
    items.push({
      producto_id: opt.value || null, producto_nombre: opt.dataset.nombre,
      cantidad, unidad: fila.querySelector('.fila-unidad').value,
      observacion: fila.querySelector('.fila-obs').value.trim() || null
    });
  });
  if(items.length===0){
    showModalPedidoAlert('Agrega al menos un producto con cantidad.');
    return;
  }
  const comentario = document.getElementById('modalPedidoComentario').value.trim() || null;

  try{
    if(pedidoModalMode === 'crear'){
      const pedido = check(await sb.from('pedidos').insert({
        cliente_id: null, cliente_nombre: 'L&A Fruver (pedido interno)', comentario, origen: 'admin'
      }).select().single());
      check(await sb.from('pedido_items').insert(items.map(it=>({ ...it, pedido_id: pedido.id }))));
    } else {
      check(await sb.from('pedido_items').delete().eq('pedido_id', pedidoModalId));
      check(await sb.from('pedido_items').insert(items.map(it=>({ ...it, pedido_id: pedidoModalId }))));
      check(await sb.from('pedidos').update({ comentario }).eq('id', pedidoModalId));
    }
    document.getElementById('modalPedidoBg').classList.remove('show');
    consultarPedidos();
  }catch(e){
    console.error(e);
    showModalPedidoAlert('No se pudo guardar el pedido.');
  }
});

async function eliminarPedido(pedidoId){
  if(!confirm('¿Eliminar este pedido por completo? Esta acción no se puede deshacer.')) return;
  try{
    check(await sb.from('pedidos').delete().eq('id', pedidoId));
    consultarPedidos();
  }catch(e){ console.error(e); showAlert('alertPedidos','No se pudo eliminar el pedido.'); }
}

/* ---------------- CATALOGO ---------------- */
setHtml(document.getElementById('nuevoProdUnidad'), UNIT_OPTIONS.map(u=>html`<option value="${u}">${u}</option>`));

async function cargarCatalogo(){
  try{
    const productos = check(await sb.from('productos').select('*').order('nombre'));
    const relaciones = check(await sb.from('producto_proveedores').select('producto_id, proveedores(id,nombre)'));
    const proveedores = check(await sb.from('proveedores').select('id,nombre').eq('activo', true).order('nombre'));
    window.__proveedoresCache = proveedores || [];

    document.getElementById('catalogoCount').textContent = `Productos (${productos.length})`;
    const tbody = document.getElementById('tbodyCatalogo');
    setHtml(tbody, productos.map(p=>{
      const provsDelProd = (relaciones||[]).filter(r=>r.producto_id===p.id && r.proveedores).map(r=>r.proveedores.nombre);
      return html`
      <tr data-id="${p.id}">
        <td><input type="text" class="edit-nombre" value="${p.nombre}" style="width:170px;"></td>
        <td><select class="edit-unidad">${UNIT_OPTIONS.map(u=>html`<option value="${u}" ${u===p.unidad?'selected':''}>${u}</option>`)}</select></td>
        <td class="num"><input type="number" class="edit-precio" value="${p.precio||''}" style="width:90px;text-align:right;"></td>
        <td><button class="toggle ${p.disponible?'on':'off'} toggle-disp"></button></td>
        <td><button class="btn btn-small btn-provs" style="background:var(--verde-claro);color:var(--verde-oscuro);font-size:11.5px;max-width:160px;white-space:normal;text-align:left;line-height:1.3;">${provsDelProd.length ? provsDelProd.join(', ') : 'Sin asignar'}</button></td>
        <td style="display:flex;gap:6px;"><button class="btn btn-small btn-guardar">Guardar</button><button class="btn btn-small btn-danger btn-eliminar">Eliminar</button></td>
      </tr>`;
    }));

    tbody.querySelectorAll('tr[data-id]').forEach(tr=>{
      const id = tr.dataset.id;
      tr.querySelector('.toggle-disp').addEventListener('click', function(){
        this.classList.toggle('on'); this.classList.toggle('off');
      });
      tr.querySelector('.btn-guardar').addEventListener('click', async ()=>{
        const nombre = tr.querySelector('.edit-nombre').value.trim();
        const unidad = tr.querySelector('.edit-unidad').value;
        const precio = parseFloat(tr.querySelector('.edit-precio').value) || null;
        const disponible = tr.querySelector('.toggle-disp').classList.contains('on');
        try{
          check(await sb.from('productos').update({ nombre, unidad, precio, disponible }).eq('id', id));
          showAlert('alertCatalogo','Producto actualizado correctamente.','ok');
        }catch(e){ showAlert('alertCatalogo','No se pudo guardar. Verifica que el nombre no esté repetido.'); }
      });
      tr.querySelector('.btn-eliminar').addEventListener('click', async ()=>{
        if(!confirm('¿Eliminar este producto del catálogo?')) return;
        try{
          check(await sb.from('productos').delete().eq('id', id));
          cargarCatalogo();
        }catch(e){ showAlert('alertCatalogo','No se pudo eliminar el producto.'); }
      });
      tr.querySelector('.btn-provs').addEventListener('click', ()=> abrirModalProveedores(id, tr.querySelector('.edit-nombre').value, relaciones));
    });
  }catch(e){
    console.error(e);
    showAlert('alertCatalogo','No se pudo cargar el catálogo.');
  }
}

document.getElementById('btnAgregarProd').addEventListener('click', async ()=>{
  const nombre = document.getElementById('nuevoProdNombre').value.trim();
  const unidad = document.getElementById('nuevoProdUnidad').value;
  const precio = parseFloat(document.getElementById('nuevoProdPrecio').value) || null;
  if(!nombre){ showAlert('alertCatalogo','Escribe el nombre del producto.'); return; }
  try{
    check(await sb.from('productos').insert({ nombre, unidad, precio }));
    document.getElementById('nuevoProdNombre').value=''; document.getElementById('nuevoProdPrecio').value='';
    showAlert('alertCatalogo','Producto agregado.','ok');
    cargarCatalogo();
  }catch(e){ showAlert('alertCatalogo','No se pudo agregar. ¿Ya existe un producto con ese nombre?'); }
});

function abrirModalProveedores(productoId, nombreProducto, relaciones){
  document.getElementById('modalProdNombre').textContent = nombreProducto;
  const asignados = new Set((relaciones||[]).filter(r=>r.producto_id===productoId && r.proveedores).map(r=>r.proveedores.id));
  const list = document.getElementById('modalProvList');
  const provs = window.__proveedoresCache || [];
  if(provs.length===0){
    setHtml(list, html`<div class="empty-state">Aún no tienes proveedores registrados. Ve a la sección Proveedores para agregar.</div>`);
  } else {
    setHtml(list, provs.map(p=>html`
      <label style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:13.8px;">
        <input type="checkbox" data-prov="${p.id}" ${asignados.has(p.id)?'checked':''}> ${p.nombre}
      </label>`));
  }
  document.getElementById('modalProvBg').classList.add('show');
  document.getElementById('modalProvBg').dataset.productoId = productoId;
}

document.getElementById('btnCerrarModalProv').addEventListener('click', async ()=>{
  const productoId = document.getElementById('modalProvBg').dataset.productoId;
  const checks = document.querySelectorAll('#modalProvList input[type=checkbox]');
  const seleccionados = [...checks].filter(c=>c.checked).map(c=>c.dataset.prov);
  try{
    check(await sb.from('producto_proveedores').delete().eq('producto_id', productoId));
    if(seleccionados.length>0){
      check(await sb.from('producto_proveedores').insert(seleccionados.map(pid=>({producto_id:productoId, proveedor_id:pid}))));
    }
    document.getElementById('modalProvBg').classList.remove('show');
    cargarCatalogo();
  }catch(e){ console.error(e); showAlert('alertCatalogo','No se pudieron guardar los proveedores asignados.'); }
});

/* ---------------- PROVEEDORES ---------------- */
async function cargarProveedores(){
  try{
    const data = check(await sb.from('proveedores').select('*').order('nombre'));
    window.__proveedoresCache = (data||[]).filter(p=>p.activo!==false);
    const tbody = document.getElementById('tbodyProveedores');
    setHtml(tbody, data.length ? data.map(p=>html`
      <tr data-id="${p.id}">
        <td><input type="text" class="edit-nombre" value="${p.nombre}" style="width:170px;"></td>
        <td><input type="text" class="edit-tel" value="${p.telefono||''}" style="width:120px;"></td>
        <td><input type="text" class="edit-dir" value="${p.direccion||''}" style="width:150px;"></td>
        <td style="font-size:12px;">${new Date(p.creado_en).toLocaleDateString('es-CO')}</td>
        <td><button class="toggle ${p.activo?'on':'off'} toggle-activo" title="${p.activo?'Activo':'Inactivo'}"></button></td>
        <td style="display:flex;gap:6px;"><button class="btn btn-small btn-guardar">Guardar</button><button class="btn btn-small btn-danger btn-eliminar-prov">Eliminar</button></td>
      </tr>`) : emptyRow(6, 'No tienes proveedores registrados aún.'));

    tbody.querySelectorAll('tr[data-id]').forEach(tr=>{
      const id = tr.dataset.id;
      tr.querySelector('.toggle-activo').addEventListener('click', function(){
        this.classList.toggle('on'); this.classList.toggle('off');
      });
      tr.querySelector('.btn-guardar').addEventListener('click', async ()=>{
        const nombre = tr.querySelector('.edit-nombre').value.trim();
        const telefono = tr.querySelector('.edit-tel').value.trim() || null;
        const direccion = tr.querySelector('.edit-dir').value.trim() || null;
        const activo = tr.querySelector('.toggle-activo').classList.contains('on');
        if(!nombre){ showAlert('alertProveedores','El nombre no puede quedar vacío.'); return; }
        try{
          check(await sb.from('proveedores').update({ nombre, telefono, direccion, activo, actualizado_en: new Date().toISOString() }).eq('id', id));
          showAlert('alertProveedores','Proveedor actualizado correctamente.','ok');
          cargarProveedores();
        }catch(e){ showAlert('alertProveedores','No se pudo guardar. Verifica que el nombre no esté repetido.'); }
      });
      tr.querySelector('.btn-eliminar-prov').addEventListener('click', async ()=>{
        if(!confirm('¿Eliminar este proveedor? También se quitará de los productos que tenía asignados.')) return;
        try{
          check(await sb.from('proveedores').delete().eq('id', id));
          cargarProveedores();
        }catch(e){ showAlert('alertProveedores','No se pudo eliminar el proveedor.'); }
      });
    });
  }catch(e){ console.error(e); showAlert('alertProveedores','No se pudieron cargar los proveedores.'); }
}
document.getElementById('btnAgregarProv').addEventListener('click', async ()=>{
  const nombre = document.getElementById('nuevoProvNombre').value.trim();
  const telefono = document.getElementById('nuevoProvTel').value.trim() || null;
  const direccion = document.getElementById('nuevoProvDir').value.trim() || null;
  if(!nombre){ showAlert('alertProveedores','Escribe el nombre del proveedor.'); return; }
  try{
    check(await sb.from('proveedores').insert({ nombre, telefono, direccion }));
    document.getElementById('nuevoProvNombre').value=''; document.getElementById('nuevoProvTel').value=''; document.getElementById('nuevoProvDir').value='';
    showAlert('alertProveedores','Proveedor agregado.','ok');
    cargarProveedores();
  }catch(e){ showAlert('alertProveedores','No se pudo agregar. ¿Ya existe un proveedor con ese nombre?'); }
});

/* ---------------- COMPRA A PROVEEDORES ---------------- */
document.getElementById('cDesde').value = todayStr();
document.getElementById('cHasta').value = todayStr();

async function cargarCatalogoCompra(){
  try{
    const productos = check(await sb.from('productos').select('id,nombre,unidad').order('nombre'));
    window.__catalogoCompra = productos || [];
    setHtml(document.getElementById('listaProductosCompra'), (productos||[]).map(p=>html`<option value="${p.nombre}">`));
    const relaciones = check(await sb.from('producto_proveedores').select('producto_id, proveedores(id,nombre)'));
    window.__relacionesCompra = relaciones || [];
    if(!window.__proveedoresCache){
      const provs = check(await sb.from('proveedores').select('id,nombre').eq('activo', true).order('nombre'));
      window.__proveedoresCache = provs || [];
    }
  }catch(e){
    console.error(e);
    alert('No se pudo cargar el catálogo de productos. Intenta de nuevo.');
  }
}

document.getElementById('btnConfirmarProductoCompraManual').addEventListener('click', ()=>{
  const texto = document.getElementById('buscarProductoCompra').value.trim().toLowerCase();
  const cantidad = parseFloat(document.getElementById('cantProductoCompraManual').value);
  const catalogo = window.__catalogoCompra || [];
  const prod = catalogo.find(p=>p.nombre.toLowerCase()===texto);
  if(!prod){ alert('Escribe o selecciona un producto válido de la lista.'); return; }
  if(!cantidad || cantidad<=0){ alert('Escribe una cantidad válida.'); return; }

  const relaciones = window.__relacionesCompra || [];
  const opciones = relaciones.filter(r=>r.producto_id===prod.id && r.proveedores).map(r=>r.proveedores);

  if(!window.__lineasCompra) window.__lineasCompra = [];
  if(window.__compraIdxCounter===undefined) window.__compraIdxCounter = 0;

  const existente = window.__lineasCompra.find(l=> l.nombre.toLowerCase()===prod.nombre.toLowerCase());
  if(existente){
    existente.cantidad = round(existente.cantidad + cantidad);
  } else {
    window.__lineasCompra.push({
      idx: window.__compraIdxCounter++,
      nombre: prod.nombre,
      unidad: prod.unidad,
      producto_id: prod.id,
      cantidad: round(cantidad),
      opciones,
      proveedorId: opciones.length ? opciones[0].id : null
    });
  }
  document.getElementById('buscarProductoCompra').value = '';
  document.getElementById('cantProductoCompraManual').value = '';
  renderCompra();
});

document.getElementById('btnGenerarCompra').addEventListener('click', async ()=>{
  const desdeVal = document.getElementById('cDesde').value;
  const hastaVal = document.getElementById('cHasta').value;
  const box = document.getElementById('compraResultado');
  if(desdeVal > hastaVal){ setHtml(box, html`<div class="card"><div class="alert err">La fecha "Desde" no puede ser mayor que la fecha "Hasta".</div></div>`); return; }
  const desde = new Date(desdeVal+'T00:00:00').toISOString();
  const hasta = new Date(hastaVal+'T23:59:59').toISOString();
  setHtml(box, html`<div class="empty-state">Generando…</div>`);
  try{
    const items = check(await sb.from('pedido_items')
      .select('producto_id, producto_nombre, cantidad, unidad, pedidos!inner(creado_en)')
      .gte('pedidos.creado_en', desde).lte('pedidos.creado_en', hasta));

    const aggByProduct = {};
    items.forEach(it=>{
      const key = it.producto_id || it.producto_nombre;
      if(!aggByProduct[key]) aggByProduct[key] = { nombre: it.producto_nombre, unidad: it.unidad, cantidad:0, producto_id: it.producto_id };
      aggByProduct[key].cantidad += Number(it.cantidad);
    });

    const relaciones = check(await sb.from('producto_proveedores').select('producto_id, proveedores(id,nombre)'));
    window.__relacionesCompra = relaciones || [];

    // Una sola línea por producto (sin duplicar), con el proveedor por defecto = el primero asignado
    let contador = 0;
    const lineas = Object.values(aggByProduct).map((prod)=>{
      const opciones = (relaciones||[]).filter(r=>r.producto_id===prod.producto_id && r.proveedores).map(r=>r.proveedores);
      return {
        idx: contador++,
        nombre: prod.nombre,
        unidad: prod.unidad,
        producto_id: prod.producto_id,
        cantidad: round(prod.cantidad),
        opciones,
        proveedorId: opciones.length ? opciones[0].id : null
      };
    });
    window.__compraIdxCounter = contador;
    window.__lineasCompra = lineas;
    renderCompra();
  }catch(e){
    console.error(e);
    setHtml(box, html`<div class="card"><div class="empty-state">No se pudo generar la lista de compra.</div></div>`);
  }
});

function renderCompra(){
  const box = document.getElementById('compraResultado');
  const lineas = window.__lineasCompra || [];
  if(lineas.length===0){
    setHtml(box, html`<div class="card"><div class="empty-state">No hay pedidos en ese rango de fechas.</div></div>`);
    return;
  }
  setHtml(box, html`<div class="card"><div class="card-head"><h2>Lista de compra</h2></div>
    <div class="table-scroll"><table>
      <thead><tr><th>Producto</th><th class="num">Cantidad</th><th>Unidad</th><th>Proveedor</th><th></th></tr></thead>
      <tbody>
      ${lineas.map(l=>html`
        <tr data-idx="${l.idx}">
          <td>${capitalize(l.nombre)}</td>
          <td class="num"><input type="number" class="linea-cant" value="${l.cantidad}" style="width:80px;text-align:right;"></td>
          <td>${l.unidad}</td>
          <td>
            ${l.opciones.length ? html`<select class="linea-prov">
                ${l.opciones.map(o=>html`<option value="${o.id}" ${o.id===l.proveedorId?'selected':''}>${o.nombre}</option>`)}
              </select>` : html`<select class="linea-prov-nueva" style="border-color:var(--rojo);">
                <option value="">Pendiente asignación</option>
                ${(window.__proveedoresCache||[]).map(p=>html`<option value="${p.id}">${p.nombre}</option>`)}
              </select>`}
          </td>
          <td><button class="btn btn-small btn-danger btn-quitar-linea">Quitar</button></td>
        </tr>`)}
      </tbody>
    </table></div>
  </div>
  <div id="gruposProveedorContainer"></div>`);

  box.querySelectorAll('tr[data-idx]').forEach(tr=>{
    const idx = Number(tr.dataset.idx);
    const linea = lineas.find(l=>l.idx===idx);
    const cantInput = tr.querySelector('.linea-cant');
    if(cantInput) cantInput.addEventListener('change', ()=>{ linea.cantidad = parseFloat(cantInput.value)||0; renderCompraPorProveedor(); });
    const provSelect = tr.querySelector('.linea-prov');
    if(provSelect) provSelect.addEventListener('change', ()=>{ linea.proveedorId = provSelect.value; renderCompraPorProveedor(); });
    const provNuevaSelect = tr.querySelector('.linea-prov-nueva');
    if(provNuevaSelect) provNuevaSelect.addEventListener('change', async ()=>{
      const proveedorId = provNuevaSelect.value;
      if(!proveedorId) return;
      linea.proveedorId = proveedorId;
      const provObj = (window.__proveedoresCache||[]).find(p=>p.id===proveedorId);
      if(provObj) linea.opciones = [provObj];
      if(linea.producto_id){
        // Si la relación ya existía, Supabase devuelve un error que podemos ignorar.
        const { error } = await sb.from('producto_proveedores').insert({ producto_id: linea.producto_id, proveedor_id: proveedorId });
        if(error) console.warn('No se guardó la relación producto-proveedor:', error.message);
      }
      renderCompra();
    });
    tr.querySelector('.btn-quitar-linea').addEventListener('click', ()=>{
      window.__lineasCompra = lineas.filter(l=>l.idx!==idx);
      renderCompra();
    });
  });

  renderCompraPorProveedor();
}

function renderCompraPorProveedor(){
  const lineas = window.__lineasCompra || [];
  const porProveedor = {};
  const sinProveedor = [];
  lineas.forEach(l=>{
    if(!l.proveedorId){ sinProveedor.push(l); return; }
    const prov = l.opciones.find(o=>o.id===l.proveedorId);
    const key = l.proveedorId;
    if(!porProveedor[key]) porProveedor[key] = { nombre: prov ? prov.nombre : '—', lineas: [] };
    porProveedor[key].lineas.push(l);
  });

  const partes = Object.values(porProveedor).map(prov=>html`<div class="card"><div class="card-head"><h2>${prov.nombre}</h2></div>
      <div class="table-scroll"><table><thead><tr><th>Producto</th><th class="num">Cantidad</th><th>Unidad</th></tr></thead><tbody>
      ${prov.lineas.map(l=>html`<tr><td>${capitalize(l.nombre)}</td><td class="num">${round(l.cantidad)}</td><td>${l.unidad}</td></tr>`)}
      </tbody></table></div></div>`);
  if(sinProveedor.length>0){
    partes.push(html`<div class="card"><div class="card-head"><h2>Sin proveedor asignado</h2></div>
      <div class="table-scroll"><table><thead><tr><th>Producto</th><th class="num">Cantidad</th><th>Unidad</th></tr></thead><tbody>
      ${sinProveedor.map(l=>html`<tr><td>${capitalize(l.nombre)}</td><td class="num">${round(l.cantidad)}</td><td>${l.unidad}</td></tr>`)}
      </tbody></table></div><p style="font-size:12.5px;color:#8a938a;margin-top:8px;">Asigna un proveedor a estos productos desde el Catálogo.</p></div>`);
  }
  setHtml(document.getElementById('gruposProveedorContainer'), partes);
}

/* ---------------- CLIENTES ---------------- */
async function cargarClientes(){
  try{
    const clientes = check(await sb.from('clientes').select('*').order('nombre'));
    const pedidos = check(await sb.from('pedidos').select('cliente_id'));
    const conteo = {};
    (pedidos||[]).forEach(p=> conteo[p.cliente_id] = (conteo[p.cliente_id]||0)+1);

    document.getElementById('clientesCount').textContent = `Clientes (${clientes.length})`;
    const tbody = document.getElementById('tbodyClientes');
    setHtml(tbody, clientes.length ? clientes.map(c=>html`
      <tr data-id="${c.id}">
        <td><input type="text" class="edit-nombre" value="${c.nombre}" style="width:170px;"></td>
        <td><input type="text" class="edit-tel" value="${c.telefono||''}" style="width:120px;"></td>
        <td><input type="text" class="edit-dir" value="${c.direccion||''}" style="width:150px;"></td>
        <td class="num">${conteo[c.id]||0}</td>
        <td style="font-size:12px;">${new Date(c.creado_en).toLocaleDateString('es-CO')}</td>
        <td><button class="toggle ${c.activo?'on':'off'} toggle-activo" title="${c.activo?'Activo':'Inactivo'}"></button></td>
        <td style="display:flex;gap:6px;"><button class="btn btn-small btn-guardar">Guardar</button><button class="btn btn-small btn-danger btn-eliminar">Eliminar</button></td>
      </tr>`) : emptyRow(7, 'Aún no hay clientes registrados.'));

    tbody.querySelectorAll('tr[data-id]').forEach(tr=>{
      const id = tr.dataset.id;
      tr.querySelector('.toggle-activo').addEventListener('click', function(){
        this.classList.toggle('on'); this.classList.toggle('off');
      });
      tr.querySelector('.btn-guardar').addEventListener('click', async ()=>{
        const nombre = tr.querySelector('.edit-nombre').value.trim();
        const telefono = tr.querySelector('.edit-tel').value.trim() || null;
        const direccion = tr.querySelector('.edit-dir').value.trim() || null;
        const activo = tr.querySelector('.toggle-activo').classList.contains('on');
        if(!nombre){ showAlert('alertClientes','El nombre no puede quedar vacío.'); return; }
        try{
          check(await sb.from('clientes').update({ nombre, telefono, direccion, activo, actualizado_en: new Date().toISOString() }).eq('id', id));
          showAlert('alertClientes','Cliente actualizado correctamente.','ok');
        }catch(e){ showAlert('alertClientes','No se pudo guardar. Verifica que el nombre no esté repetido.'); }
      });
      tr.querySelector('.btn-eliminar').addEventListener('click', async ()=>{
        if(!confirm('¿Eliminar este cliente permanentemente? Su historial de pedidos quedará conservado, pero ya no podrá elegirse en el formulario.')) return;
        try{
          check(await sb.from('clientes').delete().eq('id', id));
          cargarClientes();
        }catch(e){ showAlert('alertClientes','No se pudo eliminar el cliente.'); }
      });
    });
  }catch(e){ console.error(e); showAlert('alertClientes','No se pudieron cargar los clientes.'); }
}

document.getElementById('btnAgregarCli').addEventListener('click', async ()=>{
  const nombre = document.getElementById('nuevoCliNombre').value.trim();
  const telefono = document.getElementById('nuevoCliTel').value.trim() || null;
  const direccion = document.getElementById('nuevoCliDir').value.trim() || null;
  if(!nombre){ showAlert('alertClientes','Escribe el nombre del cliente.'); return; }
  try{
    check(await sb.from('clientes').insert({ nombre, telefono, direccion }));
    document.getElementById('nuevoCliNombre').value=''; document.getElementById('nuevoCliTel').value=''; document.getElementById('nuevoCliDir').value='';
    showAlert('alertClientes','Cliente agregado.','ok');
    cargarClientes();
  }catch(e){ showAlert('alertClientes','No se pudo agregar. ¿Ya existe un cliente con ese nombre?'); }
});

/* ---------------- REPORTES ---------------- */
document.getElementById('rDesde').value = todayStr();
document.getElementById('rHasta').value = todayStr();

document.getElementById('btnGenerarReporte').addEventListener('click', async ()=>{
  const desdeVal = document.getElementById('rDesde').value;
  const hastaVal = document.getElementById('rHasta').value;
  if(desdeVal > hastaVal){ alert('La fecha "Desde" no puede ser mayor que la fecha "Hasta".'); return; }
  const desdeDate = new Date(desdeVal+'T00:00:00');
  const hastaDate = new Date(hastaVal+'T23:59:59');
  const desde = desdeDate.toISOString();
  const hasta = hastaDate.toISOString();
  try{
    const items = check(await sb.from('pedido_items')
      .select('producto_nombre, cantidad, unidad, pedidos!inner(id, cliente_id, cliente_nombre, creado_en)')
      .gte('pedidos.creado_en', desde).lte('pedidos.creado_en', hasta));

    // Top productos
    const aggProd = {};
    items.forEach(it=>{
      const key = it.producto_nombre.toLowerCase()+'|'+it.unidad;
      if(!aggProd[key]) aggProd[key] = { nombre: it.producto_nombre, unidad: it.unidad, cantidad:0 };
      aggProd[key].cantidad += Number(it.cantidad);
    });
    const topRows = Object.values(aggProd).sort((a,b)=>b.cantidad-a.cantidad);
    setHtml(document.getElementById('tbodyTopProductos'), topRows.length
      ? topRows.map(r=>html`<tr><td>${capitalize(r.nombre)}</td><td class="num">${round(r.cantidad)}</td><td>${r.unidad}</td></tr>`)
      : emptyRow(3, 'Sin datos en este rango.'));
    window.__repTop = topRows;

    // KPIs
    const pedidosIdsUnicos = new Set(items.map(it=>it.pedidos.id));
    const clientesUnicos = new Set(items.map(it=>it.pedidos.cliente_nombre));
    setHtml(document.getElementById('kpiCards'), html`
      ${kpiCard('📦', pedidosIdsUnicos.size, 'Pedidos')}
      ${kpiCard('🥬', topRows.length, 'Productos distintos')}
      ${kpiCard('👥', clientesUnicos.size, 'Clientes activos')}
      ${kpiCard('🏆', topRows[0]?capitalize(topRows[0].nombre):'—', 'Más pedido')}
    `);

    // Gráfico de barras: top 8 productos
    const top8 = topRows.slice(0,8);
    if(window.__chartTop) window.__chartTop.destroy();
    window.__chartTop = new Chart(document.getElementById('chartTop'), {
      type:'bar',
      data:{ labels: top8.map(r=>capitalize(r.nombre)), datasets:[{ label:'Cantidad pedida', data: top8.map(r=>round(r.cantidad)), backgroundColor:'#1e7d32', borderRadius:6 }] },
      options:{ responsive:true, plugins:{legend:{display:false}}, scales:{ y:{ beginAtZero:true } } }
    });

    // Gráfico de línea: pedidos por día en el rango (día según la hora local, no UTC)
    const porDia = {};
    items.forEach(it=>{
      const dia = localDateKey(it.pedidos.creado_en);
      porDia[dia] = porDia[dia] || new Set();
      porDia[dia].add(it.pedidos.id);
    });
    const dias = Object.keys(porDia).sort();
    if(window.__chartTendencia) window.__chartTendencia.destroy();
    window.__chartTendencia = new Chart(document.getElementById('chartTendencia'), {
      type:'line',
      data:{ labels: dias, datasets:[{ label:'Pedidos', data: dias.map(d=>porDia[d].size), borderColor:'#ffc800', backgroundColor:'#fff4cc', fill:true, tension:0.3 }] },
      options:{ responsive:true, plugins:{legend:{display:false}}, scales:{ y:{ beginAtZero:true, ticks:{ stepSize:1 } } } }
    });

    // Clientes vs pedidos (conteo de pedidos únicos por cliente)
    const pedidosUnicos = {};
    items.forEach(it=> pedidosUnicos[it.pedidos.id] = it.pedidos.cliente_nombre);
    const conteoCliente = {};
    Object.values(pedidosUnicos).forEach(nombre=> conteoCliente[nombre] = (conteoCliente[nombre]||0)+1);
    const clientRows = Object.entries(conteoCliente).map(([nombre,n])=>({nombre, n})).sort((a,b)=>b.n-a.n);
    setHtml(document.getElementById('tbodyClientesPedidos'), clientRows.length
      ? clientRows.map(r=>html`<tr><td>${r.nombre}</td><td class="num">${r.n}</td></tr>`)
      : emptyRow(2, 'Sin datos en este rango.'));
    window.__repClientes = clientRows;

    // Clientes nuevos y todos los clientes (para inactivos)
    const todosClientes = check(await sb.from('clientes').select('id, nombre, creado_en')) || [];
    const nuevos = todosClientes.filter(c=>{
      const creado = new Date(c.creado_en);
      return creado >= desdeDate && creado <= hastaDate;
    });
    setHtml(document.getElementById('tbodyClientesNuevos'), nuevos.length
      ? nuevos.map(c=>html`<tr><td>${c.nombre}</td><td>${new Date(c.creado_en).toLocaleDateString('es-CO')}</td></tr>`)
      : emptyRow(2, 'No hubo clientes nuevos en este rango.'));

    const idsConPedido = new Set(items.map(it=>it.pedidos.cliente_id).filter(Boolean));
    const inactivos = todosClientes.filter(c=> !idsConPedido.has(c.id));
    setHtml(document.getElementById('tbodyClientesInactivos'), inactivos.length
      ? inactivos.map(c=>html`<tr><td>${c.nombre}</td></tr>`)
      : html`<tr><td><div class="empty-state">Todos tus clientes pidieron en este rango.</div></td></tr>`);

  }catch(e){
    console.error(e);
    alert('No se pudo generar el reporte. Intenta de nuevo.');
  }
});

document.getElementById('btnExcelTop').addEventListener('click', ()=>{
  const rows = window.__repTop || [];
  if(!rows.length) return;
  const aoa = [['Producto','Cantidad','Unidad'], ...rows.map(r=>[capitalize(r.nombre), round(r.cantidad), r.unidad])];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Top productos');
  XLSX.writeFile(wb, `reporte_productos_${todayStr()}.xlsx`);
});
document.getElementById('btnExcelClientesRep').addEventListener('click', ()=>{
  const rows = window.__repClientes || [];
  if(!rows.length) return;
  const aoa = [['Cliente','N° de pedidos'], ...rows.map(r=>[r.nombre, r.n])];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
  XLSX.writeFile(wb, `reporte_clientes_${todayStr()}.xlsx`);
});

/* ---------------- FACTURACION ---------------- */
let facturaItems = [];
let productosCache = [];

async function cargarFacturacion(){
  document.getElementById('fFecha').value = todayStr();
  try{
    productosCache = check(await sb.from('productos').select('id,nombre,unidad,precio')) || [];

    const desde = new Date(); desde.setDate(desde.getDate()-14);
    const pedidos = check(await sb.from('pedidos').select('id, cliente_nombre, creado_en').gte('creado_en', desde.toISOString()).order('creado_en', {ascending:false}).limit(40));
    const sel = document.getElementById('selectPedidoFactura');
    setHtml(sel, html`<option value="">Selecciona un pedido…</option>${
      (pedidos||[]).map(p=>html`<option value="${p.id}">${p.cliente_nombre} — ${new Date(p.creado_en).toLocaleString('es-CO')}</option>`)
    }`);

    await cargarListaFacturas();
  }catch(e){ console.error(e); showAlert('alertFactura','No se pudo cargar la información inicial.'); }
}

async function cargarListaFacturas(){
  try{
    const facturas = check(await sb.from('facturas').select('*').order('numero',{ascending:false}).limit(30));
    const tbody = document.getElementById('tbodyFacturas');
    setHtml(tbody, facturas.length ? facturas.map(f=>html`
      <tr><td>#${f.numero}</td><td>${f.cliente_nombre}</td><td>${parseDateOnly(f.fecha).toLocaleDateString('es-CO')}</td>
      <td class="num">$${Number(f.total).toLocaleString('es-CO')}</td>
      <td><button class="btn btn-small btn-ver-factura" data-id="${f.id}">Ver / Imprimir</button></td></tr>
    `) : emptyRow(5, 'Aún no has generado facturas.'));
    tbody.querySelectorAll('.btn-ver-factura').forEach(btn=>{
      btn.addEventListener('click', ()=> mostrarFacturaImprimible(btn.dataset.id));
    });
  }catch(e){ console.error(e); showAlert('alertFactura','No se pudieron cargar las facturas.'); }
}

document.getElementById('btnCargarPedidoFactura').addEventListener('click', async ()=>{
  const pedidoId = document.getElementById('selectPedidoFactura').value;
  if(!pedidoId){ showAlert('alertFactura','Selecciona un pedido primero.'); return; }
  try{
    const pedido = check(await sb.from('pedidos').select('*, clientes(telefono,direccion)').eq('id', pedidoId).single());
    const items = check(await sb.from('pedido_items').select('*').eq('pedido_id', pedidoId)) || [];

    document.getElementById('fCliNombre').value = pedido.cliente_nombre || '';
    document.getElementById('fCliTel').value = (pedido.clientes && pedido.clientes.telefono) || '';
    document.getElementById('fCliDir').value = (pedido.clientes && pedido.clientes.direccion) || '';

    facturaItems = items.map(it=>{
      // Se busca el precio por el identificador del producto; si no hay, por el nombre.
      const prod = productosCache.find(p=> it.producto_id && p.id===it.producto_id)
        || productosCache.find(p=>p.nombre.toLowerCase()===it.producto_nombre.toLowerCase());
      const precio = prod && prod.precio ? Number(prod.precio) : 0;
      return { nombre: it.producto_nombre, cantidad: Number(it.cantidad), unidad: it.unidad, precio, subtotal: precio*Number(it.cantidad) };
    });
    document.getElementById('draftFacturaCard').style.display='block';
    renderFacturaItems();
  }catch(e){ console.error(e); showAlert('alertFactura','No se pudo cargar ese pedido.'); }
});

document.getElementById('btnFacturaManual').addEventListener('click', ()=>{
  document.getElementById('fCliNombre').value=''; document.getElementById('fCliTel').value=''; document.getElementById('fCliDir').value='';
  facturaItems = [];
  document.getElementById('draftFacturaCard').style.display='block';
  renderFacturaItems();
});

document.getElementById('btnAgregarLineaFactura').addEventListener('click', ()=>{
  facturaItems.push({ nombre:'', cantidad:1, unidad:'unidad', precio:0, subtotal:0 });
  renderFacturaItems();
});

function renderFacturaItems(){
  const tbody = document.getElementById('tbodyFacturaItems');
  setHtml(tbody, facturaItems.map((it,i)=>html`
    <tr data-i="${i}">
      <td><input type="text" class="fi-nombre" value="${it.nombre}" style="width:150px;"></td>
      <td><input type="number" class="fi-cant" value="${it.cantidad}" style="width:70px;text-align:right;"></td>
      <td><select class="fi-unidad">${UNIT_OPTIONS.map(u=>html`<option value="${u}" ${u===it.unidad?'selected':''}>${u}</option>`)}</select></td>
      <td><input type="number" class="fi-precio" value="${it.precio}" style="width:90px;text-align:right;"></td>
      <td class="num">$${Number(it.subtotal).toLocaleString('es-CO')}</td>
      <td><button class="btn btn-small btn-danger fi-quitar">✕</button></td>
    </tr>`));

  tbody.querySelectorAll('tr').forEach(tr=>{
    const i = Number(tr.dataset.i);
    const recalc = ()=>{
      facturaItems[i].nombre = tr.querySelector('.fi-nombre').value;
      facturaItems[i].cantidad = parseFloat(tr.querySelector('.fi-cant').value)||0;
      facturaItems[i].unidad = tr.querySelector('.fi-unidad').value;
      facturaItems[i].precio = parseFloat(tr.querySelector('.fi-precio').value)||0;
      facturaItems[i].subtotal = facturaItems[i].cantidad * facturaItems[i].precio;
      renderFacturaItems();
    };
    tr.querySelector('.fi-cant').addEventListener('change', recalc);
    tr.querySelector('.fi-precio').addEventListener('change', recalc);
    tr.querySelector('.fi-unidad').addEventListener('change', recalc);
    tr.querySelector('.fi-nombre').addEventListener('change', recalc);
    tr.querySelector('.fi-quitar').addEventListener('click', ()=>{ facturaItems.splice(i,1); renderFacturaItems(); });
  });

  const flete = parseFloat(document.getElementById('fFlete').value)||0;
  const total = facturaItems.reduce((s,it)=>s+it.subtotal,0) + flete;
  document.getElementById('fTotalPreview').textContent = '$'+total.toLocaleString('es-CO');
}
document.getElementById('fFlete').addEventListener('input', renderFacturaItems);

document.getElementById('btnGuardarFactura').addEventListener('click', async ()=>{
  const nombre = document.getElementById('fCliNombre').value.trim();
  if(!nombre){ showAlert('alertFactura','Escribe el nombre del cliente.'); return; }
  if(facturaItems.length===0){ showAlert('alertFactura','Agrega al menos un producto.'); return; }
  const flete = parseFloat(document.getElementById('fFlete').value)||0;
  const total = facturaItems.reduce((s,it)=>s+it.subtotal,0) + flete;
  try{
    const factura = check(await sb.from('facturas').insert({
      cliente_nombre: nombre,
      cliente_telefono: document.getElementById('fCliTel').value.trim()||null,
      cliente_direccion: document.getElementById('fCliDir').value.trim()||null,
      fecha: document.getElementById('fFecha').value,
      flete, total
    }).select().single());
    check(await sb.from('factura_items').insert(facturaItems.map(it=>({
      factura_id: factura.id, producto_nombre: it.nombre, cantidad: it.cantidad, unidad: it.unidad, precio_unitario: it.precio, subtotal: it.subtotal
    }))));
    showAlert('alertFactura','Factura #'+factura.numero+' generada correctamente.','ok');
    document.getElementById('draftFacturaCard').style.display='none';
    facturaItems = [];
    await cargarListaFacturas();
    mostrarFacturaImprimible(factura.id);
  }catch(e){ console.error(e); showAlert('alertFactura','No se pudo guardar la factura.'); }
});

async function mostrarFacturaImprimible(facturaId){
  try{
    const f = check(await sb.from('facturas').select('*').eq('id', facturaId).single());
    const items = check(await sb.from('factura_items').select('*').eq('factura_id', facturaId)) || [];
    document.getElementById('pfNumero').textContent = f.numero;
    document.getElementById('pfCliente').textContent = f.cliente_nombre;
    document.getElementById('pfTel').textContent = f.cliente_telefono || '—';
    document.getElementById('pfFecha').textContent = parseDateOnly(f.fecha).toLocaleDateString('es-CO');
    document.getElementById('pfDireccion').textContent = f.cliente_direccion || '—';
    setHtml(document.getElementById('pfItems'), items.map(it=>html`
      <tr><td style="padding:4px;">${capitalize(it.producto_nombre)}</td><td style="padding:4px;text-align:center;">${round(it.cantidad)} ${it.unidad}</td>
      <td style="padding:4px;text-align:right;">$${Number(it.subtotal).toLocaleString('es-CO')}</td></tr>`));
    document.getElementById('pfFlete').textContent = '$'+Number(f.flete).toLocaleString('es-CO');
    document.getElementById('pfTotal').textContent = '$'+Number(f.total).toLocaleString('es-CO');
    document.getElementById('modalFacturaBg').classList.add('show');
  }catch(e){ console.error(e); showAlert('alertFactura','No se pudo cargar la factura.'); }
}
document.getElementById('btnCerrarFactura').addEventListener('click', ()=> document.getElementById('modalFacturaBg').classList.remove('show'));
document.getElementById('btnImprimirFactura').addEventListener('click', ()=>{
  // outerHTML es el HTML ya construido y escapado de la factura en pantalla.
  const contenido = document.getElementById('facturaImprimible').outerHTML;
  const fontsUrl = new URL('css/fonts.css', window.location.href).href;
  const w = window.open('', '_blank');
  if(!w){ alert('El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes para este sitio.'); return; }
  w.document.write(`<html><head><title>Factura</title><link rel="stylesheet" href="${escapeHtml(fontsUrl)}"><style>
    :root{ --verde:#1e7d32; --verde-oscuro:#145a24; --verde-claro:#e8f5e9; --amarillo:#ffc800; --amarillo-suave:#fff4cc; --borde:#d9e3d9; --rojo:#c0392b; }
    @page{ size: letter landscape; margin: 8mm; }
    body{ margin:0; font-family:Arial,sans-serif; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .hoja{ display:flex; gap:14px; }
    .hoja > div{ flex:1; transform:scale(0.98); }
    .divisoria{ border-left:2px dashed #ccc; }
  </style></head><body>
    <div class="hoja">${contenido}<div class="divisoria"></div>${contenido}</div>
  </body></html>`);
  w.document.close();
  setTimeout(()=> w.print(), 300);
});
document.getElementById('btnDescargarImagenFactura').addEventListener('click', async ()=>{
  const el = document.getElementById('facturaImprimible');
  const canvas = await html2canvas(el, { scale: 3, backgroundColor: '#ffffff' });
  const link = document.createElement('a');
  link.download = 'factura_'+document.getElementById('pfNumero').textContent+'.jpg';
  link.href = canvas.toDataURL('image/jpeg', 0.95);
  link.click();
});

/* Link al formulario de clientes con URL completa */
document.getElementById('linkClientes').href = new URL('cliente.html', window.location.href).href;
document.getElementById('linkClientes').textContent = new URL('cliente.html', window.location.href).href;
