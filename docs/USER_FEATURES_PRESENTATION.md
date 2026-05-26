# Presentacion Funcionalidades Usuario — Escalerilla de Tenis

> Documento para presentar las funcionalidades visibles para socios, jugadores e invitados. No incluye pantallas ni flujos administrativos.

## 1. Propuesta de valor

La app permite que los socios sigan la escalerilla de tenis del Club La Dehesa desde el celular:

- Ver ranking masculino y femenino en tiempo real.
- Revisar la programacion semanal de partidos.
- Declarar disponibilidad habitual para jugar.
- Consultar el perfil propio, proximos partidos, historial y estadisticas.
- Ingresar resultados de partidos pendientes.
- Ver perfiles de otros jugadores y datos deportivos relevantes.
- Acceder al reglamento oficial.

El objetivo es que el jugador no dependa de mensajes dispersos por WhatsApp para saber su posicion, sus partidos o sus obligaciones dentro de la escalerilla.

## 2. Tipos de usuario de cara al producto

### Invitado

Puede entrar sin iniciar sesion y revisar informacion publica:

- Home de la escalerilla.
- Ranking por categoria.
- Fixture publicado.
- Resultados recientes.
- Reglamento oficial.

### Jugador registrado

Despues de iniciar sesion y completar su perfil, puede usar las funciones personales:

- Declarar disponibilidad.
- Ver "Mi perfil".
- Ver sus proximos partidos.
- Revisar contadores semanales/mensuales.
- Consultar zona desafiable.
- Ingresar resultados.
- Acceder a datos de contacto permitidos de sus rivales.

## 3. Home publica

Ruta: `/`

Funcionalidades visibles:

- Hero de la Escalerilla de Tenis Club La Dehesa.
- Accesos directos al ranking de hombres y mujeres.
- Vista previa del Top 10 por categoria.
- Carrusel de ultimos partidos/resultados.
- Seccion explicativa de como funciona la escalerilla.

Valor para el usuario:

- Entiende rapidamente que es la plataforma.
- Puede revisar el estado competitivo sin iniciar sesion.
- Tiene entrada directa a rankings y fixture.

## 4. Ranking publico

Rutas:

- `/ranking`
- `/ranking/hombres`
- `/ranking/mujeres`

Funcionalidades visibles:

- Ranking separado por categoria hombres/mujeres.
- Posicion actual de cada jugador.
- Puntaje vigente.
- Partidos jugados, ganados y perdidos.
- Mejor ranking historico cuando existe.
- Variacion de puntos de la semana.
- Estado del jugador cuando aplica.
- Top 3 destacado visualmente.
- Cambio rapido entre categorias.
- Vista optimizada para celular.
- Perfil de jugador al seleccionar una fila.

Valor para el usuario:

- Ve su posicion actual sin esperar actualizaciones manuales.
- Puede comparar desempeno con otros jugadores.
- Tiene transparencia sobre puntos y actividad reciente.

## 5. Perfil publico de jugador

Disponible desde el ranking.

Funcionalidades visibles:

- Nombre del jugador.
- Categoria.
- Posicion y puntos.
- Nivel declarado.
- Mano dominante.
- Tipo de reves.
- Edad si la visibilidad lo permite.
- Telefono/WhatsApp si la visibilidad lo permite.
- Estadisticas de rendimiento.
- Ultimos partidos.

Reglas de privacidad:

- El telefono puede estar visible segun permisos configurados.
- El RUT no se muestra publicamente.
- La fecha de nacimiento se protege segun visibilidad.

Valor para el usuario:

- Permite conocer rivales antes de coordinar.
- Facilita contacto deportivo cuando esta permitido.
- Da contexto competitivo sin exponer datos sensibles innecesarios.

## 6. Fixture semanal

Ruta: `/fixture`

Funcionalidades visibles:

- Lista de partidos publicados.
- Navegacion entre semanas publicadas.
- Categoria del partido.
- Tipo de partido: sorteo, desafio o campeonato.
- Estado del partido: pendiente, reportado, confirmado, W.O. o empate.
- Jugadores enfrentados.
- Ranking/posicion aproximada de los jugadores.
- Marcador por sets cuando el resultado ya fue registrado.
- Puntos ganados o perdidos por cada jugador cuando corresponde.
- Acceso a vista imprimible del fixture.
- En jugador logueado, sus partidos pueden destacarse dentro de la programacion.

Valor para el usuario:

- Sabe contra quien juega y en que semana.
- Puede revisar resultados pasados.
- Puede compartir o imprimir la programacion si lo necesita.

## 7. Registro e inicio de sesion

Rutas:

- `/login`
- `/register`

Funcionalidades visibles:

- Ingreso con Google cuando esta configurado.
- Ingreso con email y contrasena.
- Creacion de cuenta con email.
- Redireccion a onboarding cuando el perfil esta incompleto.

Valor para el usuario:

- Permite asociar la cuenta personal con el jugador de la escalerilla.
- Habilita funciones privadas como disponibilidad, perfil y resultados.

## 8. Onboarding del jugador

Ruta: `/onboarding`

Funcionalidades visibles:

- Flujo guiado en pasos.
- Datos personales basicos:
  - Nombre.
  - Apellido.
  - Genero/categoria.
  - Fecha de nacimiento.
  - Telefono.
  - RUT.
- Perfil tenistico:
  - Nivel: principiante, intermedio bajo, intermedio alto o avanzado.
  - Mano dominante.
  - Reves a una o dos manos.
- Disponibilidad general:
  - Dias disponibles.
  - Bloques horarios por dia.
