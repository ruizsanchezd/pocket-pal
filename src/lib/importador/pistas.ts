/**
 * Pistas por palabra para comercios que el importador no ha visto nunca: "SPORTS GRILL PENA"
 * no está en el historial, pero "GRILL" dice que es un restaurante. Solo se usan cuando no hay
 * nada aprendido del comercio, y siempre salen en amarillo.
 *
 * Sacadas de las palabras que aparecen en el extracto de CaixaBank de 2026 y de las cadenas
 * habituales en España. Apuntan a categorías por **nombre** (padre y, si existe, subcategoría);
 * si el usuario no tiene esa categoría, la pista se ignora. Si solo existe el padre, se usa el
 * padre.
 *
 * Sintaxis de cada palabra (se compara con el concepto ya normalizado por `claveComercio`):
 * - `BAR` — la palabra entera (así "ESTANCO BARCELO" no es un bar).
 * - `RESTAUR*` — cualquier palabra que empiece así (RESTAURANTE, RESTAURACION…).
 * - `UBER EATS` — varias palabras seguidas.
 * El banco corta el concepto a unos 17 caracteres: la última palabra puede venir a medias
 * ("RESTAURACI", "PIZZERI") y cuenta si es el principio de la pista (mínimo 4 letras).
 *
 * El orden importa: gana la primera pista que encaja. Por eso lo más concreto va antes
 * ("UBER EATS" antes que "UBER", "BAR RESTAURANTE" es restaurante antes que bar).
 */

export interface Pista {
  palabras: string[];
  categoria: string;
  subcategoria?: string;
}

