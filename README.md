# SwingCalc

Calculadora de riesgo para swing trading con cuatro módulos: Posición, Plan, Stop ATR y Esperanza. Los cálculos y los datos introducidos se quedan en el navegador. La PWA puede funcionar sin conexión una vez guardados los recursos en caché.

## Pruebas

Ejecuta `node --test`.

## Cloudflare

La configuración de Wrangler está en `wrangler.jsonc` y sirve los archivos estáticos de `public/`. Desde la raíz del repositorio, ejecuta `npx wrangler dev` para previsualizar o `npx wrangler deploy` para desplegar como Worker.

Para importar el repositorio en Cloudflare Pages, selecciona la rama `main`, ningún framework, `exit 0` como comando de compilación y `public` como directorio de salida.

## Instalar en iPhone

Abre la URL HTTPS de SwingCalc en Safari, pulsa Compartir → Añadir a pantalla de inicio y activa Abrir como app web si aparece esa opción. Abre SwingCalc desde el icono mientras tengas conexión y espera a ver «Disponible sin conexión». A partir de ahí puedes abrirla en modo avión.

Los valores se guardan en el dispositivo. Si cambias de dominio, tendrás que volver a introducirlos.
