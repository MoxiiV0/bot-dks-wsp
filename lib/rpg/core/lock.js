// Lock por jugador: serializa las acciones de un mismo usuario.
// Ningún combate/comando puede avanzar dos veces a la vez para el mismo ID.

const colas = new Map(); // key -> Promise encadenada (ya ingerida)

// Ejecuta fn bajo el lock de `key`. Si ya hay una tarea en cola, espera su turno.
// El error de fn no rompe la cadena: se propaga al llamador, no a los siguientes.
const withLock = (key, fn) => {
  const prev = colas.get(key) || Promise.resolve();
  const tarea = prev.then(() => fn());
  const encadenada = tarea.then(() => {}, () => {});
  colas.set(key, encadenada);
  encadenada.then(() => {
    if (colas.get(key) === encadenada) colas.delete(key);
  });
  return tarea;
};

// true si el usuario tiene una tarea en curso o en cola.
const isLocked = (key) => colas.has(key);

// Solo para pruebas/arranque: limpia todas las colas.
const clearLocks = () => colas.clear();

module.exports = { withLock, isLocked, clearLocks };
