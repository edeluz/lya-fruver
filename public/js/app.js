'use strict';
/* ============================================================
   L&A FRUVER - JavaScript propio común (base para las páginas rediseñadas)
   Requiere, en este orden:
     vendor/jquery.min.js → vendor/bootstrap/bootstrap.bundle.min.js → js/common.js → js/app.js
   El login NO lo usa (es independiente y liviano).

   REGLA DE SEGURIDAD: con jQuery, los datos se pintan SIEMPRE con .text() o .val(),
   o con html`...` + setHtml de common.js. NUNCA con .html(texto) / .append(texto) /
   $('<b>' + dato + '</b>') armados con datos de la API (eso permite XSS).
   ============================================================ */

const App = (function(){

  /* Llamada AJAX a la API del mismo servidor. Devuelve una promesa con el JSON.
     Si la sesión venció (401), vuelve al login. Los errores traen .status y el mensaje. */
  function api(metodo, ruta, cuerpo){
    return new Promise((resolver, rechazar)=>{
      $.ajax({
        url: '/api' + ruta,
        method: metodo,
        contentType: cuerpo === undefined ? undefined : 'application/json',
        data: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
        dataType: 'json',
        xhrFields: { withCredentials: true },
      })
        .done((datos)=> resolver(datos))
        .fail((xhr)=>{
          if(xhr.status === 401){ window.location.href = 'login.html'; return; }
          const mensaje = (xhr.responseJSON && xhr.responseJSON.error) || 'No se pudo completar la operación';
          const error = new Error(mensaje);
          error.status = xhr.status;
          error.detalles = xhr.responseJSON && xhr.responseJSON.detalles;
          rechazar(error);
        });
    });
  }

  /* Aviso flotante (toast de Bootstrap) abajo a la derecha. tipo: 'ok' | 'error' | 'info' */
  function aviso(texto, tipo = 'ok'){
    let $zona = $('#frAvisos');
    if(!$zona.length){
      $zona = $('<div>', { id: 'frAvisos', class: 'toast-container position-fixed bottom-0 end-0 p-3' }).appendTo('body');
    }
    const estilos = {
      ok:    { clase: 'text-bg-success', icono: 'bi-check-circle' },
      error: { clase: 'text-bg-danger',  icono: 'bi-exclamation-triangle' },
      info:  { clase: 'text-bg-dark',    icono: 'bi-info-circle' },
    }[tipo] || { clase: 'text-bg-dark', icono: 'bi-info-circle' };

    const $toast = $('<div>', { class: `toast align-items-center border-0 ${estilos.clase}`, role: 'status', 'aria-live': 'polite' });
    const $fila = $('<div>', { class: 'd-flex' }).appendTo($toast);
    const $cuerpo = $('<div>', { class: 'toast-body d-flex gap-2 align-items-center' }).appendTo($fila);
    $('<i>', { class: `bi ${estilos.icono}`, 'aria-hidden': 'true' }).appendTo($cuerpo);
    $('<span>').text(texto).appendTo($cuerpo);   // .text(): el mensaje nunca se interpreta como HTML
    $('<button>', { type: 'button', class: 'btn-close btn-close-white me-2 m-auto', 'data-bs-dismiss': 'toast', 'aria-label': 'Cerrar' }).appendTo($fila);

    $toast.appendTo($zona);
    $toast.on('hidden.bs.toast', ()=> $toast.remove());
    bootstrap.Toast.getOrCreateInstance($toast[0], { delay: 4000 }).show();
  }

  return { api, aviso };
})();
