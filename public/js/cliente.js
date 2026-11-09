'use strict';
/* Formulario de pedidos para clientes (cliente.html). */

let productos = [];
let clientes = [];
let rowCount = 0;

function showAlert(msg, type='err'){
  const box = document.getElementById('alertBox');
  const div = document.createElement('div');
  div.className = 'alert ' + type;
  div.textContent = msg;
  box.replaceChildren(div);
  setTimeout(()=> box.replaceChildren(), 6000);
}

async function cargarDatos(){
  try{
    const [{data: prods, error: errP}, {data: clis, error: errC}] = await Promise.all([
      sb.from('productos').select('id,nombre,unidad').eq('disponible', true).order('nombre'),
      sb.from('clientes').select('id,nombre').eq('activo', true).order('nombre')
    ]);
    if(errP) throw errP;
    if(errC) throw errC;
    productos = prods || [];
    clientes = clis || [];
    poblarClientes();
    if(productos.length===0){
      showAlert('No hay productos disponibles en este momento. Contacta directamente a L&A Fruver.','err');
    } else {
      agregarFilaProducto();
    }
  }catch(e){
    console.error(e);
    showAlert('No se pudo cargar el formulario. Verifica tu conexión a internet e inténtalo de nuevo.','err');
  }
}

function poblarClientes(){
  const sel = document.getElementById('clienteSelect');
  setHtml(sel, html`<option value="">Selecciona tu nombre…</option>${
    clientes.map(c=>html`<option value="${c.id}">${c.nombre}</option>`)
  }<option value="__nuevo__">No estoy en la lista</option>`);
}

document.getElementById('clienteSelect').addEventListener('change', (ev)=>{
  document.getElementById('nuevoClienteBox').classList.toggle('hidden', ev.target.value !== '__nuevo__');
});

function agregarFilaProducto(){
  rowCount++;
  const id = 'row_'+rowCount;
  const container = document.getElementById('productosContainer');
  const div = document.createElement('div');
  div.className = 'producto-row';
  div.id = id;
  setHtml(div, html`
    <button type="button" class="remove-btn" data-remove="${id}">✕</button>
    <div class="row-grid">
      <div>
        <label>Producto</label>
        <select class="prod-select">
          <option value="">Selecciona…</option>
          ${productos.map(p=>html`<option value="${p.id}" data-unidad="${p.unidad}">${p.nombre}</option>`)}
        </select>
      </div>
      <div>
        <label>Cantidad</label>
        <input type="number" class="cant-input" min="0.1" step="0.1" placeholder="0">
      </div>
    </div>
    <div class="row-grid2">
      <div>
        <label>Unidad</label>
        <select class="unidad-select">
          ${UNIT_OPTIONS.map(u=>html`<option value="${u}">${u}</option>`)}
        </select>
      </div>
      <div>
        <label>Observación (opcional)</label>
        <input type="text" class="obs-input" placeholder="Ej: bien maduro">
      </div>
    </div>
  `);
  container.appendChild(div);

  const prodSelect = div.querySelector('.prod-select');
  const unidadSelect = div.querySelector('.unidad-select');
  prodSelect.addEventListener('change', ()=>{
    const opt = prodSelect.options[prodSelect.selectedIndex];
    const unidad = opt.dataset.unidad;
    if(unidad) unidadSelect.value = unidad;
  });

  div.querySelector('[data-remove]').addEventListener('click', ()=>{
    if(document.querySelectorAll('.producto-row').length <= 1){
      showAlert('Debes tener al menos un producto en el pedido.','err');
      return;
    }
    div.remove();
  });
}

document.getElementById('btnAgregarProducto').addEventListener('click', agregarFilaProducto);

