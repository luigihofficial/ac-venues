# KISS PROTOCOL — v1.0

**Estado:** APROBADO — CUMPLIMIENTO OBLIGATORIO · **Autoridad:** Luigi Hernandez — Product Owner · **Aprobado:** 2026-11-25 · **Vigencia:** inmediata
**Fuente:** *Northern South Ventures — Mandatory Project Governance Framework, KISS & SINR v1.0* (texto del Product Owner, reproducido sin cambios en las secciones citadas).
**Alcance en este repositorio:** ver [`PROJECT_IDENTITY.md`](PROJECT_IDENTITY.md). Complementa a [`SINR_PROTOCOL.md`](SINR_PROTOCOL.md); ninguno sustituye al otro.

Cualquier cambio a este archivo requiere nueva versión y aprobación del Product Owner (§18).

---

## 2. LOS DOS PILARES DE GOBERNANZA

### KISS — Keep It Simple, Stupid

Principio rector de simplicidad, eficiencia, mantenibilidad y reducción de complejidad innecesaria.

Pregunta fundamental:

**¿Estamos resolviendo el problema de la manera más simple, segura, efectiva y sostenible posible?**

### SINR — Stop, Identify, Notify, Redirect

Protocolo rector de aislamiento de proyectos, validación de contexto, seguridad operativa y control de autorizaciones.

Pregunta fundamental:

**¿Estamos ejecutando la acción correcta, dentro del proyecto correcto, sobre el recurso correcto y con la autorización correspondiente?**

Ambos protocolos son complementarios y de cumplimiento simultáneo.

Ninguno sustituye al otro.

## 3. PROTOCOLO KISS v1.0

### 3.1. Principio fundamental

Toda decisión técnica, comercial, operativa o administrativa deberá favorecer la solución más sencilla que satisfaga adecuadamente los requisitos funcionales, de seguridad, calidad, cumplimiento y escalabilidad.

La simplicidad no significa improvisación, baja calidad ni eliminación de controles necesarios.

Significa eliminar aquello que no aporta valor suficiente.

### 3.2. Reglas obligatorias

Antes de diseñar o implementar una solución:

1. Comprender el problema real.
2. Identificar los requisitos indispensables.
3. Revisar las soluciones y componentes existentes.
4. Evitar duplicaciones.
5. Evaluar alternativas sencillas antes de introducir nuevas tecnologías.
6. Seleccionar la solución proporcional al problema.
7. Documentar las decisiones relevantes.
8. Mantener la capacidad de evolución futura.

### 3.3. Aplicación técnica

KISS deberá regir:

- Arquitectura de software.
- Selección de tecnologías.
- Diseño de bases de datos.
- APIs.
- Frontend.
- Backend.
- Infraestructura.
- Integraciones.
- Seguridad.
- Automatizaciones.
- Pruebas.
- CI/CD.
- Documentación.
- Mantenimiento.
- Resolución de errores.
- Procesos de despliegue.
- Gestión de dependencias.

### 3.4. Prácticas que deben evitarse

- Sobreingeniería.
- Duplicación de código.
- Duplicación de información.
- Dependencias innecesarias.
- Microservicios sin justificación.
- Infraestructura desproporcionada.
- Funcionalidades sin una necesidad identificada.
- Automatizaciones que compliquen procesos sencillos.
- Abstracciones prematuras.
- Procesos administrativos excesivos.
- Documentación redundante.
- Herramientas pagas cuando una alternativa existente satisface adecuadamente el requisito.
- Reescrituras innecesarias de componentes funcionales.

### 3.5. Simplicidad en la experiencia del usuario

La complejidad técnica no debe trasladarse innecesariamente al usuario final.

Priorizar:

- Interfaces intuitivas.
- Navegación clara.
- Flujos de trabajo cortos.
- Información comprensible.
- Reutilización de datos previamente ingresados.
- Reducción de pasos manuales.
- Automatización útil.
- Accesibilidad.
- Consistencia visual.
- Mensajes de error accionables.

