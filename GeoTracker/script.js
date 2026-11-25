


const estado = {
  latitud:         null,     
  longitud:        null,    
  precision:       null,   
  horaActualizacion: null,   
  enSeguimiento:   false,   
  totalActualizaciones: 0,   
};


let watchId = null;


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


const mapa = L.map('mapa').setView([20, 0], 2); // Vista inicial: mundo


L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom',
  maxZoom: 19,
}).addTo(mapa);

let marcador = null;



function actualizarInterfaz() {

  if (estado.latitud !== null) {
    elementos.datoLatitud.textContent  = estado.latitud.toFixed(6) + '°';
    elementos.datoLongitud.textContent = estado.longitud.toFixed(6) + '°';
    elementos.datoPrecision.textContent = '±' + Math.round(estado.precision) + ' m';

    document.querySelectorAll('.dato-item').forEach(el => {
      el.classList.add('dato-item--activo');
    });

    if (estado.horaActualizacion) {
      elementos.datoHora.textContent = estado.horaActualizacion.toLocaleString('es-MX', {
        dateStyle: 'medium',
        timeStyle: 'medium',
      });
    }

  } else {

    elementos.datoLatitud.textContent  = '—';
    elementos.datoLongitud.textContent = '—';
    elementos.datoPrecision.textContent = '—';
    elementos.datoHora.textContent     = '—';
  }

  elementos.contadorActualizaciones.textContent = estado.totalActualizaciones;
  animarContador();

  elementos.btnIniciar.disabled = estado.enSeguimiento;
  elementos.btnDetener.disabled = !estado.enSeguimiento;
}


function animarContador() {
  const el = elementos.contadorActualizaciones;
  el.classList.add('contador-flash');
  setTimeout(() => el.classList.remove('contador-flash'), 300);
}


function cambiarEstado(mensaje, tipoCss) {
  const el = elementos.estadoMensaje;

  el.className = 'estado-badge';
  el.classList.add('estado--' + tipoCss);
  el.textContent = mensaje;
}


function procesarPosicion(posicion) {
  estado.latitud           = posicion.coords.latitude;
  estado.longitud          = posicion.coords.longitude;
  estado.precision         = posicion.coords.accuracy;
  estado.horaActualizacion = new Date(posicion.timestamp);
  estado.totalActualizaciones += 1;

  if (estado.enSeguimiento) {
    cambiarEstado('Seguimiento activo — posición actualizada', 'seguimiento');
  } else {
    cambiarEstado('Ubicación detectada correctamente', 'exitoso');
  }

  actualizarInterfaz();
  actualizarMapa(estado.latitud, estado.longitud);
}


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

  if (estado.enSeguimiento) {
    detenerSeguimiento();
  }
}


function actualizarMapa(lat, lng) {
  const posicion = [lat, lng];

  if (marcador === null) {
    marcador = L.marker(posicion).addTo(mapa);
    marcador.bindPopup('<b>Tu ubicación actual</b>').openPopup();
  } else {
    marcador.setLatLng(posicion);
  }

  mapa.setView(posicion, 15);
}


function detectarUbicacion() {

  if (!navigator.geolocation) {
    cambiarEstado('Tu navegador no soporta geolocalización.', 'error');
    return;
  }

  cambiarEstado('Obteniendo ubicación...', 'cargando');

  const opciones = {
    enableHighAccuracy: true,  
    timeout: 10000,            
    maximumAge: 0,            
  };

  navigator.geolocation.getCurrentPosition(
    procesarPosicion,
    procesarError,
    opciones
  );
}

function iniciarSeguimiento() {

  if (!navigator.geolocation) {
    cambiarEstado('Tu navegador no soporta geolocalización.', 'error');
    return;
  }

  if (estado.enSeguimiento) return;

  estado.enSeguimiento = true;

  cambiarEstado('Iniciando seguimiento continuo...', 'cargando');
  actualizarInterfaz(); 

  const opciones = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 1000, 
  };

  watchId = navigator.geolocation.watchPosition(
    procesarPosicion,
    procesarError,
    opciones
  );
}

function detenerSeguimiento() {

  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null; 
  }

  estado.enSeguimiento = false;

  cambiarEstado('Seguimiento detenido', 'exitoso');
  actualizarInterfaz(); 
}


elementos.btnDetectar.addEventListener('click', detectarUbicacion);
elementos.btnIniciar.addEventListener('click',  iniciarSeguimiento);
elementos.btnDetener.addEventListener('click',  detenerSeguimiento);


actualizarInterfaz();
