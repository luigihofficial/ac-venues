# AGENTS.md — Amor Consciente — Venues (`ac-venues`)

Aplica a **cualquier** asistente de IA (Claude, ChatGPT u otro), agente autónomo, automatización, proceso de CI/CD, desarrollador, contratista o proveedor que opere sobre este repositorio. No hay excepciones por trabajar individualmente.

## Políticas obligatorias
1. **[KISS v1.0](governance/KISS_PROTOCOL.md):** la solución correcta con la menor complejidad necesaria. KISS nunca justifica debilitar la seguridad, la validación, la auditoría, las pruebas, los respaldos ni el rollback.
2. **[SINR v1.0](governance/SINR_PROTOCOL.md):** Stop, Identify, Notify, Redirect. Ante cualquier inconsistencia entre este proyecto y la solicitud, detenerse y notificar al Product Owner con el formato estándar.
3. **[PROJECT_IDENTITY.md](governance/PROJECT_IDENTITY.md):** proyecto, repositorio, entornos, dominios y límites autorizados.

Los protocolos pertenecen al proyecto, no a los asistentes, y siguen vigentes aunque cambie la conversación, el modelo o el equipo.

## Antes de cada acción (proporcional al riesgo)
- Confirmar que el proyecto es **Amor Consciente — Venues** y el repositorio es `luigihofficial/ac-venues`. Un número de PR o de issue no identifica el proyecto por sí solo.
- Confirmar la rama, el commit, el entorno y el recurso exacto (`PROJECT_IDENTITY.md` §2).
- Confirmar que la acción cabe en el alcance autorizado. Un "GO", "procede" o "autorizo" genérico no se ejecuta si hay una inconsistencia material.

## Requiere autorización explícita del Product Owner
- Merge de un PR.
- Despliegue, promote o rollback en producción.
- Migraciones o SQL de escritura en entornos reales, y cualquier cambio en datos reales.
- Gastos o contratación de servicios.
- Rotación de credenciales y cambios de seguridad o de infraestructura.

Dentro de un alcance ya autorizado se trabaja con autonomía, sin pedir aprobaciones repetitivas para decisiones rutinarias.

## Handoffs (Claude ↔ ChatGPT ↔ GitHub)
GitHub es la fuente oficial compartida. Un handoff formal empieza con: Project Name, Project ID, Repository, Environment, Branch, Commit SHA, Related PRs, Related Issues, Scope of Work, Authorization Status, Author y Date (usar `N/A` o `UNKNOWN`). Si la tarea es simple, no se genera handoff (KISS).

## Seguridad
- Nunca escribir secretos en el repositorio, los commits, los PR o el chat.
- Reportar con transparencia cualquier acción hecha fuera de alcance o en el proyecto equivocado (SINR §16): no ocultar errores ni hacer correcciones silenciosas.