### 3.6. Simplicidad y seguridad

KISS nunca podrá utilizarse como justificación para eliminar o debilitar:

- Autenticación.
- Autorización.
- Validación de datos.
- Aislamiento de tenants.
- Protección de información sensible.
- Controles regulatorios.
- Auditoría.
- Trazabilidad.
- Pruebas necesarias.
- Respaldos.
- Procedimientos de rollback.
- Controles de producción.

La seguridad y el cumplimiento constituyen requisitos funcionales, no complejidad innecesaria.

### 3.7. Justificación de complejidad

Cuando una solución requiera mayor complejidad, documentar:

- Por qué es necesaria.
- Qué problema resuelve.
- Qué alternativas fueron consideradas.
- Qué riesgos introduce.
- Qué impacto tiene en costos y mantenimiento.

Aplicar complejidad únicamente cuando exista una justificación proporcional y verificable.

## 14. CRITERIOS DE ACEPTACIÓN DE CADA TAREA — KISS

Antes de considerar una tarea completada, verificar:

### KISS

- ¿Resuelve el problema solicitado?
- ¿Evita complejidad innecesaria?
- ¿Reutiliza adecuadamente los componentes existentes?
- ¿Es mantenible?
- ¿Tiene las pruebas y documentación proporcionales al cambio?
- ¿Evita costos injustificados?
- ¿Preserva la seguridad y el cumplimiento?

## 15. AUTONOMÍA OPERATIVA

Los protocolos no deben convertirse en obstáculos para el desarrollo.

Dentro de un proyecto correctamente identificado y de un alcance previamente autorizado, los participantes podrán avanzar con autonomía.

No solicitar aprobaciones repetitivas para decisiones rutinarias que ya estén comprendidas en el alcance autorizado.

Sin embargo, la autonomía no autoriza:

- Cambiar de proyecto.
- Ampliar unilateralmente el alcance.
- Modificar producción sin autorización.
- Incurrir en costos no aprobados.
- Eliminar controles de seguridad.
- Introducir cambios irreversibles sin evaluación.
- Transferir información entre proyectos.

KISS debe reducir la fricción operativa.

SINR debe impedir que esa autonomía genere riesgos de contextualización.

## 17. PRIORIDAD Y JERARQUÍA

Todas las acciones deberán respetar simultáneamente:

1. Legislación y requisitos regulatorios aplicables.
2. Seguridad, privacidad e integridad de la información.
3. Autorizaciones y alcance establecido por el Product Owner.
4. Protocolo SINR.
5. Protocolo KISS.
6. Arquitectura y estándares aprobados del proyecto.
7. Objetivos funcionales y prioridades de desarrollo.

KISS nunca podrá justificar el incumplimiento de SINR.

SINR nunca deberá utilizarse para introducir burocracia innecesaria en acciones correctamente contextualizadas.

La velocidad de ejecución no tendrá prioridad sobre la seguridad, la correcta identificación del proyecto o las autorizaciones.

## 20. PRINCIPIO FINAL

Cada proyecto de Northern South Ventures deberá ser:

- Tan simple como sea razonablemente posible.
- Tan seguro como sea necesario.
- Tan independiente como corresponda.
- Tan mantenible como sea sostenible.
- Tan escalable como lo requiera su evolución.
- Tan transparente como exija su gobernanza.

Antes de actuar:

**SINR — confirmar que estamos trabajando en el lugar correcto.**

Al diseñar y ejecutar:

**KISS — utilizar la solución correcta con la menor complejidad necesaria.**

Después de ejecutar:

**Verificar, documentar y preservar la trazabilidad.**

Estas reglas aplican siempre, independientemente de quién ejecute el trabajo.

**KISS v1.0 — APPROVED.**

**SINR v1.0 — APPROVED.**

**MANDATORY FOR ALL PROJECTS — PAST, PRESENT AND FUTURE.**

**END OF GOVERNANCE FRAMEWORK.**
