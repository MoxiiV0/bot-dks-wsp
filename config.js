module.exports = {
  prefix: '#',
  botName: 'DKS Bot',
  ownerNumber: process.env.OWNER_NUMBER || '',
  groupSettings: {
    antilink: true,
    welcome: true,
    goodbye: true,
    antispam: true,
  },
  welcomeText: '*¡Bienvenido(a)!*\n\nHola {nombres}, bienvenido(a) a *{grupo}*.\n\nLea la descripción del grupo y sea respetuoso(a). ¡Disfruta tu estancia!',
  goodbyeText: '*Adiós* {nombres}, ha salido del grupo.',
  mainGroupLink: process.env.MAIN_GROUP_LINK || '',
  lobbyForm: `♡ FORMULARIO DE RECLUTAMIENTO — DKS ♡

╭────────── ✦ ──────────╮
¡HOLA! BIENVENIDO/A A DKS
╰────────── ✦ ──────────╯

✨ ¡Nos alegra mucho que quieras formar parte de nuestra comunidad!
Antes de entrar, queremos conocerte un poquito. ♡

📌 REQUISITOS

• Tener 16 años o más
• Ser respetuoso/a con los demás
• Tener ganas de convivir y participar
• Respetar las reglas de DKS

Quien te reclutó?

Nombre o apodo:

Edad:

Usuario de Roblox:

País (opcional):

Pronombres (el/ella/o el que tú quieras):

¿Vienes de otro clan? (si/no):

Si respondiste que sí, ¿por qué decidiste salir de tu anterior clan?
(ignorá esta pregunta si nunca estuviste en uno)

♡ ¡GRACIAS POR COMPLETAR NUESTRO FORMULARIO! ♡

Esperamos verte pronto dentro de DKS. ✨
Recuerda: lo más importante es divertirte, respetar a los demás y disfrutar de la comunidad.`,
};