export const PISTAS: Pista[] = [
  // Antes que "AMAZON" (Tecnología) y "UBER" (Taxi): lo más concreto primero.
  { categoria: 'Servicios', subcategoria: 'Amazon Prime', palabras: ['AMAZON PRIME', 'PRIME VIDEO'] },

  // ── Comida a domicilio y para llevar ──
  { categoria: 'Ocio', subcategoria: 'Comida para llevar', palabras: [
    'UBER EATS', 'GLOVO', 'JUST EAT', 'JUSTEAT', 'DELIVEROO', 'TELEPIZZA', 'DOMINOS', 'DOMINO',
    'PAPA JOHNS', 'PIZZ*', 'KEBAB*', 'DONER', 'DURUM', 'SHAWARMA', 'TAKE AWAY', 'TAKEAWAY',
  ] },

  // ── Restaurantes ──
  { categoria: 'Ocio', subcategoria: 'Restaurante', palabras: [
    'RESTAUR*', 'REST', 'GRILL', 'ASADOR', 'BRASERIA', 'BRASA*', 'MESON', 'TABERNA', 'TASCA',
    'TAPAS', 'CASA COMIDAS', 'COMEDOR', 'COCINA', 'GASTRO*', 'BISTRO*', 'TRATTORIA', 'OSTERIA',
    'SUSHI', 'RAMEN', 'NOODLE*', 'WOK', 'TAQUERIA', 'MEXICAN*', 'BURGER*', 'HAMBURG*',
    'MCDONALD*', 'DONALDS', 'KFC', 'FOSTERS', 'GOIKO', 'VIPS', 'GINOS', 'TAGLIATELLA',
    'MONTADITOS', 'MARISQ*', 'CHURRASC*', 'POLLERIA', 'CREPERIA', 'ARROCERIA', 'SIDRERIA',
    'CANTINA', 'CHIRINGUITO', 'BOCATERIA', 'BOCADILL*', 'SANDWICH*',
  ] },

  // ── Cañas y copas ──
  { categoria: 'Ocio', subcategoria: 'Tomar algo', palabras: [
    'BAR', 'BARES', 'PUB', 'CERVEC*', 'CERVEZ*', 'CERVE', 'BIRR*', 'AMBIGU', 'BODEGA*', 'VINOTECA', 'VERMU*',
    'TERRAZA', 'CAFE BAR', 'TAPERIA', 'GRUPETA',
  ] },
  { categoria: 'Ocio', subcategoria: 'Salir de fiesta', palabras: [
    'DISCO*', 'COPAS', 'COCKTAIL*', 'COCTEL*', 'KAPITAL', 'SALA', 'NIGHT', 'CLUBBING',
  ] },

  // ── Café ──
  { categoria: 'Capricho', subcategoria: 'Cafe', palabras: [
    'COFFEE', 'CAFE', 'CAFES', 'CAFETERIA', 'STARBUCKS', 'TIM HORTONS', 'COSTA COFFEE',
    'HOLA COFFEE', 'CHURRERIA',
  ] },
  { categoria: 'Capricho', subcategoria: 'Comida', palabras: [
    'PANADERIA', 'PASTELERIA', 'HORNO', 'HELADERIA*', 'CONFITERIA', 'DULCES', 'GOLOSINAS',
  ] },

  // ── Ocio y cultura ──
  { categoria: 'Ocio', subcategoria: 'Cine / Teatro', palabras: [
    'CINE*', 'YELMO', 'KINEPOLIS', 'RENOIR', 'CINESA', 'OCINE', 'TEATRO*', 'TAQUILLA',
  ] },
  { categoria: 'Ocio', subcategoria: 'Concierto', palabras: [
    'TICKETMASTER', 'DICE', 'FEVER', 'WEGOW', 'SEETICKETS', 'ENTRADAS', 'FESTIVAL', 'MAD COOL',
    'NOCHES DEL BOTANI*', 'CONCIERT*', 'GIGLON',
  ] },
  { categoria: 'Ocio', subcategoria: 'Expo / Museo', palabras: [
    'MUSEO*', 'MUSEU*', 'EXPO*', 'FUNDACION', 'GALERIA', 'PRADO', 'THYSSEN', 'REINA SOFIA',
  ] },
  { categoria: 'Ocio', subcategoria: 'Deporte', palabras: [
    'DECATHLON', 'PADEL', 'TENIS', 'PLAYTOMIC', 'POLIDEPORTIVO', 'PISCINA', 'FUTBOL', 'CARRERA',
    'CRONO*', 'MYCHIP', 'INSCRIP*', 'TRAIL', 'RUNNING', 'CLUB DE CAMPO', 'OPEN DE TENIS',
    'DEPORTIV*', 'GIMNAS*',
  ] },
  { categoria: 'Ocio', subcategoria: 'Vicio', palabras: [
    'ESTANCO', 'TABAC*', 'EXPENDEDURIA', 'EXPEND*', 'VAPE*',
  ] },

  // ── Súper ──
  { categoria: 'Supermercado', subcategoria: 'LIDL', palabras: ['LIDL'] },
  { categoria: 'Supermercado', subcategoria: 'Mercadona', palabras: ['MERCADONA'] },
  { categoria: 'Supermercado', subcategoria: 'Carrefour', palabras: ['CARREFOUR', 'MARKET ACACIAS'] },
  { categoria: 'Supermercado', subcategoria: 'DIA', palabras: ['DIA', 'MAXI DIA'] },
  { categoria: 'Supermercado', subcategoria: 'AhorraMás', palabras: ['AHORRAMAS', 'AHORRA MAS'] },
  { categoria: 'Supermercado', subcategoria: 'BM', palabras: ['BM'] },
  { categoria: 'Supermercado', palabras: [
    'ALDI', 'ALCAMPO', 'EROSKI', 'SUPECO', 'CONSUM', 'HIPERCOR', 'SPAR', 'COVIRAN', 'CAPRABO',
    'SUPERCOR', 'SUPERMERCADO*', 'SUPERMARKET', 'SUPER', 'HIPER*', 'MINIMARKET', 'MINI MARKET',
    'ALIMENTACION', 'ULTRAMARINOS', 'FRUTERIA', 'CARNICERIA', 'PESCADERIA', 'CHARCUTERIA',
  ] },

  // ── Transporte ──
  { categoria: 'Transporte', subcategoria: 'VTC / Taxi', palabras: [
    'TAXI*', 'CABIFY', 'BOLT', 'UBER', 'FREENOW', 'FREE NOW', 'LICENCIA', 'RADIOTAXI',
  ] },
  { categoria: 'Transporte', subcategoria: 'Mochillo', palabras: [
    'COOLTRA', 'ECOOLTRA', 'YEGO', 'ACCIONA', 'MOTOSHARING', 'LIME', 'DOTT',
  ] },
  { categoria: 'Transporte', subcategoria: 'Abono Transporte', palabras: [
    'CRTM', 'ABONO', 'TARJETA TRANSPORTE',
  ] },
  { categoria: 'Transporte', palabras: [
    'METRO', 'EMT', 'RENFE', 'CERCANIAS', 'OUIGO', 'IRYO', 'ALSA', 'AVANZA', 'BLABLACAR', 'BUS',
  ] },

  // ── Coche ──
  { categoria: 'Coche', subcategoria: 'Gasolina', palabras: [
    'E S', 'EE SS', 'ESTACION DE SERVICIO', 'ESTACION SERVICIO', 'GASOL*', 'CARBURANTE*',
    'REPSOL', 'CEPSA', 'GALP', 'SHELL', 'BP', 'PETRO*', 'BEROIL', 'PLENOIL', 'BALLENOIL',
    'MOLGAS', 'PETRONOR', 'AVIA', 'GNV', 'MOEVE',
  ] },
  { categoria: 'Coche', subcategoria: 'Parking', palabras: [
    'PARK*', 'APARCA*', 'EMPARK', 'SABA', 'TELPARK', 'EASYPARK', 'ZONA AZUL', 'ZONA VERDE',
    'MOVILI*', 'PKMERCAD',
  ] },
  { categoria: 'Coche', subcategoria: 'Peaje', palabras: ['AUTOPISTA*', 'PEAJE*', 'AUDASA', 'AUMAR', 'ABERTIS', 'VIA T'] },
  { categoria: 'Coche', subcategoria: 'Mantenimiento', palabras: [
    'TALLER*', 'NEUMATIC*', 'NORAUTO', 'MIDAS', 'FEU VERT', 'LAVADO', 'LAVACOCHES', 'ITV',
    'CEDIPSA',
  ] },
  { categoria: 'Coche', subcategoria: 'Tasas / Impuestos', palabras: ['DGT', 'MULTA*', 'SANCION*'] },

  // ── Salud ──
  { categoria: 'Salud', subcategoria: 'Medicinas', palabras: ['FARMAC*', 'FCIA', 'PARAFARM*'] },
  { categoria: 'Salud', subcategoria: 'Dentista', palabras: ['DENTAL', 'DENTIST*', 'ORTODON*'] },
  { categoria: 'Salud', subcategoria: 'Fisio', palabras: ['FISIO*', 'OSTEOPAT*', 'PODOLOG*', 'PISADA'] },
  { categoria: 'Salud', subcategoria: 'Suplementación', palabras: ['HSN', 'MYPROTEIN', 'PROZIS', 'NUTRITION'] },
  { categoria: 'Salud', palabras: ['HOSPITAL', 'CLINICA', 'MEDIC*', 'SANITAS', 'ADESLAS', 'OPTICA*', 'LABORATORIO'] },

  // ── Necesidades ──
  { categoria: 'Necesidad', subcategoria: 'Peluquería', palabras: ['PELUQ*', 'BARBER*'] },
  // Ropa de marca o segunda mano: en Capricho. La básica, en Necesidad.
  { categoria: 'Capricho', subcategoria: 'Ropa', palabras: [
    'HUMANA', 'NORTH FACE', 'CARHARTT', 'PATAGONIA', 'VANS', 'LEVIS', 'KARAY', 'VINTAGE',
  ] },
  { categoria: 'Necesidad', subcategoria: 'Ropa', palabras: [
    'SASTRERIA', 'TINTORERIA', 'ARREGLOS',
    'ZARA', 'PRIMARK', 'PULL BEAR', 'BERSHKA', 'MANGO', 'UNIQLO', 'SPRINGFIELD', 'CORTEFIEL',
    'MASSIMO DUTTI', 'JACK JONES', 'LEFTIES', 'ASICS', 'NIKE', 'ADIDAS', 'ZAPATER*', 'CALZADO*',
    'VINTED', 'H M',
  ] },
  { categoria: 'Necesidad', subcategoria: 'Tecnología', palabras: [
    'MEDIAMARKT', 'MEDIA MARKT', 'PCCOMPONENTES', 'FNAC', 'WORTEN', 'XIAOMI', 'APPLE STORE',
    'AMAZON', 'AMZN',
  ] },
  { categoria: 'Necesidad', subcategoria: 'Musica', palabras: ['THOMANN', 'GUITAR*', 'MUSICAL', 'WOODBRASS', 'KEYMUSIC'] },
  { categoria: 'Necesidad', subcategoria: 'Impuestos', palabras: ['IMPUESTO*', 'AEAT', 'HACIENDA', 'TRIBUT*', 'IBI'] },

  // ── Casa ──
  { categoria: 'Casa', subcategoria: 'Cosas de casa', palabras: [
    'IKEA', 'LEROY', 'BRICO*', 'FERRET*', 'DROGUERIA', 'TIGER', 'ACTION', 'BAZAR', 'MENAJE',
    'TECNICO',
  ] },

  // ── Suscripciones ──
  { categoria: 'Servicios', subcategoria: 'Spotify', palabras: ['SPOTIFY*'] },
  { categoria: 'Servicios', subcategoria: 'Claude', palabras: ['ANTHROPIC', 'CLAUDE'] },
  { categoria: 'Servicios', subcategoria: 'Google Drive', palabras: ['GOOGLE ONE'] },
  { categoria: 'Servicios', palabras: [
    'NETFLIX', 'HBO', 'MAX', 'DISNEY*', 'YOUTUBE', 'OPENAI', 'CHATGPT', 'APPLE COM', 'GOOGLE',
    'VODAFONE', 'MOVISTAR', 'ORANGE', 'DIGI', 'PEPEPHONE', 'SIMYO', 'LOWI', 'MASMOVIL',
  ] },

  // ── Regalos ──
  { categoria: 'Regalos', subcategoria: 'Regalos Varios', palabras: ['FLORIST*', 'FLORES', 'JUGUET*', 'REGAL*'] },

  // ── Libros ──
  { categoria: 'Capricho', subcategoria: 'Libros', palabras: ['LIBRER*', 'CASA DEL LIBRO', 'LIBROS'] },

  // ── Viajes (sin subcategoría: el viaje concreto lo pone "Estuve de viaje") ──
  { categoria: 'Viajes', palabras: [
    'RYANAIR', 'VUELING', 'IBERIA', 'AIR EUROPA', 'EASYJET', 'BINTER', 'VOLOTEA', 'AENA',
    'BOOKING', 'AIRBNB', 'HOTEL*', 'HOSTAL', 'HOSTEL', 'CAMPING', 'APARTAMENT*', 'PARADOR*',
    'ALBERGUE',
  ] },
];

/** Palabras que no dicen nada del comercio: no se aprenden como pista. */
export const PALABRAS_VACIAS = new Set([
  'DE', 'DEL', 'LA', 'LAS', 'EL', 'LOS', 'Y', 'EN', 'CON', 'PARA', 'POR', 'THE', 'AND', 'OF',
  'SAN', 'SANTA', 'SANTO', 'MADRID', 'MAD', 'BARCELONA', 'ESPANA', 'SPAIN',
  'S', 'L', 'SL', 'SA', 'SLU', 'SC', 'CB', 'ES', 'EU', 'COM', 'WWW', 'NET', 'ONLINE',
  'COMPRA', 'TARJETA', 'PAGO', 'RECIBO', 'TRANSFER', 'TRANSFERENCIA', 'BIZUM', 'CUOTA',
  'DEVOLUCION', 'FACTURA', 'CALLE', 'AVDA', 'PLAZA', 'CENTRO',
]);
