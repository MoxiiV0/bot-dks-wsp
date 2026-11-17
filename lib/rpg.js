// FACHADA LEGACY — no agregar lógica acá.
// Todo vive en lib/rpg/ (data/ + core/); este archivo solo re-exporta
// para no romper los require('./lib/rpg') existentes.
module.exports = require('./rpg/index.js');
