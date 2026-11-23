/* ============================================================
   GeoTracker — script.js
   Geolocalización y reactividad con JavaScript puro (Vanilla JS)
   ============================================================

   CONCEPTOS CLAVE que este archivo demuestra:
   -------------------------------------------
   1. Geolocation API: navigator.geolocation
      - getCurrentPosition()  → obtiene la posición UNA SOLA VEZ
      - watchPosition()       → escucha cambios CONTINUAMENTE
      - clearWatch()          → DETIENE el seguimiento

   2. Reactividad manual:
      - Se mantiene un objeto "estado" con los datos actuales.
      - Cada vez que la posición cambia, se llama a actualizarInterfaz().
      - Esa función lee el estado y escribe en el DOM.
      - El usuario ve los cambios al instante, sin recargar la página.

   3. Leaflet:
      - Se inicializa el mapa una sola vez.
      - El marcador se crea/mueve según la posición recibida.
   ============================================================ */


/* ----------------------------------------------------------
   ESTADO CENTRAL DE LA APLICACIÓN
   ----------------------------------------------------------
   Este objeto es el "corazón reactivo" de la app.
   Cuando cualquiera de sus propiedades cambia, llamamos a
   actualizarInterfaz() para que el DOM refleje el nuevo estado.
   Así logramos reactividad sin ningún framework externo.
---------------------------------------------------------- */
const estado = {
  latitud:         null,     // número decimal (ej: 19.4326)
  longitud:        null,     // número decimal (ej: -99.1332)
  precision:       null,     // metros de margen de error
  horaActualizacion: null,   // objeto Date de la última lectura
  enSeguimiento:   false,    // ¿está watchPosition activo?
  totalActualizaciones: 0,   // contador para demostrar reactividad
};


/* ----------------------------------------------------------
   VARIABLE PARA EL ID DE SEGUIMIENTO
   ----------------------------------------------------------
   watchPosition() devuelve un número (watchId).
   Guardamos ese número aquí para poder cancelar el seguimiento
   más tarde con clearWatch(watchId).
---------------------------------------------------------- */
let watchId = null;


/* ----------------------------------------------------------
   REFERENCIAS A ELEMENTOS DEL DOM
   ----------------------------------------------------------
   Las guardamos en variables para no tener que buscarlas
   en el DOM cada vez que las necesitemos (mejor rendimiento).
---------------------------------------------------------- */
const elementos = {
  estadoMensaje:          document.getElementById('estado-mensaje'),
  btnDetectar:            document.getElementById('btn-detectar'),
  btnIniciar:             document.getElementById('btn-iniciar'),
  btnDetener:             document.getElementById('btn-detener'),
  datoLatitud:            document.getElementById('dato-latitud'),
  datoLongitud:           document.getElementById('dato-longitud'),
  datoPrecision:          document.getElementById('dato-precision'),
  datoHora:               document.getElementById('dato-hora'),
  contadorActualizaciones: document.getElementById('contador-actualizaciones'),
};


/* ----------------------------------------------------------
   INICIALIZACIÓN DEL MAPA CON LEAFLET
   ----------------------------------------------------------
   Leaflet es una librería JavaScript para mapas interactivos.
   - L.map('mapa')          → crea el mapa dentro del div#mapa
   - setView([lat, lng], z) → centra el mapa (z = nivel de zoom)
   - L.tileLayer(...)       → carga las imágenes del mapa (tiles)
     desde OpenStreetMap, que es gratuito y de código abierto.
---------------------------------------------------------- */
const mapa = L.map('mapa').setView([20, 0], 2); // Vista inicial: mundo

/*
   PROVEEDOR DE TILES: ESRI / ArcGIS World Street Map
   - Completamente gratuito, sin API key, sin restricciones de Referer.
   - Funciona desde localhost y desde cualquier dominio.
   - Tiles de alta calidad con datos de OpenStreetMap + otras fuentes.
   - Documentación: https://www.esri.com/en-us/legal/terms/full-master-agreement
*/
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom',
  maxZoom: 19,
}).addTo(mapa);

// El marcador se crea cuando tengamos la primera posición
let marcador = null;


/* ===========================================================
   FUNCIONES PRINCIPALES
   =========================================================== */


