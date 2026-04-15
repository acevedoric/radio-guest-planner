---
name: Hour 2 and Hour 3 info modules
description: Collapsible info modules for slots 2 and 3 with documents, links, and AI generation
type: feature
---
- Slot 2 modules: INFORMACIÓN PERSONAL, PREGUNTAS SUGERIDAS
- Slot 3 modules: DATOS PERSONALES, COMUNICADO DE PRENSA
- Each slot has: documento (url/nombre), link_info, n8n_updated_at
- DB columns: h2_info_personal, h2_preguntas_sugeridas, h2_documento_url, h2_documento_nombre, h2_link_info, h2_n8n_updated_at, h3_datos_personales, h3_comunicado_prensa, h3_documento_url, h3_documento_nombre, h3_link_info, h3_n8n_updated_at
- GuestInfoModules accepts `slot` prop (1, 2, or 3) to render appropriate modules
- trigger-n8n-scraping accepts `slot` parameter to map AI output to correct fields
