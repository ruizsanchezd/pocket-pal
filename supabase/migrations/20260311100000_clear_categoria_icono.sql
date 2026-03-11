-- Clear emoji icons from all categories (emoji picker removed from UI)
UPDATE categorias SET icono = NULL WHERE icono IS NOT NULL AND icono != '';
