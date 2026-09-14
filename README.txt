# JCE Defensa de Nota

Aplicación web local para realizar una defensa de nota con preguntas cruzadas entre grupos.

## Características

- 12 grupos iniciales.
- 5 preguntas por grupo.
- 60 turnos totales.
- Cada pregunta se utiliza una sola vez.
- Cada grupo pregunta 5 veces.
- Cada grupo responde 5 veces.
- Nunca se asigna un grupo contra sí mismo.
- La agenda se genera aleatoriamente respetando las reglas.
- La ruleta muestra visualmente el grupo receptor.
- El sistema muestra la pareja: Grupo A → Grupo B.
- El docente revela la pregunta después de girar.
- Correcta: conserva la nota.
- Incorrecta: descuenta 0.5.
- Nota inicial: 5.0.
- Después de 5 incorrectas: 2.5.
- Permite corregir resultados.
- Permite deshacer el último turno.
- Guarda automáticamente en localStorage.
- Permite exportar/importar la actividad como JSON.
- No necesita internet, servidor, API ni instalación.

## Cómo ejecutar

1. Descarga/descomprime la carpeta.
2. Abre `index.html` con Chrome, Edge o Firefox.
3. Entra en **Grupos y preguntas**.
4. Completa las preguntas de los grupos que todavía estén vacíos.
5. Ve a **Juego**.
6. Pulsa **GIRAR**.
7. El sistema mostrará quién pregunta y quién responde.
8. Pulsa **Revelar pregunta**.
9. Marca **Correcta** o **Incorrecta**.

## Importante

La primera versión trae los datos de los grupos suministrados. Los grupos 10, 11 y 12 vienen sin preguntas porque esos datos no fueron proporcionados todavía. Deben completarse antes de iniciar la ronda.

Los datos se guardan solamente en el navegador utilizado. Usa **Exportar actividad JSON** para tener una copia.

## Estructura

- `index.html` — interfaz.
- `style.css` — diseño visual.
- `data.js` — datos iniciales.
- `script.js` — lógica completa.
