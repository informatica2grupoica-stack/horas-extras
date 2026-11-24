# Horas Extras

Sistema interno para registrar y analizar horas extras por trabajador y proyecto. Sin inicio de sesión.

- **Panel**: KPIs, mes y proyecto que más consumen, mapa de calor proyecto×mes, ranking, presupuesto de horas, alertas.
- **Registros**: alta/edición, aprobación, filtros, exportación a Excel (.xlsx con 6 hojas) y CSV. El costo se calcula con valor hora × recargo.
- **Proyectos / Trabajadores**: CRUD con presupuesto de horas, límite mensual por persona.
- **Configuración**: recargos (diurna, nocturna, festiva), moneda, datos de ejemplo.

## Local
```
npm install
npm run dev
```
Sin `DATABASE_URL` guarda en `.data/db.json` (solo desarrollo).

## Desplegar en Vercel
1. Sube la carpeta a un repositorio de GitHub e impórtalo en Vercel (framework: Next.js, sin ajustes extra).
2. En el proyecto: **Storage → Create → Neon (Postgres)** y conéctalo. Vercel agrega `DATABASE_URL` solo.
3. Redespliega. La tabla se crea automáticamente al primer uso.
4. Entra a **Configuración → Cargar datos de ejemplo** para probar, o **Borrar todos los datos** para empezar limpio.

Sin base de datos conectada, la app muestra un aviso: Vercel no guarda archivos entre ejecuciones.
Al no haber login, cualquiera con la URL puede ver y editar: activa *Deployment Protection* de Vercel (o una contraseña) para restringirlo.