document.getElementById('btnEnviar').addEventListener('click', async ()=>{
  const btn = document.getElementById('btnEnviar');
  const clienteSelect = document.getElementById('clienteSelect');
  const nuevoInput = document.getElementById('nuevoClienteInput');

  let clienteId = clienteSelect.value;
  let clienteNombre = '';

  if(!clienteId){
    showAlert('Por favor selecciona quién hace el pedido.','err');
    return;
  }
  if(clienteId === '__nuevo__'){
    clienteNombre = nuevoInput.value.trim();
    const tel = document.getElementById('nuevoClienteTel').value.trim();
    const dir = document.getElementById('nuevoClienteDir').value.trim();
    if(!clienteNombre){
      showAlert('Por favor escribe tu nombre o el de tu negocio.','err');
      return;
    }
    if(!tel || !dir){
      showAlert('El teléfono y la dirección son obligatorios para poder despacharte el pedido.','err');
      return;
    }
  } else {
    const c = clientes.find(x=>x.id===clienteId);
    clienteNombre = c ? c.nombre : '';
  }

  const filas = [...document.querySelectorAll('.producto-row')];
  const items = [];
  for(const fila of filas){
    const prodSelect = fila.querySelector('.prod-select');
    const cantInput = fila.querySelector('.cant-input');
    const unidadSelect = fila.querySelector('.unidad-select');
    const obsInput = fila.querySelector('.obs-input');
    const prodId = prodSelect.value;
    const cant = parseFloat(cantInput.value);
    if(!prodId || !cant || cant<=0) continue;
    const prod = productos.find(p=>p.id===prodId);
    items.push({
      producto_id: prodId,
      producto_nombre: prod ? prod.nombre : '',
      cantidad: cant,
      unidad: unidadSelect.value,
      observacion: obsInput.value.trim() || null
    });
  }

  if(items.length===0){
    showAlert('Agrega al menos un producto con su cantidad antes de enviar.','err');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Enviando…';

  try{
    // Si es cliente nuevo, lo creamos (o reutilizamos si ya existe con ese nombre)
    if(clienteId === '__nuevo__'){
      const { data: existente, error: errExistente } = await sb.from('clientes').select('id').eq('nombre', clienteNombre).maybeSingle();
      if(errExistente) throw errExistente;
      if(existente){
        clienteId = existente.id;
      } else {
        const { data: nuevo, error: errNuevo } = await sb.from('clientes').insert({
          nombre: clienteNombre,
          telefono: document.getElementById('nuevoClienteTel').value.trim(),
          direccion: document.getElementById('nuevoClienteDir').value.trim()
        }).select().single();
        if(errNuevo) throw errNuevo;
        clienteId = nuevo.id;
      }
    }

    const { data: pedido, error: errPedido } = await sb.from('pedidos')
      .insert({ cliente_id: clienteId, cliente_nombre: clienteNombre, comentario: document.getElementById('comentarioGeneral').value.trim() || null })
      .select().single();
    if(errPedido) throw errPedido;

    const itemsConPedido = items.map(it=> ({ ...it, pedido_id: pedido.id }));
    const { error: errItems } = await sb.from('pedido_items').insert(itemsConPedido);
    if(errItems) throw errItems;

    document.getElementById('formSection').classList.add('hidden');
    document.getElementById('successSection').classList.remove('hidden');
  }catch(e){
    console.error(e);
    showAlert('No se pudo enviar el pedido. Verifica tu conexión e inténtalo de nuevo.','err');
    btn.disabled = false;
    btn.textContent = 'Enviar pedido';
  }
});

document.getElementById('btnNuevoPedido').addEventListener('click', ()=>{
  document.getElementById('successSection').classList.add('hidden');
  document.getElementById('formSection').classList.remove('hidden');
  document.getElementById('productosContainer').replaceChildren();
  document.getElementById('clienteSelect').value='';
  document.getElementById('nuevoClienteInput').value='';
  document.getElementById('nuevoClienteBox').classList.add('hidden');
  document.getElementById('comentarioGeneral').value='';
  document.getElementById('nuevoClienteTel').value='';
  document.getElementById('nuevoClienteDir').value='';
  rowCount = 0;
  cargarDatos();
  document.getElementById('btnEnviar').disabled=false;
  document.getElementById('btnEnviar').textContent='Enviar pedido';
});

cargarDatos();
