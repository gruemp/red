# red — Mis direcciones IP

Panel web estático y adaptable a móviles para consultar IP pública IPv4, compatibilidad IPv6, proveedor de internet, ASN, ubicación aproximada y datos básicos del navegador. Incluye copia de IP y un historial opcional guardado solo en el navegador.

> **Importante:** Esta implementación se preparó como alternativa funcional, ya que la URL proporcionada como referencia devolvió un error de acceso `401 Unauthorized`. No se pudo verificar ni reproducir exactamente su diseño o código original.

## Cómo ejecutar

Abre `index.html` en el navegador. Se recomienda un servidor local para que las funciones del portapapeles funcionen mejor:

```bash
python -m http.server 8000
```

Después abre `http://localhost:8000`.

## Publicar con GitHub Pages

1. Crea un repositorio llamado `red` en GitHub.
2. Sube todos los archivos de este directorio a la rama `main`, en la raíz.
3. En **Settings > Pages**, selecciona **Deploy from a branch**, rama `main` y carpeta `/(root)`.
4. Abre la dirección mostrada por GitHub Pages tras la publicación.

No necesita Node.js, framework, variables de entorno ni proceso de compilación.

## Servicios externos y privacidad

- `https://api.ipify.org?format=json`: obtiene la IP pública IPv4.
- `https://api6.ipify.org?format=json`: detecta IPv6 solo cuando la conexión la admite.
- `https://ipwho.is/`: consulta datos aproximados de red, proveedor y ubicación.

Las consultas se hacen desde el navegador a estos proveedores, por lo que estos reciben la IP pública y metadatos técnicos propios de la solicitud. Esta web no incluye backend ni analítica y no envía el historial guardado a un servidor del proyecto. El historial se limita a 12 registros y se guarda mediante `localStorage`, si el usuario lo permite.

La ubicación geográfica de una IP no permite determinar el domicilio exacto de una persona. Los navegadores generalmente no exponen la IP local por motivos de privacidad. La consulta de IPv6 puede fallar aunque IPv4 funcione.

## Archivos

- `index.html`: estructura semántica y contenido.
- `styles.css`: diseño, paleta y responsive.
- `app.js`: consultas de IP, UI e historial local.
- `favicon.svg`: ícono propio.
- `.nojekyll`: evita el procesamiento Jekyll de GitHub Pages.
