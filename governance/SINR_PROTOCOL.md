# SINR PROTOCOL — v1.0

**Estado:** APROBADO — CUMPLIMIENTO OBLIGATORIO · **Autoridad:** Luigi Hernandez — Product Owner · **Aprobado:** 2026-11-25 · **Vigencia:** inmediata
**Fuente:** *Northern South Ventures — Mandatory Project Governance Framework, KISS & SINR v1.0* (texto del Product Owner, reproducido sin cambios en las secciones citadas).
**Alcance en este repositorio:** ver [`PROJECT_IDENTITY.md`](PROJECT_IDENTITY.md). Complementa a [`KISS_PROTOCOL.md`](KISS_PROTOCOL.md); ninguno sustituye al otro.

Cualquier cambio a este archivo requiere nueva versión y aprobación del Product Owner (§18).

---

## 4. PROTOCOLO SINR v1.0

Cada proyecto deberá operar como un entorno independiente, con su propio contexto, repositorio, documentación, infraestructura, datos y autorizaciones.

Ante cualquier inconsistencia entre el proyecto activo y la información recibida, activar inmediatamente SINR.

### S — STOP

Detener inmediatamente:

- Análisis.
- Investigación.
- Planificación.
- Programación.
- Ejecución de comandos.
- Acceso a repositorios incorrectos.
- Modificación de archivos.
- Operaciones sobre bases de datos.
- Acciones sobre infraestructura.
- Procesamiento de autorizaciones.
- Despliegues.
- Cualquier otra acción relacionada con la solicitud incorrectamente contextualizada.

No intentar resolver la solicitud dentro del proyecto equivocado.

### I — IDENTIFY

Identificar:

- Proyecto activo.
- Proyecto al que corresponde la solicitud.
- Naturaleza de la inconsistencia.
- Recursos potencialmente afectados.
- Autorizaciones involucradas.

Realizar esta identificación utilizando la información disponible, sin acceder innecesariamente a recursos de otros proyectos.

### N — NOTIFY

Notificar inmediatamente al Product Owner.

Formato estándar:

**⚠️ PROTOCOLO SINR ACTIVADO — PROYECTO INCORRECTO**

Proyecto activo: [nombre].  
Proyecto identificado: [nombre].  
Motivo: [inconsistencia detectada].  
Estado: ejecución detenida.  
Modificaciones realizadas: [ninguna o descripción verificable].

Si ya se ejecutaron acciones antes de identificar la inconsistencia, reportarlas con transparencia.

### R — REDIRECT

Solicitar continuar dentro del proyecto correcto.

No continuar el análisis ni ejecutar la solicitud hasta encontrarse en el contexto correspondiente.

No cambiar automáticamente de proyecto.

No transferir información o autorizaciones entre proyectos.

## 5. VALIDACIÓN OBLIGATORIA ANTES DE CADA ACCIÓN

Antes de ejecutar una tarea, validar, cuando corresponda:

- Project Name.
- Project ID.
- GitHub Organization.
- Repository.
- Branch.
- Commit SHA.
- Pull Request.
- Issue.
- Environment.
- Deployment ID.
- Base de datos.
- Proyecto de Vercel.
- Proyecto de Supabase.
- Dominios.
- Servicios externos.
- Scope of Work.
- Authorization Status.

Los números de Issues, Pull Requests, versiones o milestones pueden coincidir entre proyectos.

Nunca deben utilizarse como identificadores únicos sin verificar el repositorio.

El nivel de validación deberá ser proporcional al riesgo de la acción, respetando KISS.

No convertir tareas sencillas en procedimientos burocráticos, pero nunca omitir una validación necesaria.

## 10. AISLAMIENTO DE AUTORIZACIONES

Ninguna autorización podrá transferirse entre proyectos.

Esto incluye:

- Desarrollo.
- Cambios de código.
- Creación y merge de Pull Requests.
- Despliegues.
- Promote a producción.
- Rollbacks.
- Migraciones.
- Consultas SQL.
- Modificación de registros.
- Eliminación de información.
- Cambios de seguridad.
- Rotación de credenciales.
- Contratación de servicios.
- Cambios de infraestructura.
- Decisiones de diseño.
- Aprobaciones comerciales.

Toda autorización debe estar vinculada al proyecto, entorno, recurso y alcance correspondiente.

Una autorización genérica como GO, procede o autorizo no deberá ejecutarse cuando exista una inconsistencia material.

Ante dicha inconsistencia, activar SINR.

## 11. AISLAMIENTO DE DATOS Y RECURSOS

No mezclar entre proyectos:

- Código fuente.
- Información de clientes.
- Datos financieros.
- Información médica.
- Información personal.
- Credenciales.
- API keys.
- Bases de datos.
- Variables de entorno.
- Documentación.
- Reglas comerciales.
- Arquitecturas.
- Configuraciones de seguridad.
- Backlogs.
- Handoffs.
- Reportes de auditoría.
- Historiales de desarrollo.
- Autorizaciones.

Se permite compartir metodologías, estándares generales, protocolos de gobernanza y buenas prácticas.

La reutilización de componentes, código o recursos específicos de otro proyecto requiere autorización expresa y una revisión proporcional de sus implicaciones.

## 12. COORDINACIÓN CHATGPT–CLAUDE–GITHUB

Cuando ambos asistentes participen, GitHub continuará siendo la fuente oficial compartida.

Todos los handoffs deberán comenzar con:

- Project Name.
- Project ID.
- Repository.
- Environment.
- Branch.
- Commit SHA.
- Related Pull Requests.
- Related Issues.
- Scope of Work.
- Authorization Status.
- Author.
- Date.

Utilizar N/A cuando un campo no sea aplicable.

Utilizar UNKNOWN cuando un dato no esté disponible.

Resolver cualquier información desconocida antes de ejecutar acciones que dependan de ella.

El asistente receptor deberá validar el proyecto antes de procesar el handoff.

Si existe una inconsistencia, activar SINR.

Si la tarea es sencilla y no requiere un handoff formal, no generar documentación innecesaria.

Aplicar KISS.

## 13. CONTROLES TÉCNICOS DE CUMPLIMIENTO

Cuando resulte técnicamente viable y proporcional al riesgo, incorporar mecanismos que refuercen los protocolos:

- Validación del repositorio activo.
- Identificación del entorno.
- Protección de ramas.
- Revisiones de Pull Requests.
- Validación de configuraciones.
- Separación de credenciales.
- Protección de producción.
- Controles de CI/CD.
- Prevención de exposición de secretos.
- Validación de identidad del proyecto.
- Registro de cambios.

Para repositorios con CI, evaluar una verificación ligera que compruebe la existencia de los documentos obligatorios de gobernanza.

No introducir dependencias, servicios pagos o infraestructura adicional únicamente para demostrar cumplimiento de KISS y SINR si existen mecanismos más sencillos.

Los controles automatizados complementan, pero no sustituyen, el juicio y la responsabilidad de los participantes.

## 14. CRITERIOS DE ACEPTACIÓN DE CADA TAREA — SINR

### SINR

- ¿Se ejecutó dentro del proyecto correcto?
- ¿Se utilizó el repositorio correcto?
- ¿Se respetó el entorno autorizado?
- ¿Se mantuvo el aislamiento de datos?
- ¿Se respetaron las autorizaciones?
- ¿Se evitó afectar otros proyectos?
- ¿Los cambios son identificables y trazables?

La validación deberá integrarse en el proceso normal de trabajo.

No será necesario producir un reporte extenso de cumplimiento para cada modificación menor.

## 16. INCIDENTES Y TRAZABILIDAD

Si se detecta una acción ejecutada en el proyecto incorrecto:

1. Detener inmediatamente las operaciones.
2. Identificar los recursos afectados.
3. Registrar las acciones realizadas.
4. Notificar al Product Owner.
5. Evaluar las consecuencias.
6. Preparar una propuesta de remediación.
7. Solicitar autorización antes de revertir o modificar los recursos afectados.

No ocultar errores.

No eliminar evidencia.

No realizar correcciones silenciosas.

Si se detecta complejidad innecesaria introducida anteriormente, documentar el hallazgo y evaluar una simplificación proporcional.

KISS no autoriza reescrituras masivas ni modificaciones innecesarias de sistemas funcionales.

## 18. VERSIONAMIENTO Y PERMANENCIA

Versiones iniciales:

- KISS v1.0.
- SINR v1.0.

Toda modificación futura deberá:

- Ser documentada.
- Contar con una nueva versión cuando corresponda.
- Identificar los cambios introducidos.
- Ser aprobada por el Product Owner.
- Incorporarse a los repositorios correspondientes respetando SINR.

Los protocolos permanecerán vigentes aunque:

- Se cierre una conversación.
- Se cambie de asistente.
- Se utilice otro modelo de inteligencia artificial.
- Se incorpore un desarrollador.
- Se cambie la infraestructura.
- Se migre un repositorio.
- Se suspenda temporalmente un proyecto.
- Se comercialice una aplicación.
- Se delegue el mantenimiento.

La gobernanza deberá acompañar al proyecto durante todo su ciclo de vida.
