// Se ejecuta antes que cualquier archivo .ts. Tiene que ser JS plano: en una
// version vieja de Node el error real es un fallo de parseo en el primer
// `import type`, que no le dice nada a nadie.
const [major, minor] = process.versions.node.split('.').map(Number);
const OK = major > 22 || (major === 22 && minor >= 6);

if (!OK) {
  console.error(`
  Node ${process.versions.node} es muy viejo para este proyecto.

  Hace falta Node >= 22.6: el codigo corre TypeScript sin compilar, con
  --experimental-strip-types, que existe recien desde esa version.

  Node 20 ademas quedo sin soporte el 30 de abril de 2026.

    nvm install 22 && nvm use 22

  La version esperada esta en .nvmrc.
`);
  process.exit(1);
}
