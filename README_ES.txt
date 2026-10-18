MONEY GAME VIDEO MAKER — PROTOTIPO INICIAL

Incluye:
- Pantalla web en español.
- Cuadro para escribir o pegar una idea.
- Solicitud de dos clips verticales 9:16 de 15 segundos mediante PixVerse API.
- Consulta de progreso, unión de los clips y botón para descargar el MP4 final.

REQUISITOS DEL SERVIDOR
- Node.js 18 o superior (incluye fetch).
- FFmpeg instalado y accesible desde la terminal.
- Clave y créditos de PixVerse API.
- Hosting que permita ejecutar Node.js y FFmpeg; un hosting de páginas estáticas no basta.

CONFIGURACIÓN
1. Copia .env.example como .env.
2. Abre .env y coloca tu clave en PIXVERSE_API_KEY. No publiques ni compartas ese archivo.
3. En la carpeta del proyecto, ejecuta: npm install
4. Ejecuta: npm start
5. Abre http://localhost:3000

NOTAS IMPORTANTES
- PixVerse API se factura mediante sus propios créditos; no des por hecho que los créditos de la web/app de PixVerse también sirven para la API.
- La app genera dos clips de 15 segundos y los concatena. La continuidad visual entre clips no está garantizada.
- Los trabajos se guardan en memoria del servidor; si este se reinicia durante la generación, puede perderse el estado del trabajo.
- Este prototipo no integra ChatGPT por API. Puedes pegar directamente el guion creado en ChatGPT.
- Antes de publicarlo para más usuarios, conviene añadir límites de uso, autenticación y limpieza automática de archivos.

DOCUMENTACIÓN OFICIAL PIXVERSE
https://docs.platform.pixverse.ai/how-does-the-api-work-882967m0
https://docs.platform.pixverse.ai/text-to-video-generation-13016634e0
https://docs.platform.pixverse.ai/get-video-generation-status-882972m0
