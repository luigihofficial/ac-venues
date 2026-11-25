# PROJECT IDENTITY — Amor Consciente — Venues

**Versión:** 1.0 · **Fecha:** 2026-11-25 · **Gobernanza:** [KISS v1.0](KISS_PROTOCOL.md) · [SINR v1.0](SINR_PROTOCOL.md)
Este archivo no contiene secretos, contraseñas ni credenciales. `UNKNOWN` marca datos que el Product Owner debe confirmar antes de cualquier acción que dependa de ellos (Framework §12).

## 1. Identidad
| Campo | Valor |
|---|---|
| Nombre del proyecto | Amor Consciente — Venues |
| Identificador único | **UNKNOWN (pendiente de asignar por el Product Owner)** |
| Product Owner | Luigi Hernandez (Northern South Ventures) |
| Organización de GitHub | `luigihofficial` |
| Repositorio oficial | `luigihofficial/ac-venues`. Rama base: `main` |
| Finalidad | Aplicación para la gestión de venues de Amor Consciente: fichas, layouts de salón, RFP a venues, encuestas, contactos y calendario. |

## 2. Infraestructura autorizada
| Servicio | Recurso | Uso |
|---|---|---|
| Vercel | Proyecto que sirve `ac-venues.vercel.app` (ID: UNKNOWN), con crons diarios `/api/survey-send` y `/api/sheet-send` | Sitio y funciones `api/*` |
| Supabase | Proyecto `dwhwbcplgcqvuvnzqmne` (URL pública en el código) | Base de datos |
| Resend | UNKNOWN | Envío de RFP, encuestas y hojas |
| Gemini | UNKNOWN | Funciones de IA |
| GitHub Actions | Este repositorio (`venue-regression.yml`) | Guardia de regresión y de gobernanza |

Las credenciales viven solo en las variables de entorno del proveedor y en los secretos de GitHub, nunca en el repositorio ni en el chat.

## 3. Entornos autorizados
| Entorno | Regla |
|---|---|
| Producción (Vercel) | Activa, con envíos automáticos por cron. Cualquier cambio requiere autorización del Product Owner |

## 4. Dominios autorizados
- `ac-venues.vercel.app`

## 5. Límites operativos
- Sin merge, despliegues, cambios en producción, migraciones, SQL de escritura ni gastos sin autorización explícita del Product Owner, vinculada a este proyecto, entorno y recurso.
- Los archivos `supabase_*.sql` son migraciones: no ejecutarlas en el proyecto real sin autorización.
- Los crons envían correos reales: no disparar `/api/*-send` manualmente.
- Titularidad del proyecto (NSV o tercero): UNKNOWN, pendiente de confirmar por el Product Owner.
- Este repositorio no comparte código, datos, credenciales, backlogs ni autorizaciones con otros proyectos de NSV (SINR §11).