/* ----------------------------------------------------------
   actualizarInterfaz()
   ----------------------------------------------------------
   Esta es la función REACTIVA central.

   ¿Cómo funciona la reactividad aquí?
   En frameworks como Vue o React, cuando cambia una variable
   el DOM se actualiza automáticamente. En JavaScript puro
   tenemos que hacerlo manualmente: cada vez que cambia el
   estado, llamamos a esta función, que "dibuja" los nuevos
   datos en el HTML.

   Este patrón se llama "unidirectional data flow":
   ACCIÓN → cambia ESTADO → actualiza INTERFAZ
---------------------------------------------------------- */
function actualizarInterfaz() {

  // Si hay coordenadas disponibles, mostrarlas con 6 decimales
  if (estado.latitud !== null) {
    elementos.datoLatitud.textContent  = estado.latitud.toFixed(6) + '°';
    elementos.datoLongitud.textContent = estado.longitud.toFixed(6) + '°';
    elementos.datoPrecision.textContent = '±' + Math.round(estado.precision) + ' m';

    // Resaltar los contenedores de datos
    document.querySelectorAll('.dato-item').forEach(el => {
      el.classList.add('dato-item--activo');
    });

    // Formatear la fecha/hora de forma legible
    if (estado.horaActualizacion) {
      elementos.datoHora.textContent = estado.horaActualizacion.toLocaleString('es-MX', {
        dateStyle: 'medium',
        timeStyle: 'medium',
      });
    }

  } else {
    // Sin datos todavía
    elementos.datoLatitud.textContent  = '—';
    elementos.datoLongitud.textContent = '—';
    elementos.datoPrecision.textContent = '—';
    elementos.datoHora.textContent     = '—';
  }

  // Actualizar el contador de actualizaciones con una animación flash
  elementos.contadorActualizaciones.textContent = estado.totalActualizaciones;
  animarContador();

  // Habilitar o deshabilitar botones según el estado
  elementos.btnIniciar.disabled = estado.enSeguimiento;
  elementos.btnDetener.disabled = !estado.enSeguimiento;
}


/* ----------------------------------------------------------
   animarContador()
   ----------------------------------------------------------
   Aplica una clase CSS temporal para hacer "flash" al número
   del contador cuando aumenta. Es solo un detalle visual.
---------------------------------------------------------- */
function animarContador() {
  const el = elementos.contadorActualizaciones;
  el.classList.add('contador-flash');
  // Elimina la clase después de 300ms para poder repetir la animación
  setTimeout(() => el.classList.remove('contador-flash'), 300);
}


/* ----------------------------------------------------------
   cambiarEstado(mensaje, tipoCss)
   ----------------------------------------------------------
   Actualiza el badge de estado en la interfaz.
   tipoCss puede ser: 'inactivo' | 'cargando' | 'exitoso' |
                      'seguimiento' | 'error'
---------------------------------------------------------- */
function cambiarEstado(mensaje, tipoCss) {
  const el = elementos.estadoMensaje;

  // Eliminar todas las clases de estado anteriores
  el.className = 'estado-badge';

  // Agregar la nueva clase según el tipo
  el.classList.add('estado--' + tipoCss);

  // Escribir el mensaje
  el.textContent = mensaje;
}


/* ----------------------------------------------------------
   procesarPosicion(posicion)
   ----------------------------------------------------------
   Esta función recibe el objeto "posicion" que devuelve
   la Geolocation API y:
   1. Actualiza el estado central de la app.
   2. Actualiza la interfaz llamando a actualizarInterfaz().
   3. Actualiza el marcador en el mapa.

   El objeto "posicion" tiene esta estructura:
   posicion.coords.latitude   → número decimal
   posicion.coords.longitude  → número decimal
   posicion.coords.accuracy   → metros de precisión
   posicion.timestamp         → milisegundos (fecha/hora)
---------------------------------------------------------- */
function procesarPosicion(posicion) {

  // 1. Actualizar el estado central
  estado.latitud           = posicion.coords.latitude;
  estado.longitud          = posicion.coords.longitude;
  estado.precision         = posicion.coords.accuracy;
  estado.horaActualizacion = new Date(posicion.timestamp);
  estado.totalActualizaciones += 1;

  // 2. Actualizar el badge de estado
  if (estado.enSeguimiento) {
    cambiarEstado('Seguimiento activo — posición actualizada', 'seguimiento');
  } else {
    cambiarEstado('Ubicación detectada correctamente', 'exitoso');
  }

  // 3. Refrescar la interfaz con los nuevos datos
  actualizarInterfaz();

  // 4. Mover el mapa y el marcador a la nueva posición
  actualizarMapa(estado.latitud, estado.longitud);
}


/* ----------------------------------------------------------
   procesarError(error)
   ----------------------------------------------------------
   Se llama cuando la Geolocation API devuelve un error.
   Muestra un mensaje claro según el tipo de error.

   Tipos de error (error.code):
   1 → PERMISSION_DENIED    → el usuario rechazó el permiso
   2 → POSITION_UNAVAILABLE → el dispositivo no pudo obtenerla
   3 → TIMEOUT              → tardó demasiado
---------------------------------------------------------- */
function procesarError(error) {
  let mensaje = '';

  switch (error.code) {
    case 1:
      mensaje = 'Permiso denegado. Permite el acceso a la ubicación en tu navegador.';
      break;
    case 2:
      mensaje = 'Ubicación no disponible. Verifica que el GPS o la red esté activa.';
      break;
    case 3:
      mensaje = 'Tiempo de espera agotado. Intenta de nuevo.';
      break;
    default:
      mensaje = 'Error desconocido al obtener la ubicación.';
  }

  cambiarEstado(mensaje, 'error');

  // Si estaba en seguimiento, detenerlo para evitar errores repetidos
  if (estado.enSeguimiento) {
    detenerSeguimiento();
  }
}


