# SwingCalc

Calculadora de riesgo para swing trading con cuatro módulos: Posición, Plan, Stop ATR y Esperanza. Los cálculos y los datos introducidos se quedan en el navegador. La PWA puede funcionar sin conexión una vez guardados los recursos en caché.

## Pruebas

Ejecuta `node --test finance.test.cjs`.

## Cloudflare Pages

Importa este repositorio como proyecto de Pages con la rama `main`, sin framework, directorio raíz por defecto, comando de compilación `exit 0` y directorio de salida `dist`. No se necesitan dependencias ni variables de entorno.