- Validaciones de RUT y telefono chileno.
- Estado pendiente si el jugador requiere aprobacion.

Valor para el usuario:

- Deja su perfil listo para participar.
- Entrega informacion suficiente para coordinar partidos.
- Reduce errores de contacto y duplicados.

## 9. Mi disponibilidad

Ruta: `/disponibilidad`

Funcionalidades visibles:

- Edicion de disponibilidad semanal/habitual.
- Seleccion de dias disponibles.
- Seleccion de bloques horarios.
- Guardado de preferencias para futuras coordinaciones.
- Vista adaptada a celular.

Valor para el usuario:

- El jugador comunica cuando puede jugar sin enviar mensajes manuales.
- La disponibilidad queda estructurada y reutilizable.
- Facilita mejores cruces y coordinacion de partidos.

## 10. Mi perfil

Ruta: `/mi-perfil`

Funcionalidades visibles:

- Datos del jugador:
  - Nombre.
  - Categoria.
  - Nivel.
  - Mano dominante.
  - Tipo de reves.
  - Edad cuando aplica.
- Posicion actual en ranking.
- Puntaje actual.
- Contador de partidos de la semana.
- Contador de partidos del mes.
- Contador de desafios aceptados en el mes.
- Proximos partidos pendientes o reportados.
- Datos utiles del rival cuando la privacidad lo permite.
- Disponibilidad compartida con el rival.
- Historial de partidos recientes.
- Resultado de cada partido: ganado, perdido, empate, W.O. ganado o W.O. perdido.
- Marcador por sets.
- Link a detalle de partido.
- Zona desafiable: jugadores cercanos en ranking que puede desafiar.

Valor para el usuario:

- Tiene un panel personal con todo lo que necesita para participar.
- Puede controlar limites semanales/mensuales.
- Sabe con quien podria coordinar desafios.
- Revisa rapidamente su historial y desempeno.

## 11. Detalle de partido

Ruta: `/mi-perfil/partidos/[id]`

Funcionalidades visibles:

- Informacion del partido seleccionado.
- Rival.
- Fecha.
- Tipo de partido.
- Estado.
- Marcador completo.
- Resultado desde la perspectiva del jugador.

Valor para el usuario:

- Permite revisar un partido puntual sin perderse en el historial.
- Ayuda a validar resultados y resolver dudas.

## 12. Ingreso de resultados

Ruta: `/ingresar-resultado`

Funcionalidades visibles:

- Lista de partidos pendientes del jugador.
- Seleccion de partido a reportar.
- Registro de resultado por modalidad:
  - Mejor de 3 sets.
  - Set largo.
  - W.O.
  - Empate.
- Ingreso de marcadores con controles optimizados para celular.
- Validacion de scores de tenis.
- Opcion de volver al ranking.

Comportamiento esperado:

- El jugador reporta el resultado.
- El resultado queda sujeto al flujo de confirmacion definido por la organizacion.
- Los puntos se reflejan cuando el resultado queda confirmado.

Valor para el usuario:

- Reduce dependencia de WhatsApp para informar resultados.
- Evita marcadores invalidos.
- Agiliza la actualizacion del ranking.

## 13. Reglamento

Ruta: `/reglamento`

Funcionalidades visibles:

- Visualizacion embebida del PDF oficial.
- Boton para abrir el PDF en otra pestana.
- Boton para descargar el reglamento.

Valor para el usuario:

- Las reglas estan siempre disponibles desde la app.
- Facilita resolver dudas sobre puntos, desafios, W.O. e inactividad.

## 14. Comunicaciones por email

Cuando el envio de emails esta habilitado, la app contempla comunicaciones orientadas al jugador:

- Bienvenida.
- Recordatorio de disponibilidad.
- Publicacion o informacion de fixture.
- Resultado de partido.
- Alertas relacionadas con inactividad.
- Comunicaciones asociadas a desafios.

Valor para el usuario:

- Recibe informacion importante sin revisar constantemente la app.
- Disminuye la carga de comunicacion manual del club.

## 15. Experiencia mobile

La app esta pensada para uso frecuente desde celular:

- Navegacion responsive.
- Header y menu adaptados a pantallas pequenas.
- Rankings legibles en mobile.
- Formularios de resultado con controles tactiles.
- Disponibilidad editable desde telefono.
- Fixture y perfil consultables rapidamente.

Valor para el usuario:

- Puede usar la escalerilla desde la cancha, el club o su casa.
- No necesita computador para participar.

## 16. Recorrido sugerido para demo

1. Abrir `/` y mostrar la propuesta general.
2. Entrar a `/ranking/hombres` o `/ranking/mujeres`.
3. Seleccionar un jugador y mostrar su perfil publico.
4. Ir a `/fixture` y navegar semanas.
5. Iniciar sesion como jugador.
6. Mostrar `/onboarding` si el perfil esta incompleto.
7. Entrar a `/disponibilidad` y mostrar la grilla de horarios.
8. Abrir `/mi-perfil` y revisar contadores, proximos partidos, historial y zona desafiable.
9. Entrar a `/ingresar-resultado` y mostrar el flujo de reporte.
10. Cerrar con `/reglamento`.

## 17. Mensaje de cierre

La escalerilla pasa de ser una coordinacion dispersa a una experiencia digital clara para el jugador:

- Ranking transparente.
- Fixture accesible.
- Perfil personal completo.
- Resultados reportables.
- Disponibilidad ordenada.
- Reglamento a mano.

La app mantiene lo importante del funcionamiento actual del club, pero lo vuelve mas facil de consultar, coordinar y auditar para todos los socios.
