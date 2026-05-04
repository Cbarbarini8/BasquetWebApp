# Mejoras del sistema — Mayo 2026

Esta entrega aplica el Reglamento Oficial del Torneo Apertura 2026 a varias áreas que antes el sistema no controlaba o que aplicaba de forma incompleta.

## Lo nuevo / lo que cambia

### 1. Categorías por edad de jugadores
- Cada jugador tiene ahora **fecha de nacimiento** y el sistema calcula automáticamente la categoría (20-25, 26-30, +30).
- Al cargar/editar un jugador, el sistema **avisa si se superan los cupos** por categoría (máximo 3 jugadores de 20-25 y 6 de 26-30 por equipo).
- En cancha durante un partido, **bloquea automáticamente** el ingreso de un tercer jugador 20-25 cuando ya hay 2 simultáneos por equipo.
- **Carga masiva por Excel**: el admin puede descargar un template, completar las fechas faltantes en Excel y subirlo. El sistema procesa todo de una sola vez.

### 2. Plantel del partido y jugadores libres
- Al iniciar un partido, ahora se controla el **máximo de 12 convocados** por equipo.
- Cupo de **3 jugadores libres por partido**, con validaciones automáticas:
  - No puede ser libre un jugador de la categoría 20-25 (lo bloquea)
  - Un libre que ya jugó para un equipo no puede jugar como libre para otro
  - En semifinal y final, no se admiten libres "nuevos" — solo los que ya hayan jugado para ese mismo equipo
- En la planilla en vivo, los jugadores libres muestran un distintivo **"L"** sobre la camiseta para que la mesa los identifique.

### 3. Suspensión automática por 2 faltas técnicas
- Antes: 2 técnicas en un partido solo expulsaba del juego, sin suspender la fecha siguiente.
- Ahora: 2 técnicas **expulsan del partido y suspenden 1 fecha** automáticamente, como indica el reglamento. El sistema bloquea al jugador en el próximo partido del equipo.
- Los otros dos casos del reglamento (técnica + antideportiva, doble antideportiva) siguen expulsando sin suspensión, tal como corresponde.

### 4. Tiempos muertos con cupos por fase
- El botón de TM ahora muestra un contador **"X/Y usados"** por equipo y por cuarto, y se desactiva al llegar al cupo.
- Los cupos respetan el reglamento:

  | | Q1 | Q2 | Q3 | Q4 | OT |
  |---|---|---|---|---|---|
  | **Fase regular / play-in / play-off** | 1 | 1 | 1 | 1 | 1 |
  | **Semifinal** | 1 | 1 | 1 | **2** | 1 |
  | **Final** | 1 | 1 | **3 entre Q3+Q4 (máx 2 en Q4)** | | 1 |

- **Falta técnica al banco**: el sistema descuenta automáticamente 1 TM del cuarto actual o, si ya está usado, del siguiente. La 2da técnica al banco sigue expulsando al capitán con 1 fecha de suspensión, como ya hacía antes.

### 5. Fase del partido (regular / play-in / play-off / semifinal / final)
- Nuevo campo configurable al editar cada partido. Define los cupos de TM y la lógica de jugadores libres mencionada arriba.
- Por defecto los partidos son "regular"; el admin solo necesita cambiarlo cuando arranquen las instancias de play-off, semifinales y final.

### 6. Walkover (incomparecencia)
- Botón nuevo **"WO"** en cada partido programado.
- Se elige qué equipo no se presentó y el sistema setea automáticamente el resultado **20-0** a favor del presente.
- En la tabla de posiciones, el equipo ausente **no suma 1 punto** (como sí pasa al perder un partido jugado): suma **0 puntos**, como pide el reglamento.
- En el fixture y en la página del partido se ve claramente la etiqueta "WO" para distinguirlos de los partidos jugados.

### 7. Desempates en la tabla según reglamento FIBA
La tabla de posiciones ahora aplica los criterios exactos del reglamento:
- **Empate entre 2 equipos**: se desempata por el resultado directo entre ellos (sin mirar diferencia de goles).
- **Empate entre 3 o más equipos**: mini-tabla considerando solo los partidos entre los empatados, en este orden:
  1. Más victorias en la mini-tabla
  2. Mejor diferencia de puntos en la mini-tabla
  3. Más puntos a favor en la mini-tabla
- Si un subgrupo se reduce a 2 dentro del proceso, vuelve al resultado directo.
- Si tras los 3 criterios persiste el empate, queda en orden estable (representa el "sorteo" que el organizador resuelve manualmente y reordena en el sistema si hace falta).

## Acciones recomendadas para la organización

1. **Cargar las fechas de nacimiento** de todos los jugadores antes del inicio del torneo. Mientras no estén cargadas, el sistema asume que son +30 y no aplica los cupos por categoría — sin riesgo, pero sin la validación.
2. **Al iniciar cada partido**, además de capitanes, marcar los **libres** del partido (los nuevos botones "L" en la pantalla de inicio).
3. **Al programar partidos de play-in / play-off / semifinal / final**, cambiar la fase desde el editor del partido. Por defecto vienen como "regular".

## Pendientes para futuras iteraciones

Hay tres puntos del reglamento que quedaron señalados pero no se implementaron en esta entrega:

1. **Reloj de 24 segundos** — el reglamento lo menciona; no afecta el flujo de la mesa de control y puede agregarse después.
2. **Incorporar jugadores al plantel durante el partido** — el reglamento permite agregar convocados hasta el inicio del 3° cuarto. Hoy el plantel se cierra al iniciar y solo puede modificarse reseteando el partido.
3. **Carry-over de TM al próximo partido** — si una falta técnica al banco en Q4 ocurre sin TM disponible para descontar, el reglamento indica que se pierde el TM del próximo partido. Hoy el sistema avisa con un mensaje claro para que la mesa lo registre, pero no lo aplica automáticamente al partido siguiente.

Ninguno de estos pendientes afecta la operación normal del torneo.