/* ----------------------------------------------------------
   actualizarMapa(lat, lng)
   ----------------------------------------------------------
   Mueve el mapa y el marcador a las nuevas coordenadas.

   Si el marcador no existe todavía, lo crea.
   Si ya existe, lo mueve a la nueva posición.
   Esto es más eficiente que destruir y crear el marcador
   cada vez que la posición cambia.
---------------------------------------------------------- */
function actualizarMapa(lat, lng) {
  const posicion = [lat, lng];

  if (marcador === null) {
    // Primera vez: crear el marcador
    marcador = L.marker(posicion).addTo(mapa);
    marcador.bindPopup('<b>Tu ubicación actual</b>').openPopup();
  } else {
    // Ya existe: solo moverlo
    marcador.setLatLng(posicion);
  }

  // Centrar el mapa en la nueva posición con zoom 15 (nivel de calle)
  mapa.setView(posicion, 15);
}


/* ===========================================================
   FUNCIONES DE LOS BOTONES
   =========================================================== */


/* ----------------------------------------------------------
   detectarUbicacion()
   ----------------------------------------------------------
   Se ejecuta al presionar "Detectar mi ubicación".

   Usa getCurrentPosition(), que solicita la ubicación
   UNA SOLA VEZ. No sigue rastreando.

   DIFERENCIA con watchPosition():
   - getCurrentPosition() → lee la posición una vez y para.
   - watchPosition()      → sigue leyendo cada vez que cambia.
---------------------------------------------------------- */
function detectarUbicacion() {

  // Verificar si el navegador soporta geolocalización
  if (!navigator.geolocation) {
    cambiarEstado('Tu navegador no soporta geolocalización.', 'error');
    return;
  }

  // Mostrar estado de carga mientras espera
  cambiarEstado('Obteniendo ubicación...', 'cargando');

  // Opciones de la solicitud
  const opciones = {
    enableHighAccuracy: true,  // Usar GPS si está disponible (más preciso)
    timeout: 10000,            // Tiempo máximo: 10 segundos
    maximumAge: 0,             // No usar caché; siempre obtener posición fresca
  };

  // Llamada a la Geolocation API
  // - procesarPosicion: función que se llama si tiene éxito (callback de éxito)
  // - procesarError:    función que se llama si falla (callback de error)
  navigator.geolocation.getCurrentPosition(
    procesarPosicion,
    procesarError,
    opciones
  );
}


/* ----------------------------------------------------------
   iniciarSeguimiento()
   ----------------------------------------------------------
   Se ejecuta al presionar "Iniciar seguimiento".

   Usa watchPosition(), que llama a procesarPosicion()
   AUTOMÁTICAMENTE cada vez que el dispositivo detecta
   un cambio de posición.

   El ID retornado (watchId) es necesario para poder
   detener el seguimiento más tarde con clearWatch().
---------------------------------------------------------- */
function iniciarSeguimiento() {

  if (!navigator.geolocation) {
    cambiarEstado('Tu navegador no soporta geolocalización.', 'error');
    return;
  }

  // Si ya hay un seguimiento activo, no crear otro
  if (estado.enSeguimiento) return;

  // Marcar que el seguimiento está activo en el estado
  estado.enSeguimiento = true;

  cambiarEstado('Iniciando seguimiento continuo...', 'cargando');
  actualizarInterfaz(); // Actualizar botones (Detener se habilita)

  const opciones = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 1000, // Acepta datos de hasta 1 segundo de antigüedad
  };

  // watchPosition() devuelve un ID numérico que guardamos en watchId
  watchId = navigator.geolocation.watchPosition(
    procesarPosicion,
    procesarError,
    opciones
  );
}


/* ----------------------------------------------------------
   detenerSeguimiento()
   ----------------------------------------------------------
   Se ejecuta al presionar "Detener seguimiento".

   clearWatch(watchId) es la función que cancela el
   seguimiento iniciado con watchPosition().

   Sin clearWatch(), watchPosition() seguiría escuchando
   en segundo plano, consumiendo batería y recursos.
---------------------------------------------------------- */
function detenerSeguimiento() {

  if (watchId !== null) {
    // Detener el seguimiento usando el ID guardado
    navigator.geolocation.clearWatch(watchId);
    watchId = null; // Limpiar el ID
  }

  // Actualizar el estado
  estado.enSeguimiento = false;

  cambiarEstado('Seguimiento detenido', 'exitoso');
  actualizarInterfaz(); // Actualizar botones (Iniciar se habilita de nuevo)
}


/* ===========================================================
   ASIGNAR EVENTOS A LOS BOTONES
   ===========================================================
   addEventListener() escucha el evento 'click' en cada botón
   y llama a la función correspondiente cuando sucede.
   =========================================================== */
elementos.btnDetectar.addEventListener('click', detectarUbicacion);
elementos.btnIniciar.addEventListener('click',  iniciarSeguimiento);
elementos.btnDetener.addEventListener('click',  detenerSeguimiento);


/* ===========================================================
   INICIALIZACIÓN AL CARGAR LA PÁGINA
   ===========================================================
   Cuando el script se carga, establecemos el estado inicial
   de la interfaz para que todo luzca correcto desde el inicio.
   =========================================================== */
actualizarInterfaz();
